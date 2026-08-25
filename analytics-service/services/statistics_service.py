"""Statistical Analytics Engine (SO2, proposal Table 8 / Appendix B).

Five analyses, each backed by a real scipy statistical test rather than a
heuristic threshold:

  1. LO trend analysis        - OLS linear regression (scipy.stats.linregress)
  2. Stability analysis       - variance/std-dev, flagged against a class-wide
                                 baseline (class mean std + 1.5 SD)
  3. Emotion-LO correlation   - Pearson's r per emotion category
  4. Engagement-performance   - Mann-Whitney U, high- vs low-engagement sessions
  5. Difficulty-vs-achievement - OLS regression of LO score against lesson
                                 difficulty (easy/medium/hard, ordinally
                                 encoded); relies on adaptive-learning's
                                 LESSON_DIFFICULTY tags flowing through
                                 learning_sessions.difficulty (see
                                 analytics_bridge.py's _push())

Fairness auditing (disparate impact, variance calibration) is a separate
concern (SO4) - see fairness_service.py.

All functions operate on rows already pulled from Postgres via
profile_service - this module has no DB access of its own, which keeps the
statistics testable against synthetic arrays without a live database.
"""

from __future__ import annotations

from collections import defaultdict
from statistics import mean, pstdev
from typing import Any, Optional

import numpy as np
from scipy import stats

MIN_SESSIONS_FOR_TREND = 3
MIN_SESSIONS_FOR_CORRELATION = 3
MIN_SESSIONS_PER_GROUP = 3
MIN_SESSIONS_FOR_DIFFICULTY = 3
TREND_SIGNIFICANCE = 0.05
CORRELATION_THRESHOLD = 0.3  # |r| below this is not "meaningful" per Table 8
ENGAGEMENT_HIGH_THRESHOLD = 0.6  # engagement_score is stored 0-1 per schema
DIFFICULTY_ORDINAL = {"easy": 1, "medium": 2, "hard": 3}


def _session_average_scores(lo_history: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Collapse per-LO-item rows into one avg score per session, ordered by
    start_time (lo_history is already sorted chronologically by the caller's
    query, so grouping preserves order)."""
    by_session: dict[str, dict[str, Any]] = {}
    order: list[str] = []
    for row in lo_history:
        sid = str(row["session_id"])
        if sid not in by_session:
            by_session[sid] = {"session_id": sid, "start_time": row["start_time"], "scores": []}
            order.append(sid)
        by_session[sid]["scores"].append(float(row["score"]))

    return [
        {
            "session_id": sid,
            "start_time": by_session[sid]["start_time"],
            "avg_score": mean(by_session[sid]["scores"]),
        }
        for sid in order
    ]


def analyze_lo_trend(lo_history: list[dict[str, Any]]) -> dict[str, Any]:
    """OLS regression of session-average LO score against session order."""
    sessions = _session_average_scores(lo_history)

    if len(sessions) < MIN_SESSIONS_FOR_TREND:
        return {
            "available": False,
            "reason": f"need at least {MIN_SESSIONS_FOR_TREND} sessions, have {len(sessions)}",
            "session_count": len(sessions),
        }

    x = np.arange(len(sessions), dtype=float)
    y = np.array([s["avg_score"] for s in sessions], dtype=float)

    result = stats.linregress(x, y)

    if result.pvalue < TREND_SIGNIFICANCE:
        direction = "improving" if result.slope > 0 else "declining"
    else:
        direction = "stable"

    return {
        "available": True,
        "session_count": len(sessions),
        "slope": round(float(result.slope), 4),
        "intercept": round(float(result.intercept), 4),
        "r_value": round(float(result.rvalue), 4),
        "p_value": round(float(result.pvalue), 4),
        "significant": bool(result.pvalue < TREND_SIGNIFICANCE),
        "direction": direction,
    }


def compute_stability(lo_history: list[dict[str, Any]]) -> dict[str, Any]:
    """Population variance/std-dev of session-average scores. Population
    (not sample) statistics per the schema's finite, complete session set
    for a given student at query time."""
    sessions = _session_average_scores(lo_history)
    if len(sessions) < 2:
        return {"available": False, "reason": "need at least 2 sessions", "session_count": len(sessions)}

    scores = [s["avg_score"] for s in sessions]
    return {
        "available": True,
        "session_count": len(sessions),
        "mean_score": round(mean(scores), 4),
        "variance": round(pstdev(scores) ** 2, 4),
        "std_dev": round(pstdev(scores), 4),
    }


def compute_class_stability_baseline(all_students_lo_history: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    """Class-wide distribution of per-student score std-devs, used as the
    "class mean + 1.5 SD" at-risk threshold from Table 8."""
    student_stds = []
    for history in all_students_lo_history.values():
        stability = compute_stability(history)
        if stability["available"]:
            student_stds.append(stability["std_dev"])

    if len(student_stds) < 2:
        return {"available": False, "reason": "need at least 2 students with 2+ sessions each"}

    return {
        "available": True,
        "student_count": len(student_stds),
        "mean_std": round(mean(student_stds), 4),
        "std_of_std": round(pstdev(student_stds), 4),
        "at_risk_threshold": round(mean(student_stds) + 1.5 * pstdev(student_stds), 4),
    }


def is_at_risk_by_stability(student_std_dev: float, baseline: dict[str, Any]) -> bool:
    if not baseline.get("available"):
        return False
    return student_std_dev > baseline["at_risk_threshold"]


def analyze_emotion_lo_correlation(
    lo_history: list[dict[str, Any]],
    emotional_states: list[dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    """Pearson's r between each session's %-of-that-emotion and that
    session's average LO score, one result per emotion label observed."""
    sessions = _session_average_scores(lo_history)
    if len(sessions) < MIN_SESSIONS_FOR_CORRELATION:
        return {}

    session_ids = [s["session_id"] for s in sessions]
    session_scores = {s["session_id"]: s["avg_score"] for s in sessions}

    # % of each emotion within each session
    counts_by_session: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    totals_by_session: dict[str, int] = defaultdict(int)
    for row in emotional_states:
        sid = str(row["session_id"])
        if sid not in session_scores:
            continue
        counts_by_session[sid][row["emotion_label"]] += 1
        totals_by_session[sid] += 1

    all_emotions = {label for counts in counts_by_session.values() for label in counts}

    results: dict[str, dict[str, Any]] = {}
    for emotion in sorted(all_emotions):
        pct_series = []
        score_series = []
        for sid in session_ids:
            total = totals_by_session.get(sid, 0)
            if total == 0:
                continue
            pct = counts_by_session[sid].get(emotion, 0) / total
            pct_series.append(pct)
            score_series.append(session_scores[sid])

        if len(pct_series) < MIN_SESSIONS_FOR_CORRELATION or len(set(pct_series)) < 2:
            results[emotion] = {"available": False, "reason": "insufficient variation or data points"}
            continue

        r, p = stats.pearsonr(pct_series, score_series)
        meaningful = abs(r) >= CORRELATION_THRESHOLD
        results[emotion] = {
            "available": True,
            "n": len(pct_series),
            "r": round(float(r), 4),
            "p_value": round(float(p), 4),
            "meaningful": bool(meaningful),
            "direction": "positive" if r > 0 else "negative",
        }

    return results


def analyze_engagement_performance(
    lo_history: list[dict[str, Any]],
    engagement_records: list[dict[str, Any]],
) -> dict[str, Any]:
    """Mann-Whitney U comparing LO scores in high- vs low-engagement
    sessions - non-parametric because engagement/score distributions
    aren't assumed normal."""
    sessions = _session_average_scores(lo_history)
    score_by_session = {s["session_id"]: s["avg_score"] for s in sessions}

    high_scores = []
    low_scores = []
    for row in engagement_records:
        sid = str(row["session_id"])
        if sid not in score_by_session:
            continue
        target = high_scores if float(row["engagement_score"]) >= ENGAGEMENT_HIGH_THRESHOLD else low_scores
        target.append(score_by_session[sid])

    if len(high_scores) < MIN_SESSIONS_PER_GROUP or len(low_scores) < MIN_SESSIONS_PER_GROUP:
        return {
            "available": False,
            "reason": f"need at least {MIN_SESSIONS_PER_GROUP} sessions in each group",
            "high_n": len(high_scores),
            "low_n": len(low_scores),
        }

    u_stat, p_value = stats.mannwhitneyu(high_scores, low_scores, alternative="two-sided")

    return {
        "available": True,
        "high_n": len(high_scores),
        "low_n": len(low_scores),
        "high_median": round(float(np.median(high_scores)), 4),
        "low_median": round(float(np.median(low_scores)), 4),
        "u_statistic": round(float(u_stat), 4),
        "p_value": round(float(p_value), 4),
        "significant": bool(p_value < TREND_SIGNIFICANCE),
    }


def _session_average_scores_with_difficulty(lo_history: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Same grouping as _session_average_scores, but also carries each
    session's lesson difficulty (learning_sessions.difficulty, joined in by
    profile_service.get_student_lo_history) - needed only by
    analyze_difficulty_relationship, so kept separate rather than adding an
    unused field to every other caller of _session_average_scores."""
    by_session: dict[str, dict[str, Any]] = {}
    order: list[str] = []
    for row in lo_history:
        sid = str(row["session_id"])
        if sid not in by_session:
            by_session[sid] = {
                "session_id": sid,
                "start_time": row["start_time"],
                "difficulty": row.get("difficulty"),
                "scores": [],
            }
            order.append(sid)
        by_session[sid]["scores"].append(float(row["score"]))

    return [
        {
            "session_id": sid,
            "start_time": by_session[sid]["start_time"],
            "difficulty": by_session[sid]["difficulty"],
            "avg_score": mean(by_session[sid]["scores"]),
        }
        for sid in order
    ]


def analyze_difficulty_relationship(lo_history: list[dict[str, Any]]) -> dict[str, Any]:
    """OLS regression of session-average LO score against lesson difficulty
    (easy=1/medium=2/hard=3). Sessions whose lesson has no difficulty tag
    (learning_sessions.difficulty IS NULL - true for any lesson not yet
    covered by adaptive-learning's LESSON_DIFFICULTY map, or for historical
    sessions recorded before that tagging existed) are excluded rather than
    guessed at."""
    sessions = [
        s for s in _session_average_scores_with_difficulty(lo_history)
        if s["difficulty"] in DIFFICULTY_ORDINAL
    ]
    distinct_levels = {s["difficulty"] for s in sessions}

    if len(sessions) < MIN_SESSIONS_FOR_DIFFICULTY or len(distinct_levels) < 2:
        return {
            "available": False,
            "reason": (
                f"need at least {MIN_SESSIONS_FOR_DIFFICULTY} difficulty-tagged sessions "
                f"spanning 2+ difficulty levels, have {len(sessions)} session(s) across "
                f"{len(distinct_levels)} level(s)"
            ),
            "session_count": len(sessions),
        }

    x = np.array([DIFFICULTY_ORDINAL[s["difficulty"]] for s in sessions], dtype=float)
    y = np.array([s["avg_score"] for s in sessions], dtype=float)

    result = stats.linregress(x, y)

    if result.pvalue < TREND_SIGNIFICANCE:
        relationship = "harder lessons score lower" if result.slope < 0 else "harder lessons score higher"
    else:
        relationship = "no significant relationship"

    by_level: dict[str, list[float]] = defaultdict(list)
    for s in sessions:
        by_level[s["difficulty"]].append(s["avg_score"])

    return {
        "available": True,
        "session_count": len(sessions),
        "slope": round(float(result.slope), 4),
        "intercept": round(float(result.intercept), 4),
        "r_value": round(float(result.rvalue), 4),
        "p_value": round(float(result.pvalue), 4),
        "significant": bool(result.pvalue < TREND_SIGNIFICANCE),
        "relationship": relationship,
        "mean_score_by_difficulty": {level: round(mean(scores), 4) for level, scores in by_level.items()},
    }
