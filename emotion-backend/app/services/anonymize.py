"""FR10 (IT22140784's emotion-recognition proposal): anonymised student
identifiers. Same algorithm/salt as emotion-service's
src/emotion_service/anonymize.py and adaptive-learning/backend's
analytics_bridge.anonymize_student_id - a given real ID must resolve to
the same pseudonym regardless of which service's entry point it comes
through (this one's own /class-session/join, which the frontend calls
directly rather than via emotion-service), or cross-service matching
(e.g. class_session_store.joined_students against event.student_id
arriving from emotion-service's already-anonymised forward) breaks.

STUDENT_ID_SALT must be set identically in both services' environments
for that consistency to hold; see emotion-service's anonymize.py for the
full pseudonymisation-vs-anonymisation rationale.
"""

from __future__ import annotations

import hashlib
import os

_SALT = os.environ.get("STUDENT_ID_SALT", "adaptive-learning-dev-salt-2026")


def anonymize_student_id(raw_id) -> str:
    if raw_id is None or raw_id == "":
        return "anon_unknown"
    digest = hashlib.sha256(f"{_SALT}:{raw_id}".encode("utf-8")).hexdigest()
    return f"anon_{digest[:16]}"
