"""attempt_state.py — Cross-device persistence of a student's post-quiz
results / recommendations screen.

lessons.jsx already keeps this blob in browser localStorage, which covers a
same-device page refresh. It does NOT survive logging back in on a
different laptop (the real LAN-classroom case) or a cleared cache: the
student lands back on the lesson list, and because quiz access is
live-class-gated, they often can't retake the quiz to get their
recommendations back. This stores the same blob server-side, keyed by
student, so lessons.jsx's hydration can fall back to it.

Opaque JSON on purpose: the value is exactly the shape lessons.jsx renders
(screen / lesson_id / result / previous_result / completed_resource_ids),
not an academic record, so — like lesson_progress.py — it lives in Redis
with a TTL and this module never couples to the result schema.

Best-effort: a Redis blip must not 500 a save the frontend only fires
opportunistically, so read/write failures degrade to "nothing stored"
rather than raising.
"""

from __future__ import annotations

import json
import time

from redis_client import redis_client

_KEY_PREFIX = "attempt_state:"          # attempt_state:<student_id> -> json
_TTL_SECONDS = 60 * 60 * 24 * 30        # 30 days; a stale half-reviewed attempt shouldn't linger forever


def _key(student_id: str) -> str:
    return f"{_KEY_PREFIX}{student_id}"


def save(student_id: str, state: dict) -> bool:
    payload = dict(state)
    payload["updated_at"] = time.time()
    try:
        redis_client.set(_key(student_id), json.dumps(payload), ex=_TTL_SECONDS)
        return True
    except Exception:
        return False


def load(student_id: str) -> dict | None:
    try:
        raw = redis_client.get(_key(student_id))
    except Exception:
        return None
    return json.loads(raw) if raw else None


def clear(student_id: str) -> None:
    try:
        redis_client.delete(_key(student_id))
    except Exception:
        pass
