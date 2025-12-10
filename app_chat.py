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
from fastapi import FastAPI, HTTPException, Body, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

# -------------------------------------------------
# Paths
# -------------------------------------------------
ROOT = Path(__file__).parent
SURVEY_PATH = ROOT / "server" / "config" / "surveys" / "worldview_continuum.json"

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
LLM_MODEL = "llama3.1:8b"
LLM_TEMP = 0.0

# runtime globals for RAG
_embedder = None
_faiss_index = None
_chunks: List[Dict[str, Any]] = []  # [{"id": int, "text": str, "source": str}]
_raw_docs_cache: Optional[List[Dict[str, str]]] = None  # for keyword fallback

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

    # 🔹 NEW: arbitrary notes/data per step (1–9)
    step_notes: Dict[str, Any] = Field(default_factory=dict)


class SessionCreateResponse(BaseModel):
    session_id: str


class ChatSendReq(BaseModel):
    session_id: str
    message: str


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
# In-memory DB
# ============================================================
DB: Dict[str, SessionData] = {}


# ============================================================
# Helpers: sessions, survey
# ============================================================
def _require_session(session_id: str) -> SessionData:
    sess = DB.get(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    return sess


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


def _render_worldview_profile(sess: SessionData) -> str:
    """
    Human-readable summary sent to the LLM after the survey.
    """
    if not sess.survey_done:
        return "Survey not finished yet."
    band = sess.worldview_label or sess.worldview_band or "Unknown"
    total = sess.worldview_total if sess.worldview_total is not None else "?"
    return f"User worldview (survey-based): {band} (total score {total})."


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
def _startup_rag():
    _build_index()


# ============================================================
# LLM call (Ollama)
# ============================================================
def build_ollama_payload(
    worldview_profile: str,
    user_msg: str,
    passages: List[Dict[str, Any]],
    stream: bool = False,
) -> Dict[str, Any]:
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
        "You are a gentle research-methods tutor helping students understand research paradigms "
        "(positivist, post-positivist, constructivist, transformative, pragmatist) and how these "
        "relate to their own worldview.\n\n"
        "Always:\n"
        "- Use a calm, encouraging tone.\n"
        "- Answer in at most 3 short paragraphs OR a few bullet points.\n"
        "- Use the user's worldview summary when explaining.\n"
        "- Use the context snippets only as support; do NOT quote long passages.\n"
        "- At the end, append a section exactly titled '**Quick references from our notes:**' "
        "followed by bullet points of the form '- *filename.pdf*: short 1–2 sentence summary'."
    )

    worldview_msg = (
        f"Here is the user's survey-based worldview profile:\n\n{worldview_profile}\n\n"
        "You also have access to some snippets from our IRML resources:\n\n"
        f"{ctx_text}"
    )

    return {
        "model": LLM_MODEL,
        "stream": stream,
        "options": {
            "temperature": LLM_TEMP,
        },
        "messages": [
            {"role": "system", "content": system_msg},
            {"role": "assistant", "content": worldview_msg},
            {"role": "user", "content": user_msg},
        ],
    }


def call_llm(
    worldview_profile: str, user_msg: str, passages: List[Dict[str, Any]]
) -> str:
    """
    Non-streaming call (used by /chat/send).
    """
    payload = build_ollama_payload(worldview_profile, user_msg, passages, stream=False)

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
# Routes
# ============================================================
@app.post("/session", response_model=SessionCreateResponse)
def create_session():
    sid = str(uuid.uuid4())
    sess = SessionData(
        id=sid,
        created_at=datetime.utcnow().isoformat(),
    )
    DB[sid] = sess
    return SessionCreateResponse(session_id=sid)


@app.get("/chat/history", response_model=ChatHistoryResp)
def get_chat_history(session_id: str = Query(...)):
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
def save_step_data(req: StepDataReq):
    sess = _require_session(req.session_id)
    key = str(req.step)
    sess.step_notes[key] = req.data or {}
    return StepDataResp(session_id=sess.id, step=req.step, data=sess.step_notes[key])


@app.get("/step/get", response_model=StepDataResp)
def get_step_data(
    session_id: str = Query(...),
    step: int = Query(...),
):
    sess = _require_session(session_id)
    key = str(step)
    data = sess.step_notes.get(key, {})
    return StepDataResp(session_id=sess.id, step=step, data=data)


# ---------------- Survey-as-conversation logic ----------------
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
def chat_send(req: ChatSendReq = Body(...)):
    sess = _require_session(req.session_id)
    history = _get_chat(sess)

    user_msg = (req.message or "").strip()
    if not user_msg:
        return ChatHistoryResp(session_id=req.session_id, history=history)

    # store user turn
    history.append(ChatTurn(role="user", content=user_msg))

    # 1) If survey not finished, let the survey handler run
    survey_resp = _handle_survey_turn(sess, user_msg, history)
    if survey_resp is not None:
        return survey_resp

    # 2) Otherwise, normal LLM + RAG chat using worldview and resources
    worldview_profile = _render_worldview_profile(sess)
    passages = _retrieve(user_msg, k=5)
    answer = call_llm(worldview_profile, user_msg, passages)

    history.append(ChatTurn(role="assistant", content=answer))
    return ChatHistoryResp(session_id=req.session_id, history=history)


# ---------------- Optional streaming endpoint ----------------
@app.post("/chat/send_stream")
def chat_send_stream(req: ChatSendReq = Body(...)):
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

    # 1) Let the survey handler run first
    survey_resp = _handle_survey_turn(sess, user_msg, history)
    if survey_resp is not None:
        # Survey still in progress or just finished -> return normal JSON
        return survey_resp

    # 2) Survey is done → stream LLM answer
    worldview_profile = _render_worldview_profile(sess)
    passages = _retrieve(user_msg, k=5)
    payload = build_ollama_payload(worldview_profile, user_msg, passages, stream=True)

    def event_stream():
        assistant_text_parts: List[str] = []
        try:
            with requests.post(OLLAMA_URL, json=payload, stream=True) as resp:
                resp.raise_for_status()
                for line in resp.iter_lines(decode_unicode=True):
                    if not line:
                        continue
                    # Ollama streaming sends a JSON object per line
                    try:
                        data = json.loads(line)
                    except Exception:
                        continue

                    delta = data.get("message", {}).get("content", "")
                    if not delta:
                        continue

                    assistant_text_parts.append(delta)
                    # yield raw text chunks; frontend will accumulate
                    yield delta
        except Exception as e:
            logger.exception("LLM stream failed: %s", e)
            yield "\n[Error streaming from model]\n"

        # When streaming is done, persist the full assistant message to history
        full_text = "".join(assistant_text_parts).strip()
        if full_text:
            history.append(ChatTurn(role="assistant", content=full_text))

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
