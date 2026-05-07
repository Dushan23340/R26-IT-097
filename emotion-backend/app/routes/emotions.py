from fastapi import APIRouter, status
from datetime import datetime
import uuid

from app.models.schemas import EmotionEvent, EmotionEventInput, EmotionType
from app.services.emotion_store import emotion_store
from app.services.emotion_service import emotion_service

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
    # Auto-fill timestamp if not provided
    if event.timestamp is None:
        event.timestamp = datetime.utcnow()

    # Store the event
    emotion_store.add_event(event)

    # Get updated dominant emotion
    dominant = emotion_store.get_dominant_emotion()

    return {
        "success": True,
        "event_id": f"evt_{uuid.uuid4().hex[:8]}",
        "processed_at": datetime.utcnow().isoformat(),
        "current_dominant": dominant,
        "message": f"Emotion '{event.emotion}' recorded for student {event.student_id}"
    }


@event_router.post("/emotion-event", status_code=status.HTTP_201_CREATED)
async def create_emotion_event(event: EmotionEventInput):
    """
    Ingest a student emotion event with camelCase fields.
    Validates input, stores in memory, and returns success response.
    """
    result = emotion_service.record_event(event)
    return result


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
