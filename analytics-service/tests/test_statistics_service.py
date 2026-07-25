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
    analyze_emotion_lo_correlation,
    analyze_engagement_performance,
    analyze_lo_trend,
    compute_class_stability_baseline,
    compute_stability,
    is_at_risk_by_stability,
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
        self.assertTrue(is_at_risk_by_stability(volatile_student["std_dev"], baseline))

        stable_student = compute_stability(_lo_rows([70, 71, 69, 72]))
        self.assertFalse(is_at_risk_by_stability(stable_student["std_dev"], baseline))


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


if __name__ == "__main__":
    unittest.main()
