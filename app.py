"""
Hopscotch 9-Step — Step-1 backend (FastAPI, full)
- Sessions, survey load, scoring
- Chat with RAG (FAISS + all-MiniLM-L6-v2) and keyword fallback
- PDF extraction fallback (pdfminer) if pypdf returns empty
- /rag/status, /rag/reindex utilities
"""

from __future__ import annotations
from typing import List, Dict, Optional, Literal, Any
from pathlib import Path
from datetime import datetime
from enum import Enum
import uuid
import re
import json
import logging
import requests
from fastapi import FastAPI, HTTPException, Body, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# -------------------------------------------------
# Paths
# -------------------------------------------------
ROOT = Path(__file__).parent
SURVEY_PATH = ROOT / "server" / "config" / "surveys" / "worldview_continuum.json"

DOCS_DIR   = ROOT / "server" / "resources"
INDEX_DIR  = ROOT / "server" / "index"
INDEX_DIR.mkdir(parents=True, exist_ok=True)
INDEX_PATH = INDEX_DIR / "faiss.index"
META_PATH  = INDEX_DIR / "chunks.json"   # keep chunk texts

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
    from pdfminer.high_level import extract_text as pdfminer_extract_text  # type: ignore
except Exception:
    pdfminer_extract_text = None

EMBED_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
EMBED_DIM        = 384  # for the model above

logger = logging.getLogger("uvicorn.error")

# Runtime globals
_embedder = None
_faiss_index = None
_chunks: List[Dict[str, Any]] = []      # [{"id": int, "text": str, "source": str}]
_raw_docs_cache: Optional[List[Dict[str, str]]] = None  # for keyword fallback

# -------------------------------------------------
# Worldview bands (match your UI)
# -------------------------------------------------
CONTINUUM_BANDS = [
    {"id": "positivist",      "label": "Positivist",      "min": 0,  "max": 4},
    {"id": "post_positivist", "label": "Post Positivist", "min": 5,  "max": 8},
    {"id": "constructivist",  "label": "Constructivist",  "min": 9,  "max": 12},
    {"id": "transformative",  "label": "Transformative",  "min": 10, "max": 18},  # overlap per spec
    {"id": "pragmatist",      "label": "Pragmatist",      "min": 20, "max": 60},
]

# --- Human labels + 1-line blurbs per worldview for a friendly tone ---
BAND_NAMES = {
    "positivist": "Positivist",
    "post_positivist": "Post-Positivist",
    "constructivist": "Constructivist",
    "transformative": "Transformative",
    "pragmatist": "Pragmatist",
}

BAND_BLURBS = {
    "positivist": "focuses on observable facts, measurement, and replicability.",
    "post_positivist": "values evidence but recognizes bias and uncertainty; aims for rigorous yet humble claims.",
    "constructivist": "emphasizes meaning-making with multiple valid perspectives and rich context.",
    "transformative": "centers equity and voice; research is a lever for social change.",
    "pragmatist": "chooses whatever methods best solve the problem; outcomes and utility first.",
}

def _current_band(sess: "SessionData") -> tuple[Optional[str], Optional[str]]:
    """Return (band_id, human_label) from current answers."""
    data = load_survey_from_disk()
    per_cat = compute_worldview_scores(sess, data)
    if not per_cat:
        return None, None
    top_id = max(per_cat.items(), key=lambda kv: kv[1])[0]
    return top_id, BAND_NAMES.get(top_id, top_id)

def current_worldview_band(total: int) -> dict | None:
    for b in CONTINUUM_BANDS:
        if b["min"] <= total <= b["max"]:
            return b
    return None

# ============================================================
# Models
# ============================================================
class QuestionType(str, Enum):
    short = "short"
    long = "long"
    mcq = "mcq"
    checkbox = "checkbox"
    scale = "scale"
    date = "date"
    time = "time"

class Question(BaseModel):
    id: Optional[str] = None
    text: str
    type: QuestionType
    options: Optional[List[str]] = None
    required: bool = False
    mapTo: Optional[str] = None
    # pass-through keys (from JSON)
    scale: Optional[Dict[str, int]] = None
    scoring: Optional[Dict[str, Dict[str, int]]] = None

class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str

class Worldview(BaseModel):
    goals: List[str] = Field(default_factory=list)
    constraints: List[str] = Field(default_factory=list)
    prior_knowledge: List[str] = Field(default_factory=list)
    preferences: List[str] = Field(default_factory=list)
    misconceptions: List[str] = Field(default_factory=list)

class SessionData(BaseModel):
    id: str
    created_at: str
    questions: List[Question] = Field(default_factory=list)
    question_queue: List[str] = Field(default_factory=list)
    answers: Dict[str, Any] = Field(default_factory=dict)
    chat: List[ChatTurn] = Field(default_factory=list)
    worldview: Optional[Worldview] = None

# API schemas
class SessionCreateResponse(BaseModel):
    session_id: str
    total_questions: int

class ImportQuestionsRequest(BaseModel):
    session_id: str
    questions: List[Question]

class NextQuestionResponse(BaseModel):
    done: bool
    question: Optional[Question] = None
    answered_count: int
    total: int

class SubmitAnswerRequest(BaseModel):
    session_id: str
    question_id: str
    answer: Any

class WorldviewGenerateRequest(BaseModel):
    session_id: str

class WorldviewGenerateResponse(BaseModel):
    worldview: Worldview

class StepRunRequest(BaseModel):
    session_id: str
    step_id: int  # 2..9
    inputs: Optional[Dict[str, Any]] = None

class StepRunResponse(BaseModel):
    step_id: int
    status: Literal["not_implemented", "ok", "error"]
    output: Optional[Dict[str, Any]] = None
    message: Optional[str] = None

class ChatSendReq(BaseModel):
    session_id: str
    message: str

class ChatHistoryResp(BaseModel):
    session_id: str
    history: List[ChatTurn]

# ============================================================
# App + CORS
# ============================================================
app = FastAPI(title="Hopscotch 9-Step API", version="0.1.0")
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
# Helpers: sessions, survey, questions
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
        raise HTTPException(status_code=500, detail=f"Survey not found at {SURVEY_PATH}")
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"Survey JSON invalid: {e}")

def _auto_id_questions(questions: List[Question]) -> List[Question]:
    out: List[Question] = []
    for idx, q in enumerate(questions, start=1):
        if not q.id:
            q.id = f"q{idx}"
        if q.type in {QuestionType.mcq, QuestionType.checkbox} and not q.options:
            raise HTTPException(status_code=400, detail=f"Question '{q.id}' requires 'options'.")
        out.append(q)
    return out

def _next_unanswered_question(sess: SessionData) -> Optional[Question]:
    answered = set(sess.answers.keys())
    # required first
    for q in sess.questions:
        if q.required and q.id not in answered:
            return q
    # then optional
    for q in sess.questions:
        if q.id not in answered:
            return q
    return None

def _normalize_and_validate_answer(q: Question, ans: Any) -> Any:
    t = q.type
    if t in (QuestionType.short, QuestionType.long):
        if not isinstance(ans, str):
            raise HTTPException(status_code=400, detail=f"Answer must be string for '{t}'.")
        return ans.strip()
    if t == QuestionType.mcq:
        val = ans if isinstance(ans, str) else (str(ans.get("value")) if isinstance(ans, dict) else None)
        if val is None or not q.options or val not in q.options:
            raise HTTPException(status_code=400, detail=f"Invalid option. Allowed: {q.options}")
        return val
    if t == QuestionType.checkbox:
        if not isinstance(ans, list):
            raise HTTPException(status_code=400, detail="Answer must be a list for 'checkbox'.")
        vals = [str(v) for v in ans]
        if not q.options or any(v not in q.options for v in vals):
            raise HTTPException(status_code=400, detail=f"Invalid options in list. Allowed: {q.options}")
        return vals
    if t == QuestionType.scale:
        if isinstance(ans, int):
            return ans
        if isinstance(ans, dict) and "value" in ans and isinstance(ans["value"], int):
            return ans["value"]
        raise HTTPException(status_code=400, detail="Answer must be int or {value:int} for 'scale'.")
    if t == QuestionType.date:
        if not isinstance(ans, str):
            raise HTTPException(status_code=400, detail="Answer must be string for 'date'.")
        try:
            datetime.strptime(ans, "%Y-%m-%d")
        except Exception:
            raise HTTPException(status_code=400, detail="Date must be YYYY-MM-DD.")
        return ans
    if t == QuestionType.time:
        if not isinstance(ans, str):
            raise HTTPException(status_code=400, detail="Answer must be string for 'time'.")
        try:
            datetime.strptime(ans, "%H:%M")
        except Exception:
            raise HTTPException(status_code=400, detail="Time must be HH:MM (24h).")
        return ans
    raise HTTPException(status_code=400, detail="Unsupported question type.")

# ============================================================
# RAG (with pdfminer + keyword fallback)
# ============================================================
def _read_txt(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="ignore")

def _read_md(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="ignore")

def _read_pdf(path: Path) -> str:
    # Try pypdf first
    txt = ""
    if PdfReader is not None:
        try:
            reader = PdfReader(str(path))
            txt = "\n".join((page.extract_text() or "") for page in reader.pages)
        except Exception:
            txt = ""
    # Fallback to pdfminer if installed and pypdf was empty
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
            # best-effort; skip unreadable files
            continue
    return docs

def _chunk(text: str, max_chars: int = 2400, overlap: int = 400) -> List[str]:
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return []
    step = max(1, max_chars - overlap)
    return [text[i:i+max_chars] for i in range(0, len(text), step)]

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

    # Try loading existing index
    if INDEX_PATH.exists() and META_PATH.exists():
        try:
            _faiss_index = faiss.read_index(str(INDEX_PATH))
            _chunks = json.loads(META_PATH.read_text(encoding="utf-8"))
            return
        except Exception as e:
            logger.warning("Failed to load existing index; rebuilding. %s", e)

    # Build new
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
    vecs = _embedder.encode(texts, convert_to_numpy=True, normalize_embeddings=True)

    index = faiss.IndexFlatIP(vecs.shape[1])
    index.add(vecs)
    _faiss_index = index

    # Persist
    faiss.write_index(_faiss_index, str(INDEX_PATH))
    META_PATH.write_text(
        json.dumps([{"id": i, "text": c["text"], "source": c["source"]} for i, c in enumerate(chunks)], ensure_ascii=False),
        encoding="utf-8"
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
            scored.append({"text": text[:2000], "source": d["source"], "score": float(score)})
    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:k]

def _retrieve(query: str, k: int = 5, boost: str | None = None) -> List[Dict[str, Any]]:
    """
    Smarter retrieval:
    - If FAISS available: search composite (query + boost) and variants
    - Else: keyword fallback
    """
    composite = f"{query}\n\n{boost}" if boost else query

    if RAG_AVAILABLE and _faiss_index is not None and _chunks:
        _ensure_embedder()

        def _faiss_search(q: str) -> List[Dict[str, Any]]:
            qv = _embedder.encode([q], convert_to_numpy=True, normalize_embeddings=True)
            D, I = _faiss_index.search(qv, k)
            out = []
            for idx, score in zip(I[0], D[0]):
                idx = int(idx)
                if 0 <= idx < len(_chunks):
                    ch = _chunks[idx]
                    out.append({"text": ch["text"], "source": ch["source"], "score": float(score)})
            return out

        results = _faiss_search(composite)
        if not results:
            results = _faiss_search(query)
        if not results and boost:
            results = _faiss_search(boost)
        if results:
            return results

    # Fallbacks
    fb = _keyword_fallback(composite, k=k)
    return fb if fb else _keyword_fallback(query, k=k)

@app.on_event("startup")
def _startup_rag():
    _build_index()

# ============================================================
# Scoring
# ============================================================
def compute_worldview_scores(sess: SessionData, survey_data: Dict[str, Any]) -> Dict[str, int]:
    scores = {w["id"]: 0 for w in survey_data.get("worldviews", [])}
    qspec_by_id = {q["id"]: q for q in survey_data.get("questions", [])}
    for qid, ans in (sess.answers or {}).items():
        spec = qspec_by_id.get(qid)
        if not spec:
            continue
        scoring = (spec.get("scoring") or {}).get(str(ans), {})
        for worldview_id, pts in scoring.items():
            scores[worldview_id] = scores.get(worldview_id, 0) + int(pts)
    return scores

def _render_profile(sess: SessionData) -> str:
    if not sess.answers:
        return "No survey answers provided yet."
    pairs = [f"{qid}: {ans}" for qid, ans in list(sess.answers.items())[:30]]
    return f"Survey snapshot — {'; '.join(pairs)}"

# ============================================================
# Routes
# ============================================================
@app.post("/session", response_model=SessionCreateResponse)
def create_session():
    sid = str(uuid.uuid4())
    data = load_survey_from_disk()

    raw_questions = data.get("questions", [])
    if not isinstance(raw_questions, list) or not raw_questions:
        raise HTTPException(status_code=500, detail="Survey has no questions.")

    questions: List[Question] = []
    for i, q in enumerate(raw_questions):
        try:
            questions.append(Question(
                id=q.get("id") or f"q{i+1}",
                text=q["text"],
                type=q["type"],
                options=q.get("options"),
                required=bool(q.get("required", False)),
                mapTo=q.get("mapTo"),
                scale=q.get("scale"),
                scoring=q.get("scoring"),
            ))
        except KeyError as ke:
            raise HTTPException(status_code=500, detail=f"Malformed question at index {i}: missing key {ke!s}")

    questions = _auto_id_questions(questions)

    sess = SessionData(
        id=sid,
        created_at=datetime.utcnow().isoformat(),
        questions=questions,
        question_queue=[q.id for q in questions],
        answers={},
        chat=[],
    )
    DB[sid] = sess
    return SessionCreateResponse(session_id=sid, total_questions=len(questions))

@app.post("/step1/questions")
def import_questions(req: ImportQuestionsRequest):
    sess = _require_session(req.session_id)
    sess.questions = _auto_id_questions(req.questions)
    sess.answers = {}
    sess.question_queue = [q.id for q in sess.questions]
    return {"ok": True, "count": len(sess.questions)}

@app.get("/step1/next-question", response_model=NextQuestionResponse)
def get_next_question(session_id: str):
    sess = _require_session(session_id)
    q = _next_unanswered_question(sess)
    return NextQuestionResponse(
        done=q is None,
        question=q,
        answered_count=len(sess.answers),
        total=len(sess.questions)
    )

@app.post("/step1/answer", response_model=NextQuestionResponse)
def submit_answer(req: SubmitAnswerRequest):
    sess = _require_session(req.session_id)
    q = next((qq for qq in sess.questions if qq.id == req.question_id), None)
    if not q:
        raise HTTPException(status_code=404, detail="Question not found in this session")
    norm = _normalize_and_validate_answer(q, req.answer)
    sess.answers[q.id] = norm
    qn = _next_unanswered_question(sess)
    return NextQuestionResponse(
        done=qn is None,
        question=qn,
        answered_count=len(sess.answers),
        total=len(sess.questions)
    )

@app.get("/step1/score")
def get_score(session_id: str):
    sess = _require_session(session_id)
    data = load_survey_from_disk()
    per_cat = compute_worldview_scores(sess, data)
    total = sum(per_cat.values())
    top = max(per_cat.items(), key=lambda kv: kv[1])[0] if per_cat else None
    return {"session_id": session_id, "total": total, "by_worldview": per_cat, "top": top}

@app.post("/worldview/generate", response_model=WorldviewGenerateResponse)
def generate_worldview(req: WorldviewGenerateRequest):
    sess = _require_session(req.session_id)
    goals: List[str] = []
    prior: List[str] = []
    prefs: List[str] = []
    constraints: List[str] = []
    miscon: List[str] = []

    for q in sess.questions:
        if q.id not in sess.answers:
            continue
        val = sess.answers[q.id]
        target = q.mapTo
        if target == "goals":
            goals.extend(val if isinstance(val, list) else [str(val)])
        elif target == "prior_knowledge":
            prior.extend(val if isinstance(val, list) else [str(val)])
        elif target == "preferences":
            prefs.extend(val if isinstance(val, list) else [str(val)])
        elif target == "constraints":
            constraints.extend(val if isinstance(val, list) else [str(val)])
        elif target == "misconceptions":
            miscon.extend(val if isinstance(val, list) else [str(val)])

    sess.worldview = Worldview(
        goals=[g for g in goals if g],
        constraints=[c for c in constraints if c],
        prior_knowledge=[p for p in prior if p],
        preferences=[p for p in prefs if p],
        misconceptions=[m for m in miscon if m],
    )
    return WorldviewGenerateResponse(worldview=sess.worldview)

@app.post("/steps/run", response_model=StepRunResponse)
def run_step(req: StepRunRequest):
    _require_session(req.session_id)
    if req.step_id < 2 or req.step_id > 9:
        raise HTTPException(status_code=400, detail="step_id must be between 2 and 9")
    return StepRunResponse(step_id=req.step_id, status="not_implemented", message="LLM flow to be added.")

@app.get("/session/{session_id}")
def read_session(session_id: str):
    return _require_session(session_id)

# ---------------- Chat ----------------
def _get_chat(sess: SessionData) -> List[ChatTurn]:
    # thanks to default_factory this will always be a list
    if sess.chat is None:
        sess.chat = []
    return sess.chat

@app.get("/chat/history", response_model=ChatHistoryResp)
def get_chat_history(session_id: str = Query(...)):
    sess = _require_session(session_id)
    history = _get_chat(sess)
    return ChatHistoryResp(session_id=session_id, history=history)

@app.post("/chat/send", response_model=ChatHistoryResp)
def chat_send(req: ChatSendReq = Body(...)):
    sess = _require_session(req.session_id)
    history = _get_chat(sess)

    user_msg = (req.message or "").strip()
    if not user_msg:
        return ChatHistoryResp(session_id=req.session_id, history=history)

    # store user turn
    history.append(ChatTurn(role="user", content=user_msg))

    # --- Build context from survey + RAG ---
    data = load_survey_from_disk()
    scores = compute_worldview_scores(sess, data)
    total = sum(scores.values())
    top_id = max(scores.items(), key=lambda kv: kv[1])[0] if scores else "unknown"
    worldview_label = top_id.replace("_", " ").title()

    passages = _retrieve(user_msg, k=5)
    refs = "\n\n".join(
        f"[{i+1}] ({p['source']}) {p['text'][:800]}"
        for i, p in enumerate(passages)
    ) or "No matching references found."

    # --- System prompt tailored for conversational tutor ---
    system_prompt = f"""
You are a friendly IRML research tutor. The student currently aligns with the
**{worldview_label}** paradigm (their total score = {total}).

Answer NATURALLY like a conversation—do not restate their score unless asked.
Use the references if helpful. Give clear, short paragraphs and concrete examples.
If they ask about other paradigms, compare them briefly and neutrally.

References:
{refs}
""".strip()

    # --- Call Ollama (Llama) locally with temperature 0 ---
    try:
        resp = requests.post(
            "http://localhost:11434/api/chat",
            json={
                "model": "llama3.1:8b",   # or "llama3.2:3b" if you pulled that
                "stream": False,
                "options": {
                    "temperature": 0.0,   # deterministic
                    "num_ctx": 4096       # raise if your docs are long & you have RAM
                },
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_msg},
                ],
            },
            timeout=120,
        )
        resp.raise_for_status()
        data = resp.json()
        # Ollama /chat returns { "message": {"role":"assistant","content":"..."}, "done": true, ... }
        reply = (data.get("message") or {}).get("content") or "Sorry, I couldn’t generate a reply."
    except Exception as e:
        reply = f"LLM call failed: {e}. I can still summarize references:\n\n{refs}"

    history.append(ChatTurn(role="assistant", content=reply))
    return ChatHistoryResp(session_id=req.session_id, history=history)



# ---------------- RAG utilities ----------------
@app.get("/rag/status")
def rag_status():
    return {
        "RAG_AVAILABLE": RAG_AVAILABLE,
        "docs_dir": str(DOCS_DIR),
        "index_path_exists": INDEX_PATH.exists(),
        "meta_path_exists": META_PATH.exists(),
        "num_chunks": len(_chunks),
        "faiss_loaded": _faiss_index is not None,
        "sample_sources": list({c["source"] for c in _chunks[:10]}),
    }

@app.post("/rag/reindex")
def rag_reindex():
    # wipe current index files so we rebuild
    try:
        if INDEX_PATH.exists(): INDEX_PATH.unlink()
        if META_PATH.exists(): META_PATH.unlink()
    except Exception as e:
        logger.exception("Failed clearing index files: %s", e)
    # rebuild
    _build_index()
    return {"ok": True, "num_chunks": len(_chunks)}
