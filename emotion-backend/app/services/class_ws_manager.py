"""In-memory WebSocket connection registry for the live-class screen-share
and chat signaling channel (app/routes/class_ws.py).

This is the first WebSocket in the platform - everything else here is
short-interval HTTP polling (see class_session.py, dashboard_store.py,
etc.), which is the right call for periodic state refresh but the wrong
tool for WebRTC signaling: an SDP offer/answer and ICE candidate exchange
needs a near-instant round trip, not a 2-5s poll cycle, or connection
setup would visibly stall for seconds per candidate.

State here is per-session and cleared when the session ends or the last
client disconnects - same ephemeral, restart-loses-it model as every other
store in this service (see the target production architecture notes: this
belongs in Redis in a real deployment, not process memory, but a single
FastAPI process is exactly how this service already runs).
"""

from __future__ import annotations

from typing import Dict, Optional

from fastapi import WebSocket


class ClassWebSocketManager:
    def __init__(self) -> None:
        # session_id -> "teacher" websocket
        self._teachers: Dict[str, WebSocket] = {}
        # session_id -> {student_pseudonym: websocket}
        self._students: Dict[str, Dict[str, WebSocket]] = {}

    async def connect_teacher(self, session_id: str, ws: WebSocket) -> None:
        await ws.accept()
        self._teachers[session_id] = ws

    async def connect_student(self, session_id: str, pseudonym: str, ws: WebSocket) -> None:
        await ws.accept()
        self._students.setdefault(session_id, {})[pseudonym] = ws

    def disconnect_teacher(self, session_id: str) -> None:
        self._teachers.pop(session_id, None)

    def disconnect_student(self, session_id: str, pseudonym: str) -> None:
        students = self._students.get(session_id)
        if students:
            students.pop(pseudonym, None)

    def get_teacher(self, session_id: str) -> Optional[WebSocket]:
        return self._teachers.get(session_id)

    def get_student(self, session_id: str, pseudonym: str) -> Optional[WebSocket]:
        return self._students.get(session_id, {}).get(pseudonym)

    def student_pseudonyms(self, session_id: str) -> list[str]:
        return list(self._students.get(session_id, {}).keys())

    async def send_to_teacher(self, session_id: str, message: dict) -> bool:
        ws = self.get_teacher(session_id)
        if not ws:
            return False
        await ws.send_json(message)
        return True

    async def send_to_student(self, session_id: str, pseudonym: str, message: dict) -> bool:
        ws = self.get_student(session_id, pseudonym)
        if not ws:
            return False
        await ws.send_json(message)
        return True

    async def broadcast(
        self,
        session_id: str,
        message: dict,
        exclude_pseudonym: Optional[str] = None,
        exclude_teacher: bool = False,
    ) -> None:
        """Sends to the teacher (if connected) and every connected student
        in this session, except exclude_pseudonym (a student sender - so
        they don't get an echo of their own chat message back) and/or
        exclude_teacher (set when the teacher itself is the sender - e.g.
        screen-share-started/stopped and teacher chat, where the teacher's
        own client already knows and doesn't need an echo)."""
        teacher = self.get_teacher(session_id)
        if teacher and not exclude_teacher:
            await teacher.send_json(message)
        for pseudonym, ws in list(self._students.get(session_id, {}).items()):
            if pseudonym == exclude_pseudonym:
                continue
            await ws.send_json(message)


class_ws_manager = ClassWebSocketManager()
