"""Fairness Auditing Module (SO4, proposal Table 8 "Fairness Audit").

Two real statistical checks, not a single opaque score:

  1. Disparate impact analysis - the standard "80% rule": each demographic
     group's proficiency-achievement rate is compared against the most
     favorable group's rate. A ratio outside [0.8, 1.25] is flagged.
  2. Variance calibration check (Levene's test) - flags when the
     assessment's score variance differs significantly across groups,
     which would mean it isn't measuring equally reliably for everyone.

Both need demographic_group populated on student_profiles (migration_001)
and are skipped gracefully when there's too little data to say anything
statistically meaningful, rather than emitting a false-confidence number.
"""

from __future__ import annotations

from collections import defaultdict
from statistics import mean
from typing import Any

from scipy import stats

DISPARATE_IMPACT_LOWER = 0.8
DISPARATE_IMPACT_UPPER = 1.25
MASTERY_THRESHOLD = 75.0  # matches IT22186492's percentile mastery threshold
MIN_STUDENTS_PER_GROUP = 3


def compute_disparate_impact(
    student_avg_scores: dict[str, float],
    student_groups: dict[str, str],
) -> dict[str, Any]:
    """student_avg_scores: {student_id: mean LO score}.
    student_groups: {student_id: demographic_group}."""
    by_group: dict[str, list[float]] = defaultdict(list)
    for student_id, score in student_avg_scores.items():
        group = student_groups.get(student_id)
        if group:
            by_group[group].append(score)

    eligible_groups = {g: scores for g, scores in by_group.items() if len(scores) >= MIN_STUDENTS_PER_GROUP}
    if len(eligible_groups) < 2:
        return {
            "available": False,
            "reason": f"need at least 2 demographic groups with {MIN_STUDENTS_PER_GROUP}+ students each",
            "groups_seen": {g: len(s) for g, s in by_group.items()},
        }

    proficiency_rates = {
        group: sum(1 for s in scores if s >= MASTERY_THRESHOLD) / len(scores)
        for group, scores in eligible_groups.items()
    }
    reference_rate = max(proficiency_rates.values())

    ratios = {}
    flagged = []
    for group, rate in proficiency_rates.items():
        ratio = (rate / reference_rate) if reference_rate > 0 else 1.0
        ratios[group] = round(ratio, 4)
        if ratio < DISPARATE_IMPACT_LOWER or ratio > DISPARATE_IMPACT_UPPER:
            flagged.append(group)

    return {
        "available": True,
        "mastery_threshold": MASTERY_THRESHOLD,
        "proficiency_rates": {g: round(r, 4) for g, r in proficiency_rates.items()},
        "disparate_impact_ratios": ratios,
        "acceptable_range": [DISPARATE_IMPACT_LOWER, DISPARATE_IMPACT_UPPER],
        "flagged_groups": flagged,
        "fair": len(flagged) == 0,
    }


def compute_variance_calibration(
    student_avg_scores: dict[str, float],
    student_groups: dict[str, str],
) -> dict[str, Any]:
    """Levene's test for equal variances across demographic groups' score
    distributions - large, significant differences suggest the assessment
    isn't equally consistent/reliable for every group."""
    by_group: dict[str, list[float]] = defaultdict(list)
    for student_id, score in student_avg_scores.items():
        group = student_groups.get(student_id)
        if group:
            by_group[group].append(score)

    eligible = [scores for scores in by_group.values() if len(scores) >= MIN_STUDENTS_PER_GROUP]
    if len(eligible) < 2:
        return {
            "available": False,
            "reason": f"need at least 2 demographic groups with {MIN_STUDENTS_PER_GROUP}+ students each",
        }

    statistic, p_value = stats.levene(*eligible)

    return {
        "available": True,
        "levene_statistic": round(float(statistic), 4),
        "p_value": round(float(p_value), 4),
        "equal_variance": bool(p_value >= 0.05),
        "group_variances": {
            group: round(float(np_var(scores)), 4)
            for group, scores in by_group.items()
            if len(scores) >= MIN_STUDENTS_PER_GROUP
        },
    }


def np_var(values: list[float]) -> float:
    m = mean(values)
    return sum((v - m) ** 2 for v in values) / len(values)
