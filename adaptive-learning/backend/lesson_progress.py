"""lesson_progress.py — Live-class-gated quiz access.

"lesson" means the live online class (emotion-backend's class_session.py),
not a reading-material screen. A student's quiz for a lesson is only
accessible once BOTH:
  1. they attended a live class ended for that lesson_id (pushed here by
     emotion-backend's adaptive_learning_bridge.py, with their real
     dominant emotion captured throughout that class), AND
  2. a teacher has explicitly unlocked that lesson's quiz.

Same in-memory dict + threading.Lock pattern as quiz_gen/store.py and
advisor_recommendations.py - this service has no database of its own, and
this doesn't need to be the first thing to add one.
"""

from __future__ import annotations

import threading
import time

_LOCK = threading.Lock()

# (student_id, lesson_id) -> {"completed_at": float, "dominant_emotion": str | None}
_COMPLETION: dict[tuple[str, str], dict] = {}

# lesson_id -> locked (True) / unlocked (False). Any lesson not yet
# explicitly touched by a teacher defaults to locked - a live class ending
# marks students as having completed it, but a teacher still has to
# deliberately publish the quiz before anyone can take it.
_LOCK_STATE: dict[str, bool] = {}
_DEFAULT_LOCKED = True


def mark_completed(student_id: str, lesson_id: str, dominant_emotion: str | None) -> None:
    with _LOCK:
        _COMPLETION[(student_id, lesson_id)] = {
            "completed_at": time.time(),
            "dominant_emotion": dominant_emotion,
        }


def get_access(student_id: str, lesson_id: str) -> dict:
    with _LOCK:
        completion = _COMPLETION.get((student_id, lesson_id))
        locked = _LOCK_STATE.get(lesson_id, _DEFAULT_LOCKED)

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
    with _LOCK:
        _LOCK_STATE[lesson_id] = bool(locked)


def get_all_locks() -> dict[str, bool]:
    """All lesson_ids a teacher has explicitly touched -> their current
    locked state. A lesson never touched by a teacher is simply absent
    here (caller should treat any missing lesson_id as locked, the same
    default get_access() applies)."""
    with _LOCK:
        return dict(_LOCK_STATE)
