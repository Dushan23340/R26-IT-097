"""Correctness tests for the statistics engine against synthetic data with
mathematically known answers - no database needed."""

import sys
import unittest
import uuid
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from services.statistics_service import (
    analyze_difficulty_relationship,
    analyze_emotion_lo_correlation,
    analyze_engagement_performance,
    analyze_lo_trend,
    compute_class_stability_baseline,
    compute_stability,
    is_at_risk_by_stability,
    select_emotion_finding,
)


def _lo_rows(scores: list[float]) -> list[dict]:
    base = datetime(2026, 1, 1)
    rows = []
    for i, score in enumerate(scores):
        sid = f"session-{i}"
        rows.append({
            "session_id": sid,
            "start_time": base + timedelta(days=i),
            "lo_level": "understand",
            "score": score,
            "max_score": 100,
        })
    return rows


def _lo_rows_with_difficulty(scores_and_difficulty: list[tuple[float, str]]) -> list[dict]:
    base = datetime(2026, 1, 1)
    rows = []
    for i, (score, difficulty) in enumerate(scores_and_difficulty):
        rows.append({
            "session_id": f"session-{i}",
            "start_time": base + timedelta(days=i),
            "lo_level": "understand",
            "score": score,
            "max_score": 100,
            "difficulty": difficulty,
        })
    return rows


class LOTrendTests(unittest.TestCase):
    def test_clearly_improving_scores_detected_as_improving(self):
        result = analyze_lo_trend(_lo_rows([40, 50, 60, 70, 80, 90]))
        self.assertTrue(result["available"])
        self.assertEqual(result["direction"], "improving")
        self.assertGreater(result["slope"], 0)
        self.assertTrue(result["significant"])

    def test_clearly_declining_scores_detected_as_declining(self):
        result = analyze_lo_trend(_lo_rows([90, 80, 70, 60, 50, 40]))
        self.assertEqual(result["direction"], "declining")
        self.assertLess(result["slope"], 0)

    def test_flat_noisy_scores_detected_as_stable(self):
        result = analyze_lo_trend(_lo_rows([70, 72, 68, 71, 69, 70]))
        self.assertEqual(result["direction"], "stable")

    def test_too_few_sessions_reports_unavailable(self):
        result = analyze_lo_trend(_lo_rows([70, 80]))
        self.assertFalse(result["available"])


class StabilityTests(unittest.TestCase):
    def test_constant_scores_have_zero_variance(self):
        result = compute_stability(_lo_rows([75, 75, 75, 75]))
        self.assertTrue(result["available"])
        self.assertEqual(result["std_dev"], 0.0)

    def test_volatile_scores_have_higher_std_than_stable_ones(self):
        stable = compute_stability(_lo_rows([70, 72, 71, 69, 70]))
        volatile = compute_stability(_lo_rows([30, 90, 20, 95, 25]))
        self.assertGreater(volatile["std_dev"], stable["std_dev"])

    def test_class_baseline_flags_outlier_student_as_at_risk(self):
        stable_students = {
            f"stu-{i}": _lo_rows([70 + i, 71 + i, 69 + i, 72 + i])
            for i in range(5)
        }
        baseline = compute_class_stability_baseline(stable_students)
        self.assertTrue(baseline["available"])

        volatile_student = compute_stability(_lo_rows([20, 95, 15, 98]))
        self.assertTrue(is_at_risk_by_stability(volatile_student["volatility"], baseline))

        stable_student = compute_stability(_lo_rows([70, 71, 69, 72]))
        self.assertFalse(is_at_risk_by_stability(stable_student["volatility"], baseline))

    def test_steady_improvement_is_not_volatile(self):
        # A learner rising in even steps has a large plain std-dev (the trend
        # itself) but no fluctuation around that trend.
        improving = compute_stability(_lo_rows([20, 40, 60, 80, 100]))
        self.assertGreater(improving["std_dev"], 25)
        self.assertAlmostEqual(improving["volatility"], 0.0, places=6)

    def test_steady_improver_is_not_flagged_at_risk(self):
        # The exact case seen on the running platform: four sessions scoring
        # 0, 20, 46.67, 100 were described as "unusually volatile".
        # A class with ordinary, varied fluctuation between sessions.
        classmates = {
            "stu-0": _lo_rows([60, 68, 59, 70, 62]),
            "stu-1": _lo_rows([55, 75, 50, 80, 58]),
            "stu-2": _lo_rows([70, 72, 71, 69, 73]),
            "stu-3": _lo_rows([40, 65, 45, 70, 52]),
            "stu-4": _lo_rows([80, 62, 85, 66, 78]),
            "stu-5": _lo_rows([50, 58, 47, 61, 55]),
        }
        baseline = compute_class_stability_baseline(classmates)
        improver = compute_stability(_lo_rows([0, 20, 46.67, 100]))
        self.assertGreater(improver["std_dev"], baseline["at_risk_threshold"])  # the old rule flagged this
        self.assertFalse(is_at_risk_by_stability(improver["volatility"], baseline))

    def test_zigzag_around_a_rising_trend_is_still_volatile(self):
        zigzag = compute_stability(_lo_rows([20, 90, 30, 95, 40, 100]))
        smooth = compute_stability(_lo_rows([20, 36, 52, 68, 84, 100]))
        self.assertGreater(zigzag["volatility"], 20)
        self.assertGreater(zigzag["volatility"], smooth["volatility"] + 20)

    def test_two_sessions_fall_back_to_plain_std_dev(self):
        two = compute_stability(_lo_rows([40, 80]))
        self.assertEqual(two["volatility"], two["std_dev"])


class EmotionCorrelationTests(unittest.TestCase):
    def test_boredom_negatively_correlated_with_score_is_detected(self):
        # Sessions where boredom % is high line up with low scores, and vice versa.
        lo_rows = _lo_rows([30, 50, 70, 90, 95, 20])
        emotional_states = []
        bored_fraction = [0.9, 0.6, 0.3, 0.1, 0.05, 0.95]
        for i, frac in enumerate(bored_fraction):
            sid = f"session-{i}"
            n_bored = int(frac * 10)
            for _ in range(n_bored):
                emotional_states.append({"session_id": sid, "emotion_label": "BORED"})
            for _ in range(10 - n_bored):
                emotional_states.append({"session_id": sid, "emotion_label": "HAPPY"})

        result = analyze_emotion_lo_correlation(lo_rows, emotional_states)
        self.assertIn("BORED", result)
        self.assertTrue(result["BORED"]["available"])
        self.assertEqual(result["BORED"]["direction"], "negative")
        self.assertTrue(result["BORED"]["meaningful"])

    def test_insufficient_sessions_returns_empty(self):
        result = analyze_emotion_lo_correlation(_lo_rows([50, 60]), [])
        self.assertEqual(result, {})


class EmotionFindingSelectionTests(unittest.TestCase):
    """select_emotion_finding decides which correlation is strong enough to
    queue as a recommendation for a teacher."""

    @staticmethod
    def _result(r, p, n, available=True):
        return {"available": available, "r": r, "p_value": p, "n": n,
                "meaningful": abs(r) >= 0.3, "direction": "negative" if r < 0 else "positive"}

    def test_large_but_non_significant_correlation_is_not_queued(self):
        # The real case that exposed the problem: r = -0.76 with p = 0.45.
        self.assertIsNone(select_emotion_finding({"BORED": self._result(-0.76, 0.45, 3)}))

    def test_significant_correlation_on_too_few_sessions_is_not_queued(self):
        self.assertIsNone(select_emotion_finding({"BORED": self._result(-0.99, 0.01, 4)}))

    def test_significant_negative_correlation_with_enough_sessions_is_queued(self):
        finding = select_emotion_finding({"BORED": self._result(-0.94, 0.0001, 10)})
        self.assertIsNotNone(finding)
        self.assertEqual(finding[0], "BORED")

    def test_positive_or_weak_correlations_are_not_queued(self):
        self.assertIsNone(select_emotion_finding({"HAPPY": self._result(0.9, 0.001, 10)}))
        self.assertIsNone(select_emotion_finding({"BORED": self._result(-0.2, 0.01, 40)}))

    def test_most_significant_qualifying_emotion_wins(self):
        finding = select_emotion_finding({
            "CONFUSED": self._result(-0.7, 0.03, 9),
            "BORED": self._result(-0.9, 0.001, 9),
            "FRUSTRATED": self._result(-0.95, 0.4, 9),
        })
        self.assertEqual(finding[0], "BORED")

    def test_real_pipeline_end_to_end(self):
        # Same data as the detection test above, through the real analysis.
        lo_rows = _lo_rows([30, 50, 70, 90, 95, 20])
        states = []
        for i, frac in enumerate([0.9, 0.6, 0.3, 0.1, 0.05, 0.95]):
            n_bored = int(frac * 10)
            states += [{"session_id": f"session-{i}", "emotion_label": "BORED"}] * n_bored
            states += [{"session_id": f"session-{i}", "emotion_label": "HAPPY"}] * (10 - n_bored)
        finding = select_emotion_finding(analyze_emotion_lo_correlation(lo_rows, states))
        self.assertIsNotNone(finding)
        self.assertEqual(finding[0], "BORED")


class EngagementPerformanceTests(unittest.TestCase):
    def test_high_engagement_sessions_score_higher(self):
        lo_rows = _lo_rows([40, 45, 42, 85, 90, 88])
        engagement_records = [
            {"session_id": "session-0", "engagement_score": 0.3},
            {"session_id": "session-1", "engagement_score": 0.35},
            {"session_id": "session-2", "engagement_score": 0.4},
            {"session_id": "session-3", "engagement_score": 0.8},
            {"session_id": "session-4", "engagement_score": 0.85},
            {"session_id": "session-5", "engagement_score": 0.9},
        ]
        result = analyze_engagement_performance(lo_rows, engagement_records)
        self.assertTrue(result["available"])
        self.assertGreater(result["high_median"], result["low_median"])

    def test_too_few_sessions_per_group_reports_unavailable(self):
        lo_rows = _lo_rows([40, 90])
        engagement_records = [
            {"session_id": "session-0", "engagement_score": 0.2},
            {"session_id": "session-1", "engagement_score": 0.9},
        ]
        result = analyze_engagement_performance(lo_rows, engagement_records)
        self.assertFalse(result["available"])


class DifficultyRelationshipTests(unittest.TestCase):
    def test_harder_lessons_score_lower_is_detected(self):
        rows = _lo_rows_with_difficulty([
            (90, "easy"), (88, "easy"),
            (70, "medium"), (68, "medium"),
            (40, "hard"), (42, "hard"),
        ])
        result = analyze_difficulty_relationship(rows)
        self.assertTrue(result["available"])
        self.assertLess(result["slope"], 0)
        self.assertEqual(result["relationship"], "harder lessons score lower")
        self.assertTrue(result["significant"])

    def test_untagged_sessions_are_excluded_not_guessed(self):
        rows = _lo_rows_with_difficulty([(90, "easy"), (88, "medium")])
        rows.append({
            "session_id": "session-untagged", "start_time": datetime(2026, 1, 10),
            "lo_level": "understand", "score": 50, "max_score": 100, "difficulty": None,
        })
        result = analyze_difficulty_relationship(rows)
        # only 2 tagged sessions - below MIN_SESSIONS_FOR_DIFFICULTY
        self.assertFalse(result["available"])

    def test_single_difficulty_level_reports_unavailable(self):
        rows = _lo_rows_with_difficulty([(90, "easy"), (88, "easy"), (85, "easy")])
        result = analyze_difficulty_relationship(rows)
        self.assertFalse(result["available"])

    def test_no_relationship_when_scores_dont_track_difficulty(self):
        rows = _lo_rows_with_difficulty([
            (80, "easy"), (80, "medium"), (80, "hard"),
            (80, "easy"), (80, "medium"), (80, "hard"),
        ])
        result = analyze_difficulty_relationship(rows)
        self.assertTrue(result["available"])
        self.assertEqual(result["relationship"], "no significant relationship")


if __name__ == "__main__":
    unittest.main()
