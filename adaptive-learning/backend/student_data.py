"""Everything this service keeps about one student, for the privacy centre's
"Download my data" and "Delete my data" (account service, routes/privacy.js).

This service stores per-student data only in Redis:
  attempt_state:<id>                     saved results screen (30-day TTL)
  advisor_recs:<id>                      approved teacher/advisor notes
  lesson_progress:completion  (hash)     "<id>|<lesson>" -> live-class attendance
  lesson_progress:completed:<lesson>     set of students who attended
  help_requests               (hash)     "<id>|<lesson>" -> open help request
Quiz instances (quiz_instance:*) hold questions only, never a student id.
Quiz results themselves are stored by analytics-service in PostgreSQL.
"""

from __future__ import annotations

import json

from redis_client import redis_client

_COMPLETION_KEY = "lesson_progress:completion"
_COMPLETED_SET_PREFIX = "lesson_progress:completed:"
_HELP_KEY = "help_requests"


def _loads(raw):
    try:
        return json.loads(raw)
    except (TypeError, ValueError):
        return raw


def _own_fields(hash_key: str, student_id: str) -> dict:
    prefix = f"{student_id}|"
    return {field: value for field, value in redis_client.hgetall(hash_key).items() if field.startswith(prefix)}


def export(student_id: str) -> dict:
    attempt = redis_client.get(f"attempt_state:{student_id}")
    return {
        "saved_results_screen": _loads(attempt) if attempt else None,
        "advisor_recommendations": [_loads(x) for x in redis_client.lrange(f"advisor_recs:{student_id}", 0, -1)],
        "live_class_attendance": [
            {"lesson_id": field.split("|", 1)[1], **(_loads(value) if isinstance(_loads(value), dict) else {"value": value})}
            for field, value in _own_fields(_COMPLETION_KEY, student_id).items()
        ],
        "help_requests": [_loads(value) for value in _own_fields(_HELP_KEY, student_id).values()],
    }


def erase(student_id: str) -> dict:
    removed = {
        "saved_results_screen": redis_client.delete(f"attempt_state:{student_id}"),
        "advisor_recommendations": redis_client.delete(f"advisor_recs:{student_id}"),
        "live_class_attendance": 0,
        "help_requests": 0,
    }
    attendance = _own_fields(_COMPLETION_KEY, student_id)
    if attendance:
        removed["live_class_attendance"] = redis_client.hdel(_COMPLETION_KEY, *attendance.keys())
        for field in attendance:
            redis_client.srem(f"{_COMPLETED_SET_PREFIX}{field.split('|', 1)[1]}", student_id)
    help_fields = _own_fields(_HELP_KEY, student_id)
    if help_fields:
        removed["help_requests"] = redis_client.hdel(_HELP_KEY, *help_fields.keys())
    return removed
