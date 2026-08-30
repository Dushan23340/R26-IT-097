"""lesson_progress.py — Live-class-gated quiz access.

"lesson" means the live online class (emotion-backend's class_session.py),
not a reading-material screen. A student's quiz for a lesson is only
accessible once BOTH:
  1. they attended a live class ended for that lesson_id (pushed here by
     emotion-backend's adaptive_learning_bridge.py, with their real
     dominant emotion captured throughout that class), AND
  2. a teacher has explicitly unlocked that lesson's quiz.

State now lives in Redis instead of process memory (target production
architecture: Redis = temporary / real-time state) - completion/lock
status isn't an academic record that needs PostgreSQL's durability
guarantees, but it does need to survive this process restarting, which a
plain in-memory dict never could.
"""

from __future__ import annotations

import json
import time

from redis_client import redis_client

_COMPLETION_KEY = "lesson_progress:completion"  # hash: "student_id|lesson_id" -> json
_COMPLETED_SET_PREFIX = "lesson_progress:completed:"  # set per lesson_id: student_ids
_LOCKS_KEY = "lesson_progress:locks"  # hash: lesson_id -> "1" (locked) / "0" (unlocked)
_DEFAULT_LOCKED = True


def _completion_field(student_id: str, lesson_id: str) -> str:
    return f"{student_id}|{lesson_id}"


def mark_completed(student_id: str, lesson_id: str, dominant_emotion: str | None) -> None:
    record = {"completed_at": time.time(), "dominant_emotion": dominant_emotion}
    redis_client.hset(_COMPLETION_KEY, _completion_field(student_id, lesson_id), json.dumps(record))
    redis_client.sadd(f"{_COMPLETED_SET_PREFIX}{lesson_id}", student_id)


def get_access(student_id: str, lesson_id: str) -> dict:
    raw = redis_client.hget(_COMPLETION_KEY, _completion_field(student_id, lesson_id))
    completion = json.loads(raw) if raw else None

    lock_raw = redis_client.hget(_LOCKS_KEY, lesson_id)
    locked = (lock_raw == "1") if lock_raw is not None else _DEFAULT_LOCKED

    completed = completion is not None
    quiz_unlocked = not locked
    return {
        "completed": completed,
        "completed_at": completion["completed_at"] if completion else None,
        "dominant_emotion": completion["dominant_emotion"] if completion else None,
        "quiz_unlocked": quiz_unlocked,
        "can_take_quiz": completed and quiz_unlocked,
    }


def set_lock(lesson_id: str, locked: bool) -> None:
    redis_client.hset(_LOCKS_KEY, lesson_id, "1" if locked else "0")


def get_all_locks() -> dict[str, bool]:
    """All lesson_ids a teacher has explicitly touched -> their current
    locked state. A lesson never touched by a teacher is simply absent
    here (caller should treat any missing lesson_id as locked, the same
    default get_access() applies)."""
    raw = redis_client.hgetall(_LOCKS_KEY)
    return {lesson_id: (value == "1") for lesson_id, value in raw.items()}


def get_completed_students(lesson_id: str) -> list[str]:
    """Every student_id who has completed this lesson's live class,
    regardless of current lock state - used when a teacher unlocks a
    lesson to know who to notify (backend/'s POST /api/notify/quiz-unlocked),
    not just who currently has access."""
    return list(redis_client.smembers(f"{_COMPLETED_SET_PREFIX}{lesson_id}"))
