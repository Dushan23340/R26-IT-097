"""help_requests.py — Student "I'm stuck, please help" requests.

Raised from lessons.jsx's escalation panel, which appears after a few quiz
attempts where a Learning Outcome is still weak and hasn't improved since
the previous attempt - the point where another quiz cycle won't help and a
teacher / re-teaching is the right move. Surfaces in the Teacher Console's
"Students needing help" panel.

Redis-backed, same rationale as lesson_progress.py / attempt_state.py:
real state that must survive a restart but isn't an academic record. One
open request per (student, lesson) - a repeat raise just refreshes it.
Auto-resolved when that student later submits the lesson's quiz with no
weak LOs left; a teacher can also resolve it from the console.
"""

from __future__ import annotations

import json
import time

from redis_client import redis_client

_KEY = "help_requests"  # hash: "student_id|lesson_id" -> json record


def _field(student_id: str, lesson_id: str) -> str:
    return f"{student_id}|{lesson_id}"


def create(
    student_id: str,
    student_name: str,
    lesson_id: str,
    lesson_title: str,
    stuck_los: list[dict],
    attempt_count: int,
) -> dict:
    field = _field(student_id, lesson_id)
    existing = {}
    try:
        raw = redis_client.hget(_KEY, field)
        if raw:
            existing = json.loads(raw)
    except Exception:
        pass

    record = {
        "student_id": student_id,
        "student_name": student_name or student_id,
        "lesson_id": lesson_id,
        "lesson_title": lesson_title or lesson_id,
        "stuck_los": stuck_los or [],
        "attempt_count": attempt_count,
        "first_requested_at": existing.get("first_requested_at", time.time()),
        "updated_at": time.time(),
        "status": "open",
    }
    try:
        redis_client.hset(_KEY, field, json.dumps(record))
    except Exception:
        pass
    return record


def list_open() -> list[dict]:
    try:
        raw = redis_client.hgetall(_KEY)
    except Exception:
        return []
    out = []
    for value in raw.values():
        try:
            rec = json.loads(value)
        except (TypeError, ValueError):
            continue
        if rec.get("status") == "open":
            out.append(rec)
    out.sort(key=lambda r: r.get("updated_at", 0), reverse=True)
    return out


def resolve(student_id: str, lesson_id: str) -> None:
    try:
        redis_client.hdel(_KEY, _field(student_id, lesson_id))
    except Exception:
        pass
