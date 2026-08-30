"""Real "Send Message" broadcast for the Teacher Console's Quick Actions
panel - same single-active-broadcast shape as class_session.py and
quiz_broadcast.py. The teacher writes a short message; students poll this
state and see it as a dismissible banner (StudentDashboard.jsx).

State now lives in Redis instead of process memory (target production
architecture: Redis = temporary / real-time state).
"""

import json
from datetime import datetime
from typing import Dict, Optional
import uuid

from app.redis_client import redis_client

MAX_MESSAGE_LENGTH = 500
STATE_KEY = "broadcast:message"


class MessageBroadcastStore:
    def __init__(self) -> None:
        self.is_active: bool = False
        self.message: Optional[str] = None
        self.sent_by: Optional[str] = None
        self.sent_at: Optional[datetime] = None
        self.broadcast_id: Optional[str] = None

    def _load(self) -> None:
        raw = redis_client.get(STATE_KEY)
        data = json.loads(raw) if raw else {}
        self.is_active = data.get("is_active", False)
        self.message = data.get("message")
        self.sent_by = data.get("sent_by")
        self.sent_at = datetime.fromisoformat(data["sent_at"]) if data.get("sent_at") else None
        self.broadcast_id = data.get("broadcast_id")

    def _save(self) -> None:
        redis_client.set(STATE_KEY, json.dumps({
            "is_active": self.is_active,
            "message": self.message,
            "sent_by": self.sent_by,
            "sent_at": self.sent_at.isoformat() if self.sent_at else None,
            "broadcast_id": self.broadcast_id,
        }))

    def send(self, message: str, sent_by: Optional[str]) -> None:
        self.is_active = True
        self.message = message[:MAX_MESSAGE_LENGTH]
        self.sent_by = sent_by or "Teacher"
        self.sent_at = datetime.utcnow()
        self.broadcast_id = str(uuid.uuid4())[:8]
        self._save()

    def clear(self) -> None:
        self.is_active = False
        self.message = None
        self.sent_by = None
        self.sent_at = None
        self.broadcast_id = None
        self._save()

    def get_state(self) -> Dict:
        self._load()
        if not self.is_active:
            return {"is_active": False}
        return {
            "is_active": True,
            "message": self.message,
            "sent_by": self.sent_by,
            "sent_at": self.sent_at.isoformat() if self.sent_at else None,
            "broadcast_id": self.broadcast_id,
        }


message_broadcast_store = MessageBroadcastStore()
