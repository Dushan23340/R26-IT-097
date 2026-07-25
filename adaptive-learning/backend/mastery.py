"""
mastery.py — Weighted percentile mastery model (proposal SO2 / 3.2):

    Percentile Mastery Score = Weighted Correctness x Difficulty x Cognitive Level

Applied at two levels rather than one flat multiplication:

  - Per-LO score = difficulty-weighted correctness, self-normalized to
    that LO's own items (0-100). Harder items within the LO count more
    toward both the numerator and denominator, but answering every item
    correctly always reaches 100 regardless of which Bloom level it is -
    normalizing every LO against the single global hardest combination
    ("create" x "hard") makes it mathematically impossible to ever
    "master" lower Bloom levels even at 100% correct, which was caught by
    testing against a perfect-score submission before this was fixed.

  - Overall score = per-LO scores combined with cognitive-level weights,
    so higher-order thinking (analyze/evaluate/create) counts more toward
    the overall grade than recall - this is where "Cognitive Level"
    actually does something, since it's constant across every item within
    a single LO and can't differentiate anything at the per-LO level.
"""

from __future__ import annotations

from lessons import get_lesson

DIFFICULTY_WEIGHT = {"easy": 1.0, "medium": 1.5, "hard": 2.0}
COGNITIVE_WEIGHT = {
    "remember": 1.0,
    "understand": 1.2,
    "apply": 1.5,
    "analyze": 1.8,
    "evaluate": 2.1,
    "create": 2.5,
}

MASTERY_THRESHOLD = 75.0  # matches the proposal's stated threshold exactly


def score_submission(lesson_id: str, answers: dict[str, str]) -> dict:
    """answers: {question_id: selected_option}."""
    lesson = get_lesson(lesson_id)
    if not lesson:
        raise ValueError(f"Unknown lesson: {lesson_id}")

    per_lo_items: dict[str, list[dict]] = {}
    for q in lesson["questions"]:
        selected = answers.get(q["id"])
        correct = selected is not None and selected == q["answer"]
        per_lo_items.setdefault(q["lo_level"], []).append({
            "question_id": q["id"],
            "correct": correct,
            "difficulty": q["difficulty"],
            "difficulty_weight": DIFFICULTY_WEIGHT[q["difficulty"]],
        })

    lo_scores = {}
    for lo, items in per_lo_items.items():
        weighted_correct = sum(i["difficulty_weight"] for i in items if i["correct"])
        weighted_total = sum(i["difficulty_weight"] for i in items)
        percentile = round((weighted_correct / weighted_total) * 100, 2) if weighted_total else 0.0

        lo_scores[lo] = {
            "percentile_mastery_score": percentile,
            "mastered": percentile >= MASTERY_THRESHOLD,
            "items": [{k: v for k, v in i.items() if k != "difficulty_weight"} for i in items],
            "correct_count": sum(1 for i in items if i["correct"]),
            "total_count": len(items),
        }

    cognitive_weight_sum = sum(COGNITIVE_WEIGHT[lo] for lo in lo_scores)
    overall = (
        round(
            sum(v["percentile_mastery_score"] * COGNITIVE_WEIGHT[lo] for lo, v in lo_scores.items())
            / cognitive_weight_sum,
            2,
        )
        if cognitive_weight_sum else 0.0
    )

    return {
        "lesson_id": lesson_id,
        "overall_percentile_mastery": overall,
        "lo_scores": lo_scores,
        "weak_los": [lo for lo, v in lo_scores.items() if not v["mastered"]],
        "strong_los": [lo for lo, v in lo_scores.items() if v["mastered"]],
    }
