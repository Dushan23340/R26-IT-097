"""
lesson_resources.py — Real, lesson-specific learning resources for the
weak-LO recommendations shown after a real quiz submission (lessons.py +
mastery.py), replacing data.py's RESOURCES: those were generic Bloom-level
placeholders ("Concept Mapping Tutorial", "Evidence-Based Decision Making
Guide") reused for every lesson regardless of topic - not tied to any real
URL, and not actually about the specific lesson topic.

Now holds the Learning Outcome owner's short revision notes - one PDF per
lesson x Bloom level (remember, understand, apply: the 3 levels the LO
quizzes assess) - served as static files from this service
(static/notes/<lesson_id>/<lo_name>.pdf). A note is recommended for every
level the student scored "weak" or "average" on (mastery.py); the notes
cover the level, while the emotion side is covered by
validated_recommendations.py's teacher-validated video - the two are
BLENDED in semantic_recommender.recommend_resources(), the video
answering "what to watch for this emotional state" and the note "what to
read for this Bloom level", rather than one replacing the other.

All 6 lessons have all 3 levels. get_lesson_resources() still returns []
for any (lesson_id, lo_name) not in the dict below - callers already treat
"no resources" as expected, not an error.
"""

from __future__ import annotations

import os

# The frontend (localhost:3002) has no proxy for this backend's /static -
# a bare "/static/..." path would resolve against the FRONTEND's own
# origin and 404, so this needs the backend's own absolute origin.
#
# The 127.0.0.1 default is only right for a single-machine run: opened from
# another device on the LAN (a live-class laptop hitting this machine by
# IP), a 127.0.0.1 note link resolves to THAT device's own localhost and
# fails. scripts/start-all.sh sets ADAPTIVE_LEARNING_SELF_URL to this
# machine's LAN IP explicitly, and scripts/set-lan-ip.sh rewrites the IP
# literal below (same as it does for emotion-backend's CORS config) for a
# manual restart without that env var.
_SELF_URL = os.environ.get("ADAPTIVE_LEARNING_SELF_URL", "http://127.0.0.1:5005")


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
    "sets": "Sets",
}

NOTE_LEVELS = ["remember", "understand", "apply"]

# lesson_id -> lo_name -> [resource, ...]
LESSON_RESOURCES: dict[str, dict[str, list[dict]]] = {
    lesson_id: {lo: [_note(lesson_id, lo, title)] for lo in NOTE_LEVELS}
    for lesson_id, title in _LESSON_TITLES.items()
}


def get_lesson_resources(lesson_id: str, lo_name: str) -> list[dict]:
    return LESSON_RESOURCES.get(lesson_id, {}).get(lo_name, [])
