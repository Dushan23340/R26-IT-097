"""quiz_gen/generator.py — Assembles one fresh, fully-answered 12-question
quiz instance per request, in the Learning Outcome quizzes' format: 5
remember + 5 understand + 2 apply questions (the 3 Bloom levels those
quizzes assess). Each slot is filled by a template (templates.py) chosen via
the trained selector (model.py) among the templates the registry says are
valid for that level - solver-backed parameterised templates (fresh random
numbers each time) plus the LO owner's own verified questions (bank.py),
limited to Quiz 1 on a first attempt and Quiz 2 on a retake.

Mirrors lessons.py's question shape exactly (id, lo_level, difficulty,
question, answer, optional accepted_answers/answer_type) so downstream code
(mastery.py's _is_correct, semantic_recommender.py) works unmodified
whether it's looking at static or generated content.
"""

from __future__ import annotations

import random

from . import model as M
from . import templates as T

LEVELS = ["remember", "understand", "apply"]
SLOTS = {"remember": 5, "understand": 5, "apply": 2}
PREFIX = {"remember": "r", "understand": "u", "apply": "a"}
DIFFICULTY = {"remember": "easy", "understand": "easy", "apply": "medium"}

SUPPORTED_LESSONS = set(T.TEMPLATES_BY_LESSON.keys())

MAX_ATTEMPTS_PER_QUESTION = 8


def _concept_allowed(tmpl, used_concepts: dict[str, set[bool]]) -> bool:
    """A pool template and a bank item tagged with the same concept ask the
    same thing in different words - never put both in one quiz. Two bank
    items sharing a concept are fine (the LO owner wrote both into the same
    quiz deliberately)."""
    if not tmpl.concept or tmpl.concept not in used_concepts:
        return True
    if tmpl.is_bank:
        return False not in used_concepts[tmpl.concept]
    return False


def _fill_level(lesson_id: str, level: str, quiz_set: int, rng: random.Random,
                seen_questions: set[str], used_concepts: dict[str, set[bool]]) -> list[dict]:
    candidates = T.templates_for(lesson_id, level, quiz_set)
    if not candidates:
        raise ValueError(f"No templates registered for {lesson_id}/{level}")

    filled = []
    used_template_ids: set[str] = set()
    for i in range(1, SLOTS[level] + 1):
        # Prefer a template not already used for this level's other slots -
        # the model's learned weighting can otherwise concentrate heavily
        # on whichever template it scores highest, filling every slot of a
        # level with the same question type (different numbers, but the
        # same structure) instead of genuinely varied questions. Only
        # falls back to reuse when a level runs out of fresh templates.
        allowed = [c for c in candidates if _concept_allowed(c, used_concepts)] or candidates
        fresh_candidates = [c for c in allowed if c.template_id not in used_template_ids]
        pool = fresh_candidates or allowed
        for _ in range(MAX_ATTEMPTS_PER_QUESTION):
            tmpl = M.select_template(lesson_id, level, pool, rng)
            item = tmpl.generate(rng)
            if item["question"] not in seen_questions:
                break
        else:
            # The learned weighting kept landing on text already in this
            # quiz (e.g. a sampled "What is the value of 2^1?" that a bank
            # question also asks) - walk the remaining templates instead of
            # accepting a duplicate.
            for alternative in rng.sample(allowed, len(allowed)):
                candidate_item = alternative.generate(rng)
                if candidate_item["question"] not in seen_questions:
                    tmpl, item = alternative, candidate_item
                    break
        used_template_ids.add(tmpl.template_id)
        if tmpl.concept:
            used_concepts.setdefault(tmpl.concept, set()).add(tmpl.is_bank)
        seen_questions.add(item["question"])
        question = {
            "id": f"{lesson_id[:2]}g-{PREFIX[level]}{i}",
            "lo_level": level,
            "difficulty": DIFFICULTY[level],
            "set": quiz_set,
            "question": item["question"],
            "answer": item["answer"],
        }
        if "accepted_answers" in item:
            question["accepted_answers"] = item["accepted_answers"]
        if "answer_type" in item:
            question["answer_type"] = item["answer_type"]
        filled.append(question)
    return filled


def generate_quiz(lesson_id: str, title: str, subject: str, rng: random.Random | None = None,
                  quiz_set: int = 1) -> dict:
    """Returns the full instance (WITH answers) - callers must strip
    answers before sending anything to the client. Use store.py to keep
    the full instance server-side and hand out only an opaque id.
    quiz_set 1 = first attempt (bank items from Quiz 1), 2 = retake
    (bank items from Quiz 2)."""
    if lesson_id not in SUPPORTED_LESSONS:
        raise ValueError(f"{lesson_id} is not a generation-supported lesson")
    if quiz_set not in (1, 2):
        quiz_set = 1

    rng = rng or random.Random()
    seen_questions: set[str] = set()
    used_concepts: dict[str, set[bool]] = {}
    questions = []
    for level in LEVELS:
        questions.extend(_fill_level(lesson_id, level, quiz_set, rng, seen_questions, used_concepts))

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
