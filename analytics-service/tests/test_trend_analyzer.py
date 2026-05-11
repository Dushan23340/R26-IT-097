"""
Pytest unit-test suite for TrendAnalyzer.

Test cases:
  - Mock improving student data
  - Mock declining student data
  - Mock stable student data
  - Insufficient data handling (< 3 sessions)
  - Regression calculation correctness
  - Classification logic edge cases
  - Interpretation generation
  - Visualization generation

Run:
    cd analytics-service
    python -m pytest tests/test_trend_analyzer.py -v
"""

import sys
from pathlib import Path
from unittest.mock import patch

import numpy as np
import pytest
from scipy import stats

# Ensure analytics-service root is on sys.path
_sys_path = str(Path(__file__).resolve().parents[1])
if _sys_path not in sys.path:
    sys.path.insert(0, _sys_path)

from config.database import test_connection as _db_test_connection
from services.trend_analyzer import TrendAnalyzer, MIN_SESSIONS


# ==================================================================
# Unit tests — mocked data (no DB required)
# ==================================================================

class TestTrendClassification:
    """Test trend classification with mock session data."""

    def test_improving_student(self, mock_sessions_improving, mock_lo_scores_improving):
        """Student with strong upward trend is classified as improving."""
        analyzer = TrendAnalyzer("TEST_IMPROVING")
        analyzer.sessions = mock_sessions_improving

        with patch.object(
            analyzer, "fetch_lo_timeseries", return_value=(
                np.arange(1, len(mock_lo_scores_improving) + 1, dtype=float),
                mock_lo_scores_improving,
            )
        ):
            result = analyzer.get_analysis_summary()

        assert result["student_id"] == "TEST_IMPROVING"
        assert result["trend_classification"] == "improving"
        assert result["num_sessions"] == len(mock_sessions_improving)
        reg = result["regression_stats"]
        assert reg["slope"] > 0.5
        assert reg["p_value"] < 0.05
        assert "improving" in result["interpretation"].lower()

    def test_declining_student(self, mock_sessions_declining, mock_lo_scores_declining):
        """Student with strong downward trend is classified as declining."""
        analyzer = TrendAnalyzer("TEST_DECLINING")
        analyzer.sessions = mock_sessions_declining

        with patch.object(
            analyzer, "fetch_lo_timeseries", return_value=(
                np.arange(1, len(mock_lo_scores_declining) + 1, dtype=float),
                mock_lo_scores_declining,
            )
        ):
            result = analyzer.get_analysis_summary()

        assert result["trend_classification"] == "declining"
        reg = result["regression_stats"]
        assert reg["slope"] < -0.5
        assert reg["p_value"] < 0.05
        assert "declining" in result["interpretation"].lower()

    def test_stable_student(self, mock_sessions_stable, mock_lo_scores_stable):
        """Student with flat trend is classified as stable."""
        analyzer = TrendAnalyzer("TEST_STABLE")
        analyzer.sessions = mock_sessions_stable

        with patch.object(
            analyzer, "fetch_lo_timeseries", return_value=(
                np.arange(1, len(mock_lo_scores_stable) + 1, dtype=float),
                mock_lo_scores_stable,
            )
        ):
            result = analyzer.get_analysis_summary()

        assert result["trend_classification"] == "stable"
        reg = result["regression_stats"]
        assert abs(reg["slope"]) <= 0.5
        assert "stable" in result["interpretation"].lower()

    def test_insufficient_data(self):
        """Fewer than MIN_SESSIONS sessions yields empty regression and warning."""
        analyzer = TrendAnalyzer("TEST_INSUFFICIENT")
        analyzer.sessions = [
            {"session_id": "s1", "start_time": None, "lesson_id": "L1"},
            {"session_id": "s2", "start_time": None, "lesson_id": "L2"},
        ]

        with patch.object(
            analyzer, "fetch_lo_timeseries", return_value=(np.array([]), np.array([]))
        ):
            result = analyzer.get_analysis_summary()

        assert result["num_sessions"] == 2
        assert result["regression_stats"] == {}
        assert result["trend_classification"] == "unstable"
        assert "insufficient data" in result["interpretation"].lower()

    def test_empty_sessions(self):
        """Zero sessions yields empty regression and unstable classification."""
        analyzer = TrendAnalyzer("TEST_EMPTY")
        analyzer.sessions = []

        result = analyzer.get_analysis_summary()
        assert result["num_sessions"] == 0
        assert result["regression_stats"] == {}
        assert result["trend_classification"] == "unstable"


class TestRegressionCalculations:
    """Verify regression statistics are computed correctly."""

    def test_regression_values_match_scipy(self, mock_lo_scores_improving):
        """compute_linear_regression must match scipy.stats.linregress exactly."""
        analyzer = TrendAnalyzer("TEST_REG")
        session_numbers = np.arange(1, len(mock_lo_scores_improving) + 1, dtype=float)

        result = analyzer.compute_linear_regression(
            session_numbers=session_numbers,
            avg_scores=mock_lo_scores_improving,
        )

        expected = stats.linregress(session_numbers, mock_lo_scores_improving)
        assert pytest.approx(result["slope"], rel=1e-9) == expected.slope
        assert pytest.approx(result["intercept"], rel=1e-9) == expected.intercept
        assert pytest.approx(result["r_value"], rel=1e-9) == expected.rvalue
        assert pytest.approx(result["p_value"], rel=1e-9) == expected.pvalue
        assert pytest.approx(result["std_err"], rel=1e-9) == expected.stderr
        assert pytest.approx(result["r_squared"], rel=1e-9) == expected.rvalue ** 2

    def test_regression_with_nan_values(self):
        """NaN values in input arrays are filtered out before regression."""
        analyzer = TrendAnalyzer("TEST_NAN")
        session_numbers = np.array([1.0, 2.0, 3.0, 4.0, 5.0])
        avg_scores = np.array([50.0, np.nan, 60.0, 65.0, 70.0])

        result = analyzer.compute_linear_regression(
            session_numbers=session_numbers,
            avg_scores=avg_scores,
        )

        # After filtering NaN we have 4 points — still >= MIN_SESSIONS
        assert result != {}
        assert "slope" in result
        assert not np.isnan(result["slope"])

    def test_regression_all_nan(self):
        """All NaN values result in empty regression."""
        analyzer = TrendAnalyzer("TEST_ALL_NAN")
        session_numbers = np.array([1.0, 2.0, 3.0, 4.0, 5.0])
        avg_scores = np.array([np.nan, np.nan, np.nan, np.nan, np.nan])

        result = analyzer.compute_linear_regression(
            session_numbers=session_numbers,
            avg_scores=avg_scores,
        )

        assert result == {}

    def test_regression_less_than_min_sessions(self):
        """Regression with fewer than MIN_SESSIONS returns empty dict."""
        analyzer = TrendAnalyzer("TEST_MIN")
        session_numbers = np.array([1.0, 2.0])
        avg_scores = np.array([50.0, 55.0])

        result = analyzer.compute_linear_regression(
            session_numbers=session_numbers,
            avg_scores=avg_scores,
        )

        assert result == {}


class TestClassificationLogic:
    """Test static classify_trend method edge cases."""

    @pytest.mark.parametrize("slope,p_value,expected", [
        (1.0, 0.01, "improving"),
        (0.6, 0.01, "improving"),
        (0.6, 0.10, "unstable"),   # slope > 0.5 but p >= 0.05
        (0.4, 0.01, "stable"),     # |slope| <= 0.5
        (0.0, 0.01, "stable"),
        (-0.4, 0.01, "stable"),
        (-0.6, 0.01, "declining"),
        (-1.0, 0.01, "declining"),
        (-0.6, 0.10, "unstable"),  # slope < -0.5 but p >= 0.05
        (10.0, 0.001, "improving"),
        (-10.0, 0.001, "declining"),
    ])
    def test_classify_trend_parametrized(self, slope, p_value, expected):
        """classify_trend must follow the documented rules."""
        regression = {"slope": slope, "p_value": p_value}
        assert TrendAnalyzer.classify_trend(regression) == expected

    def test_classify_trend_empty(self):
        """Empty regression dict returns unstable."""
        assert TrendAnalyzer.classify_trend({}) == "unstable"

    def test_classify_trend_none(self):
        """None regression returns unstable."""
        assert TrendAnalyzer.classify_trend(None) == "unstable"

    def test_classify_trend_nan_slope(self):
        """NaN slope returns unstable."""
        regression = {"slope": np.nan, "p_value": 0.01}
        assert TrendAnalyzer.classify_trend(regression) == "unstable"

    def test_classify_trend_nan_pvalue(self):
        """NaN p-value returns unstable."""
        regression = {"slope": 1.0, "p_value": np.nan}
        assert TrendAnalyzer.classify_trend(regression) == "unstable"


class TestInterpretation:
    """Test natural-language interpretation generation."""

    def test_interpretation_improving(self, mock_lo_scores_improving):
        """Improving trend yields positive wording."""
        analyzer = TrendAnalyzer("TEST_INT")
        regression = {
            "slope": 2.5,
            "r_squared": 0.90,
            "p_value": 0.001,
        }
        interp = analyzer._interpret("improving", regression, mock_lo_scores_improving)
        assert "improving" in interp.lower()
        assert "2.50" in interp
        assert "R²" in interp

    def test_interpretation_declining(self, mock_lo_scores_declining):
        """Declining trend yields negative wording."""
        analyzer = TrendAnalyzer("TEST_INT")
        regression = {
            "slope": -2.5,
            "r_squared": 0.85,
            "p_value": 0.002,
        }
        interp = analyzer._interpret("declining", regression, mock_lo_scores_declining)
        assert "declining" in interp.lower()
        assert "intervention" in interp.lower()

    def test_interpretation_stable(self, mock_lo_scores_stable):
        """Stable trend yields neutral wording."""
        analyzer = TrendAnalyzer("TEST_INT")
        regression = {
            "slope": 0.2,
            "r_squared": 0.10,
            "p_value": 0.30,
        }
        interp = analyzer._interpret("stable", regression, mock_lo_scores_stable)
        assert "stable" in interp.lower()
        assert "slope = +0.20" in interp  # ensure formatting works

    def test_interpretation_unstable(self, mock_lo_scores_stable):
        """Unstable trend yields cautionary wording."""
        analyzer = TrendAnalyzer("TEST_INT")
        regression = {
            "slope": 1.0,
            "r_squared": 0.20,
            "p_value": 0.20,
        }
        interp = analyzer._interpret("unstable", regression, mock_lo_scores_stable)
        assert "not statistically significant" in interp.lower()
        assert "more data" in interp.lower()

    def test_interpretation_empty_regression(self):
        """Empty regression yields insufficient-data message."""
        analyzer = TrendAnalyzer("TEST_INT")
        interp = analyzer._interpret("unstable", {}, np.array([]))
        assert "insufficient data" in interp.lower()

    def test_interpretation_zero_scores(self):
        """Zero-length scores yields insufficient-data message."""
        analyzer = TrendAnalyzer("TEST_INT")
        interp = analyzer._interpret("stable", {"slope": 0.1, "r_squared": 0.0, "p_value": 1.0}, np.array([]))
        assert "insufficient data" in interp.lower()


class TestVisualization:
    """Test PNG generation."""

    def test_generate_visualization_success(self, tmp_path, mock_sessions_improving, mock_lo_scores_improving):
        """Visualization saves a valid PNG file."""
        analyzer = TrendAnalyzer("TEST_VIZ")
        analyzer.sessions = mock_sessions_improving
        session_numbers = np.arange(1, len(mock_lo_scores_improving) + 1, dtype=float)
        regression = analyzer.compute_linear_regression(session_numbers, mock_lo_scores_improving)

        out_file = tmp_path / "trend_test.png"
        path = analyzer.generate_visualization(
            str(out_file),
            session_numbers=session_numbers,
            avg_scores=mock_lo_scores_improving,
            regression_results=regression,
        )

        assert path != ""
        assert Path(path).exists()
        assert Path(path).stat().st_size > 0

    def test_generate_visualization_insufficient_data(self, tmp_path):
        """Visualization returns empty string when data is insufficient."""
        analyzer = TrendAnalyzer("TEST_VIZ_EMPTY")
        analyzer.sessions = []
        path = analyzer.generate_visualization(str(tmp_path / "trend_empty.png"))
        assert path == ""

    def test_generate_visualization_no_regression(self, tmp_path, mock_sessions_improving, mock_lo_scores_improving):
        """Visualization computes regression automatically when not provided."""
        analyzer = TrendAnalyzer("TEST_VIZ_AUTO")
        analyzer.sessions = mock_sessions_improving
        session_numbers = np.arange(1, len(mock_lo_scores_improving) + 1, dtype=float)

        out_file = tmp_path / "trend_auto.png"
        path = analyzer.generate_visualization(
            str(out_file),
            session_numbers=session_numbers,
            avg_scores=mock_lo_scores_improving,
        )

        assert path != ""
        assert Path(path).exists()


# ==================================================================
# Integration tests — requires real database
# ==================================================================

class TestTrendAnalyzerIntegration:
    """Integration tests against the real database."""

    @pytest.mark.skipif(
        not _db_test_connection(),
        reason="PostgreSQL database not available",
    )
    def test_real_student_analysis(self, sample_student_id):
        """TrendAnalyzer runs successfully on a real student."""
        analyzer = TrendAnalyzer(sample_student_id)
        result = analyzer.get_analysis_summary()

        assert result["student_id"] == sample_student_id
        assert "num_sessions" in result
        assert "regression_stats" in result
        assert "trend_classification" in result
        assert "interpretation" in result

        classification = result["trend_classification"]
        assert classification in ("improving", "declining", "stable", "unstable")

    @pytest.mark.skipif(
        not _db_test_connection(),
        reason="PostgreSQL database not available",
    )
    def test_real_student_regression_consistency(self, sample_student_id):
        """Regression stats are internally consistent (R² = r²)."""
        analyzer = TrendAnalyzer(sample_student_id)
        result = analyzer.get_analysis_summary()
        reg = result.get("regression_stats", {})

        if not reg:
            pytest.skip("No regression stats (insufficient data).")

        expected_r_squared = reg["r_value"] ** 2
        assert pytest.approx(reg["r_squared"], rel=1e-6) == expected_r_squared
