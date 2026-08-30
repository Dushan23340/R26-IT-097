import json
from datetime import datetime
from typing import List, Dict

from app.models.schemas import EmotionEventInput, EmotionEvent
from app.services.emotion_store import emotion_store
from app.redis_client import redis_client

RAW_EVENTS_KEY = "emotion:raw_events"


class EmotionService:
    """
    Service layer for managing emotion events.
    Handles validation, conversion, and storage of incoming emotion data.
    raw_events (audit/debug log) now lives in Redis instead of process
    memory - exposed as a property so existing direct attribute access
    (e.g. `len(emotion_service.raw_events)`) keeps working unchanged.
    """

    def __init__(self, store):
        self.store = store

    @property
    def raw_events(self) -> List[Dict]:
        raw = redis_client.get(RAW_EVENTS_KEY)
        return json.loads(raw) if raw else []

    def _save_raw_events(self, events: List[Dict]) -> None:
        redis_client.set(RAW_EVENTS_KEY, json.dumps(events))

    def record_event(self, input_data: EmotionEventInput) -> Dict:
        """
        Process and store a new emotion event.
        Converts camelCase input to internal snake_case format.
        """
        # Convert input to internal EmotionEvent format
        internal_event = EmotionEvent(
            student_id=str(input_data.student_id),
            emotion=input_data.emotion,
            timestamp=input_data.timestamp,
            confidence=1.0
        )

        # Store in analytics engine (sliding window)
        self.store.add_event(internal_event)

        # Also keep raw event for audit/debug
        raw_record = {
            "student_id": input_data.student_id,
            "session_id": input_data.session_id,
            "emotion": input_data.emotion.value,
            "timestamp": input_data.timestamp.isoformat(),
            "received_at": datetime.utcnow().isoformat()
        }
        events = self.raw_events
        events.append(raw_record)
        self._save_raw_events(events)

        return {
            "success": True,
            "event_id": f"evt_{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')[:-3]}",
            "stored_at": datetime.utcnow().isoformat(),
            "current_dominant_emotion": self.store.get_dominant_emotion(),
            "window_event_count": len(self.store.events)
        }

    def get_all_events(self) -> List[Dict]:
        """Return all raw emotion events (for debugging/inspection)."""
        return self.raw_events

    def get_recent_events(self, limit: int = 20) -> List[Dict]:
        """Return the most recent raw events."""
        return self.raw_events[-limit:]


# Global service instance
emotion_service = EmotionService(store=emotion_store)
