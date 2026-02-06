"""
Hopscotch IRML - chat-first backend with survey-as-conversation.

Flow:
- /session          -> create session
- /chat/history     -> get full chat history
- /chat/send        -> main chat endpoint (non-streaming)
- /chat/send_stream -> optional streaming endpoint

Chat behaviour:
- If worldview survey is NOT finished:
    * First user message -> assistant explains and asks Q1.
    * Each subsequent user message is treated as the answer to the current
      survey question (must be one of the provided options).
    * After last question, scores worldview and tells the user their band.
- Once survey is finished:
    * All messages go to LLM (Ollama + llama3.1:8b) with:
        - user's worldview band + score
        - retrieved IRML snippets (RAG, FAISS)
    * Assistant responds in a short, friendly, tutor-style format
      and appends a "Quick references from our notes" block that
      the frontend renders as cards.
"""

from __future__ import annotations

from typing import List, Dict, Optional, Literal, Any
from pathlib import Path
from datetime import datetime
import uuid
import re
import json
import logging

import requests
from fastapi import FastAPI, HTTPException, Body, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from auth import hash_password, verify_password, create_access_token, get_current_user
from database import (
    ensure_indexes, find_user_by_email, create_user,
    find_session, create_session_doc, update_session,
    get_sessions_for_user, get_all_student_sessions,
    get_latest_session_for_user,
)

# -------------------------------------------------
# Paths
# -------------------------------------------------
ROOT = Path(__file__).parent
SURVEY_PATH = ROOT / "server" / "config" / "surveys" / "worldview_continuum.json"
PATHS_PATH = ROOT / "server" / "config" / "paths" / "research_paths.json"

DOCS_DIR = ROOT / "server" / "resources"
INDEX_DIR = ROOT / "server" / "index"
INDEX_DIR.mkdir(parents=True, exist_ok=True)
INDEX_PATH = INDEX_DIR / "faiss.index"
META_PATH = INDEX_DIR / "chunks.json"  # keep chunk texts

# -------------------------------------------------
# Optional RAG deps (safe import)
# -------------------------------------------------
RAG_AVAILABLE = True
try:
    import faiss  # type: ignore
    from sentence_transformers import SentenceTransformer  # type: ignore
    from pypdf import PdfReader  # type: ignore
except Exception:
    RAG_AVAILABLE = False
    faiss = None
    SentenceTransformer = None
    PdfReader = None

# Optional pdfminer fallback (used only if installed)
try:
    from pdfminer_high_level import extract_text as pdfminer_extract_text  # type: ignore
except Exception:
    try:
        from pdfminer.high_level import extract_text as pdfminer_extract_text  # type: ignore
    except Exception:
        pdfminer_extract_text = None

EMBED_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
EMBED_DIM = 384  # for the model above

logger = logging.getLogger("uvicorn.error")

# -------------------------------------------------
# Ollama / LLM config
# -------------------------------------------------
OLLAMA_URL = "http://127.0.0.1:11434/api/chat"
LLM_MODEL = "qwen2.5:14b"
LLM_TEMP = 0.4

# runtime globals for RAG
_embedder = None
_faiss_index = None
_chunks: List[Dict[str, Any]] = []  # [{"id": int, "text": str, "source": str}]
_raw_docs_cache: Optional[List[Dict[str, str]]] = None  # for keyword fallback

# runtime global for path config
_paths_config: Dict[str, Any] = {}


def load_paths_config() -> Dict[str, Any]:
    """Load research_paths.json once and cache it."""
    global _paths_config
    if _paths_config:
        return _paths_config
    try:
        with open(PATHS_PATH, "r", encoding="utf-8") as f:
            _paths_config = json.load(f)
    except FileNotFoundError:
        logger.warning("Paths config not found at %s", PATHS_PATH)
        _paths_config = {}
    except json.JSONDecodeError as e:
        logger.warning("Paths config JSON invalid: %s", e)
        _paths_config = {}
    return _paths_config


# -------------------------------------------------
# Worldview continuum bands (total-score based ONLY)
#   You can tweak these ranges; logic just picks the band
#   whose [min, max] contains the final total score.
# -------------------------------------------------
CONTINUUM_BANDS = [
    {"id": "positivist",      "label": "Positivist",      "min": 0,  "max": 4},
    {"id": "post_positivist", "label": "Post Positivist", "min": 5,  "max": 8},
    {"id": "constructivist",  "label": "Constructivist",  "min": 9,  "max": 12},
    {"id": "transformative",  "label": "Transformative",  "min": 13, "max": 19},
    {"id": "pragmatist",      "label": "Pragmatist",      "min": 20, "max": 60},
]


def determine_continuum_band(total: int):
    for band in CONTINUUM_BANDS:
        if band["min"] <= total <= band["max"]:
            return band
    return None


# ============================================================
# Models
# ============================================================
class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class SessionData(BaseModel):
    id: str
    created_at: str
    answers: Dict[str, Any] = Field(default_factory=dict)
    chat: List[ChatTurn] = Field(default_factory=list)

    survey_index: int = 0
    survey_started: bool = False
    survey_done: bool = False

    worldview_band: Optional[str] = None
    worldview_label: Optional[str] = None
    worldview_total: Optional[int] = None

    # arbitrary notes/data per step (1-9)
    step_notes: Dict[str, Any] = Field(default_factory=dict)

    # resolved research path ("quantitative" | "qualitative" | "mixed")
    resolved_path: Optional[str] = None
    # for mixed-methods students: which methodology they chose at Step 4
    chosen_methodology: Optional[str] = None

    # current step the student is working on (1-9)
    active_step: int = 1


class SessionCreateResponse(BaseModel):
    session_id: str


class ChatSendReq(BaseModel):
    session_id: str
    message: str
    active_step: Optional[int] = None


class ChatHistoryResp(BaseModel):
    session_id: str
    history: List[ChatTurn]


# ============================================================
# App + CORS
# ============================================================
app = FastAPI(title="Hopscotch IRML Chat API", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# Helpers: sessions, survey
# ============================================================
def _require_session(session_id: str) -> SessionData:
    """Load a session from MongoDB and return it as a SessionData model."""
    doc = find_session(session_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Session not found")
    chat_turns = [ChatTurn(**t) for t in (doc.get("chat") or [])]
    return SessionData(
        id=doc["session_id"],
        created_at=doc.get("created_at", ""),
        answers=doc.get("answers", {}),
        chat=chat_turns,
        survey_index=doc.get("survey_index", 0),
        survey_started=doc.get("survey_started", False),
        survey_done=doc.get("survey_done", False),
        worldview_band=doc.get("worldview_band"),
        worldview_label=doc.get("worldview_label"),
        worldview_total=doc.get("worldview_total"),
        step_notes=doc.get("step_notes", {}),
        resolved_path=doc.get("resolved_path"),
        chosen_methodology=doc.get("chosen_methodology"),
        active_step=doc.get("active_step", 1),
    )


def _persist_session(sess: SessionData):
    """Write the current SessionData back to MongoDB."""
    update_session(sess.id, {
        "answers": sess.answers,
        "chat": [t.dict() for t in sess.chat],
        "survey_index": sess.survey_index,
        "survey_started": sess.survey_started,
        "survey_done": sess.survey_done,
        "worldview_band": sess.worldview_band,
        "worldview_label": sess.worldview_label,
        "worldview_total": sess.worldview_total,
        "step_notes": sess.step_notes,
        "resolved_path": sess.resolved_path,
        "chosen_methodology": sess.chosen_methodology,
        "active_step": sess.active_step,
    })


def load_survey_from_disk() -> Dict[str, Any]:
    try:
        with open(SURVEY_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        raise HTTPException(
            status_code=500, detail=f"Survey not found at {SURVEY_PATH}"
        )
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=500, detail=f"Survey JSON invalid: {e}"
        )


def compute_total_score(answers, survey_data) -> int:
    """
    YOUR RULE:
    - If user answers Agree → add points from the question's "scoring" map
    - If user answers Disagree → add 0
    """
    qspec_by_id = {q["id"]: q for q in survey_data.get("questions", [])}
    total = 0

    for qid, ans in (answers or {}).items():
        spec = qspec_by_id.get(qid)
        if not spec:
            continue

        # Only "Agree" gives points
        if str(ans).strip().lower() != "agree":
            continue

        scoring_map = spec.get("scoring") or {}
        points_dict = scoring_map.get("Agree") or scoring_map.get("agree") or {}

        if isinstance(points_dict, dict):
            pts = sum(int(v) for v in points_dict.values())
        else:
            try:
                pts = int(points_dict)
            except Exception:
                pts = 0

        total += pts

    return total


WORLDVIEW_DESCRIPTIONS = {
    "positivist": (
        "Positivist: Believes in an objective, knowable reality. Knowledge is gained through "
        "observation, measurement, and empirical testing. Research should be value-free and "
        "generalizable. Favours quantitative methods — experiments, surveys, statistical analysis. "
        "The researcher remains detached and neutral."
    ),
    "post_positivist": (
        "Post-Positivist: Acknowledges that reality exists but can only be imperfectly known. "
        "All observation is fallible and theory-laden. Emphasises falsification, triangulation, "
        "and critical multiplism. Uses primarily quantitative methods but recognises limitations "
        "of absolute objectivity. The researcher strives for objectivity while acknowledging bias."
    ),
    "constructivist": (
        "Constructivist (Interpretivist): Believes reality is socially constructed and that "
        "multiple, equally valid realities exist. Knowledge is co-created between researcher "
        "and participants. Values deep understanding of lived experiences, meaning-making, and "
        "context. Favours qualitative methods — interviews, observations, narrative analysis. "
        "The researcher is an active participant in the research process."
    ),
    "transformative": (
        "Transformative: Centres issues of power, justice, and equity. Reality is shaped by "
        "social, political, cultural, and economic forces. Research should serve marginalised "
        "communities and promote social change. Uses qualitative and participatory methods. "
        "The researcher is an advocate who collaborates with communities."
    ),
    "pragmatist": (
        "Pragmatist: Focuses on 'what works' rather than committing to a single ontology. "
        "The research question drives the choice of methods — quantitative, qualitative, or both. "
        "Values practical consequences, real-world applicability, and problem-solving. "
        "Embraces mixed methods and methodological flexibility. The researcher chooses approaches "
        "based on the nature of the problem being studied."
    ),
}


def _render_worldview_profile(sess: SessionData) -> str:
    """
    Human-readable summary sent to the LLM with rich worldview context.
    """
    if not sess.survey_done:
        return "The student has not yet selected a worldview."
    band = sess.worldview_band or "unknown"
    label = sess.worldview_label or band.replace("_", " ").title()
    desc = WORLDVIEW_DESCRIPTIONS.get(band, "")
    path = sess.resolved_path or "not yet determined"
    parts = [f"Student's worldview: {label}"]
    if sess.worldview_total is not None:
        parts.append(f"Survey score: {sess.worldview_total}")
    parts.append(f"Research methodology pathway: {path}")
    if desc:
        parts.append(f"Worldview description: {desc}")
    return "\n".join(parts)


def _get_chat(sess: SessionData) -> List[ChatTurn]:
    if sess.chat is None:
        sess.chat = []
    return sess.chat


# ============================================================
# RAG (with pdfminer + keyword fallback)
# ============================================================
def _read_txt(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="ignore")


def _read_md(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="ignore")


def _read_pdf(path: Path) -> str:
    txt = ""
    # Try pypdf first
    if PdfReader is not None:
        try:
            reader = PdfReader(str(path))
            txt = "\n".join((page.extract_text() or "") for page in reader.pages)
        except Exception:
            txt = ""
    # Fallback to pdfminer if installed
    if (not txt or not txt.strip()) and pdfminer_extract_text is not None:
        try:
            txt = pdfminer_extract_text(str(path)) or ""
        except Exception:
            txt = ""
    return txt


def _load_all_docs() -> List[Dict[str, str]]:
    docs: List[Dict[str, str]] = []
    if not DOCS_DIR.exists():
        return docs
    for p in sorted(DOCS_DIR.glob("**/*")):
        ext = p.suffix.lower()
        try:
            if ext == ".txt":
                docs.append({"source": p.name, "text": _read_txt(p)})
            elif ext in (".md", ".markdown"):
                docs.append({"source": p.name, "text": _read_md(p)})
            elif ext == ".pdf":
                docs.append({"source": p.name, "text": _read_pdf(p)})
        except Exception:
            continue
    return docs


def _chunk(text: str, max_chars: int = 2400, overlap: int = 400) -> List[str]:
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return []
    step = max(1, max_chars - overlap)
    return [text[i: i + max_chars] for i in range(0, len(text), step)]


def _ensure_embedder():
    global _embedder
    if not RAG_AVAILABLE:
        return
    if _embedder is None:
        _embedder = SentenceTransformer(EMBED_MODEL_NAME)


def _build_index():
    """Build or load FAISS index; if RAG unavailable, no-op."""
    global _faiss_index, _chunks
    if not RAG_AVAILABLE:
        _faiss_index = None
        _chunks = []
        return

    _ensure_embedder()

    if INDEX_PATH.exists() and META_PATH.exists():
        try:
            _faiss_index = faiss.read_index(str(INDEX_PATH))
            _chunks = json.loads(META_PATH.read_text(encoding="utf-8"))
            return
        except Exception as e:
            logger.warning("Failed to load existing index; rebuilding. %s", e)

    docs = _load_all_docs()
    chunks: List[Dict[str, Any]] = []
    for d in docs:
        for piece in _chunk(d["text"]):
            chunks.append({"text": piece, "source": d["source"]})

    if not chunks:
        _faiss_index = faiss.IndexFlatIP(EMBED_DIM) if RAG_AVAILABLE else None
        _chunks = []
        return

    texts = [c["text"] for c in chunks]
    _ensure_embedder()
    vecs = _embedder.encode(
        texts, convert_to_numpy=True, normalize_embeddings=True
    )

    index = faiss.IndexFlatIP(vecs.shape[1])
    index.add(vecs)
    _faiss_index = index

    faiss.write_index(_faiss_index, str(INDEX_PATH))
    META_PATH.write_text(
        json.dumps(
            [{"id": i, "text": c["text"], "source": c["source"]} for i, c in enumerate(chunks)],
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    _chunks = [{"id": i, **c} for i, c in enumerate(chunks)]


def _keyword_fallback(query: str, k: int = 5) -> List[Dict[str, Any]]:
    """Very simple keyword scoring fallback when FAISS/chunks unavailable."""
    global _raw_docs_cache
    if _raw_docs_cache is None:
        _raw_docs_cache = _load_all_docs()
    q = (query or "").strip().lower()
    if not q:
        return []
    scored: List[Dict[str, Any]] = []
    for d in _raw_docs_cache:
        text = d.get("text") or ""
        if not text:
            continue
        tl = text.lower()
        occ = tl.count(q)
        score = occ + (1.0 if q in tl else 0.0)
        if score > 0:
            scored.append(
                {
                    "text": text[:2000],
                    "source": d["source"],
                    "score": float(score),
                }
            )
    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:k]


def _retrieve(query: str, k: int = 5) -> List[Dict[str, Any]]:
    """Try vector search; if nothing, use keyword fallback."""
    if RAG_AVAILABLE and _faiss_index is not None and _chunks:
        _ensure_embedder()
        try:
            qv = _embedder.encode(
                [query], convert_to_numpy=True, normalize_embeddings=True
            )
            D, I = _faiss_index.search(qv, k)
            out = []
            for idx, score in zip(I[0], D[0]):
                idx = int(idx)
                if 0 <= idx < len(_chunks):
                    ch = _chunks[idx]
                    out.append(
                        {
                            "text": ch["text"],
                            "source": ch["source"],
                            "score": float(score),
                        }
                    )
            if out:
                return out
        except Exception as e:
            logger.warning(
                "Vector retrieval failed; falling back to keywords. %s", e
            )
    return _keyword_fallback(query, k=k)


@app.on_event("startup")
def _startup():
    ensure_indexes()
    _build_index()
    load_paths_config()


# ============================================================
# LLM call (Ollama)
# ============================================================

def _get_step_llm_guidance(sess: SessionData, active_step: Optional[int]) -> Optional[str]:
    """Resolve the LLM guidance string for the given step from the paths config."""
    if not active_step or active_step < 4:
        return None
    paths_cfg = load_paths_config()
    resolved = sess.resolved_path
    if not resolved:
        return None

    all_paths = paths_cfg.get("paths", {})
    path_data = all_paths.get(resolved, {})
    step_cfg = path_data.get("steps", {}).get(str(active_step), {})

    # Handle mixed-methods inheritance for steps 5-9
    if resolved == "mixed" and active_step >= 5 and step_cfg.get("inherits_from_chosen_methodology"):
        chosen = sess.chosen_methodology
        if not chosen:
            return "The student has not yet chosen their primary methodology in Step 4."
        inherited = all_paths.get(chosen, {}).get("steps", {}).get(str(active_step), {})
        guidance = inherited.get("llm_guidance", "")
        addendum = step_cfg.get("llm_guidance_addendum", "")
        if addendum:
            guidance = f"{guidance}\n{addendum}" if guidance else addendum
        return guidance or None

    return step_cfg.get("llm_guidance")


def build_ollama_payload(worldview_profile, step_context, user_msg, passages,
                         stream=False, active_step=None, step_llm_guidance=None,
                         chat_history=None):
    """
    Shared helper to build the Ollama chat payload.
    Set stream=True when you want chunked responses, False for normal JSON.
    """
    ctx_blocks = []
    for i, p in enumerate(passages):
        ctx_blocks.append(
            f"[{i+1}] Source: {p['source']}\n{p['text'][:800]}"
        )
    ctx_text = "\n\n".join(ctx_blocks) if ctx_blocks else "No matching passages."

    system_msg = (
        "You are a knowledgeable, supportive research-methods tutor embedded in the "
        "Hopscotch IRML (Introductory Research Methods Learning) platform. You help "
        "students scaffold their research design through a 9-step process.\n\n"

        "THE 9 STEPS:\n"
        "1. Who am I as a researcher? — Identify your worldview/paradigm (positivist, "
        "post-positivist, constructivist, transformative, pragmatist). Your worldview "
        "shapes your ontology (what is real), epistemology (how we know), axiology "
        "(role of values), and methodology (how we study).\n"
        "2. What am I wondering about? — Define your research topic and goals "
        "(personal, practical, intellectual).\n"
        "3. What do I already know? — Review topical research (prior studies) and "
        "theoretical frameworks that support your study.\n"
        "4. How will I study it? — Choose a research design/methodology aligned with "
        "your worldview (quantitative, qualitative, or mixed).\n"
        "5. What is my research question? — Formulate your research question "
        "(quantitative: hypothesis; qualitative: open-ended central issue).\n"
        "6. What data will I collect? — Select data collection methods that fit your "
        "design.\n"
        "7. How will I analyze the data? — Choose appropriate analysis techniques.\n"
        "8. How will I ensure trustworthiness? — Address validity/reliability "
        "(quantitative) or credibility/transferability/dependability/confirmability "
        "(qualitative, Lincoln & Guba).\n"
        "9. How will I be ethical? — Plan for IRB, Belmont principles (respect, "
        "beneficence, justice), informed consent, and confidentiality.\n\n"

        "YOUR APPROACH:\n"
        "- Be substantive: explain concepts, give examples, and connect ideas to the "
        "student's specific worldview and topic. Do NOT just ask questions back.\n"
        "- When explaining a worldview, discuss its ontology, epistemology, axiology, "
        "and methodology implications with concrete examples.\n"
        "- Lead with helpful content first, then ask 1-2 follow-up questions to "
        "deepen understanding.\n"
        "- Use the student's previous step inputs (topic, goals, worldview, etc.) "
        "to give personalised guidance rather than generic advice.\n"
        "- Reference specific methodologies, frameworks, and scholars when relevant.\n"
        "- Use a warm, encouraging tone — the student may be new to research.\n"
        "- Keep responses focused but thorough (2-4 paragraphs typically).\n"
        "- At the end, append '**Quick references from our notes:**' with 2-5 "
        "bullets sourced from the IRML resource snippets provided.\n"
    )

    # Inject step-specific guidance
    if active_step:
        system_msg += f"\nThe student is currently working on Step {active_step}.\n"
        if step_llm_guidance:
            system_msg += f"\nStep-specific instructions:\n{step_llm_guidance}\n"

    context_msg = (
        f"Student context:\n{worldview_profile}\n\n"
        f"Step inputs:\n{step_context}\n\n"
        f"IRML resource snippets:\n{ctx_text}"
    )

    # Build messages: system + context + conversation history + latest user msg
    messages = [
        {"role": "system", "content": system_msg},
        {"role": "system", "content": context_msg},
    ]

    # Include recent conversation history (last 20 turns to stay within context)
    if chat_history:
        recent = chat_history[-20:]
        for turn in recent:
            # Skip the very last user message — we append it separately below
            if turn is recent[-1] and turn.role == "user" and turn.content == user_msg:
                continue
            messages.append({"role": turn.role, "content": turn.content})

    messages.append({"role": "user", "content": user_msg})

    return {
        "model": LLM_MODEL,
        "stream": stream,
        "options": {"temperature": LLM_TEMP},
        "messages": messages,
    }


def call_llm(worldview_profile: str, step_context: str, user_msg: str,
             passages: List[Dict[str, Any]],
             active_step: Optional[int] = None,
             step_llm_guidance: Optional[str] = None,
             chat_history=None) -> str:

    payload = build_ollama_payload(
        worldview_profile, step_context, user_msg, passages,
        stream=False, active_step=active_step, step_llm_guidance=step_llm_guidance,
        chat_history=chat_history,
    )
    

    try:
        resp = requests.post(OLLAMA_URL, json=payload, timeout=120)
        resp.raise_for_status()
        data = resp.json()
        # Ollama /api/chat returns {"message": {"role":"assistant","content":"..."}}
        return (
            data.get("message", {}).get("content", "").strip()
            or "I couldn't generate a response."
        )
    except Exception as e:
        logger.exception("LLM call failed: %s", e)
        return (
            "I ran into an issue calling the language model. "
            "Please try again or check the backend logs."
        )


# ============================================================
# Auth endpoints
# ============================================================

class RegisterReq(BaseModel):
    email: str
    password: str
    name: str
    role: str  # "student" or "teacher"


class LoginReq(BaseModel):
    email: str
    password: str


class AuthResp(BaseModel):
    token: str
    email: str
    name: str
    role: str


@app.post("/auth/register", response_model=AuthResp)
def register(req: RegisterReq):
    if req.role not in ("student", "teacher"):
        raise HTTPException(status_code=400, detail="Role must be 'student' or 'teacher'")
    if find_user_by_email(req.email):
        raise HTTPException(status_code=409, detail="Email already registered")
    pw_hash = hash_password(req.password)
    create_user(req.email, pw_hash, req.role, req.name)
    token = create_access_token({"sub": req.email})
    return AuthResp(token=token, email=req.email, name=req.name, role=req.role)


@app.post("/auth/login", response_model=AuthResp)
def login(req: LoginReq):
    user = find_user_by_email(req.email)
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token({"sub": req.email})
    return AuthResp(token=token, email=req.email, name=user["name"], role=user["role"])


@app.get("/auth/me")
def get_me(user: dict = Depends(get_current_user)):
    return {"email": user["email"], "name": user["name"], "role": user["role"]}


# ============================================================
# Routes
# ============================================================
@app.post("/session", response_model=SessionCreateResponse)
def create_session(user: dict = Depends(get_current_user)):
    sid = str(uuid.uuid4())
    user_id = str(user["_id"])
    create_session_doc(sid, user_id)
    return SessionCreateResponse(session_id=sid)


class SessionResumeResponse(BaseModel):
    session_id: Optional[str] = None
    active_step: int = 1
    found: bool = False


@app.get("/session/resume", response_model=SessionResumeResponse)
def resume_session(user: dict = Depends(get_current_user)):
    """Return the user's most recent session if one exists."""
    user_id = str(user["_id"])
    doc = get_latest_session_for_user(user_id)
    if not doc:
        return SessionResumeResponse(found=False)
    return SessionResumeResponse(
        session_id=doc["session_id"],
        active_step=doc.get("active_step", 1),
        found=True,
    )


class UpdateStepReq(BaseModel):
    session_id: str
    active_step: int


@app.post("/session/update_step")
def update_active_step(req: UpdateStepReq, user: dict = Depends(get_current_user)):
    """Save the student's current active step to the session."""
    sess = _require_session(req.session_id)
    sess.active_step = req.active_step
    _persist_session(sess)
    return {"ok": True}


@app.get("/chat/history", response_model=ChatHistoryResp)
def get_chat_history(session_id: str = Query(...), user: dict = Depends(get_current_user)):
    sess = _require_session(session_id)
    history = _get_chat(sess)
    return ChatHistoryResp(session_id=session_id, history=history)

class StepDataReq(BaseModel):
    session_id: str
    step: int
    data: Dict[str, Any]


class StepDataResp(BaseModel):
    session_id: str
    step: int
    data: Dict[str, Any]


@app.post("/step/save", response_model=StepDataResp)
def save_step_data(req: StepDataReq, user: dict = Depends(get_current_user)):
    sess = _require_session(req.session_id)
    key = str(req.step)
    sess.step_notes[key] = req.data or {}
    _persist_session(sess)
    return StepDataResp(session_id=sess.id, step=req.step, data=sess.step_notes[key])


@app.get("/step/get", response_model=StepDataResp)
def get_step_data(
    session_id: str = Query(...),
    step: int = Query(...),
    user: dict = Depends(get_current_user),
):
    sess = _require_session(session_id)
    key = str(step)
    data = sess.step_notes.get(key, {})
    return StepDataResp(session_id=sess.id, step=step, data=data)

class WorldviewSetReq(BaseModel):
    session_id: str
    worldview_id: str  # "positivist" | "post_positivist" | "constructivist" | "transformative" | "pragmatist"

class WorldviewSetResp(BaseModel):
    session_id: str
    worldview_id: str
    worldview_label: str


WORLDVIEW_LABELS = {
    "positivist": "Positivist",
    "post_positivist": "Post Positivist",
    "constructivist": "Constructivist",
    "transformative": "Transformative",
    "pragmatist": "Pragmatist",
}


@app.post("/worldview/set", response_model=WorldviewSetResp)
def set_worldview(req: WorldviewSetReq, user: dict = Depends(get_current_user)):
    sess = _require_session(req.session_id)

    wid = (req.worldview_id or "").strip()
    if wid not in WORLDVIEW_LABELS:
        raise HTTPException(status_code=400, detail="Invalid worldview_id")

    # IMPORTANT: disable survey mode completely for this session
    sess.survey_started = True
    sess.survey_done = True
    sess.survey_index = 0
    sess.answers = {}

    # Set worldview on session (what the LLM will see)
    sess.worldview_band = wid
    sess.worldview_label = WORLDVIEW_LABELS[wid]
    sess.worldview_total = None

    # Also store into step 1 notes so you can use it later
    sess.step_notes["1"] = {**(sess.step_notes.get("1") or {}), "worldview_id": wid}

    # Resolve research path from worldview
    paths_cfg = load_paths_config()
    wv_to_path = paths_cfg.get("worldview_to_path", {})
    sess.resolved_path = wv_to_path.get(wid, None)

    _persist_session(sess)
    return WorldviewSetResp(
        session_id=sess.id,
        worldview_id=wid,
        worldview_label=sess.worldview_label,
    )

# ---------------- Step config + methodology endpoints ----------------

class StepConfigResp(BaseModel):
    step: int
    path: Optional[str] = None
    title: str = ""
    directions: str = ""
    field_type: Optional[str] = None
    field_key: Optional[str] = None
    options: Optional[List[Dict[str, Any]]] = None
    fields: Optional[List[Dict[str, Any]]] = None
    llm_guidance: Optional[str] = None
    quantitative_options: Optional[List[Dict[str, Any]]] = None
    qualitative_options: Optional[List[Dict[str, Any]]] = None


@app.get("/step/config", response_model=StepConfigResp)
def get_step_config(
    session_id: str = Query(...),
    step: int = Query(...),
    user: dict = Depends(get_current_user),
):
    """Return the path-resolved configuration for a given step."""
    sess = _require_session(session_id)
    paths_cfg = load_paths_config()

    # Steps 1-3 are handled entirely by the frontend
    if step <= 3:
        return StepConfigResp(step=step)

    resolved = sess.resolved_path
    if not resolved:
        return StepConfigResp(
            step=step,
            title=f"Step {step}",
            directions="Please complete Step 1 first and select your worldview.",
        )

    all_paths = paths_cfg.get("paths", {})
    path_data = all_paths.get(resolved, {})
    step_key = str(step)
    step_cfg = path_data.get("steps", {}).get(step_key, {})

    # Handle mixed-methods inheritance for Steps 5-9
    if resolved == "mixed" and step >= 5 and step_cfg.get("inherits_from_chosen_methodology"):
        chosen = sess.chosen_methodology
        if not chosen:
            return StepConfigResp(
                step=step,
                path="mixed",
                title=f"Step {step}",
                directions="Please complete Step 4 first and choose your primary methodology.",
            )
        # Resolve from the chosen methodology's path
        inherited_cfg = all_paths.get(chosen, {}).get("steps", {}).get(step_key, {})
        # Merge the llm_guidance_addendum from the mixed step config
        guidance = inherited_cfg.get("llm_guidance", "")
        addendum = step_cfg.get("llm_guidance_addendum", "")
        if addendum:
            guidance = f"{guidance}\n{addendum}" if guidance else addendum
        return StepConfigResp(
            step=step,
            path="mixed",
            title=inherited_cfg.get("title", f"Step {step}"),
            directions=inherited_cfg.get("directions", ""),
            field_type=inherited_cfg.get("field_type"),
            field_key=inherited_cfg.get("field_key"),
            options=inherited_cfg.get("options"),
            fields=inherited_cfg.get("fields"),
            llm_guidance=guidance or None,
        )

    # For mixed Step 4: include both option sets
    quant_opts = None
    qual_opts = None
    if resolved == "mixed" and step == 4:
        quant_opts = (
            all_paths.get("quantitative", {})
            .get("steps", {}).get("4", {}).get("options")
        )
        qual_opts = (
            all_paths.get("qualitative", {})
            .get("steps", {}).get("4", {}).get("options")
        )

    return StepConfigResp(
        step=step,
        path=resolved,
        title=step_cfg.get("title", f"Step {step}"),
        directions=step_cfg.get("directions", ""),
        field_type=step_cfg.get("field_type"),
        field_key=step_cfg.get("field_key"),
        options=step_cfg.get("options"),
        fields=step_cfg.get("fields"),
        llm_guidance=step_cfg.get("llm_guidance"),
        quantitative_options=quant_opts,
        qualitative_options=qual_opts,
    )


class SetMethodologyReq(BaseModel):
    session_id: str
    methodology: str  # "quantitative" or "qualitative"


class SetMethodologyResp(BaseModel):
    session_id: str
    chosen_methodology: str


@app.post("/step/set_methodology", response_model=SetMethodologyResp)
def set_methodology(req: SetMethodologyReq, user: dict = Depends(get_current_user)):
    """For mixed-methods students: set the primary methodology chosen at Step 4."""
    sess = _require_session(req.session_id)
    if sess.resolved_path != "mixed":
        raise HTTPException(
            status_code=400,
            detail="Only mixed-methods (pragmatist) students use this endpoint.",
        )
    meth = (req.methodology or "").strip().lower()
    if meth not in ("quantitative", "qualitative"):
        raise HTTPException(
            status_code=400,
            detail="methodology must be 'quantitative' or 'qualitative'",
        )

    # If changing from a previous choice, clear steps 5-9 data
    prev = sess.chosen_methodology
    if prev and prev != meth:
        for s in range(5, 10):
            sess.step_notes.pop(str(s), None)

    sess.chosen_methodology = meth
    s4 = sess.step_notes.get("4") or {}
    s4["chosen_methodology"] = meth
    sess.step_notes["4"] = s4

    _persist_session(sess)
    return SetMethodologyResp(session_id=sess.id, chosen_methodology=meth)


# ---------------- Survey-as-conversation logic ----------------

def _render_step_context(sess: SessionData) -> str:
    """Build a comprehensive context string from all step inputs (1-9)."""
    lines = []
    notes = sess.step_notes or {}

    # Step 1: worldview (field saved as "worldview_id" by /worldview/set)
    s1 = notes.get("1") or {}
    worldview_id = (s1.get("worldview_id") or s1.get("worldview") or "").strip()
    if worldview_id:
        label = WORLDVIEW_LABELS.get(worldview_id, worldview_id)
        lines.append(f"Step 1 worldview: {label}")

    # Step 2: topic and goals
    s2 = notes.get("2") or {}
    if s2.get("topic"):
        lines.append(f"Step 2 research topic: {s2['topic']}")
    if s2.get("goals"):
        lines.append(f"Step 2 research goals: {s2['goals']}")

    # Step 3: literature review
    s3 = notes.get("3") or {}
    if s3.get("topicalResearch"):
        lines.append(f"Step 3 topical research: {s3['topicalResearch']}")
    if s3.get("theoreticalFrameworks"):
        lines.append(f"Step 3 theoretical frameworks: {s3['theoreticalFrameworks']}")

    # Resolved path and methodology (if set)
    if sess.resolved_path:
        lines.append(f"Research path: {sess.resolved_path}")
    if sess.chosen_methodology:
        lines.append(f"Chosen methodology (Step 4): {sess.chosen_methodology}")

    # Steps 4-9: read whatever structured data was saved
    for step_num in range(4, 10):
        sn = notes.get(str(step_num)) or {}
        for key, val in sn.items():
            if not val:
                continue
            if isinstance(val, list):
                val_str = ", ".join(str(v) for v in val)
            else:
                val_str = str(val)
            # Truncate very long values to keep context manageable
            if len(val_str) > 300:
                val_str = val_str[:300] + "..."
            lines.append(f"Step {step_num} {key}: {val_str}")

    return "\n".join(lines) if lines else "No step inputs saved yet."

def _handle_survey_turn(
    sess: SessionData,
    user_msg: str,
    history: List[ChatTurn],
) -> Optional[ChatHistoryResp]:
    """
    Chat-driven worldview survey:

    - If survey not started yet, send intro + Question 1.
    - If survey in progress, treat the user's message as the answer to the
      current question, score it, and either:
        * ask the next question, or
        * finish the survey and send a summary.
    - If survey already done, return None so caller can go to normal LLM chat.
    """
    data = load_survey_from_disk()
    questions = data.get("questions", [])
    total_q = len(questions)

    if total_q == 0:
        # No survey configured – just tell the user and let normal chat handle it
        history.append(
            ChatTurn(
                role="assistant",
                content=(
                    "I don’t have any survey questions configured right now, "
                    "but I can still talk about paradigms with you."
                ),
            )
        )
        return ChatHistoryResp(session_id=sess.id, history=history)

    # 1) Start survey (only once)
    if not sess.survey_started:
        sess.survey_started = True
        sess.survey_index = 0
        qspec = questions[0]
        opts = qspec.get("options") or []

        intro = (
            "Great, let's start by understanding your **research worldview**. "
            "I'll ask you a short series of survey questions. For each one, reply using "
            "exactly one of the listed options so I can score it correctly.\n\n"
        )
        body = f"**Question 1/{total_q}:** {qspec.get('text', '')}\n\n"
        if opts:
            body += "Please respond with exactly ONE of the following options:\n\n"
            for o in opts:
                body += f"- {o}\n"

        history.append(ChatTurn(role="assistant", content=intro + body))
        return ChatHistoryResp(session_id=sess.id, history=history)

    # 2) If survey already finished → signal caller to go to LLM mode
    if sess.survey_done:
        return None

    # 3) We are mid-survey: treat this message as the answer to the current question
    if sess.survey_index >= total_q:
        # Safety guard: mark as done and let caller go to LLM
        sess.survey_done = True
        return None

    current_spec = questions[sess.survey_index]
    qid = current_spec.get("id") or f"q{sess.survey_index + 1}"
    opts = current_spec.get("options") or []

    # ---- normalize answer + options (case-insensitive) ----
    answer_raw = user_msg.strip()
    answer_norm = answer_raw.lower()
    canon_answer = answer_raw  # the value we actually store

    if opts:
        norm_map = {opt.strip().lower(): opt for opt in opts}

        if answer_norm in norm_map:
            canon_answer = norm_map[answer_norm]
        else:
            # try stripping leading bullet, e.g. "• Agree"
            m = re.match(r"^[\-\u2022\*]\s*(.+)$", answer_raw)
            if m:
                cand = m.group(1).strip().lower()
                if cand in norm_map:
                    canon_answer = norm_map[cand]
                else:
                    # still invalid
                    warn = (
                        "Thanks for your reply! For scoring, please pick **one** of the listed options "
                        "(you can also click the quick buttons below).\n\n"
                        f"**Question {sess.survey_index + 1}/{total_q}:** {current_spec.get('text', '')}\n\n"
                        "Options:\n- " + "\n- ".join(opts)
                    )
                    history.append(ChatTurn(role="assistant", content=warn))
                    return ChatHistoryResp(session_id=sess.id, history=history)
            else:
                # not a known option
                warn = (
                    "Thanks for your reply! For scoring, please pick **one** of the listed options "
                    "(you can also click the quick buttons below).\n\n"
                    f"**Question {sess.survey_index + 1}/{total_q}:** {current_spec.get('text', '')}\n\n"
                    "Options:\n- " + "\n- ".join(opts)
                )
                history.append(ChatTurn(role="assistant", content=warn))
                return ChatHistoryResp(session_id=sess.id, history=history)

    # Store canonical option (exactly matches JSON key so scoring works)
    sess.answers[qid] = canon_answer

    # Advance index
    sess.survey_index += 1

    # 4) If that was the last question → compute scores & summary
    if sess.survey_index >= total_q:
        sess.survey_done = True

        data = load_survey_from_disk()
        total_score = compute_total_score(sess.answers, data)
        sess.worldview_total = total_score

        band = determine_continuum_band(total_score)
        if band:
            sess.worldview_band = band["id"]
            sess.worldview_label = band["label"]
        else:
            sess.worldview_band = None
            sess.worldview_label = "Unclassified"

        summary = (
            f"Thanks — that’s all **{total_q}** questions.\n\n"
            f"Based on your answers, your overall **worldview band** is "
            f"**{sess.worldview_label}** (total score = {total_score}).\n\n"
            "You can now ask me questions like:\n"
            "- *What does this paradigm assume about reality and knowledge?*\n"
            "- *What methods fit this worldview best?*\n"
            "- *How would a different paradigm look for my topic?*\n"
        )

        history.append(ChatTurn(role="assistant", content=summary))
        return ChatHistoryResp(session_id=sess.id, history=history)

    # 5) Otherwise send the NEXT question
    next_spec = questions[sess.survey_index]
    n_opts = next_spec.get("options") or []

    body = f"**Question {sess.survey_index + 1}/{total_q}:** {next_spec.get('text', '')}\n\n"
    if n_opts:
        body += "Please respond with exactly ONE of the following options:\n\n"
        for o in n_opts:
            body += f"- {o}\n"

    history.append(ChatTurn(role="assistant", content=body))
    return ChatHistoryResp(session_id=sess.id, history=history)


# ---------------- Chat main endpoint (non-streaming) ----------------
@app.post("/chat/send", response_model=ChatHistoryResp)
def chat_send(req: ChatSendReq = Body(...), user: dict = Depends(get_current_user)):
    sess = _require_session(req.session_id)
    history = _get_chat(sess)

    user_msg = (req.message or "").strip()
    if not user_msg:
        return ChatHistoryResp(session_id=req.session_id, history=history)

    # store user turn
    history.append(ChatTurn(role="user", content=user_msg))

    # Only run survey if user has NOT already set worldview
    if not sess.survey_done and not sess.worldview_label:
        survey_resp = _handle_survey_turn(sess, user_msg, history)
        if survey_resp is not None:
            _persist_session(sess)
            return survey_resp

    # 2) Otherwise, normal LLM + RAG chat using worldview and resources
    worldview_profile = _render_worldview_profile(sess)
    step_context = _render_step_context(sess)
    passages = _retrieve(user_msg, k=5)
    step_llm_guidance = _get_step_llm_guidance(sess, req.active_step)
    answer = call_llm(
        worldview_profile, step_context, user_msg, passages,
        active_step=req.active_step, step_llm_guidance=step_llm_guidance,
        chat_history=history,
    )

    history.append(ChatTurn(role="assistant", content=answer))
    _persist_session(sess)
    return ChatHistoryResp(session_id=req.session_id, history=history)


# ---------------- Optional streaming endpoint ----------------
@app.post("/chat/send_stream")
def chat_send_stream(req: ChatSendReq = Body(...), user: dict = Depends(get_current_user)):
    """
    Streaming variant of /chat/send.

    - If the worldview survey is still running, we just reuse the normal survey
      logic and return JSON (no streaming).
    - Once the survey is done, we stream the LLM's answer chunk-by-chunk.
    """
    sess = _require_session(req.session_id)
    history = _get_chat(sess)

    user_msg = (req.message or "").strip()
    if not user_msg:
        raise HTTPException(status_code=400, detail="Empty message")

    # store user turn
    history.append(ChatTurn(role="user", content=user_msg))

    # Only run survey if user has NOT already set worldview
    if not sess.survey_done and not sess.worldview_label:
        survey_resp = _handle_survey_turn(sess, user_msg, history)
        if survey_resp is not None:
            _persist_session(sess)
            return survey_resp

    # 2) Survey is done -> stream LLM answer
    worldview_profile = _render_worldview_profile(sess)
    step_context = _render_step_context(sess)
    passages = _retrieve(user_msg, k=5)
    step_llm_guidance = _get_step_llm_guidance(sess, req.active_step)
    payload = build_ollama_payload(
        worldview_profile, step_context, user_msg, passages,
        stream=True, active_step=req.active_step, step_llm_guidance=step_llm_guidance,
        chat_history=history,
    )

    # Capture session_id for persistence inside the generator
    session_id = sess.id

    def event_stream():
        assistant_text_parts: List[str] = []
        try:
            with requests.post(OLLAMA_URL, json=payload, stream=True) as resp:
                resp.raise_for_status()
                for line in resp.iter_lines(decode_unicode=True):
                    if not line:
                        continue
                    try:
                        data = json.loads(line)
                    except Exception:
                        continue

                    delta = data.get("message", {}).get("content", "")
                    if not delta:
                        continue

                    assistant_text_parts.append(delta)
                    yield delta
        except Exception as e:
            logger.exception("LLM stream failed: %s", e)
            yield "\n[Error streaming from model]\n"

        # When streaming is done, persist the full assistant message
        full_text = "".join(assistant_text_parts).strip()
        if full_text:
            history.append(ChatTurn(role="assistant", content=full_text))
        _persist_session(sess)

    return StreamingResponse(event_stream(), media_type="text/plain")


# ---------------- Teacher dashboard ----------------

@app.get("/teacher/students")
def teacher_students(user: dict = Depends(get_current_user)):
    if user.get("role") != "teacher":
        raise HTTPException(status_code=403, detail="Teachers only")
    sessions = get_all_student_sessions()
    # Serialize ObjectId fields for JSON
    for s in sessions:
        s.pop("_id", None)
        s.pop("user_oid", None)
        if "user" in s:
            s["user"].pop("_id", None)
    return {"sessions": sessions}


# ---------------- RAG utilities ----------------
@app.get("/rag/status")
def rag_status():
    return {
        "RAG_AVAILABLE": RAG_AVAILABLE,
        "docs_dir": str(DOCS_DIR),
        "index_path_exists": INDEX_PATH.exists(),
        "meta_path_exists": META_PATH.exists(),
        "num_chunks": len(_chunks),
    }


@app.post("/rag/reindex")
def rag_reindex():
    try:
        if INDEX_PATH.exists():
            INDEX_PATH.unlink()
        if META_PATH.exists():
            META_PATH.unlink()
    except Exception as e:
        logger.exception("Failed clearing index files: %s", e)
    _build_index()
    return {"ok": True, "num_chunks": len(_chunks)}
