"""
lesson_resources.py — Real, lesson-specific learning resources for the
weak-LO recommendations shown after a real quiz submission (lessons.py +
mastery.py), replacing data.py's RESOURCES: those were generic Bloom-level
placeholders ("Concept Mapping Tutorial", "Evidence-Based Decision Making
Guide") reused for every lesson regardless of topic - not tied to any real
URL, and not actually about the specific lesson topic.

Now holds teacher-prepared short revision notes (one PDF per lesson x
Bloom level - "remember" through "create") as PDF resources, served as
static files from this service (static/notes/<lesson_id>/<lo_name>.pdf).
These are BLENDED with validated_recommendations.py's teacher-validated
video in semantic_recommender.recommend_resources() - the video answers
"what to watch for this emotional state", the note answers "what to read
for this Bloom level" - rather than one replacing the other.

Coverage is real, not complete: 5 of the 6 lessons have full remember
through create coverage (binary-numbers, fractions-bodmas,
number-patterns, percentages, sets - see below), except:
  - area-of-shapes is missing analyze and create (not prepared upstream)
  - sets has no notes at all (none prepared upstream)
get_lesson_resources() returns [] for any (lesson_id, lo_name) not in the
dict below - callers already treat "no resources" as expected, not an
error, so these gaps degrade silently rather than needing a special case.
"""

from __future__ import annotations

import os

# The frontend (localhost:3002) has no proxy for this backend's /static -
# a bare "/static/..." path would resolve against the FRONTEND's own
# origin and 404, so this needs the backend's own absolute origin, same
# PORT default app.py itself uses.
_SELF_URL = os.environ.get("ADAPTIVE_LEARNING_SELF_URL", f"http://127.0.0.1:{os.environ.get('PORT', 5005)}")


def _note_url(lesson_id: str, lo_name: str) -> str:
    return f"{_SELF_URL}/static/notes/{lesson_id}/{lo_name}.pdf"


def _note(lesson_id: str, lo_name: str, lesson_title: str) -> dict:
    return {
        "id": f"note-{lesson_id}-{lo_name}",
        "title": f"{lesson_title} — {lo_name.capitalize()} Level Short Notes",
        "type": "note",
        "difficulty": "medium",
        "url": _note_url(lesson_id, lo_name),
    }


_LESSON_TITLES = {
    "area-of-shapes": "Area",
    "binary-numbers": "Binary Numbers",
    "fractions-bodmas": "Fractions",
    "number-patterns": "Number Patterns",
    "percentages": "Percentages",
}

# lesson_id -> lo_name -> [resource, ...]. Every lesson here has one note
# per Bloom level actually prepared (see module docstring for the two gaps).
LESSON_RESOURCES: dict[str, dict[str, list[dict]]] = {
    "area-of-shapes": {
        lo: [_note("area-of-shapes", lo, _LESSON_TITLES["area-of-shapes"])]
        for lo in ["remember", "understand", "apply", "evaluate"]
    },
    "binary-numbers": {
        lo: [_note("binary-numbers", lo, _LESSON_TITLES["binary-numbers"])]
        for lo in ["remember", "understand", "apply", "analyze", "evaluate", "create"]
    },
    "fractions-bodmas": {
        lo: [_note("fractions-bodmas", lo, _LESSON_TITLES["fractions-bodmas"])]
        for lo in ["remember", "understand", "apply", "analyze", "evaluate", "create"]
    },
    "number-patterns": {
        lo: [_note("number-patterns", lo, _LESSON_TITLES["number-patterns"])]
        for lo in ["remember", "understand", "apply", "analyze", "evaluate", "create"]
    },
    "percentages": {
        lo: [_note("percentages", lo, _LESSON_TITLES["percentages"])]
        for lo in ["remember", "understand", "apply", "analyze", "evaluate", "create"]
    },
}


def get_lesson_resources(lesson_id: str, lo_name: str) -> list[dict]:
    return LESSON_RESOURCES.get(lesson_id, {}).get(lo_name, [])
