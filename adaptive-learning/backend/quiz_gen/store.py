"""quiz_gen/store.py — Server-side cache of generated quiz instances,
keyed by an opaque instance_id handed to the client instead of the old
static quiz_set int. Same "answer key never leaves the server" guarantee
lessons.py's get_quiz_for_lesson() already gives static lessons: the full
instance (with real answers) lives only here; the client only ever sees
strip_answers()'d questions.

State now lives in Redis instead of process memory (target production
architecture: Redis = temporary state, exactly the "temporary
quiz-generation state" use case) - and Redis's native key expiry replaces
the manual _evict_expired_locked() sweep the in-memory version needed,
since SETEX handles the TTL for us.
"""

from __future__ import annotations

import json
import uuid

from redis_client import redis_client

_TTL_SECONDS = 6 * 60 * 60  # a student could plausibly leave a quiz open for hours


def save(quiz: dict) -> str:
    instance_id = uuid.uuid4().hex
    redis_client.setex(f"quiz_instance:{instance_id}", _TTL_SECONDS, json.dumps(quiz))
    return instance_id


def get(instance_id: str) -> dict | None:
    raw = redis_client.get(f"quiz_instance:{instance_id}")
    return json.loads(raw) if raw else None
