import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from services.fairness_service import compute_disparate_impact, compute_variance_calibration


class DisparateImpactTests(unittest.TestCase):
    def test_equal_proficiency_rates_are_fair(self):
        scores = {f"a{i}": 80 for i in range(4)} | {f"b{i}": 80 for i in range(4)}
        groups = {f"a{i}": "GroupA" for i in range(4)} | {f"b{i}": "GroupB" for i in range(4)}
        result = compute_disparate_impact(scores, groups)
        self.assertTrue(result["available"])
        self.assertTrue(result["fair"])

    def test_large_gap_between_groups_is_flagged(self):
        scores = {f"a{i}": 90 for i in range(5)} | {f"b{i}": 40 for i in range(5)}
        groups = {f"a{i}": "GroupA" for i in range(5)} | {f"b{i}": "GroupB" for i in range(5)}
        result = compute_disparate_impact(scores, groups)
        self.assertTrue(result["available"])
        self.assertFalse(result["fair"])
        self.assertIn("GroupB", result["flagged_groups"])

    def test_insufficient_groups_reports_unavailable(self):
        scores = {"a1": 80, "a2": 85}
        groups = {"a1": "GroupA", "a2": "GroupA"}
        result = compute_disparate_impact(scores, groups)
        self.assertFalse(result["available"])


class VarianceCalibrationTests(unittest.TestCase):
    def test_similar_variance_groups_report_equal_variance(self):
        scores = {f"a{i}": v for i, v in enumerate([70, 72, 68, 74, 71])} | {
            f"b{i}": v for i, v in enumerate([70, 73, 67, 75, 70])
        }
        groups = {f"a{i}": "GroupA" for i in range(5)} | {f"b{i}": "GroupB" for i in range(5)}
        result = compute_variance_calibration(scores, groups)
        self.assertTrue(result["available"])
        self.assertTrue(result["equal_variance"])

    def test_wildly_different_variance_is_detected(self):
        # Levene's test needs enough samples to reach significance even
        # when the true variance gap is large - n=5/group is too underpowered.
        low_variance = [70, 71, 69, 70, 71, 69, 70, 71, 70, 69]
        high_variance = [10, 95, 20, 90, 15, 85, 25, 92, 12, 88]
        scores = {f"a{i}": v for i, v in enumerate(low_variance)} | {
            f"b{i}": v for i, v in enumerate(high_variance)
        }
        groups = {f"a{i}": "GroupA" for i in range(len(low_variance))} | {
            f"b{i}": "GroupB" for i in range(len(high_variance))
        }
        result = compute_variance_calibration(scores, groups)
        self.assertTrue(result["available"])
        self.assertFalse(result["equal_variance"])


if __name__ == "__main__":
    unittest.main()
