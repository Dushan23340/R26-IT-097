"""quiz_gen/store.py — Server-side cache of generated quiz instances,
keyed by an opaque instance_id handed to the client instead of the old
static quiz_set int. Same "answer key never leaves the server" guarantee
lessons.py's get_quiz_for_lesson() already gives static lessons: the full
instance (with real answers) lives only here; the client only ever sees
strip_answers()'d questions. Mirrors the in-memory dict + lock + TTL
pattern already proven in emotion-service/flask_api.py's _LIVE_FRAMES
cache for the same kind of "server holds state, client gets a handle"
need.
"""

from __future__ import annotations

import threading
import time
import uuid

_LOCK = threading.Lock()
_INSTANCES: dict[str, dict] = {}
_TTL_SECONDS = 6 * 60 * 60  # a student could plausibly leave a quiz open for hours


def save(quiz: dict) -> str:
    instance_id = uuid.uuid4().hex
    with _LOCK:
        _INSTANCES[instance_id] = {"quiz": quiz, "created_at": time.time()}
        _evict_expired_locked()
    return instance_id


def get(instance_id: str) -> dict | None:
    with _LOCK:
        entry = _INSTANCES.get(instance_id)
        return entry["quiz"] if entry else None


def _evict_expired_locked() -> None:
    now = time.time()
    expired = [iid for iid, entry in _INSTANCES.items() if now - entry["created_at"] > _TTL_SECONDS]
    for iid in expired:
        del _INSTANCES[iid]
