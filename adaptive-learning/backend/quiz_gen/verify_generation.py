"""quiz_gen/verify_generation.py — Batch correctness harness.

Generates N full 12-question quiz instances per lesson, for both quiz
sets (1 = first attempt, 2 = retake), and asserts:
  - every quiz has 5 remember + 5 understand + 2 apply questions (12 total)
  - every answer self-grades correct via the real mastery._is_correct
    (the same function that scores real student submissions)
  - no bank item from the other quiz set is ever used
  - no quiz contains both a pool template and a bank item with the same
    `concept` (the same question asked twice in different words)
  - every question is well-formed (non-empty text and answer)
  - across many generations, every registered template for a lesson gets
    used at least once (dead templates would mean thinner real variety
    than the registry claims)

Usage: .venv/bin/python3 -m quiz_gen.verify_generation [n_per_lesson]
"""

from __future__ import annotations

import random
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from mastery import _is_correct  # noqa: E402
from quiz_gen import templates as T  # noqa: E402
from quiz_gen.generator import LEVELS, SLOTS, generate_quiz  # noqa: E402

LESSON_TITLES = {
    "number-patterns": ("Number Patterns", "Mathematics"),
    "fractions-bodmas": ("Fractions & BODMAS", "Mathematics"),
    "binary-numbers": ("Binary Numbers", "Mathematics"),
    "area-of-shapes": ("Area", "Mathematics"),
    "percentages": ("Percentages", "Mathematics"),
    "sets": ("Sets", "Mathematics"),
}


def verify(n_per_lesson: int = 1000) -> bool:
    from quiz_gen import model as M

    total = sum(SLOTS.values())
    all_ok = True
    for lesson_id, (title, subject) in LESSON_TITLES.items():
        errors = []
        template_usage: Counter[str] = Counter()
        n_quizzes = 0

        for quiz_set in (1, 2):
            rng = random.Random(123 + quiz_set)
            chosen: list = []
            original_select = M.select_template

            def _tracking_select(lesson_id_, level_, candidates_, rng_, _orig=original_select, _chosen=chosen):
                tmpl = _orig(lesson_id_, level_, candidates_, rng_)
                _chosen.append(tmpl)
                return tmpl

            M.select_template = _tracking_select
            try:
                for _ in range(n_per_lesson):
                    chosen.clear()
                    quiz = generate_quiz(lesson_id, title, subject, rng=rng, quiz_set=quiz_set)
                    n_quizzes += 1
                    for tmpl in chosen:
                        template_usage[tmpl.template_id] += 1
                        if tmpl.is_bank and tmpl.quiz_set != quiz_set:
                            errors.append(f"set {quiz_set} quiz used {tmpl.template_id} from quiz set {tmpl.quiz_set}")

                    kinds_by_concept: dict[str, set[bool]] = {}
                    for tmpl in chosen:
                        if tmpl.concept:
                            kinds_by_concept.setdefault(tmpl.concept, set()).add(tmpl.is_bank)
                    for concept, kinds in kinds_by_concept.items():
                        if kinds == {True, False}:
                            errors.append(f"concept {concept!r} asked twice (pool + bank) in one quiz")

                    if len(quiz["questions"]) != total:
                        errors.append(f"expected {total} questions, got {len(quiz['questions'])}")
                        continue

                    per_level = Counter(q["lo_level"] for q in quiz["questions"])
                    for level in LEVELS:
                        if per_level[level] != SLOTS[level]:
                            errors.append(f"level {level} has {per_level[level]} questions, expected {SLOTS[level]}")

                    texts = [q["question"] for q in quiz["questions"]]
                    if len(set(texts)) != len(texts):
                        errors.append("duplicate question text within one quiz")

                    for q in quiz["questions"]:
                        if not q["question"].strip() or not str(q["answer"]).strip():
                            errors.append(f"empty question/answer: {q}")
                            continue
                        if not _is_correct(q, q["answer"]):
                            errors.append(f"answer {q['answer']!r} fails self-check: {q['question']!r}")
            finally:
                M.select_template = original_select

        registered_ids = {t.template_id for t in T.TEMPLATES_BY_LESSON[lesson_id]}
        unused = registered_ids - set(template_usage.keys())
        if unused:
            errors.append(f"templates never selected across {n_quizzes} generations: {sorted(unused)}")

        status = "OK" if not errors else "FAILED"
        print(f"[{status}] {lesson_id}: {n_quizzes} quizzes ({n_quizzes * total} questions), "
              f"{len(registered_ids)} templates registered, {len(registered_ids) - len(unused)} used, "
              f"{len(errors)} errors")
        for e in sorted(set(errors))[:15]:
            print("   -", e)
        if errors:
            all_ok = False

    return all_ok


if __name__ == "__main__":
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 1000
    ok = verify(n)
    sys.exit(0 if ok else 1)
