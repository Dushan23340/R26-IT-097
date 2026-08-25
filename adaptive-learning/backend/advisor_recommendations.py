"""advisor_recommendations.py — In-memory store for recommendations
forwarded from IT22197146's analytics-service when a teacher/advisor
approves or modifies one (closes the proposal's Figure 3 "forwarded to
Learning Outcome Component" step, which previously did nothing).

Same in-memory dict pattern as quiz_gen/store.py's generated-quiz cache -
this service has no database of its own, and these are advisory nudges,
not academic records that need to survive a restart.
"""

from __future__ import annotations

import threading
import time
import uuid

_LOCK = threading.Lock()
_BY_STUDENT: dict[str, list[dict]] = {}
_MAX_PER_STUDENT = 20


def add(student_id: str, lesson_id: str, text: str, insight_type: str, source: str) -> str:
    entry = {
        "id": uuid.uuid4().hex,
        "lesson_id": lesson_id,
        "text": text,
        "insight_type": insight_type,
        "source": source,
        "received_at": time.time(),
    }
    with _LOCK:
        bucket = _BY_STUDENT.setdefault(student_id, [])
        bucket.insert(0, entry)
        del bucket[_MAX_PER_STUDENT:]
    return entry["id"]


def get_for_student(student_id: str) -> list[dict]:
    with _LOCK:
        return list(_BY_STUDENT.get(student_id, []))
