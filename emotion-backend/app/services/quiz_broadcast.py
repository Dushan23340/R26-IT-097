"""Real "Start Quiz" broadcast for the Teacher Console's Quick Actions panel
- same shape as class_session.py's live-class broadcast: the teacher picks
a real lesson (adaptive-learning's /api/lessons) and starts it here;
students poll this state and get a prompt to jump straight into that
lesson's quiz (frontend/src/routes/lessons.jsx, ?lesson_id= auto-start).

Deliberately a single active broadcast, not a queue - a second "Start Quiz"
call while one is already active replaces it (mirrors class_session.py's
start() semantics), since there's no requirement yet for multiple
concurrent quiz prompts.
"""

from datetime import datetime
from typing import Dict, Optional
import uuid


class QuizBroadcastStore:
    def __init__(self) -> None:
        self.is_active: bool = False
        self.lesson_id: Optional[str] = None
        self.lesson_title: Optional[str] = None
        self.started_by: Optional[str] = None
        self.started_at: Optional[datetime] = None
        self.broadcast_id: Optional[str] = None

    def start(self, lesson_id: str, lesson_title: Optional[str], started_by: Optional[str]) -> None:
        self.is_active = True
        self.lesson_id = lesson_id
        self.lesson_title = lesson_title or lesson_id
        self.started_by = started_by or "Teacher"
        self.started_at = datetime.utcnow()
        self.broadcast_id = str(uuid.uuid4())[:8]

    def end(self) -> None:
        self.is_active = False
        self.lesson_id = None
        self.lesson_title = None
        self.started_by = None
        self.started_at = None
        self.broadcast_id = None

    def get_state(self) -> Dict:
        if not self.is_active:
            return {"is_active": False}
        return {
            "is_active": True,
            "lesson_id": self.lesson_id,
            "lesson_title": self.lesson_title,
            "started_by": self.started_by,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "broadcast_id": self.broadcast_id,
        }


quiz_broadcast_store = QuizBroadcastStore()
