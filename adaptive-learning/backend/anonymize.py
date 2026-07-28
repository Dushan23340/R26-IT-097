"""FR10 (IT22140784's emotion-recognition proposal): anonymised student
identifiers. Same algorithm/salt as emotion-service's own copy
(emotion-service/src/emotion_service/anonymize.py) and emotion-backend's
(app/services/anonymize.py) - a given real ID must resolve to the same
pseudonym regardless of which service computes it, since this module's
only use (analytics_bridge.get_live_emotion) needs to match against
emotion-service's already-anonymised GET /students response without a
shared live lookup between services.

STUDENT_ID_SALT must be set identically across all three services for
that consistency to hold.
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
