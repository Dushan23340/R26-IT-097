"""quiz_gen/generator.py — Assembles one fresh, fully-answered 18-question
quiz instance for a pilot lesson: 3 questions per Bloom level, each filled
by a template (templates.py) chosen via the trained selector (model.py)
among the templates the registry says are valid for that level, with fresh
random parameters solved by solvers.py.

Mirrors lessons.py's question shape exactly (id, lo_level, difficulty,
question, answer, optional accepted_answers/answer_type) so downstream code
(mastery.py's _is_correct, semantic_recommender.py) works unmodified
whether it's looking at static or generated content.
"""

from __future__ import annotations

import random

from . import model as M
from . import templates as T

LEVELS = ["remember", "understand", "apply", "analyze", "evaluate", "create"]
PREFIX = {"remember": "r", "understand": "u", "apply": "a", "analyze": "n", "evaluate": "e", "create": "c"}
DIFFICULTY = {"remember": "easy", "understand": "easy", "apply": "medium", "analyze": "medium", "evaluate": "hard", "create": "hard"}

SUPPORTED_LESSONS = set(T.TEMPLATES_BY_LESSON.keys())

MAX_ATTEMPTS_PER_QUESTION = 8


def _fill_level(lesson_id: str, level: str, rng: random.Random, seen_questions: set[str]) -> list[dict]:
    candidates = T.templates_for(lesson_id, level)
    if not candidates:
        raise ValueError(f"No templates registered for {lesson_id}/{level}")

    filled = []
    used_template_ids: set[str] = set()
    for i in range(1, 4):
        # Prefer a template not already used for this level's other slots -
        # the model's learned weighting can otherwise concentrate heavily
        # on whichever template it scores highest, filling all 3 slots of
        # a level with the same question type (different numbers, but the
        # same structure) instead of genuinely varied questions. Only
        # falls back to reuse when a level has fewer templates than slots.
        fresh_candidates = [c for c in candidates if c.template_id not in used_template_ids]
        pool = fresh_candidates or candidates
        for _ in range(MAX_ATTEMPTS_PER_QUESTION):
            tmpl = M.select_template(lesson_id, level, pool, rng)
            item = tmpl.generate(rng)
            if item["question"] not in seen_questions:
                break
        used_template_ids.add(tmpl.template_id)
        seen_questions.add(item["question"])
        question = {
            "id": f"{lesson_id[:2]}g-{PREFIX[level]}{i}",
            "lo_level": level,
            "difficulty": DIFFICULTY[level],
            "set": 1,
            "question": item["question"],
            "answer": item["answer"],
        }
        if "accepted_answers" in item:
            question["accepted_answers"] = item["accepted_answers"]
        if "answer_type" in item:
            question["answer_type"] = item["answer_type"]
        filled.append(question)
    return filled


def generate_quiz(lesson_id: str, title: str, subject: str, rng: random.Random | None = None) -> dict:
    """Returns the full instance (WITH answers) - callers must strip
    answers before sending anything to the client. Use store.py to keep
    the full instance server-side and hand out only an opaque id."""
    if lesson_id not in SUPPORTED_LESSONS:
        raise ValueError(f"{lesson_id} is not a generation-supported lesson")

    rng = rng or random.Random()
    seen_questions: set[str] = set()
    questions = []
    for level in LEVELS:
        questions.extend(_fill_level(lesson_id, level, rng, seen_questions))

    return {
        "lesson_id": lesson_id,
        "title": title,
        "subject": subject,
        "questions": questions,
    }


def strip_answers(quiz: dict) -> dict:
    return {
        "lesson_id": quiz["lesson_id"],
        "title": quiz["title"],
        "subject": quiz["subject"],
        "questions": [
            {
                "id": q["id"], "lo_level": q["lo_level"], "difficulty": q["difficulty"],
                "question": q["question"],
            }
            for q in quiz["questions"]
        ],
    }
