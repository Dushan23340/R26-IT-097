"""advisor_recommendations.py — Store for recommendations forwarded from
IT22197146's analytics-service when a teacher/advisor approves or modifies
one (closes the proposal's Figure 3 "forwarded to Learning Outcome
Component" step, which previously did nothing).

State now lives in Redis instead of process memory (target production
architecture: Redis = temporary / real-time state) - these are advisory
nudges, not academic records that need PostgreSQL's durability guarantees,
but they should survive this process restarting, which a plain in-memory
dict never could. A Redis LIST with LTRIM gives the same "newest 20,
oldest silently dropped" behavior the original list.insert(0, ...) +
del bucket[20:] pattern had.
"""

from __future__ import annotations

import json
import time
import uuid

from redis_client import redis_client

_MAX_PER_STUDENT = 20


def _key(student_id: str) -> str:
    return f"advisor_recs:{student_id}"


def add(student_id: str, lesson_id: str, text: str, insight_type: str, source: str) -> str:
    entry = {
        "id": uuid.uuid4().hex,
        "lesson_id": lesson_id,
        "text": text,
        "insight_type": insight_type,
        "source": source,
        "received_at": time.time(),
    }
    key = _key(student_id)
    redis_client.lpush(key, json.dumps(entry))
    redis_client.ltrim(key, 0, _MAX_PER_STUDENT - 1)
    return entry["id"]


def get_for_student(student_id: str) -> list[dict]:
    raw = redis_client.lrange(_key(student_id), 0, -1)
    return [json.loads(item) for item in raw]
