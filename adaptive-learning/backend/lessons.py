"""
lessons.py — Real per-lesson quiz content: genuine questions with correct
answers, difficulty, and Bloom's cognitive-level tags.

6 lessons (number-patterns, fractions-bodmas, area-of-shapes,
binary-numbers, percentages, sets) - exactly the ones covered by
validated_recommendations.py's teacher-validated (lesson x emotion) video
table. Each lesson's static questions are the Learning Outcome owner's two
textbook-aligned quizzes (quiz_gen/bank.py), verbatim: set 1 = Quiz 1
(first attempt), set 2 = Quiz 2 (retake), each 5 remember + 5 understand +
2 apply. In normal operation quiz_gen generates a fresh quiz per request in
this same format (drawing on these same questions); these static sets are
the fallback if generation fails.

fractions-bodmas, area-of-shapes, and number-patterns are deliberately
the same lesson_ids tagged onto real playable games in emotion-backend's
game_catalog.py (Fraction Room Rescue, Fish Tank Shop, Pattern Islands) -
this is what lets the Teacher Console's Game Recommendation Engine offer
a game genuinely related to the lesson the teacher picked, not just its
subject.
"""

from quiz_gen.bank import bank_items

_LESSON_META = {
    "fractions-bodmas": "Fractions & BODMAS",
    "number-patterns": "Number Patterns",
    "area-of-shapes": "Area",
    "binary-numbers": "Binary Numbers",
    "percentages": "Percentages",
    "sets": "Sets",
}

_DIFFICULTY = {"remember": "easy", "understand": "easy", "apply": "medium"}

# Short id prefix per lesson, matching the ids the previous hand-written
# content used (np-, fr-, ...), so stored attempts stay readable.
_ID_PREFIX = {
    "fractions-bodmas": "fr", "number-patterns": "np", "area-of-shapes": "ar",
    "binary-numbers": "bn", "percentages": "pc", "sets": "st",
}


def _static_questions(lesson_id):
    questions = []
    for quiz_set in (1, 2):
        for level, code, i, item in bank_items(lesson_id, quiz_set):
            question = {
                "id": f"{_ID_PREFIX[lesson_id]}-q{quiz_set}-{code}{i}",
                "lo_level": level,
                "difficulty": _DIFFICULTY[level],
                "set": quiz_set,
                "question": item["question"],
                "answer": item["answer"],
            }
            if "accepted_answers" in item:
                question["accepted_answers"] = item["accepted_answers"]
            if "answer_type" in item:
                question["answer_type"] = item["answer_type"]
            questions.append(question)
    return questions


LESSONS = {
    lesson_id: {"title": title, "subject": "Mathematics", "questions": _static_questions(lesson_id)}
    for lesson_id, title in _LESSON_META.items()
}


def get_lesson(lesson_id):
    return LESSONS.get(lesson_id)


def list_lessons():
    return [
        {
            "lesson_id": lid,
            "title": l["title"],
            "subject": l["subject"],
            # Count for quiz_set 1 specifically (what a student actually
            # sees on their first attempt), not the full question bank -
            # pilot-format lessons have a second, equally-sized retake set
            # that would otherwise double this number.
            "question_count": sum(1 for q in l["questions"] if q.get("set", 1) == 1),
        }
        for lid, l in LESSONS.items()
    ]


# Curriculum-judgment difficulty tag per lesson (easy/medium/hard), used by
# IT22197146's analytics-service for its "lesson difficulty vs achievement"
# analysis (learning_sessions.difficulty). Deliberately NOT derived from the
# quiz questions' own per-LO-level difficulty tags above - every lesson has
# an identical 10-easy/2-medium Bloom-level split, so that would give
# every lesson the same value and make the analysis meaningless. This is a
# genuine, distinguishing per-lesson judgment instead.
LESSON_DIFFICULTY = {
    "percentages": "easy",
    "number-patterns": "medium",
    "fractions-bodmas": "medium",
    "area-of-shapes": "medium",
    "binary-numbers": "hard",
    "sets": "hard",
}


def get_lesson_difficulty(lesson_id):
    return LESSON_DIFFICULTY.get(lesson_id)


def get_quiz_for_lesson(lesson_id, quiz_set=1):
    """Question (+ options, for legacy MCQ lessons) only - the answer key
    never goes to the client. Lessons not yet migrated to the free-text
    pilot format have no "set" field on their questions at all - treated as
    set 1 implicitly, so requesting quiz_set=2 against one of them falls
    back to returning its one and only set rather than an empty quiz."""
    lesson = get_lesson(lesson_id)
    if not lesson:
        return None

    questions = [q for q in lesson["questions"] if q.get("set", 1) == quiz_set]
    if not questions and quiz_set != 1:
        questions = [q for q in lesson["questions"] if q.get("set", 1) == 1]
        quiz_set = 1

    return {
        "lesson_id": lesson_id,
        "title": lesson["title"],
        "subject": lesson["subject"],
        "quiz_set": quiz_set,
        "questions": [
            {
                "id": q["id"], "lo_level": q["lo_level"], "difficulty": q["difficulty"],
                "question": q["question"],
                **({"options": q["options"]} if "options" in q else {}),
            }
            for q in questions
        ],
    }
