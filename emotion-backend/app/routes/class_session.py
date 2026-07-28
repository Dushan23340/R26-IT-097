from fastapi import APIRouter
from typing import Dict

from app.services.class_session import class_session_store
from app.services import student_profile_bridge

router = APIRouter(prefix="/class-session", tags=["class-session"])


@router.get("/state")
async def get_class_session_state() -> Dict:
    """Students poll this to detect when the teacher starts/ends class."""
    return class_session_store.get_state()


@router.post("/start")
async def start_class_session(body: Dict) -> Dict:
    """Body: {"subject": "Mathematics", "started_by": "Dr. Sarah Johnson"}.
    Starts a fresh session (joined count resets)."""
    class_session_store.start(subject=body.get("subject"), started_by=body.get("started_by"))
    return {"success": True, **class_session_store.get_state()}


@router.post("/end")
async def end_class_session() -> Dict:
    """Teacher ends the live class for the whole class. Pushes a final
    engagement_metrics summary to analytics-service for every student who
    had a linked session (best-effort, fire-and-forget)."""
    summaries = class_session_store.end()
    for student_id, analytics_session_id, engagement_score, time_on_task, interaction_count in summaries:
        student_profile_bridge.push_engagement_metrics_async(
            analytics_session_id, student_id, engagement_score, time_on_task, interaction_count
        )
    return {"success": True, "is_live": False}


@router.post("/join")
async def join_class_session(body: Dict) -> Dict:
    """A student's dashboard calls this when they click Join. Body:
    {"student_id": "...", "session_id": "...", "student_name": "..."}.
    session_id must match the current broadcast (from GET /state) or the
    join is silently ignored. student_name is optional (falls back to
    student_id) - used only for Teacher Console display, see
    get_joined_students."""
    student_id = body.get("student_id")
    session_id = body.get("session_id")
    student_name = body.get("student_name")
    if not student_id or not session_id:
        return {"success": False, "error": "student_id and session_id are required"}
    joined = class_session_store.join(student_id, session_id, student_name)
    return {"success": joined}


@router.get("/students")
async def get_class_session_students() -> Dict:
    """Real roster of who's joined the current live class (pseudonym + real
    display name) - the Teacher Console cross-references this against
    emotion-service's live tracker (GET /students on port 5002, matched by
    pseudonym) to show each joined student's name next to their current
    emotion."""
    return {"students": class_session_store.get_joined_students()}
