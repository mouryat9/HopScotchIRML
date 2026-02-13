# database.py — MongoDB connection and session/user/class CRUD for Hopscotch

from pymongo import MongoClient
from pymongo.errors import OperationFailure
from typing import Optional, Dict, Any, List
from datetime import datetime

MONGO_URI = "mongodb://127.0.0.1:27017"
DB_NAME = "hopscotch"

client = MongoClient(MONGO_URI)
db = client[DB_NAME]

users_col = db["users"]
sessions_col = db["sessions"]
classes_col = db["classes"]


def ensure_indexes():
    """Create MongoDB indexes (idempotent, safe to call on every startup)."""
    # Migrate: drop old strict email index, replace with sparse
    try:
        users_col.drop_index("email_1")
    except OperationFailure:
        pass
    users_col.create_index("email", unique=True, sparse=True)
    users_col.create_index("username", unique=True, sparse=True)
    sessions_col.create_index("session_id", unique=True)
    sessions_col.create_index("user_id")
    classes_col.create_index("class_code", unique=True)
    classes_col.create_index("teacher_id")


# --------------- User CRUD ---------------

def find_user_by_email(email: str) -> Optional[Dict]:
    return users_col.find_one({"email": email})


def find_user_by_username(username: str) -> Optional[Dict]:
    return users_col.find_one({"username": username})


def create_user(email: str, password_hash: str, role: str, name: str) -> str:
    result = users_col.insert_one({
        "email": email,
        "password_hash": password_hash,
        "role": role,
        "name": name,
        "created_at": datetime.utcnow().isoformat(),
    })
    return str(result.inserted_id)


def create_classroom_student(username: str, password_hash: str, name: str, class_id: str) -> str:
    """Create a classroom student (no email, username-based login)."""
    result = users_col.insert_one({
        "username": username,
        "password_hash": password_hash,
        "role": "classroom_student",
        "name": name,
        "class_id": class_id,
        "created_at": datetime.utcnow().isoformat(),
    })
    return str(result.inserted_id)


def update_user_password(email: str, password_hash: str) -> bool:
    """Update a user's password hash. Returns True if a document was modified."""
    result = users_col.update_one(
        {"email": email},
        {"$set": {"password_hash": password_hash}},
    )
    return result.modified_count > 0


# --------------- Class CRUD ---------------

def create_class_doc(teacher_id: str, class_name: str, class_code: str,
                     password_hash: str, password: str, student_count: int) -> str:
    result = classes_col.insert_one({
        "teacher_id": teacher_id,
        "class_name": class_name,
        "class_code": class_code,
        "password_hash": password_hash,
        "password": password,
        "student_count": student_count,
        "created_at": datetime.utcnow().isoformat(),
    })
    return str(result.inserted_id)


def find_class_by_code(class_code: str) -> Optional[Dict]:
    return classes_col.find_one({"class_code": class_code})


def get_classes_for_teacher(teacher_id: str) -> List[Dict]:
    return list(classes_col.find({"teacher_id": teacher_id}).sort("created_at", -1))


def get_students_in_class(class_id: str) -> List[Dict]:
    return list(users_col.find(
        {"class_id": class_id, "role": "classroom_student"},
        {"password_hash": 0},
    ))


def get_all_student_sessions_for_teacher(teacher_id: str) -> List[Dict]:
    """Get all sessions for all students in all classes belonging to this teacher."""
    classes = get_classes_for_teacher(teacher_id)
    class_ids = [str(c["_id"]) for c in classes]
    if not class_ids:
        return []
    students = list(users_col.find(
        {"class_id": {"$in": class_ids}, "role": "classroom_student"},
        {"password_hash": 0},
    ))
    student_ids = [str(s["_id"]) for s in students]
    if not student_ids:
        return []
    sessions = list(sessions_col.find(
        {"user_id": {"$in": student_ids}},
        {"chat": 0},
    ).sort("created_at", -1))
    user_map = {str(s["_id"]): s for s in students}
    for sess in sessions:
        sess["user"] = user_map.get(sess.get("user_id"), {})
    return sessions


# --------------- Session CRUD ---------------

def find_session(session_id: str) -> Optional[Dict]:
    return sessions_col.find_one({"session_id": session_id})


def create_session_doc(session_id: str, user_id: str) -> Dict:
    doc = {
        "session_id": session_id,
        "user_id": user_id,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        "chat": [],
        "worldview_band": None,
        "worldview_label": None,
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


def get_session_summaries_for_user(user_id: str) -> List[Dict]:
    """Return all sessions for a user, excluding the heavy chat array."""
    return list(sessions_col.find(
        {"user_id": user_id},
        {"chat": 0, "_id": 0},
    ).sort("created_at", -1))
