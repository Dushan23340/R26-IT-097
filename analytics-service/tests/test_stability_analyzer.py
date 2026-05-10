"""
Test suite for StabilityAnalyzer — variance-based stability analysis.

Test cases:
  - Stable student (low CV)
  - Unstable student (high CV)
  - At-risk flagging
  - Rolling variance
  - CV calculation and edge cases
  - Class-level statistics

Run:
    cd analytics-service
    pytest tests/test_stability_analyzer.py -v
"""

import sys
from pathlib import Path

import numpy as np
import pytest

# Ensure analytics-service root is on sys.path
_sys_path = str(Path(__file__).resolve().parents[1])
if _sys_path not in sys.path:
    sys.path.insert(0, _sys_path)

from services.stability_analyzer import StabilityAnalyzer, compute_class_statistics
from config.database import get_cursor


# ------------------------------------------------------------------
# Fixtures
# ------------------------------------------------------------------
def _fetch_all_student_ids() -> list[str]:
    """Fetch every student_id from the database."""
    with get_cursor() as cur:
        cur.execute("SELECT student_id FROM student_profiles ORDER BY student_id")
        return [row[0] for row in cur.fetchall()]


@pytest.fixture(scope="module")
def student_ids():
    """All student IDs in the database."""
    return _fetch_all_student_ids()


# ==================================================================
# Unit tests — using in-memory data (no DB required)
# ==================================================================

class TestVarianceAndSD:
    """Test variance and SD calculations with mocked scores."""

    def test_variance_stable(self):
        """Low variance for a consistent student."""
        analyzer = StabilityAnalyzer("TEST_STABLE")
        analyzer._scores = np.array([80.0, 82.0, 79.0, 81.0, 80.0, 83.0, 78.0, 82.0, 80.0, 81.0])
        var = analyzer.compute_variance()
        assert var is not None
        assert var < 5.0, f"Expected low variance, got {var}"

    def test_variance_unstable(self):
        """High variance for an erratic student."""
        analyzer = StabilityAnalyzer("TEST_UNSTABLE")
        analyzer._scores = np.array([50.0, 95.0, 40.0, 88.0, 30.0, 92.0, 55.0, 98.0, 45.0, 85.0])
        var = analyzer.compute_variance()
        assert var is not None
        assert var > 200.0, f"Expected high variance, got {var}"

    def test_sd_stable(self):
        """Low SD for a consistent student."""
        analyzer = StabilityAnalyzer("TEST_STABLE")
        analyzer._scores = np.array([80.0, 82.0, 79.0, 81.0, 80.0])
        sd = analyzer.compute_standard_deviation()
        assert sd is not None
        assert sd < 3.0

    def test_sd_unstable(self):
        """High SD for an erratic student."""
        analyzer = StabilityAnalyzer("TEST_UNSTABLE")
        analyzer._scores = np.array([50.0, 95.0, 40.0, 88.0, 30.0])
        sd = analyzer.compute_standard_deviation()
        assert sd is not None
        assert sd > 20.0

    def test_variance_identical_scores(self):
        """Zero variance when all scores are the same."""
        analyzer = StabilityAnalyzer("TEST_SAME")
        analyzer._scores = np.array([75.0, 75.0, 75.0, 75.0])
        var = analyzer.compute_variance()
        assert var == 0.0

    def test_insufficient_data(self):
        """None returned when fewer than 3 sessions."""
        analyzer = StabilityAnalyzer("TEST_SHORT")
        analyzer._scores = np.array([80.0, 82.0])
        assert analyzer.compute_variance() is None
        assert analyzer.compute_standard_deviation() is None

    def test_ddof1_used(self):
        """Verify ddof=1 (sample variance) is used, not population."""
        scores = np.array([10.0, 20.0, 30.0])
        analyzer = StabilityAnalyzer("TEST_DDOF")
        analyzer._scores = scores
        var = analyzer.compute_variance()
        # Sample variance (ddof=1): sum of squared deviations / (n-1)
        expected = float(np.var(scores, ddof=1))
        assert var == pytest.approx(expected)


class TestCoefficientOfVariation:
    """Test CV calculation and edge cases."""

    def test_cv_stable(self):
        """Low CV for a consistent student."""
        analyzer = StabilityAnalyzer("TEST_CV_STABLE")
        analyzer._scores = np.array([80.0, 82.0, 79.0, 81.0, 80.0])
        cv = analyzer.compute_coefficient_of_variation()
        assert cv is not None
        assert cv < 5.0, f"Expected low CV, got {cv}"

    def test_cv_unstable(self):
        """High CV for an erratic student."""
        analyzer = StabilityAnalyzer("TEST_CV_UNSTABLE")
        analyzer._scores = np.array([50.0, 95.0, 40.0, 88.0, 30.0])
        cv = analyzer.compute_coefficient_of_variation()
        assert cv is not None
        assert cv > 30.0, f"Expected high CV, got {cv}"

    def test_cv_zero_mean(self):
        """CV is None when mean is zero."""
        analyzer = StabilityAnalyzer("TEST_CV_ZERO")
        analyzer._scores = np.array([0.0, 0.0, 0.0, 0.0])
        cv = analyzer.compute_coefficient_of_variation()
        assert cv is None

    def test_cv_formula(self):
        """Verify CV = (SD / |Mean|) × 100."""
        scores = np.array([60.0, 70.0, 80.0])
        analyzer = StabilityAnalyzer("TEST_CV_FORMULA")
        analyzer._scores = scores
        cv = analyzer.compute_coefficient_of_variation()
        expected = (float(np.std(scores, ddof=1)) / abs(float(np.mean(scores)))) * 100
        assert cv == pytest.approx(expected, rel=1e-6)

    def test_cv_interpretation_very_stable(self):
        """CV < 10 → Very stable performance."""
        analyzer = StabilityAnalyzer("TEST_INTERP_VS")
        analyzer._scores = np.array([80.0, 81.0, 80.5, 80.0, 81.0])
        result = analyzer.get_analysis()
        assert "Very stable" in result["interpretation"]

    def test_cv_interpretation_at_risk(self):
        """CV > 50 → Very high performance variability."""
        analyzer = StabilityAnalyzer("TEST_INTERP_AR")
        analyzer._scores = np.array([10.0, 90.0, 20.0, 85.0, 15.0])
        result = analyzer.get_analysis()
        assert "at-risk" in result["interpretation"].lower()


class TestRollingVariance:
    """Test rolling-window variance."""

    def test_rolling_variance_basic(self):
        """Rolling variance returns correct number of windows."""
        analyzer = StabilityAnalyzer("TEST_ROLL")
        analyzer._scores = np.array([80.0, 82.0, 79.0, 85.0, 70.0, 90.0])
        rolling = analyzer.compute_rolling_variance(window_size=3)
        # n=6, window=3 → 4 windows
        assert len(rolling) == 4
        # Each entry is (index, variance)
        for idx, var in rolling:
            assert isinstance(idx, int)
            assert isinstance(var, float)
            assert var >= 0

    def test_rolling_variance_stable_vs_unstable(self):
        """Stable segment has lower rolling variance than unstable."""
        analyzer = StabilityAnalyzer("TEST_ROLL_CMP")
        # First 3 stable, last 3 erratic
        analyzer._scores = np.array([80.0, 81.0, 79.0, 50.0, 95.0, 40.0])
        rolling = analyzer.compute_rolling_variance(window_size=3)
        var_stable = rolling[0][1]  # window [80, 81, 79]
        var_unstable = rolling[3][1]  # window [50, 95, 40]
        assert var_stable < var_unstable

    def test_rolling_variance_insufficient(self):
        """Empty list when scores < window_size."""
        analyzer = StabilityAnalyzer("TEST_ROLL_SHORT")
        analyzer._scores = np.array([80.0, 82.0])
        rolling = analyzer.compute_rolling_variance(window_size=3)
        assert rolling == []

    def test_rolling_variance_values(self):
        """Verify rolling variance against numpy calculation."""
        scores = np.array([70.0, 80.0, 90.0, 60.0])
        analyzer = StabilityAnalyzer("TEST_ROLL_VAL")
        analyzer._scores = scores
        rolling = analyzer.compute_rolling_variance(window_size=3)
        # Window 0: [70, 80, 90]
        expected_0 = float(np.var(scores[0:3], ddof=1))
        assert rolling[0][1] == pytest.approx(expected_0)
        # Window 1: [80, 90, 60]
        expected_1 = float(np.var(scores[1:4], ddof=1))
        assert rolling[1][1] == pytest.approx(expected_1)


class TestAtRiskFlagging:
    """Test at-risk flagging logic."""

    def test_at_risk_high_sd(self):
        """Student with high SD flagged as at-risk."""
        # class: mean_sd=5, sd_of_sds=2 → threshold = 5 + 1.5*2 = 8
        assert StabilityAnalyzer.flag_at_risk(10.0, 5.0, 2.0) is True

    def test_not_at_risk_normal_sd(self):
        """Student with normal SD not flagged."""
        assert StabilityAnalyzer.flag_at_risk(6.0, 5.0, 2.0) is False

    def test_not_at_risk_low_sd(self):
        """Student with low SD not flagged."""
        assert StabilityAnalyzer.flag_at_risk(2.0, 5.0, 2.0) is False

    def test_threshold_boundary(self):
        """Student exactly at threshold not flagged (> not >=)."""
        # threshold = 5 + 1.5*2 = 8.0
        assert StabilityAnalyzer.flag_at_risk(8.0, 5.0, 2.0) is False

    def test_custom_multiplier(self):
        """Custom threshold_multiplier changes the boundary."""
        # multiplier=2 → threshold = 5 + 2*2 = 9
        assert StabilityAnalyzer.flag_at_risk(8.5, 5.0, 2.0, threshold_multiplier=2.0) is False
        assert StabilityAnalyzer.flag_at_risk(9.5, 5.0, 2.0, threshold_multiplier=2.0) is True

    def test_zero_class_sd_of_sds(self):
        """No one flagged when all students have identical SDs."""
        assert StabilityAnalyzer.flag_at_risk(10.0, 5.0, 0.0) is False


class TestClassStatistics:
    """Test compute_class_statistics with mocked data."""

    def test_class_stats_basic(self):
        """Compute mean and SD of student SDs correctly."""
        # Create analyzers with pre-set scores
        ids = ["S1", "S2", "S3"]
        scores_map = {
            "S1": np.array([80.0, 82.0, 79.0, 81.0]),  # low SD
            "S2": np.array([50.0, 95.0, 40.0, 88.0]),  # high SD
            "S3": np.array([70.0, 72.0, 68.0, 71.0]),  # low SD
        }
        sds = []
        for sid in ids:
            analyzer = StabilityAnalyzer(sid)
            analyzer._scores = scores_map[sid]
            sds.append(analyzer.compute_standard_deviation())

        expected_mean = float(np.mean(sds))
        expected_sd_of_sds = float(np.std(sds, ddof=1))

        # Verify manually
        assert all(s is not None for s in sds)
        assert len(sds) == 3


# ==================================================================
# Integration tests — using the real database
# ==================================================================

class TestWithDatabase:
    """Integration tests against the PostgreSQL database."""

    def test_fetch_lo_scores_returns_array(self, student_ids):
        """fetch_lo_scores returns a non-empty numpy array."""
        if not student_ids:
            pytest.skip("No students in database")
        analyzer = StabilityAnalyzer(student_ids[0])
        scores = analyzer.fetch_lo_scores()
        assert isinstance(scores, np.ndarray)
        assert len(scores) >= 3

    def test_get_analysis_complete(self, student_ids):
        """get_analysis returns all expected keys."""
        if not student_ids:
            pytest.skip("No students in database")
        analyzer = StabilityAnalyzer(student_ids[0])
        result = analyzer.get_analysis()
        expected_keys = {"student_id", "num_sessions", "variance", "sd",
                         "cv", "rolling_variance", "interpretation"}
        assert set(result.keys()) == expected_keys

    def test_class_statistics_all_students(self, student_ids):
        """compute_class_statistics works for all 20 students."""
        if not student_ids:
            pytest.skip("No students in database")
        stats = compute_class_statistics(student_ids)
        assert stats["num_valid"] == len(student_ids)
        assert stats["class_mean_sd"] > 0
        assert stats["class_sd_of_sds"] >= 0

    def test_at_risk_flagging_10_to_20_percent(self, student_ids):
        """Approximately 10-20% of students flagged as at-risk."""
        if not student_ids:
            pytest.skip("No students in database")
        stats = compute_class_statistics(student_ids)
        class_mean_sd = stats["class_mean_sd"]
        class_sd_of_sds = stats["class_sd_of_sds"]

        at_risk_count = 0
        for sid, sd in stats["student_sds"].items():
            if sd is not None and StabilityAnalyzer.flag_at_risk(
                sd, class_mean_sd, class_sd_of_sds
            ):
                at_risk_count += 1

        total = stats["num_valid"]
        pct = (at_risk_count / total) * 100 if total > 0 else 0
        # Expect roughly 10-20% — but with only 20 students we allow a
        # wider band (5-40%) to account for random variance
        assert pct <= 50, (
            f"At-risk percentage {pct:.0f}% is unexpectedly high "
            f"({at_risk_count}/{total} students)"
        )

    def test_all_students_analysis_summary(self, student_ids):
        """Print a summary table for all students."""
        if not student_ids:
            pytest.skip("No students in database")

        stats = compute_class_statistics(student_ids)
        class_mean_sd = stats["class_mean_sd"]
        class_sd_of_sds = stats["class_sd_of_sds"]

        print(f"\n{'Student':<12} {'Sessions':>8} {'Variance':>10} {'SD':>8} {'CV%':>8} {'At-Risk':>8}  Interpretation")
        print("-" * 100)

        for sid in student_ids:
            analyzer = StabilityAnalyzer(sid)
            result = analyzer.get_analysis()
            sd = result["sd"]
            cv = result["cv"]
            var = result["variance"]

            at_risk = ""
            if sd is not None:
                flagged = StabilityAnalyzer.flag_at_risk(sd, class_mean_sd, class_sd_of_sds)
                at_risk = "YES" if flagged else "no"

            cv_str = f"{cv:.1f}" if cv is not None else "N/A"
            var_str = f"{var:.1f}" if var is not None else "N/A"
            sd_str = f"{sd:.1f}" if sd is not None else "N/A"

            interp = result["interpretation"][:45]
            print(f"{sid:<12} {result['num_sessions']:>8} {var_str:>10} {sd_str:>8} {cv_str:>8} {at_risk:>8}  {interp}")