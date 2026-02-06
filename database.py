# database.py — MongoDB connection and session/user CRUD for Hopscotch

from pymongo import MongoClient
from typing import Optional, Dict, Any, List
from datetime import datetime

MONGO_URI = "mongodb://127.0.0.1:27017"
DB_NAME = "hopscotch"

client = MongoClient(MONGO_URI)
db = client[DB_NAME]

users_col = db["users"]
sessions_col = db["sessions"]


def ensure_indexes():
    """Create MongoDB indexes (idempotent, safe to call on every startup)."""
    users_col.create_index("email", unique=True)
    sessions_col.create_index("session_id", unique=True)
    sessions_col.create_index("user_id")


# --------------- User CRUD ---------------

def find_user_by_email(email: str) -> Optional[Dict]:
    return users_col.find_one({"email": email})


def create_user(email: str, password_hash: str, role: str, name: str) -> str:
    result = users_col.insert_one({
        "email": email,
        "password_hash": password_hash,
        "role": role,
        "name": name,
        "created_at": datetime.utcnow().isoformat(),
    })
    return str(result.inserted_id)


# --------------- Session CRUD ---------------

def find_session(session_id: str) -> Optional[Dict]:
    return sessions_col.find_one({"session_id": session_id})


def create_session_doc(session_id: str, user_id: str) -> Dict:
    doc = {
        "session_id": session_id,
        "user_id": user_id,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        "answers": {},
        "chat": [],
        "survey_index": 0,
        "survey_started": False,
        "survey_done": False,
        "worldview_band": None,
        "worldview_label": None,
        "worldview_total": None,
        "step_notes": {},
        "resolved_path": None,
        "chosen_methodology": None,
        "active_step": 1,
    }
    sessions_col.insert_one(doc)
    return doc


def update_session(session_id: str, update: Dict[str, Any]):
    update["updated_at"] = datetime.utcnow().isoformat()
    sessions_col.update_one({"session_id": session_id}, {"$set": update})


def get_sessions_for_user(user_id: str) -> List[Dict]:
    return list(sessions_col.find({"user_id": user_id}))


def get_latest_session_for_user(user_id: str) -> Optional[Dict]:
    """Return the most recent session for a given user, or None."""
    cursor = sessions_col.find({"user_id": user_id}).sort("created_at", -1).limit(1)
    docs = list(cursor)
    return docs[0] if docs else None


