"""
Hopscotch 9-Step — Step‑1 backend skeleton (FastAPI)
---------------------------------------------------

"""

from __future__ import annotations
from typing import List, Dict, Optional, Literal, Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from enum import Enum
import uuid
from datetime import datetime
# add near the top
import json
from pathlib import Path

SURVEY_PATH = Path(__file__).parent / "server" / "config" / "surveys" / "worldview_continuum.json"




# ---------------------------
# Models
# ---------------------------

class QuestionType(str, Enum):
    short = "short"
    long = "long"
    mcq = "mcq"
    checkbox = "checkbox"
    scale = "scale"
    date = "date"
    time = "time"

class Question(BaseModel):
    id: Optional[str] = Field(default=None, description="Stable question id; if None, will be auto-assigned")
    text: str
    type: QuestionType
    options: Optional[List[str]] = None  # for mcq/checkbox
    required: bool = False
    mapTo: Optional[str] = Field(default=None, description="Optional mapping hint to worldview or step fields")

class SessionState(str, Enum):
    STEP_1_CHAT = "STEP_1_CHAT"
    STEP_2 = "STEP_2"
    STEP_3 = "STEP_3"
    STEP_4 = "STEP_4"
    STEP_5 = "STEP_5"
    STEP_6 = "STEP_6"
    STEP_7 = "STEP_7"
    STEP_8 = "STEP_8"
    STEP_9 = "STEP_9"
    DONE = "DONE"

class Worldview(BaseModel):
    goals: List[str] = []
    constraints: List[str] = []
    prior_knowledge: List[str] = []
    preferences: List[str] = []
    misconceptions: List[str] = []

class SessionData(BaseModel):
    id: str
    created_at: str
    state: SessionState = SessionState.STEP_1_CHAT
    questions: List[Question] = []
    answers: Dict[str, Any] = {}
    worldview: Optional[Worldview] = None

# ---------------------------
# In-memory DB (swap later)
# ---------------------------
DB: Dict[str, SessionData] = {}

# ---------------------------
# FastAPI app
# ---------------------------
app = FastAPI(title="Hopscotch 9-Step API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------
# Helpers
# ---------------------------

def _require_session(session_id: str) -> SessionData:
    sess = DB.get(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    return sess


def _auto_id_questions(questions: List[Question]) -> List[Question]:
    auto = []
    for idx, q in enumerate(questions, start=1):
        if not q.id:
            q.id = f"q{idx}"
        auto.append(q)
    # validate options present when needed
    for q in auto:
        if q.type in {QuestionType.mcq, QuestionType.checkbox} and not q.options:
            raise HTTPException(status_code=400, detail=f"Question '{q.id}' requires 'options' for type {q.type}.")
    return auto


def _next_unanswered_question(sess: SessionData) -> Optional[Question]:
    answered = set(sess.answers.keys())
    for q in sess.questions:
        if q.required and q.id not in answered:
            return q
    # if required done, return first optional unanswered
    for q in sess.questions:
        if q.id not in answered:
            return q
    return None


def _normalize_and_validate_answer(q: Question, ans: Any) -> Any:
    t = q.type
    if t == QuestionType.short:
        if not isinstance(ans, str):
            raise HTTPException(status_code=400, detail="Answer must be a string for 'short'.")
        return ans.strip()
    if t == QuestionType.long:
        if not isinstance(ans, str):
            raise HTTPException(status_code=400, detail="Answer must be a string for 'long'.")
        return ans.strip()
    if t == QuestionType.mcq:
        if isinstance(ans, str):
            val = ans
        elif isinstance(ans, dict) and "value" in ans:
            val = str(ans["value"])  # allow {value: ...}
        else:
            raise HTTPException(status_code=400, detail="Answer must be a single string for 'mcq'.")
        if not q.options or val not in q.options:
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
        # Expect {min: int, max: int, value: int} or plain int
        if isinstance(ans, int):
            return ans
        if isinstance(ans, dict) and "value" in ans:
            if not isinstance(ans["value"], int):
                raise HTTPException(status_code=400, detail="Scale 'value' must be int.")
            return ans["value"]
        raise HTTPException(status_code=400, detail="Answer must be int or {value:int} for 'scale'.")
    if t == QuestionType.date:
        # Accept YYYY-MM-DD
        if not isinstance(ans, str):
            raise HTTPException(status_code=400, detail="Answer must be a string for 'date'.")
        try:
            datetime.strptime(ans, "%Y-%m-%d")
        except Exception:
            raise HTTPException(status_code=400, detail="Date must be in YYYY-MM-DD format.")
        return ans
    if t == QuestionType.time:
        # Accept HH:MM
        if not isinstance(ans, str):
            raise HTTPException(status_code=400, detail="Answer must be a string for 'time'.")
        try:
            datetime.strptime(ans, "%H:%M")
        except Exception:
            raise HTTPException(status_code=400, detail="Time must be in HH:MM (24h) format.")
        return ans
    raise HTTPException(status_code=400, detail="Unsupported question type.")

# ---------------------------
# Schemas for requests
# ---------------------------

class SessionCreateResponse(BaseModel):
    session_id: str

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

# ---------------------------
# Routes
# ---------------------------

@app.post("/session", response_model=SessionCreateResponse)
def create_session():
  sid = str(uuid.uuid4())
  sess = SessionData(id=sid, created_at=datetime.utcnow().isoformat())
  DB[sid] = sess

  data = load_survey_from_disk()
  sess.questions = [
    Question(
      id=q.get("id") or f"q{i+1}",
      text=q["text"],
      type=q["type"],
      options=q.get("options"),
      required=q.get("required", False),
      mapTo=q.get("mapTo")
    )
    for i, q in enumerate(data["questions"])
  ]
  sess.answers = {}
  return SessionCreateResponse(session_id=sid)


@app.post("/step1/questions")
def import_questions(req: ImportQuestionsRequest):
    sess = _require_session(req.session_id)
    sess.questions = _auto_id_questions(req.questions)
    # reset answers if re-import
    sess.answers = {}
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
    # find question
    q: Optional[Question] = next((qq for qq in sess.questions if qq.id == req.question_id), None)
    if not q:
        raise HTTPException(status_code=404, detail="Question not found in this session")
    norm = _normalize_and_validate_answer(q, req.answer)
    sess.answers[q.id] = norm
    # return next
    qn = _next_unanswered_question(sess)
    return NextQuestionResponse(
        done=qn is None,
        question=qn,
        answered_count=len(sess.answers),
        total=len(sess.questions)
    )

# ---------------------- Worldview Scoring ----------------------

def compute_worldview_scores(sess: SessionData, survey_data: Dict[str, Any]) -> Dict[str, int]:
    """Compute cumulative scores for each worldview category based on survey answers."""
    # Initialize worldview scores
    scores = {w["id"]: 0 for w in survey_data.get("worldviews", [])}
    qspec_by_id = {q["id"]: q for q in survey_data.get("questions", [])}

    # Iterate through each answered question
    for qid, ans in (sess.answers or {}).items():
        spec = qspec_by_id.get(qid)
        if not spec:
            continue
        # Lookup scoring rule for this answer
        scoring = (spec.get("scoring") or {}).get(str(ans), {})
        for worldview_id, pts in scoring.items():
            scores[worldview_id] = scores.get(worldview_id, 0) + int(pts)

    return scores


@app.get("/step1/score")
def get_score(session_id: str):
    sess = _require_session(session_id)
    data = load_survey_from_disk()
    per_cat = compute_worldview_scores(sess, data)
    total = sum(per_cat.values())
    top = max(per_cat.items(), key=lambda kv: kv[1])[0] if per_cat else None
    return {
        "session_id": session_id,
        "total": total,
        "by_worldview": per_cat,
        "top": top
    }



@app.post("/worldview/generate", response_model=WorldviewGenerateResponse)
def generate_worldview(req: WorldviewGenerateRequest):
    """
    LLM-less heuristic stub:
    - Anything mapped to 'goals' -> collect as strings
    - 'prior_knowledge' -> collect selected values
    - Otherwise ignore for now
    Swap later with Llama‑3 call.
    """
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
        if q.mapTo == "goals":
            if isinstance(val, list):
                goals.extend([str(v) for v in val])
            else:
                goals.append(str(val))
        elif q.mapTo == "prior_knowledge":
            if isinstance(val, list):
                prior.extend([str(v) for v in val])
            else:
                prior.append(str(val))
        elif q.mapTo == "preferences":
            if isinstance(val, list):
                prefs.extend([str(v) for v in val])
            else:
                prefs.append(str(val))
        elif q.mapTo == "constraints":
            if isinstance(val, list):
                constraints.extend([str(v) for v in val])
            else:
                constraints.append(str(val))
        elif q.mapTo == "misconceptions":
            if isinstance(val, list):
                miscon.extend([str(v) for v in val])
            else:
                miscon.append(str(val))

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
    sess = _require_session(req.session_id)
    if req.step_id < 2 or req.step_id > 9:
        raise HTTPException(status_code=400, detail="step_id must be between 2 and 9")
    # Placeholder: not implemented yet
    return StepRunResponse(step_id=req.step_id, status="not_implemented", message="LLM flow to be added.")


@app.get("/session/{session_id}")
def read_session(session_id: str):
    # Useful for debugging/inspecting from the UI
    sess = _require_session(session_id)
    return sess

def load_survey_from_disk():
  with open(SURVEY_PATH, "r", encoding="utf-8") as f:
    return json.load(f)
