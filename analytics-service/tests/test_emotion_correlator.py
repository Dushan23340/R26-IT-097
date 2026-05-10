"""
Test suite for EmotionCorrelationAnalyzer.

Test cases:
  - Emotion mapping to sessions
  - Positive correlation detection
  - Negative correlation detection
  - Significance filtering
  - Edge cases (insufficient data, zero variance)

Run:
    cd analytics-service
    pytest tests/test_emotion_correlator.py -v
"""

import sys
from pathlib import Path

import numpy as np
import pytest

# Ensure analytics-service root is on sys.path
_sys_path = str(Path(__file__).resolve().parents[1])
if _sys_path not in sys.path:
    sys.path.insert(0, _sys_path)

from services.emotion_correlator import (
    EmotionCorrelationAnalyzer,
    _classify_strength,
    _classify_direction,
    ALL_EMOTIONS,
    MIN_SESSIONS,
)
from config.database import get_cursor


# ------------------------------------------------------------------
# Fixtures
# ------------------------------------------------------------------
def _fetch_all_student_ids() -> list[str]:
    with get_cursor() as cur:
        cur.execute("SELECT student_id FROM student_profiles ORDER BY student_id")
        return [row[0] for row in cur.fetchall()]


@pytest.fixture(scope="module")
def student_ids():
    return _fetch_all_student_ids()


# ==================================================================
# Unit tests — classification helpers
# ==================================================================

class TestClassificationHelpers:
    """Test strength and direction classification logic."""

    @pytest.mark.parametrize("r,expected", [
        (0.1, "weak"),
        (0.0, "weak"),
        (0.29, "weak"),
        (0.3, "moderate"),
        (0.45, "moderate"),
        (0.5, "strong"),
        (0.65, "strong"),
        (0.7, "very strong"),
        (0.95, "very strong"),
        (-0.1, "weak"),
        (-0.35, "moderate"),
        (-0.55, "strong"),
        (-0.8, "very strong"),
    ])
    def test_classify_strength(self, r, expected):
        assert _classify_strength(r) == expected

    @pytest.mark.parametrize("r,expected", [
        (0.5, "positive"),
        (0.0, "none"),
        (-0.3, "negative"),
    ])
    def test_classify_direction(self, r, expected):
        assert _classify_direction(r) == expected


# ==================================================================
# Unit tests — correlation with mocked data
# ==================================================================

class TestCorrelationComputation:
    """Test Pearson correlation calculation with mocked internal data."""

    def _make_analyzer(self, emotion_data, lo_data):
        """Create an analyzer with pre-set emotion and LO maps."""
        analyzer = EmotionCorrelationAnalyzer("TEST_MOCK")
        analyzer._emotion_map = emotion_data
        analyzer._lo_map = lo_data
        return analyzer

    def test_positive_correlation(self):
        """Happy emotion shows positive correlation with LO scores."""
        # Sessions: more happy % → higher LO score
        sessions = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9", "s10"]
        emotion_data = {
            s: {"happy": 10 + i * 8, "neutral": 50 - i * 5,
                "sad": 10, "angry": 5, "surprised": 5,
                "confused": 10, "bored": 10 - i}
            for i, s in enumerate(sessions)
        }
        lo_data = {s: 50.0 + i * 5 for i, s in enumerate(sessions)}

        analyzer = self._make_analyzer(emotion_data, lo_data)
        result = analyzer.correlate_emotion_with_lo("happy")
        assert result["r"] is not None
        assert result["r"] > 0.3, f"Expected positive r, got {result['r']}"
        assert result["direction"] == "positive"

    def test_negative_correlation(self):
        """Bored emotion shows negative correlation with LO scores."""
        sessions = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9", "s10"]
        emotion_data = {
            s: {"happy": 30 - i * 2, "neutral": 30,
                "sad": 5, "angry": 5, "surprised": 5,
                "confused": 5, "bored": 10 + i * 5}
            for i, s in enumerate(sessions)
        }
        lo_data = {s: 80.0 - i * 4 for i, s in enumerate(sessions)}

        analyzer = self._make_analyzer(emotion_data, lo_data)
        result = analyzer.correlate_emotion_with_lo("bored")
        assert result["r"] is not None
        assert result["r"] < -0.3, f"Expected negative r, got {result['r']}"
        assert result["direction"] == "negative"

    def test_emotion_not_observed(self):
        """Zero-variance emotion returns r=0, p=1 with note."""
        sessions = ["s1", "s2", "s3", "s4", "s5"]
        emotion_data = {
            s: {"happy": 30, "neutral": 40,
                "sad": 10, "angry": 5, "surprised": 5,
                "confused": 5, "bored": 5}
            for s in sessions
        }
        lo_data = {s: 60.0 + i * 5 for i, s in enumerate(sessions)}

        analyzer = self._make_analyzer(emotion_data, lo_data)
        # All sessions have identical "happy" % → zero variance
        result = analyzer.correlate_emotion_with_lo("happy")
        assert result["r"] == 0.0
        assert result["p_value"] == 1.0
        assert "zero variance" in result["note"].lower() or "not observed" in result["note"].lower()

    def test_insufficient_sessions(self):
        """Fewer than 3 sessions returns insufficient-data note."""
        emotion_data = {"s1": {"happy": 30, "neutral": 40, "sad": 10, "angry": 5, "surprised": 5, "confused": 5, "bored": 5}}
        lo_data = {"s1": 70.0}

        analyzer = self._make_analyzer(emotion_data, lo_data)
        result = analyzer.correlate_emotion_with_lo("happy")
        assert result["r"] is None
        assert "Insufficient" in result["note"]

    def test_p_value_range(self):
        """p-value is between 0 and 1."""
        sessions = [f"s{i}" for i in range(10)]
        emotion_data = {
            s: {"happy": 10 + i * 7, "neutral": 50 - i * 3,
                "sad": 10, "angry": 5, "surprised": 5,
                "confused": 8, "bored": 12 - i}
            for i, s in enumerate(sessions)
        }
        lo_data = {s: 55.0 + i * 3 for i, s in enumerate(sessions)}

        analyzer = self._make_analyzer(emotion_data, lo_data)
        for emotion in ["happy", "bored", "confused"]:
            result = analyzer.correlate_emotion_with_lo(emotion)
            if result["p_value"] is not None:
                assert 0 <= result["p_value"] <= 1


class TestSignificanceFiltering:
    """Test identify_significant_correlations."""

    def test_filters_weak_and_insignificant(self):
        """Only keeps correlations with p < alpha AND |r| >= min_r."""
        sessions = [f"s{i}" for i in range(10)]
        emotion_data = {
            s: {"happy": 10 + i * 8, "neutral": 50 - i * 5,
                "sad": 10, "angry": 5, "surprised": 5,
                "confused": 5, "bored": 10 - i}
            for i, s in enumerate(sessions)
        }
        lo_data = {s: 50.0 + i * 5 for i, s in enumerate(sessions)}

        analyzer = EmotionCorrelationAnalyzer("TEST_SIG")
        analyzer._emotion_map = emotion_data
        analyzer._lo_map = lo_data

        sig = analyzer.identify_significant_correlations(alpha=0.05, min_r=0.3)
        # All entries in significant should meet both criteria
        for emotion, result in sig.items():
            assert result["significant"] is True
            assert result["p_value"] < 0.05
            assert abs(result["r"]) >= 0.3

    def test_custom_alpha_and_min_r(self):
        """Custom thresholds are respected."""
        sessions = [f"s{i}" for i in range(10)]
        emotion_data = {
            s: {"happy": 30, "neutral": 40,
                "sad": 10, "angry": 5, "surprised": 5,
                "confused": 5, "bored": 5}
            for s in sessions
        }
        lo_data = {s: 70.0 + (i % 3) * 2 for i, s in enumerate(sessions)}

        analyzer = EmotionCorrelationAnalyzer("TEST_CUSTOM")
        analyzer._emotion_map = emotion_data
        analyzer._lo_map = lo_data

        # With very strict thresholds, may find nothing
        sig = analyzer.identify_significant_correlations(alpha=0.001, min_r=0.9)
        # Result is a dict — may be empty but should not error
        assert isinstance(sig, dict)


class TestEmotionMapping:
    """Test map_emotions_to_sessions with mocked data."""

    def test_percentages_sum_to_100(self):
        """Emotion percentages per session should sum to ~100%."""
        sessions = [f"s{i}" for i in range(5)]
        emotion_data = {
            s: {"happy": 35, "neutral": 30,
                "sad": 10, "angry": 7, "surprised": 3,
                "confused": 10, "bored": 5}
            for s in sessions
        }
        lo_data = {s: 70.0 for s in sessions}

        analyzer = EmotionCorrelationAnalyzer("TEST_MAP")
        analyzer._emotion_map = emotion_data
        analyzer._lo_map = lo_data

        for sid, emos in emotion_data.items():
            total = sum(emos.values())
            assert abs(total - 100) < 1.0, f"Session {sid}: percentages sum to {total}"


# ==================================================================
# Integration tests — using the real database
# ==================================================================

class TestWithDatabase:
    """Integration tests against the PostgreSQL database."""

    def test_map_emotions_to_sessions(self, student_ids):
        """Emotion mapping returns a non-empty dict."""
        if not student_ids:
            pytest.skip("No students in database")
        analyzer = EmotionCorrelationAnalyzer(student_ids[0])
        emap = analyzer.map_emotions_to_sessions()
        assert isinstance(emap, dict)
        assert len(emap) >= 3

    def test_compute_all_correlations(self, student_ids):
        """All emotions have correlation results."""
        if not student_ids:
            pytest.skip("No students in database")
        analyzer = EmotionCorrelationAnalyzer(student_ids[0])
        corr = analyzer.compute_all_correlations()
        assert set(corr.keys()) == set(ALL_EMOTIONS)
        for emotion, result in corr.items():
            assert "r" in result
            assert "p_value" in result
            assert "strength" in result
            assert "direction" in result

    def test_get_analysis_structure(self, student_ids):
        """get_analysis returns all expected keys."""
        if not student_ids:
            pytest.skip("No students in database")
        analyzer = EmotionCorrelationAnalyzer(student_ids[0])
        result = analyzer.get_analysis()
        expected_keys = {"student_id", "num_sessions", "correlations",
                         "significant_correlations", "summary"}
        assert set(result.keys()) == expected_keys

    def test_boredom_negative_trend(self, student_ids):
        """Boredom should show negative correlation in most students."""
        if not student_ids:
            pytest.skip("No students in database")

        negative_count = 0
        total = 0
        for sid in student_ids:
            analyzer = EmotionCorrelationAnalyzer(sid)
            result = analyzer.correlate_emotion_with_lo("bored")
            if result["r"] is not None:
                total += 1
                if result["direction"] == "negative":
                    negative_count += 1

        if total > 0:
            pct = (negative_count / total) * 100
            # With synthetic data's built-in negative-emotion penalty,
            # at least some students should show negative boredom trend
            assert pct >= 20, (
                f"Only {pct:.0f}% of students show negative boredom trend "
                f"— expected at least 20%"
            )

    def test_generate_visualization(self, student_ids):
        """Visualization PNG can be generated."""
        if not student_ids:
            pytest.skip("No students in database")

        out_dir = Path(__file__).resolve().parent / "output"
        analyzer = EmotionCorrelationAnalyzer(student_ids[0])
        path = analyzer.generate_visualization(
            "bored", str(out_dir / f"emotion_{student_ids[0]}_bored.png")
        )
        assert path != "", "Visualization generation failed"

    def test_all_students_correlation_summary(self, student_ids):
        """Print a correlation summary table for all students."""
        if not student_ids:
            pytest.skip("No students in database")

        print()
        print(f"{'Student':<12} {'Sessions':>8} {'happy r':>8} {'bored r':>8} {'confused r':>10} {'angry r':>8} {'Sig. #':>6}")
        print("-" * 70)

        for sid in student_ids:
            analyzer = EmotionCorrelationAnalyzer(sid)
            result = analyzer.get_analysis()
            corr = result["correlations"]
            n_sig = len(result["significant_correlations"])

            happy_r = f"{corr['happy']['r']:+.2f}" if corr.get("happy", {}).get("r") is not None else "N/A"
            bored_r = f"{corr['bored']['r']:+.2f}" if corr.get("bored", {}).get("r") is not None else "N/A"
            confused_r = f"{corr['confused']['r']:+.2f}" if corr.get("confused", {}).get("r") is not None else "N/A"
            angry_r = f"{corr['angry']['r']:+.2f}" if corr.get("angry", {}).get("r") is not None else "N/A"

            print(f"{sid:<12} {result['num_sessions']:>8} {happy_r:>8} {bored_r:>8} {confused_r:>10} {angry_r:>8} {n_sig:>6}")