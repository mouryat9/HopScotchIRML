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
login_history_col = db["login_history"]
admin_audit_col = db["admin_audit_log"]


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
    login_history_col.create_index("user_id")
    login_history_col.create_index("login_at")
    login_history_col.create_index([("lat", 1), ("lng", 1)])
    admin_audit_col.create_index("timestamp")


# --------------- User CRUD ---------------

def find_user_by_id(user_id: str) -> Optional[Dict]:
    from bson import ObjectId
    try:
        return users_col.find_one({"_id": ObjectId(user_id)})
    except Exception:
        return None


def find_user_by_email(email: str) -> Optional[Dict]:
    return users_col.find_one({"email": email})


def find_user_by_username(username: str) -> Optional[Dict]:
    return users_col.find_one({"username": username})


def create_user(email: str, password_hash: str, role: str, name: str,
                education_level: str = "high_school") -> str:
    result = users_col.insert_one({
        "email": email,
        "password_hash": password_hash,
        "role": role,
        "name": name,
        "education_level": education_level,
        "created_at": datetime.utcnow().isoformat() + "Z",
    })
    return str(result.inserted_id)


def create_classroom_student(username: str, password_hash: str, name: str,
                             class_id: str, education_level: str = "high_school") -> str:
    """Create a classroom student (no email, username-based login)."""
    result = users_col.insert_one({
        "username": username,
        "password_hash": password_hash,
        "role": "classroom_student",
        "name": name,
        "class_id": class_id,
        "education_level": education_level,
        "created_at": datetime.utcnow().isoformat() + "Z",
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
        "created_at": datetime.utcnow().isoformat() + "Z",
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
    """Get all students in all classes belonging to this teacher, with their session data if any."""
    classes = get_classes_for_teacher(teacher_id)
    class_map = {str(c["_id"]): c for c in classes}
    class_ids = list(class_map.keys())
    if not class_ids:
        return []
    students = list(users_col.find(
        {"class_id": {"$in": class_ids}, "role": "classroom_student"},
        {"password_hash": 0},
    ))
    student_ids = [str(s["_id"]) for s in students]
    if not student_ids:
        return []

    # Fetch all sessions for these students
    sessions = list(sessions_col.find(
        {"user_id": {"$in": student_ids}},
        {"chat": 0},
    ).sort("created_at", -1))

    # Map: user_id -> list of sessions
    session_map: Dict[str, List[Dict]] = {}
    for sess in sessions:
        uid = sess.get("user_id", "")
        session_map.setdefault(uid, []).append(sess)

    # Build result: one entry per student, with their latest session (or empty)
    result = []
    for student in students:
        sid = str(student["_id"])
        student_class_id = student.get("class_id", "")
        cls = class_map.get(student_class_id, {})
        student_sessions = session_map.get(sid, [])

        if student_sessions:
            # Student has sessions — include each one
            for sess in student_sessions:
                sess["user"] = student
                sess["class_name"] = cls.get("class_name", "")
                sess["class_code"] = cls.get("class_code", "")
                result.append(sess)
        else:
            # Student hasn't logged in — create a placeholder entry
            result.append({
                "user": student,
                "class_name": cls.get("class_name", ""),
                "class_code": cls.get("class_code", ""),
                "session_id": None,
                "active_step": None,
                "worldview_label": None,
                "resolved_path": None,
                "step_notes": {},
                "created_at": student.get("created_at"),
                "updated_at": None,
                "_id": sid,
            })
    return result


# --------------- Session CRUD ---------------

def find_session(session_id: str) -> Optional[Dict]:
    return sessions_col.find_one({"session_id": session_id})


def create_session_doc(session_id: str, user_id: str) -> Dict:
    doc = {
        "session_id": session_id,
        "user_id": user_id,
        "created_at": datetime.utcnow().isoformat() + "Z",
        "updated_at": datetime.utcnow().isoformat() + "Z",
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
    update["updated_at"] = datetime.utcnow().isoformat() + "Z"
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


# --------------- Login History ---------------

def record_login(user_id: str, email_or_username: str, ip: str,
                 geo: Dict, user_agent: str, success: bool = True):
    """Record a login attempt."""
    login_history_col.insert_one({
        "user_id": user_id,
        "email": email_or_username,
        "ip": ip,
        "city": geo.get("city", ""),
        "region": geo.get("regionName", ""),
        "country": geo.get("country", ""),
        "lat": geo.get("lat"),
        "lng": geo.get("lng"),
        "user_agent": user_agent or "",
        "login_at": datetime.utcnow().isoformat() + "Z",
        "success": success,
    })


def get_recent_logins(limit: int = 100, skip: int = 0) -> List[Dict]:
    return list(login_history_col.find(
        {}, {"_id": 0}
    ).sort("login_at", -1).skip(skip).limit(limit))


def get_login_locations() -> List[Dict]:
    """Aggregate login locations for world map."""
    return list(login_history_col.aggregate([
        {"$match": {"lat": {"$ne": None}, "lng": {"$ne": None}, "success": True}},
        {"$group": {
            "_id": {"lat": "$lat", "lng": "$lng"},
            "city": {"$first": "$city"},
            "country": {"$first": "$country"},
            "count": {"$sum": 1},
            "last_login": {"$max": "$login_at"},
            "users": {"$addToSet": "$email"},
        }},
        {"$project": {
            "_id": 0,
            "lat": "$_id.lat",
            "lng": "$_id.lng",
            "city": 1, "country": 1, "count": 1,
            "last_login": 1,
            "users": {"$slice": ["$users", 5]},
        }},
    ]))


def get_logins_for_user(user_id: str, limit: int = 50) -> List[Dict]:
    return list(login_history_col.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("login_at", -1).limit(limit))


def get_login_stats_by_country() -> List[Dict]:
    """Aggregate unique users and total logins per country."""
    return list(login_history_col.aggregate([
        {"$match": {"country": {"$ne": ""}, "success": True}},
        {"$group": {
            "_id": "$country",
            "logins": {"$sum": 1},
            "users": {"$addToSet": "$user_id"},
        }},
        {"$project": {
            "_id": 0,
            "country": "$_id",
            "logins": 1,
            "unique_users": {"$size": "$users"},
        }},
        {"$sort": {"unique_users": -1}},
    ]))


def get_login_stats_by_region() -> List[Dict]:
    """Aggregate unique users and total logins per city/region."""
    return list(login_history_col.aggregate([
        {"$match": {"city": {"$ne": ""}, "success": True}},
        {"$group": {
            "_id": {"city": "$city", "region": "$region", "country": "$country"},
            "logins": {"$sum": 1},
            "users": {"$addToSet": "$user_id"},
        }},
        {"$project": {
            "_id": 0,
            "city": "$_id.city",
            "region": "$_id.region",
            "country": "$_id.country",
            "logins": 1,
            "unique_users": {"$size": "$users"},
        }},
        {"$sort": {"unique_users": -1}},
        {"$limit": 30},
    ]))


# --------------- Admin: User Management ---------------

def get_all_users(skip: int = 0, limit: int = 50,
                  role_filter: Optional[str] = None,
                  search: Optional[str] = None):
    """Return (users, total) for admin dashboard."""
    query: Dict[str, Any] = {}
    if role_filter:
        query["role"] = role_filter
    if search:
        query["$or"] = [
            {"email": {"$regex": search, "$options": "i"}},
            {"username": {"$regex": search, "$options": "i"}},
            {"name": {"$regex": search, "$options": "i"}},
        ]
    cursor = users_col.find(query, {"password_hash": 0}).sort("created_at", -1).skip(skip).limit(limit)
    total = users_col.count_documents(query)
    return list(cursor), total


def update_user_fields(user_id: str, fields: Dict) -> bool:
    """Update arbitrary fields on a user document."""
    from bson import ObjectId
    result = users_col.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": fields}
    )
    return result.modified_count > 0


def delete_user_by_id(user_id: str) -> bool:
    """Hard-delete a user."""
    from bson import ObjectId
    result = users_col.delete_one({"_id": ObjectId(user_id)})
    return result.deleted_count > 0


# --------------- Admin: Analytics ---------------

def get_user_counts_by_role() -> Dict[str, int]:
    pipeline = [{"$group": {"_id": "$role", "count": {"$sum": 1}}}]
    return {doc["_id"]: doc["count"] for doc in users_col.aggregate(pipeline)}


def get_signups_over_time(days: int = 30) -> List[Dict]:
    from datetime import timedelta
    cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat()
    pipeline = [
        {"$match": {"created_at": {"$gte": cutoff}}},
        {"$project": {"date": {"$substr": ["$created_at", 0, 10]}}},
        {"$group": {"_id": "$date", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]
    return [{"date": doc["_id"], "count": doc["count"]} for doc in users_col.aggregate(pipeline)]


def get_total_sessions_count() -> int:
    return sessions_col.count_documents({})


def get_total_classes_count() -> int:
    return classes_col.count_documents({})


def get_active_users_last_n_days(days: int = 7) -> int:
    from datetime import timedelta
    cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat()
    return len(login_history_col.distinct(
        "user_id", {"login_at": {"$gte": cutoff}, "success": True}
    ))


def get_step_completion_across_all() -> List[Dict]:
    """For all sessions, count how many completed each step (1-9)."""
    pipeline = [
        {"$project": {"step_notes": {"$objectToArray": "$step_notes"}}},
        {"$unwind": "$step_notes"},
        {"$match": {"step_notes.v": {"$ne": {}}}},
        {"$group": {"_id": "$step_notes.k", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]
    return [{"step": int(doc["_id"]), "count": doc["count"]}
            for doc in sessions_col.aggregate(pipeline)]


# --------------- Admin: Audit Log ---------------

def record_admin_action(admin_user_id: str, admin_email: str, action: str,
                        target_user_id: str, target_email: str,
                        details: Optional[Dict] = None):
    admin_audit_col.insert_one({
        "admin_user_id": admin_user_id,
        "admin_email": admin_email,
        "action": action,
        "target_user_id": target_user_id,
        "target_email": target_email,
        "details": details or {},
        "timestamp": datetime.utcnow().isoformat() + "Z",
    })


def get_admin_audit_log(limit: int = 100, skip: int = 0) -> List[Dict]:
    return list(admin_audit_col.find(
        {}, {"_id": 0}
    ).sort("timestamp", -1).skip(skip).limit(limit))


# --------------- Admin: Class Management ---------------

def get_all_classes(skip: int = 0, limit: int = 50,
                    search: Optional[str] = None) -> tuple:
    """Return (classes, total) for admin dashboard."""
    query: Dict[str, Any] = {}
    if search:
        query["$or"] = [
            {"class_name": {"$regex": search, "$options": "i"}},
            {"class_code": {"$regex": search, "$options": "i"}},
        ]
    cursor = classes_col.find(query).sort("created_at", -1).skip(skip).limit(limit)
    total = classes_col.count_documents(query)
    results = []
    for cls in cursor:
        cls["_id"] = str(cls["_id"])
        # Count actual students
        cls["actual_students"] = users_col.count_documents({
            "class_id": cls["_id"], "role": "classroom_student"
        })
        # Resolve teacher name
        teacher = find_user_by_id(cls.get("teacher_id", ""))
        cls["teacher_name"] = teacher.get("name", "") if teacher else ""
        cls["teacher_email"] = teacher.get("email", "") if teacher else ""
        results.append(cls)
    return results, total


def delete_class_by_id(class_id: str) -> bool:
    """Delete a class and all its students."""
    from bson import ObjectId
    # Delete students in this class
    users_col.delete_many({"class_id": class_id, "role": "classroom_student"})
    # Delete sessions for those students
    # (students are already deleted, but clean up orphan sessions)
    result = classes_col.delete_one({"_id": ObjectId(class_id)})
    return result.deleted_count > 0


# --------------- Admin: Session Browsing ---------------

def get_all_sessions(skip: int = 0, limit: int = 50,
                     user_id: Optional[str] = None) -> tuple:
    """Return (sessions, total) for admin."""
    query: Dict[str, Any] = {}
    if user_id:
        query["user_id"] = user_id
    cursor = sessions_col.find(query, {"chat": 0}).sort("created_at", -1).skip(skip).limit(limit)
    total = sessions_col.count_documents(query)
    results = []
    for sess in cursor:
        sess["_id"] = str(sess["_id"])
        # Resolve user
        owner = find_user_by_id(sess.get("user_id", ""))
        sess["user_name"] = (owner.get("username") or owner.get("name", "")) if owner else ""
        sess["user_email"] = (owner.get("email") or owner.get("username", "")) if owner else ""
        results.append(sess)
    return results, total


def get_session_full(session_id: str) -> Optional[Dict]:
    """Return a full session including chat (for admin viewer)."""
    return sessions_col.find_one({"session_id": session_id})


# --------------- Admin: User Detail Drill-Down ---------------

def get_user_detail(user_id: str) -> Optional[Dict]:
    """Return user profile with session summaries and login history."""
    from bson import ObjectId
    user = find_user_by_id(user_id)
    if not user:
        return None
    user["_id"] = str(user["_id"])
    user.pop("password_hash", None)

    # Get session summaries
    sessions = list(sessions_col.find(
        {"user_id": user_id},
        {"chat": 0}
    ).sort("created_at", -1))
    for s in sessions:
        s["_id"] = str(s["_id"])

    # Get recent logins
    logins = get_logins_for_user(user_id, limit=20)

    return {
        "user": user,
        "sessions": sessions,
        "logins": logins,
    }
