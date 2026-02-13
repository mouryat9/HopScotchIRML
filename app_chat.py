"""
Hopscotch IRML - chat backend with LLM + RAG.

Flow:
- /session          -> create session
- /chat/history     -> get full chat history
- /chat/send        -> main chat endpoint (non-streaming)
- /chat/send_stream -> streaming endpoint

Chat behaviour:
- Worldview is selected via Step 1 dropdown (/worldview/set).
- All messages go to LLM (Ollama) with:
    - user's worldview band
    - retrieved IRML snippets (RAG, FAISS)
    - step-specific guidance
- Assistant responds in a short, friendly, tutor-style format.
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
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel, Field
from jinja2 import Template
from weasyprint import HTML

import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from auth import (
    hash_password, verify_password, create_access_token, get_current_user,
    create_password_reset_token, decode_token,
)
from database import (
    ensure_indexes, find_user_by_email, find_user_by_username,
    create_user, create_classroom_student, update_user_password,
    find_session, create_session_doc, update_session,
    get_sessions_for_user,
    get_latest_session_for_user,
    get_session_summaries_for_user,
    create_class_doc, find_class_by_code, get_classes_for_teacher,
    get_students_in_class, get_all_student_sessions_for_teacher,
)

# -------------------------------------------------
# Paths
# -------------------------------------------------
ROOT = Path(__file__).parent
PATHS_PATH = ROOT / "server" / "config" / "paths" / "research_paths.json"
TEMPLATE_DIR = ROOT / "server" / "templates"

# -------------------------------------------------
# Email / SMTP configuration (password reset)
# -------------------------------------------------
SMTP_HOST = os.environ.get("HOPSCOTCH_SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("HOPSCOTCH_SMTP_PORT", "587"))
SMTP_USER = os.environ.get("HOPSCOTCH_SMTP_USER", "")
SMTP_PASS = os.environ.get("HOPSCOTCH_SMTP_PASS", "")
SMTP_FROM = os.environ.get("HOPSCOTCH_SMTP_FROM", "") or SMTP_USER
FRONTEND_URL = os.environ.get("HOPSCOTCH_FRONTEND_URL", "https://hopscotchai.us")

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
# ============================================================
# Models
# ============================================================
class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str
    step: Optional[int] = None


class SessionData(BaseModel):
    id: str
    created_at: str
    chat: List[ChatTurn] = Field(default_factory=list)

    worldview_band: Optional[str] = None
    worldview_label: Optional[str] = None

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
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "https://hopscotchai.us"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# Helpers: sessions
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
        chat=chat_turns,
        worldview_band=doc.get("worldview_band"),
        worldview_label=doc.get("worldview_label"),
        step_notes=doc.get("step_notes", {}),
        resolved_path=doc.get("resolved_path"),
        chosen_methodology=doc.get("chosen_methodology"),
        active_step=doc.get("active_step", 1),
    )


def _persist_session(sess: SessionData):
    """Write the current SessionData back to MongoDB."""
    update_session(sess.id, {
        "chat": [t.dict() for t in sess.chat],
        "worldview_band": sess.worldview_band,
        "worldview_label": sess.worldview_label,
        "step_notes": sess.step_notes,
        "resolved_path": sess.resolved_path,
        "chosen_methodology": sess.chosen_methodology,
        "active_step": sess.active_step,
    })



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
    if not sess.worldview_band:
        return "The student has not yet selected a worldview."
    band = sess.worldview_band
    label = sess.worldview_label or band.replace("_", " ").title()
    desc = WORLDVIEW_DESCRIPTIONS.get(band, "")
    path = sess.resolved_path or "not yet determined"
    parts = [f"Student's worldview: {label}"]
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
    # Pre-warm the LLM so the first chat request doesn't cold-start
    _warm_ollama_model()


def _warm_ollama_model():
    """Send a tiny request to Ollama to pre-load the model into memory."""
    try:
        logger.info("Pre-warming Ollama model %s ...", LLM_MODEL)
        resp = requests.post(OLLAMA_URL, json={
            "model": LLM_MODEL,
            "messages": [{"role": "user", "content": "hi"}],
            "stream": False,
            "options": {"num_predict": 1},
        }, timeout=300)
        resp.raise_for_status()
        logger.info("Ollama model %s is warm and ready.", LLM_MODEL)
    except Exception as e:
        logger.warning("Failed to pre-warm Ollama model: %s", e)


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
    email: Optional[str] = None
    username: Optional[str] = None
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
    return {
        "email": user.get("email"),
        "username": user.get("username"),
        "name": user["name"],
        "role": user["role"],
    }


# ---------- Password reset ----------

class ForgotPasswordReq(BaseModel):
    email: str

class ResetPasswordReq(BaseModel):
    token: str
    new_password: str


def _send_reset_email(to_email: str, reset_token: str):
    """Send a password-reset link via SMTP. Fails silently to avoid leaking user existence."""
    if not SMTP_USER or not SMTP_PASS:
        logger.warning("SMTP not configured — cannot send reset email")
        return

    reset_link = f"{FRONTEND_URL}?reset_token={reset_token}"

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Hopscotch - Reset Your Password"
    msg["From"] = SMTP_FROM
    msg["To"] = to_email

    text_body = (
        f"You requested a password reset for your Hopscotch account.\n\n"
        f"Click this link to set a new password (valid for 30 minutes):\n"
        f"{reset_link}\n\n"
        f"If you did not request this, you can safely ignore this email."
    )

    html_body = f"""\
<div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
    <h2 style="color: #2B5EA7;">Hopscotch Password Reset</h2>
    <p>You requested a password reset for your Hopscotch account.</p>
    <p>
        <a href="{reset_link}"
           style="display: inline-block; padding: 12px 24px; background: #2B5EA7;
                  color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">
            Reset Password
        </a>
    </p>
    <p style="font-size: 0.85rem; color: #666;">
        This link is valid for 30 minutes. If you did not request this, ignore this email.
    </p>
</div>"""

    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(SMTP_FROM, to_email, msg.as_string())
        logger.info(f"Reset email sent to {to_email}")
    except Exception as e:
        logger.error(f"Failed to send reset email: {e}")


@app.post("/auth/forgot-password")
def forgot_password(req: ForgotPasswordReq):
    """Send a password-reset email. Always returns success to avoid leaking user existence."""
    user = find_user_by_email(req.email)
    if user:
        token = create_password_reset_token(req.email)
        _send_reset_email(req.email, token)
    return {"message": "If an account with that email exists, a reset link has been sent."}


@app.post("/auth/reset-password")
def reset_password(req: ResetPasswordReq):
    """Verify the reset token and update the user's password."""
    payload = decode_token(req.token)

    if payload.get("purpose") != "password_reset":
        raise HTTPException(status_code=400, detail="Invalid reset token")

    email = payload.get("sub")
    if not email:
        raise HTTPException(status_code=400, detail="Invalid reset token")

    user = find_user_by_email(email)
    if not user:
        raise HTTPException(status_code=400, detail="Invalid reset token")

    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    new_hash = hash_password(req.new_password)
    update_user_password(email, new_hash)

    return {"message": "Password updated successfully. You can now log in."}


# ---------- Classroom login ----------

class ClassroomLoginReq(BaseModel):
    username: str
    password: str


@app.post("/auth/classroom-login", response_model=AuthResp)
def classroom_login(req: ClassroomLoginReq):
    """Login for classroom (username-based) students."""
    user = find_user_by_username(req.username)
    if not user or user.get("role") != "classroom_student":
        raise HTTPException(status_code=401, detail="Invalid username or password")
    if not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = create_access_token({"sub": req.username, "sub_type": "username"})
    return AuthResp(
        token=token,
        username=req.username,
        name=user["name"],
        role=user["role"],
    )


# ============================================================
# Teacher endpoints
# ============================================================

class CreateClassReq(BaseModel):
    class_name: str
    student_count: int
    password: str


@app.post("/teacher/create-class")
def create_class_endpoint(req: CreateClassReq, user: dict = Depends(get_current_user)):
    if user.get("role") != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can create classes")
    if not (1 <= req.student_count <= 100):
        raise HTTPException(status_code=400, detail="Student count must be between 1 and 100")
    if len(req.password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters")

    # Generate class_code from class_name
    raw = re.sub(r'[^a-z0-9]', '', req.class_name.lower().replace(' ', ''))
    class_code = raw[:20] or "class"

    # Ensure uniqueness
    base_code = class_code
    counter = 1
    while find_class_by_code(class_code):
        class_code = f"{base_code}{counter}"
        counter += 1

    pw_hash = hash_password(req.password)
    teacher_id = str(user["_id"])

    class_id = create_class_doc(teacher_id, req.class_name, class_code, pw_hash, req.password, req.student_count)

    # Create student accounts
    students = []
    for i in range(1, req.student_count + 1):
        username = f"{class_code}_{i:02d}"
        student_name = f"Student {i:02d}"
        create_classroom_student(username, pw_hash, student_name, class_id)
        students.append({"username": username, "name": student_name})

    return {
        "class_id": class_id,
        "class_code": class_code,
        "class_name": req.class_name,
        "password": req.password,
        "students": students,
    }


@app.get("/teacher/classes")
def list_teacher_classes(user: dict = Depends(get_current_user)):
    if user.get("role") != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can view classes")
    teacher_id = str(user["_id"])
    classes = get_classes_for_teacher(teacher_id)
    result = []
    for cls in classes:
        students = get_students_in_class(str(cls["_id"]))
        result.append({
            "class_id": str(cls["_id"]),
            "class_name": cls["class_name"],
            "class_code": cls["class_code"],
            "password": cls.get("password", ""),
            "student_count": cls["student_count"],
            "created_at": cls.get("created_at", ""),
            "students": [
                {"username": s.get("username"), "name": s.get("name")}
                for s in students
            ],
        })
    return {"classes": result}


@app.get("/teacher/student-sessions")
def get_teacher_student_sessions(user: dict = Depends(get_current_user)):
    """Return all sessions for all students in the teacher's classes."""
    if user.get("role") != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can view student sessions")
    teacher_id = str(user["_id"])
    sessions = get_all_student_sessions_for_teacher(teacher_id)
    for s in sessions:
        s["_id"] = str(s["_id"])
        if "user" in s and "_id" in s["user"]:
            s["user"]["_id"] = str(s["user"]["_id"])
    return {"sessions": sessions}


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
    completed_steps: List[int] = []


def _compute_completed_steps_from_session(sess: "SessionData") -> List[int]:
    """Return list of step numbers that have meaningful saved data."""
    completed = []
    notes = sess.step_notes or {}

    # Step 1: completed when worldview has been chosen
    s1 = notes.get("1") or {}
    if s1.get("worldview_id"):
        completed.append(1)

    # Steps 2-9: completed when step_notes has non-empty data
    for s in range(2, 10):
        data = notes.get(str(s)) or {}
        if data:
            completed.append(s)

    return completed


def _compute_completed_steps_from_doc(doc: dict) -> List[int]:
    """Return list of step numbers that have meaningful saved data (from raw MongoDB doc)."""
    completed = []
    notes = doc.get("step_notes") or {}

    s1 = notes.get("1") or {}
    if s1.get("worldview_id"):
        completed.append(1)

    for s in range(2, 10):
        data = notes.get(str(s)) or {}
        if data:
            completed.append(s)

    return completed


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
        completed_steps=_compute_completed_steps_from_doc(doc),
    )


class SessionSummary(BaseModel):
    session_id: str
    created_at: str = ""
    active_step: int = 1
    completed_steps: List[int] = []
    topic: Optional[str] = None
    resolved_path: Optional[str] = None
    worldview_label: Optional[str] = None


class SessionListResponse(BaseModel):
    sessions: List[SessionSummary]


@app.get("/session/list", response_model=SessionListResponse)
def list_sessions(user: dict = Depends(get_current_user)):
    """Return all sessions for the current user with summary info."""
    user_id = str(user["_id"])
    docs = get_session_summaries_for_user(user_id)
    summaries = []
    for doc in docs:
        step_notes = doc.get("step_notes") or {}
        topic = (step_notes.get("2") or {}).get("topic")
        summaries.append(SessionSummary(
            session_id=doc["session_id"],
            created_at=doc.get("created_at", ""),
            active_step=doc.get("active_step", 1),
            completed_steps=_compute_completed_steps_from_doc(doc),
            topic=topic,
            resolved_path=doc.get("resolved_path"),
            worldview_label=doc.get("worldview_label"),
        ))
    return SessionListResponse(sessions=summaries)


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
    completed_steps: List[int] = []


@app.post("/step/save", response_model=StepDataResp)
def save_step_data(req: StepDataReq, user: dict = Depends(get_current_user)):
    sess = _require_session(req.session_id)
    key = str(req.step)
    sess.step_notes[key] = req.data or {}
    _persist_session(sess)
    return StepDataResp(session_id=sess.id, step=req.step, data=sess.step_notes[key], completed_steps=_compute_completed_steps_from_session(sess))


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
    completed_steps: List[int] = []


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

    # Set worldview on session (what the LLM will see)
    sess.worldview_band = wid
    sess.worldview_label = WORLDVIEW_LABELS[wid]

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
        completed_steps=_compute_completed_steps_from_session(sess),
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


# ---------------- Chat main endpoint (non-streaming) ----------------
@app.post("/chat/send", response_model=ChatHistoryResp)
def chat_send(req: ChatSendReq = Body(...), user: dict = Depends(get_current_user)):
    sess = _require_session(req.session_id)
    history = _get_chat(sess)

    user_msg = (req.message or "").strip()
    if not user_msg:
        return ChatHistoryResp(session_id=req.session_id, history=history)

    # store user turn
    history.append(ChatTurn(role="user", content=user_msg, step=req.active_step))

    # Normal LLM + RAG chat using worldview and resources
    worldview_profile = _render_worldview_profile(sess)
    step_context = _render_step_context(sess)
    passages = _retrieve(user_msg, k=5)
    step_llm_guidance = _get_step_llm_guidance(sess, req.active_step)
    answer = call_llm(
        worldview_profile, step_context, user_msg, passages,
        active_step=req.active_step, step_llm_guidance=step_llm_guidance,
        chat_history=history,
    )

    history.append(ChatTurn(role="assistant", content=answer, step=req.active_step))
    _persist_session(sess)
    return ChatHistoryResp(session_id=req.session_id, history=history)


# ---------------- Optional streaming endpoint ----------------
@app.post("/chat/send_stream")
def chat_send_stream(req: ChatSendReq = Body(...), user: dict = Depends(get_current_user)):
    """
    Streaming variant of /chat/send — streams the LLM's answer chunk-by-chunk.
    """
    sess = _require_session(req.session_id)
    history = _get_chat(sess)

    user_msg = (req.message or "").strip()
    if not user_msg:
        raise HTTPException(status_code=400, detail="Empty message")

    # store user turn
    history.append(ChatTurn(role="user", content=user_msg, step=req.active_step))

    # Stream LLM answer
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
            try:
                with requests.post(OLLAMA_URL, json=payload, stream=True, timeout=300) as resp:
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
            except GeneratorExit:
                logger.info("Client disconnected during stream for session %s", session_id)
                return  # finally block still runs
            except Exception as e:
                logger.exception("LLM stream failed: %s", e)
                yield "\n[Error streaming from model]\n"
        finally:
            # Always persist, even if client disconnected mid-stream
            full_text = "".join(assistant_text_parts).strip()
            if full_text:
                history.append(ChatTurn(role="assistant", content=full_text, step=req.active_step))
            _persist_session(sess)

    return StreamingResponse(event_stream(), media_type="text/plain")


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


# ---------------- PDF Export ----------------
@app.get("/session/{session_id}/export/pdf")
def export_research_design_pdf(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Generate and download a PDF of the research design based on all step responses.
    Automatically selects the appropriate template (quantitative, qualitative, or mixed-methods)
    based on the student's chosen methodology.
    """
    from datetime import datetime

    # Load session
    sess = _require_session(session_id)
    steps_data = sess.step_notes

    # Determine research path/methodology
    resolved_path = sess.resolved_path or "qualitative"  # Default to qualitative
    chosen_methodology = sess.chosen_methodology

    # Helper function to safely get field from step data
    def get_field(step_num: int, field_name: str, default: str = "") -> str:
        step_key = str(step_num)
        if step_key not in steps_data or not isinstance(steps_data[step_key], dict):
            return default
        value = steps_data[step_key].get(field_name, default)
        return str(value) if value else default

    # Extract Step 1: Worldview
    step1_data = steps_data.get("1", {})
    worldview = step1_data.get("worldview") or step1_data.get("worldview_id") or step1_data.get("worldview_label") or "Not specified"

    # Extract Step 2: Topic & Goals (detailed)
    step2_data = steps_data.get("2", {})
    step2_topic = get_field(2, "topic", "Not yet completed")
    step2_personal_goals = get_field(2, "personal_goals") or get_field(2, "personalGoals") or "Not yet completed"
    step2_practical_goals = get_field(2, "practical_goals") or get_field(2, "practicalGoals") or "Not yet completed"
    step2_intellectual_goals = get_field(2, "intellectual_goals") or get_field(2, "intellectualGoals") or "Not yet completed"

    # Extract Step 3: Conceptual Framework (detailed)
    step3_topical = get_field(3, "topicalResearch") or get_field(3, "topical_research") or "Not yet completed"
    step3_gaps = get_field(3, "gaps") or get_field(3, "gaps_identified") or "Not yet completed"
    step3_theoretical = get_field(3, "theoreticalFrameworks") or get_field(3, "theoretical_frameworks") or "Not yet completed"
    step3_problem = get_field(3, "problem_statement") or get_field(3, "problemStatement") or "Not yet completed"

    # Extract Step 4: Methodology
    step4_notes = get_field(4, "notes", "Not yet completed")

    # Base template data (common to all templates)
    template_data = {
        "name": current_user.get("name", "Student"),
        "email": current_user.get("email") or current_user.get("username") or "",
        "date": datetime.now().strftime("%B %d, %Y"),
        "step1": worldview.title(),
        "step2_topic": step2_topic,
        "step2_personal_goals": step2_personal_goals,
        "step2_practical_goals": step2_practical_goals,
        "step2_intellectual_goals": step2_intellectual_goals,
        "step3_topical": step3_topical,
        "step3_gaps": step3_gaps,
        "step3_theoretical": step3_theoretical,
        "step3_problem": step3_problem,
        "step4": step4_notes,
    }

    # Determine which template to use and extract appropriate fields
    if resolved_path == "mixed" or chosen_methodology == "mixed":
        # Mixed-Methods: Steps 5-8 split into quantitative and qualitative
        template_name = "research_design_mixed.html"

        # Extract split fields for Steps 5-8
        step5_data = steps_data.get("5", {})
        template_data["step5_quant"] = get_field(5, "research_question_quant") or get_field(5, "quantitative_question") or "Not yet completed"
        template_data["step5_qual"] = get_field(5, "research_question_qual") or get_field(5, "qualitative_question") or "Not yet completed"

        template_data["step6_quant"] = get_field(6, "data_collection_quant") or get_field(6, "quantitative_data") or "Not yet completed"
        template_data["step6_qual"] = get_field(6, "data_collection_qual") or get_field(6, "qualitative_data") or "Not yet completed"

        template_data["step7_quant"] = get_field(7, "analysis_quant") or get_field(7, "quantitative_analysis") or "Not yet completed"
        template_data["step7_qual"] = get_field(7, "analysis_qual") or get_field(7, "qualitative_analysis") or "Not yet completed"

        template_data["step8_quant"] = get_field(8, "validity") or get_field(8, "quantitative_validity") or "Not yet completed"
        template_data["step8_qual"] = get_field(8, "trustworthiness") or get_field(8, "qualitative_trustworthiness") or "Not yet completed"

        template_data["step9"] = get_field(9, "notes") or get_field(9, "ethics") or "Not yet completed"

    elif resolved_path == "quantitative":
        # Quantitative Research Design
        template_name = "research_design_quantitative.html"
        template_data["step5"] = get_field(5, "research_question") or get_field(5, "notes") or "Not yet completed"
        template_data["step6"] = get_field(6, "notes") or get_field(6, "data_collection") or "Not yet completed"
        template_data["step7"] = get_field(7, "notes") or get_field(7, "analysis") or "Not yet completed"
        template_data["step8"] = get_field(8, "notes") or get_field(8, "validity") or "Not yet completed"
        template_data["step9"] = get_field(9, "notes") or get_field(9, "ethics") or "Not yet completed"

    else:  # qualitative (default)
        # Qualitative Research Design
        template_name = "research_design_qualitative.html"
        template_data["step5"] = get_field(5, "research_question") or get_field(5, "notes") or "Not yet completed"
        template_data["step6"] = get_field(6, "notes") or get_field(6, "data_collection") or "Not yet completed"
        template_data["step7"] = get_field(7, "notes") or get_field(7, "analysis") or "Not yet completed"
        template_data["step8"] = get_field(8, "notes") or get_field(8, "trustworthiness") or "Not yet completed"
        template_data["step9"] = get_field(9, "notes") or get_field(9, "ethics") or "Not yet completed"

    # Load and render the appropriate HTML template
    template_path = TEMPLATE_DIR / template_name
    if not template_path.exists():
        raise HTTPException(status_code=500, detail=f"PDF template not found: {template_name}")

    with open(template_path, "r", encoding="utf-8") as f:
        template_html = f.read()

    # Render with Jinja2
    template = Template(template_html)
    rendered_html = template.render(**template_data)

    # Generate PDF with WeasyPrint
    pdf_bytes = HTML(string=rendered_html, base_url=str(ROOT)).write_pdf()

    # Return PDF as download with methodology-specific filename
    methodology_name = resolved_path.title() if resolved_path else "Research"
    filename = f"{methodology_name}_Research_Design_{current_user.get('name', 'Student').replace(' ', '_')}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )
