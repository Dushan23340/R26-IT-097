from fastapi import APIRouter, status
from datetime import datetime
from pydantic import BaseModel
import uuid
from typing import List

from app.models.schemas import EmotionEvent, EmotionEventInput, EmotionType
from app.services.emotion_store import emotion_store
from app.services.emotion_service import emotion_service
from app.services.class_session import class_session_store
from app.services import student_profile_bridge

# Router for /emotions/* endpoints
router = APIRouter(prefix="/emotions", tags=["emotions"])

# Router for top-level /emotion-event endpoint
event_router = APIRouter(tags=["emotion-events"])


@router.post("", status_code=status.HTTP_201_CREATED)
async def ingest_emotion(event: EmotionEvent):
    """
    Receive a real-time emotion event from a student.
    Automatically updates the sliding window and triggers analytics.
    """
    if event.timestamp is None:
        event.timestamp = datetime.utcnow()

    emotion_store.add_event(event)
    dominant = emotion_store.get_dominant_emotion()

    # Student Profile (analytics-service) bridging: only forwards if this
    # student is actually part of the currently live class and the
    # throttle interval has elapsed - a no-op no-error skip otherwise
    # (e.g. no class is live, or this student hasn't joined one).
    # event.emotion.value (not str(event.emotion)) - EmotionType is a
    # `str, Enum` mixin, and on Python <3.11 str() on it returns
    # "EmotionType.CONFUSED" rather than "CONFUSED", which would silently
    # fail analytics-service's lowercase emotion_label CHECK constraint.
    emotion_value = event.emotion.value
    bridge_target = class_session_store.record_emotion_for_bridge(event.student_id, emotion_value)
    if bridge_target:
        analytics_session_id, real_student_id = bridge_target
        # Real ID here, not event.student_id (already a pseudonym by this
        # point) - analytics-service needs the real, cross-linkable
        # identity; see class_session.py's module docstring.
        student_profile_bridge.push_emotional_state_async(
            analytics_session_id, real_student_id, emotion_value, event.confidence
        )

    return {
        "success": True,
        "event_id": f"evt_{uuid.uuid4().hex[:8]}",
        "processed_at": datetime.utcnow().isoformat(),
        "current_dominant": dominant,
        "message": f"Emotion '{event.emotion}' recorded for student {event.student_id}"
    }


class InvalidFrameInput(BaseModel):
    """Body for POST /emotions/invalid - see mark_invalid's docstring on
    EmotionStore for why this is a separate, lighter path than the main
    ingest_emotion route rather than just posting a fabricated EmotionEvent:
    no fake emotion should ever reach class_session_store's profile bridge
    or the emotion trend/distribution history."""
    student_id: str
    reason: str = "no_face_detected"


@router.post("/invalid", status_code=status.HTTP_200_OK)
async def ingest_invalid_frame(payload: InvalidFrameInput):
    """
    Record that a student is present but not currently classifiable
    (occluded / looking away / no face detected at all) - keeps them in
    active_students so the class size stays accurate, while excluding
    their stale last-known emotion from the distribution/dominant-emotion
    chart until a real classification resumes. See emotion-service's
    FaceValidityError / mark_invalid for the upstream source of this call.
    """
    emotion_store.mark_invalid(payload.student_id, payload.reason)
    return {
        "success": True,
        "student_id": payload.student_id,
        "reason": payload.reason,
    }


@event_router.post("/emotion-event", status_code=status.HTTP_201_CREATED)
async def create_emotion_event(event: EmotionEventInput):
    """
    Ingest a student emotion event with camelCase fields.
    Validates input, stores in memory, and returns success response.
    """
    result = emotion_service.record_event(event)
    return result


@event_router.post("/emotion-event/batch", status_code=status.HTTP_201_CREATED)
async def create_emotion_events_batch(events: List[EmotionEventInput]):
    """
    Ingest multiple emotion events in a single request.
    """
    results = []
    for event in events:
        result = emotion_service.record_event(event)
        results.append(result)

    return {
        "success": True,
        "processed_count": len(results),
        "results": results
    }


@event_router.get("/emotion-event/history")
async def get_emotion_event_history(limit: int = 20):
    """
    Get recent raw emotion events (for debugging/verification).
    """
    return {
        "success": True,
        "count": len(emotion_service.raw_events),
        "events": emotion_service.get_recent_events(limit=limit)
    }
