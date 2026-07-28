from fastapi import APIRouter
from typing import Dict

from app.services.quiz_broadcast import quiz_broadcast_store

router = APIRouter(prefix="/quiz-broadcast", tags=["quiz-broadcast"])


@router.get("/state")
async def get_quiz_broadcast_state() -> Dict:
    """Students poll this to detect when the teacher pushes a quiz."""
    return quiz_broadcast_store.get_state()


@router.post("/start")
async def start_quiz_broadcast(body: Dict) -> Dict:
    """Body: {"lesson_id": "...", "lesson_title": "...", "started_by": "..."}.
    lesson_id must be a real lesson id from adaptive-learning's
    GET /api/lessons - this store doesn't validate it against that service
    (best-effort/non-blocking, same pattern as the rest of this backend),
    so an unknown id just means students land on lessons.jsx's normal
    lesson-picker instead of auto-starting."""
    lesson_id = body.get("lesson_id")
    if not lesson_id:
        return {"success": False, "error": "lesson_id is required"}
    quiz_broadcast_store.start(
        lesson_id=lesson_id,
        lesson_title=body.get("lesson_title"),
        started_by=body.get("started_by"),
    )
    return {"success": True, **quiz_broadcast_store.get_state()}


@router.post("/end")
async def end_quiz_broadcast() -> Dict:
    quiz_broadcast_store.end()
    return {"success": True, "is_active": False}
