"""
mastery.py — Raw-correct-count mastery tiers per Learning Outcome.

    Per-LO tier, as set by the Learning Outcome quizzes (5 remember + 5
    understand + 2 apply questions):
      remember / understand (5 items): 4-5 correct -> "good",
                                       3 -> "average", 0-2 -> "weak"
      apply (2 items):                 2 -> "good", 1 -> "average", 0 -> "weak"
    (legacy 3-item LOs keep 3 -> good, 2 -> average, 0-1 -> weak; any other
    count is scored proportionally - see TIER_THRESHOLDS below).

Replaces the previous difficulty x cognitive-level weighted percentile
model (75% threshold): that formula is gone, but `percentile_mastery_score`,
`mastered`, and `overall_percentile_mastery` are still returned (now simple
correct/total percentages) so analytics_bridge.py's push to analytics-service
and profile.jsx's mastery trend chart keep working unmodified. The new
primary signal is `mastery_tier` ("good"/"average"/"weak") per LO.

Quizzes are versioned via `quiz_set` (1 or 2) so a retake quiz can use a
different set of questions per LO than the first attempt - questions are
tagged `"set": 1|2` in lessons.py (Quiz 1 / Quiz 2 of the LO quizzes).
"""

from __future__ import annotations

import re

from lessons import get_lesson

# Exact (good_min, average_min) correct-count thresholds per LO item count:
# 5 and 2 are the LO quizzes' remember/understand and apply sizes, 3 the
# previous 3-per-level format (kept so older stored attempts re-score the
# same). Any other count falls back to the proportional ratios below.
TIER_THRESHOLDS = {5: (4, 3), 3: (3, 2), 2: (2, 1)}

# correct/total ratio thresholds for any other LO size.
# >= 0.9 -> good (e.g. 2/2, 5/5), >= 0.5 -> average (e.g. 1/2, 3/5), else weak.
PROPORTIONAL_GOOD_RATIO = 0.9
PROPORTIONAL_AVERAGE_RATIO = 0.5


def _normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", str(value).strip().lower())


def _normalize_fraction(value: str):
    """Mirrors the normalizeFraction() verified in fraction-chef-recipe-rescue.jsx -
    accepts whole numbers, simple fractions, and mixed numbers, reduced to
    lowest terms so equivalent-but-unreduced answers (e.g. "8/12" for "2/3")
    are accepted."""
    cleaned = str(value).strip()
    if not cleaned:
        return None

    def _reduce(num: int, den: int):
        if den == 0:
            return None
        if num == 0:
            return (0, 1)
        a, b = abs(num), abs(den)
        while b:
            a, b = b, a % b
        g = a or 1
        return (num // g, den // g)

    m = re.fullmatch(r"(\d+)\s+(\d+)\s*/\s*(\d+)", cleaned)
    if m:
        whole, num, den = int(m.group(1)), int(m.group(2)), int(m.group(3))
        return _reduce(whole * den + num, den)

    m = re.fullmatch(r"(\d+)\s*/\s*(\d+)", cleaned)
    if m:
        return _reduce(int(m.group(1)), int(m.group(2)))

    m = re.fullmatch(r"(\d+)", cleaned)
    if m:
        return _reduce(int(m.group(1)), 1)

    return None


# Semantic-similarity fallback for free-text answers that don't literally
# match `answer` or any `accepted_answers` entry the content author wrote -
# catches a student who typed a genuinely correct answer in words the
# author didn't anticipate. Reuses the exact Sentence-BERT model
# semantic_recommender.py already loads for resource ranking (same
# lru_cache'd singleton - no second model in memory, no extra dependency).
#
# Calibrated empirically against this lesson content (paraphrase vs.
# plausible-wrong-answer pairs for set-theory/percentage/commission
# definitions): every wrong-answer similarity observed stayed below 0.76,
# so 0.80 sits with a safety margin above the highest false positive found,
# at the cost of also rejecting some genuine paraphrases whose similarity
# fell short of it (~0.70-0.78) - a deliberate precision-over-recall
# choice, since in this system a false positive (crediting a wrong answer)
# is worse than a false negative (a correct paraphrase marked wrong still
# only trips a recommendation, not an incorrect mastery signal).
_SEMANTIC_SIMILARITY_THRESHOLD = 0.80

# Sentence embeddings are known to be largely insensitive to negation and
# clause order - calibration testing found a student who swapped the two
# halves of a finite-vs-infinite-set definition (definitively WRONG) scored
# HIGHER (0.92) against the canonical answer than an honestly correct
# paraphrase of the same question (0.78). Any canonical answer with
# contrastive structure is excluded from the semantic fallback entirely,
# falling back to exact/accepted_answers matching only for those questions.
_CONTRAST_MARKERS = (";", " while ", " whereas ", " but ", " versus ", " vs ", " compared to ")


def _is_comparison_answer(text: str) -> bool:
    lowered = f" {str(text).lower()} "
    return any(marker in lowered for marker in _CONTRAST_MARKERS)


def _is_conceptual_answer(text: str) -> bool:
    """Semantic similarity is only reliable for concept/definition answers
    ("Brackets", "A set with no elements") - not bare numbers, fractions,
    or short symbolic answers ("6/11", "45%", "x"), where two embeddings
    can look deceptively similar despite representing different values.
    Those are already covered by exact matching (or, for real fractions,
    _normalize_fraction's mathematical equivalence check above)."""
    stripped = str(text).strip()
    return len(stripped) >= 4 and bool(re.search(r"[a-zA-Z]{3,}", stripped))


def _is_semantically_correct(selected: str, candidates: list[str]) -> bool:
    selected = str(selected).strip()
    if not selected:
        return False
    try:
        from semantic_recommender import _get_model
        from sentence_transformers import util
    except Exception:
        return False  # sentence-transformers unavailable - fail closed, no unearned credit

    model = _get_model()
    selected_embedding = model.encode(selected, convert_to_tensor=True)
    candidate_embeddings = model.encode(candidates, convert_to_tensor=True)
    similarities = util.cos_sim(selected_embedding, candidate_embeddings)[0].tolist()
    return max(similarities) >= _SEMANTIC_SIMILARITY_THRESHOLD


# Same symbol typed several ways ("×" / "x" / "*", "²" / "^2", "π" / "pi",
# unicode minus) - folded together, with all whitespace removed, before
# comparing formula-style answers like "1/2 × (a + b) × h" or "3n - 2".
_SYMBOL_FOLDS = {"×": "x", "*": "x", "·": "x", "−": "-", "–": "-", "²": "^2", "½": "1/2", "π": "pi", "ₙ": "n"}


def _compact(value: str) -> str:
    text = str(value).strip().lower()
    for symbol, replacement in _SYMBOL_FOLDS.items():
        text = text.replace(symbol, replacement)
    return re.sub(r"\s+", "", text).rstrip(".")


# A plain number, optionally with "Rs"/"Rs." in front and a unit, % or
# ordinal after it - so "Rs. 23,750", "68 cm²", "20 %" and "25th term" all
# grade against a bare numeric answer key ("23750", "68", "20%", "25").
_NUMERIC_ANSWER = re.compile(
    r"(?:rs\.?|rupees)?(-?\d+(?:\.\d+)?)"
    r"(?:%|percent|(?:st|nd|rd|th)(?:term)?|cm\^2|m\^2|cm2|m2|sqcm|cm|km|m|kg|g|metres|meters|seats|rupees|rs)?"
)


def _numeric_value(value: str):
    match = _NUMERIC_ANSWER.fullmatch(_compact(value).replace(",", ""))
    return float(match.group(1)) if match else None


def _parse_set(text: str):
    """"{1, 3, 5}" -> frozenset({"1", "3", "5"}); also accepts the bare
    element list ("1, 3, 5") and φ / ∅ / "{ }" for the empty set. Order and
    spacing never matter - {3, 1} and {1,3} are the same set."""
    cleaned = str(text).strip().replace("φ", "{}").replace("∅", "{}")
    if cleaned.startswith("{") and cleaned.endswith("}"):
        cleaned = cleaned[1:-1]
    elif "{" in cleaned or "}" in cleaned:
        return None
    elements = [e.strip().lower() for e in cleaned.split(",") if e.strip()]
    return frozenset(elements)


def _parse_set_list(text: str):
    """"{}, {1}, {2}, {1, 2}" -> {frozenset(), {"1"}, {"2"}, {"1","2"}} -
    for "write all the subsets" answers, in any order."""
    cleaned = str(text).replace("φ", "{}").replace("∅", "{}")
    groups = re.findall(r"\{[^{}]*\}", cleaned)
    if not groups:
        return None
    parsed = [_parse_set(g) for g in groups]
    return parsed if None not in parsed else None


def _is_correct(question: dict, selected) -> bool:
    if selected is None:
        return False

    answer_type = question.get("answer_type")
    if answer_type == "fraction":
        parsed = _normalize_fraction(selected)
        target = _normalize_fraction(question["answer"])
        return parsed is not None and parsed == target

    if answer_type == "set":
        parsed = _parse_set(selected)
        return parsed is not None and parsed == _parse_set(question["answer"])

    if answer_type == "set_list":
        parsed = _parse_set_list(selected)
        target = _parse_set_list(question["answer"])
        return parsed is not None and len(parsed) == len(set(parsed)) and set(parsed) == set(target)

    candidates = [question["answer"], *question.get("accepted_answers", [])]
    normalized_selected = _normalize_text(selected)
    if any(normalized_selected == _normalize_text(c) for c in candidates):
        return True

    compact_selected = _compact(selected)
    if compact_selected and any(compact_selected == _compact(c) for c in candidates):
        return True

    target_number = _numeric_value(question["answer"])
    if target_number is not None:
        selected_number = _numeric_value(selected)
        return selected_number is not None and selected_number == target_number

    canonical_answer = question["answer"]
    if not _is_conceptual_answer(canonical_answer) or _is_comparison_answer(canonical_answer):
        return False

    return _is_semantically_correct(str(selected), candidates)


def _tier_for(correct_count: int, total_count: int) -> str:
    if total_count in TIER_THRESHOLDS:
        good_min, average_min = TIER_THRESHOLDS[total_count]
        if correct_count >= good_min:
            return "good"
        if correct_count >= average_min:
            return "average"
        return "weak"

    if total_count == 0:
        return "weak"
    ratio = correct_count / total_count
    if ratio >= PROPORTIONAL_GOOD_RATIO:
        return "good"
    if ratio >= PROPORTIONAL_AVERAGE_RATIO:
        return "average"
    return "weak"


def score_submission(lesson_id: str, answers: dict[str, str], quiz_set: int = 1) -> dict:
    """answers: {question_id: free-text submitted answer}."""
    lesson = get_lesson(lesson_id)
    if not lesson:
        raise ValueError(f"Unknown lesson: {lesson_id}")

    # Lessons not yet migrated to the pilot format have no "set" field -
    # treat them as belonging to set 1 only, so a set=2 request against
    # an unmigrated lesson naturally falls back to its one and only set.
    questions = [q for q in lesson["questions"] if q.get("set", 1) == quiz_set]
    return _score_questions(lesson_id, questions, answers, quiz_set)


def score_generated_submission(lesson_id: str, questions: list[dict], answers: dict[str, str], instance_id: str) -> dict:
    """Same scoring as score_submission, but against a quiz_gen-generated
    instance's questions (passed in directly, not looked up from the
    static LESSONS dict) - used for the pilot lessons where every quiz is
    freshly generated per request. `instance_id` is echoed back in the
    result's quiz_set field exactly like a static quiz_set int would be,
    since the frontend already treats that field as an opaque round-trip
    value."""
    return _score_questions(lesson_id, questions, answers, instance_id)


def _score_questions(lesson_id: str, questions: list[dict], answers: dict[str, str], quiz_set) -> dict:
    per_lo_items: dict[str, list[dict]] = {}
    for q in questions:
        selected = answers.get(q["id"])
        correct = _is_correct(q, selected)
        per_lo_items.setdefault(q["lo_level"], []).append({
            "question_id": q["id"],
            "correct": correct,
            "difficulty": q["difficulty"],
        })

    lo_scores = {}
    for lo, items in per_lo_items.items():
        correct_count = sum(1 for i in items if i["correct"])
        total_count = len(items)
        tier = _tier_for(correct_count, total_count)
        percentile = round((correct_count / total_count) * 100, 2) if total_count else 0.0

        lo_scores[lo] = {
            "percentile_mastery_score": percentile,
            "mastered": tier == "good",
            "mastery_tier": tier,
            "items": items,
            "correct_count": correct_count,
            "total_count": total_count,
        }

    overall = round(sum(v["percentile_mastery_score"] for v in lo_scores.values()) / len(lo_scores), 2) if lo_scores else 0.0

    needs_recommendation = [lo for lo, v in lo_scores.items() if v["mastery_tier"] != "good"]

    return {
        "lesson_id": lesson_id,
        "quiz_set": quiz_set,
        "overall_percentile_mastery": overall,
        "lo_scores": lo_scores,
        "weak_los": needs_recommendation,
        "strong_los": [lo for lo, v in lo_scores.items() if v["mastery_tier"] == "good"],
        "good_los": [lo for lo, v in lo_scores.items() if v["mastery_tier"] == "good"],
    }
