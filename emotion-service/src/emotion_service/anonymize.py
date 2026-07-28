"""FR10: "The system shall log emotion classification data using
anonymised student identifiers and session identifiers to protect user
privacy" - previously the real logged-in user's DB ID or literal email was
used as student_id end-to-end (tracker keys, forwarded events, API
responses), with no anonymisation step anywhere.

Pseudonymisation, applied server-side at every point a real student_id
first enters the emotion-recognition pipeline (this service's /predict,
and the equivalent entry points in emotion-backend and adaptive-learning -
see their own anonymize_student_id() copies, same algorithm/salt so a
given real ID always resolves to the same pseudonym across services
without needing a shared live lookup):

  - Deterministic: the same real ID always hashes to the same pseudonym,
    so a student's own history stays linked across sessions.
  - One-way: the pseudonym alone can't be reversed back to the real
    ID/email without the salt - this can only be a genuine secret when
    computed server-side (never in frontend JS, which is always
    inspectable), which is why this is NOT done client-side.

This is pseudonymisation, not perfect anonymisation - STUDENT_ID_SALT is a
shared secret configured identically across services (env var, not
committed), not a per-service private key; anyone with the salt and a
guess at the real ID can still verify a match. That's the realistic bound
for a system that must also let a student see their own data and a
teacher see whose data is whose - true irreversible anonymisation would
mean no one could ever re-identify a struggling student to help them,
which defeats the platform's purpose.
"""

from __future__ import annotations

import hashlib
import os

_SALT = os.environ.get("STUDENT_ID_SALT", "adaptive-learning-dev-salt-2026")


def anonymize_student_id(raw_id: str | int | None) -> str:
    if raw_id is None or raw_id == "":
        return "anon_unknown"
    digest = hashlib.sha256(f"{_SALT}:{raw_id}".encode("utf-8")).hexdigest()
    return f"anon_{digest[:16]}"
