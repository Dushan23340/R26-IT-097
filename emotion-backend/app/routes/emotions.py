from fastapi import APIRouter, status
from datetime import datetime
import uuid

from app.models.schemas import EmotionEvent, EmotionType
from app.services.emotion_store import emotion_store

router = APIRouter(prefix="/emotions", tags=["emotions"])


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
