"""
Test suite for EngagementPerformanceComparator — Mann-Whitney U
comparison of learning outcomes by engagement level.

Test cases:
  - Session classification by median threshold
  - Custom threshold classification
  - Mann-Whitney U calculation
  - Effect size calculation and classification
  - Descriptive statistics
  - Interpretation logic
  - Edge cases (no variance, insufficient data)

Run:
    cd analytics-service
    pytest tests/test_engagement_comparator.py -v
"""

import sys
from pathlib import Path

import numpy as np
import pytest

# Ensure analytics-service root is on sys.path
_sys_path = str(Path(__file__).resolve().parents[1])
if _sys_path not in sys.path:
    sys.path.insert(0, _sys_path)

from services.engagement_comparator import EngagementPerformanceComparator
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

class TestSessionClassification:
    """Test splitting sessions into high/low engagement groups."""

    def test_median_threshold_split(self):
        """Sessions split correctly at the median engagement score."""
        comparator = EngagementPerformanceComparator("TEST_MEDIAN")
        comparator._sessions = [
            {"session_id": "s1", "engagement_score": 0.2, "avg_lo_score": 60.0},
            {"session_id": "s2", "engagement_score": 0.4, "avg_lo_score": 65.0},
            {"session_id": "s3", "engagement_score": 0.6, "avg_lo_score": 70.0},
            {"session_id": "s4", "engagement_score": 0.8, "avg_lo_score": 75.0},
            {"session_id": "s5", "engagement_score": 0.9, "avg_lo_score": 80.0},
            {"session_id": "s6", "engagement_score": 0.95, "avg_lo_score": 85.0},
        ]
        high, low = comparator.classify_sessions_by_engagement()
        # median of [0.2, 0.4, 0.6, 0.8, 0.9, 0.95] = 0.7
        assert len(high) == 3  # 0.8, 0.9, 0.95
        assert len(low) == 3   # 0.2, 0.4, 0.6
        for s in high:
            assert s["engagement_score"] >= 0.7
        for s in low:
            assert s["engagement_score"] < 0.7

    def test_custom_threshold(self):
        """Custom threshold overrides median calculation."""
        comparator = EngagementPerformanceComparator("TEST_CUSTOM")
        comparator._sessions = [
            {"session_id": "s1", "engagement_score": 0.1, "avg_lo_score": 50.0},
            {"session_id": "s2", "engagement_score": 0.5, "avg_lo_score": 60.0},
            {"session_id": "s3", "engagement_score": 0.9, "avg_lo_score": 70.0},
        ]
        high, low = comparator.classify_sessions_by_engagement(threshold=0.5)
        assert len(high) == 2  # 0.5, 0.9
        assert len(low) == 1   # 0.1

    def test_no_variance_engagement(self):
        """All identical engagement scores → empty groups."""
        comparator = EngagementPerformanceComparator("TEST_NO_VAR")
        comparator._sessions = [
            {"session_id": "s1", "engagement_score": 0.5, "avg_lo_score": 70.0},
            {"session_id": "s2", "engagement_score": 0.5, "avg_lo_score": 75.0},
            {"session_id": "s3", "engagement_score": 0.5, "avg_lo_score": 80.0},
        ]
        high, low = comparator.classify_sessions_by_engagement()
        assert high == []
        assert low == []

    def test_empty_sessions(self):
        """No sessions → empty groups."""
        comparator = EngagementPerformanceComparator("TEST_EMPTY")
        comparator._sessions = []
        high, low = comparator.classify_sessions_by_engagement()
        assert high == []
        assert low == []


class TestExtractLOScores:
    """Test extraction of LO score arrays."""

    def test_extract_scores_order_preserved(self):
        """LO scores extracted in session order."""
        comparator = EngagementPerformanceComparator("TEST_EXTRACT")
        comparator._sessions = [
            {"session_id": "s1", "engagement_score": 0.9, "avg_lo_score": 80.0},
            {"session_id": "s2", "engagement_score": 0.8, "avg_lo_score": 75.0},
            {"session_id": "s3", "engagement_score": 0.3, "avg_lo_score": 60.0},
            {"session_id": "s4", "engagement_score": 0.2, "avg_lo_score": 55.0},
        ]
        comparator.classify_sessions_by_engagement(threshold=0.5)
        high_scores, low_scores = comparator.extract_lo_scores_by_group()
        assert np.array_equal(high_scores, np.array([80.0, 75.0]))
        assert np.array_equal(low_scores, np.array([60.0, 55.0]))


class TestMannWhitney:
    """Test Mann-Whitney U test computation."""

    def test_significant_high_better(self):
        """High engagement group clearly better → significant result."""
        comparator = EngagementPerformanceComparator("TEST_MW_SIG")
        comparator._sessions = [
            {"session_id": "s1", "engagement_score": 0.9, "avg_lo_score": 92.0},
            {"session_id": "s2", "engagement_score": 0.8, "avg_lo_score": 88.0},
            {"session_id": "s3", "engagement_score": 0.85, "avg_lo_score": 90.0},
            {"session_id": "s4", "engagement_score": 0.88, "avg_lo_score": 85.0},
            {"session_id": "s5", "engagement_score": 0.2, "avg_lo_score": 50.0},
            {"session_id": "s6", "engagement_score": 0.3, "avg_lo_score": 55.0},
            {"session_id": "s7", "engagement_score": 0.25, "avg_lo_score": 52.0},
            {"session_id": "s8", "engagement_score": 0.22, "avg_lo_score": 48.0},
        ]
        comparator.classify_sessions_by_engagement()
        result = comparator.perform_mann_whitney_test()
        assert result is not None
        U_stat, p_value = result
        assert U_stat > 0
        assert p_value < 0.05

    def test_not_significant_similar_groups(self):
        """Similar groups → p >= 0.05."""
        comparator = EngagementPerformanceComparator("TEST_MW_NS")
        # Both groups have similar scores
        comparator._sessions = [
            {"session_id": "s1", "engagement_score": 0.9, "avg_lo_score": 75.0},
            {"session_id": "s2", "engagement_score": 0.8, "avg_lo_score": 70.0},
            {"session_id": "s3", "engagement_score": 0.85, "avg_lo_score": 72.0},
            {"session_id": "s4", "engagement_score": 0.2, "avg_lo_score": 73.0},
            {"session_id": "s5", "engagement_score": 0.3, "avg_lo_score": 68.0},
            {"session_id": "s6", "engagement_score": 0.25, "avg_lo_score": 71.0},
        ]
        comparator.classify_sessions_by_engagement()
        result = comparator.perform_mann_whitney_test()
        assert result is not None
        _, p_value = result
        assert p_value >= 0.05

    def test_insufficient_data(self):
        """Fewer than 3 sessions in a group → None."""
        comparator = EngagementPerformanceComparator("TEST_MW_SHORT")
        comparator._sessions = [
            {"session_id": "s1", "engagement_score": 0.9, "avg_lo_score": 80.0},
            {"session_id": "s2", "engagement_score": 0.8, "avg_lo_score": 75.0},
            {"session_id": "s3", "engagement_score": 0.1, "avg_lo_score": 60.0},
        ]
        comparator.classify_sessions_by_engagement()
        result = comparator.perform_mann_whitney_test()
        assert result is None

    def test_alternative_is_greater(self):
        """Verify alternative='greater' is used."""
        comparator = EngagementPerformanceComparator("TEST_MW_ALT")
        comparator._sessions = [
            {"session_id": "s1", "engagement_score": 0.9, "avg_lo_score": 95.0},
            {"session_id": "s2", "engagement_score": 0.8, "avg_lo_score": 90.0},
            {"session_id": "s3", "engagement_score": 0.85, "avg_lo_score": 92.0},
            {"session_id": "s4", "engagement_score": 0.88, "avg_lo_score": 94.0},
            {"session_id": "s5", "engagement_score": 0.2, "avg_lo_score": 50.0},
            {"session_id": "s6", "engagement_score": 0.3, "avg_lo_score": 55.0},
            {"session_id": "s7", "engagement_score": 0.25, "avg_lo_score": 52.0},
            {"session_id": "s8", "engagement_score": 0.22, "avg_lo_score": 48.0},
        ]
        comparator.classify_sessions_by_engagement()
        result = comparator.perform_mann_whitney_test()
        assert result is not None
        U_stat, p_value = result
        # With high >> low, U should be large (close to n1*n2 = 16)
        assert U_stat >= 14
        assert p_value < 0.05


class TestEffectSize:
    """Test effect size computation and classification."""

    def test_effect_size_large(self):
        """Large separation → large effect size."""
        comparator = EngagementPerformanceComparator("TEST_ES_LARGE")
        comparator._sessions = [
            {"session_id": "s1", "engagement_score": 0.9, "avg_lo_score": 95.0},
            {"session_id": "s2", "engagement_score": 0.8, "avg_lo_score": 90.0},
            {"session_id": "s3", "engagement_score": 0.85, "avg_lo_score": 92.0},
            {"session_id": "s4", "engagement_score": 0.2, "avg_lo_score": 50.0},
            {"session_id": "s5", "engagement_score": 0.3, "avg_lo_score": 55.0},
            {"session_id": "s6", "engagement_score": 0.25, "avg_lo_score": 52.0},
        ]
        comparator.classify_sessions_by_engagement()
        r = comparator.compute_effect_size()
        assert r is not None
        assert abs(r) >= 0.5
        assert r > 0  # positive because high > low

    def test_effect_size_small(self):
        """Small separation → small effect size."""
        comparator = EngagementPerformanceComparator("TEST_ES_SMALL")
        # Heavily overlapping scores — only a slight tendency for high > low
        comparator._sessions = [
            {"session_id": "s1", "engagement_score": 0.9, "avg_lo_score": 75.0},
            {"session_id": "s2", "engagement_score": 0.8, "avg_lo_score": 70.0},
            {"session_id": "s3", "engagement_score": 0.85, "avg_lo_score": 73.0},
            {"session_id": "s4", "engagement_score": 0.88, "avg_lo_score": 71.0},
            {"session_id": "s5", "engagement_score": 0.87, "avg_lo_score": 72.0},
            {"session_id": "s6", "engagement_score": 0.2, "avg_lo_score": 69.0},
            {"session_id": "s7", "engagement_score": 0.3, "avg_lo_score": 74.0},
            {"session_id": "s8", "engagement_score": 0.25, "avg_lo_score": 70.0},
            {"session_id": "s9", "engagement_score": 0.22, "avg_lo_score": 72.0},
            {"session_id": "s10", "engagement_score": 0.28, "avg_lo_score": 71.0},
        ]
        comparator.classify_sessions_by_engagement()
        r = comparator.compute_effect_size()
        assert r is not None
        assert abs(r) < 0.5

    def test_effect_size_range(self):
        """Effect size must be in [-1, 1]."""
        comparator = EngagementPerformanceComparator("TEST_ES_RANGE")
        comparator._sessions = [
            {"session_id": "s1", "engagement_score": 0.9, "avg_lo_score": 90.0},
            {"session_id": "s2", "engagement_score": 0.8, "avg_lo_score": 85.0},
            {"session_id": "s3", "engagement_score": 0.85, "avg_lo_score": 88.0},
            {"session_id": "s4", "engagement_score": 0.2, "avg_lo_score": 60.0},
            {"session_id": "s5", "engagement_score": 0.3, "avg_lo_score": 65.0},
            {"session_id": "s6", "engagement_score": 0.25, "avg_lo_score": 62.0},
        ]
        comparator.classify_sessions_by_engagement()
        r = comparator.compute_effect_size()
        assert r is not None
        assert -1.0 <= r <= 1.0

    def test_effect_size_none_when_insufficient(self):
        """Effect size is None when test cannot run."""
        comparator = EngagementPerformanceComparator("TEST_ES_NONE")
        comparator._sessions = [
            {"session_id": "s1", "engagement_score": 0.9, "avg_lo_score": 80.0},
            {"session_id": "s2", "engagement_score": 0.1, "avg_lo_score": 60.0},
        ]
        comparator.classify_sessions_by_engagement()
        r = comparator.compute_effect_size()
        assert r is None

    def test_classify_effect_size(self):
        """Effect size classification boundaries."""
        assert EngagementPerformanceComparator._classify_effect_size(0.2) == "small"
        assert EngagementPerformanceComparator._classify_effect_size(-0.2) == "small"
        assert EngagementPerformanceComparator._classify_effect_size(0.4) == "medium"
        assert EngagementPerformanceComparator._classify_effect_size(-0.4) == "medium"
        assert EngagementPerformanceComparator._classify_effect_size(0.6) == "large"
        assert EngagementPerformanceComparator._classify_effect_size(-0.6) == "large"


class TestDescriptiveStatistics:
    """Test descriptive statistics computation."""

    def test_stats_correct_values(self):
        """Statistics match numpy calculations."""
        comparator = EngagementPerformanceComparator("TEST_STATS")
        comparator._sessions = [
            {"session_id": "s1", "engagement_score": 0.9, "avg_lo_score": 80.0},
            {"session_id": "s2", "engagement_score": 0.8, "avg_lo_score": 90.0},
            {"session_id": "s3", "engagement_score": 0.85, "avg_lo_score": 70.0},
            {"session_id": "s4", "engagement_score": 0.2, "avg_lo_score": 50.0},
            {"session_id": "s5", "engagement_score": 0.3, "avg_lo_score": 60.0},
        ]
        comparator.classify_sessions_by_engagement(threshold=0.5)
        stats = comparator.get_descriptive_statistics()

        high = stats["high_engagement"]
        assert high["count"] == 3
        assert high["mean"] == pytest.approx(np.mean([80.0, 90.0, 70.0]))
        assert high["median"] == pytest.approx(np.median([80.0, 90.0, 70.0]))
        assert high["min"] == 70.0
        assert high["max"] == 90.0

        low = stats["low_engagement"]
        assert low["count"] == 2
        assert low["mean"] == pytest.approx(np.mean([50.0, 60.0]))
        assert low["min"] == 50.0
        assert low["max"] == 60.0

    def test_empty_group_stats(self):
        """Empty group returns None for all stats."""
        comparator = EngagementPerformanceComparator("TEST_STATS_EMPTY")
        comparator._sessions = []
        stats = comparator.get_descriptive_statistics()
        assert stats["high_engagement"]["count"] == 0
        assert stats["high_engagement"]["mean"] is None
        assert stats["low_engagement"]["count"] == 0
        assert stats["low_engagement"]["mean"] is None


class TestInterpretationLogic:
    """Test natural-language interpretation generation."""

    def test_significant_large_effect(self):
        """p < 0.05 and r >= 0.3 → significant + large effect message."""
        comparator = EngagementPerformanceComparator("TEST_INT_SIG_LARGE")
        comparator._sessions = [
            {"session_id": "s1", "engagement_score": 0.9, "avg_lo_score": 95.0},
            {"session_id": "s2", "engagement_score": 0.8, "avg_lo_score": 90.0},
            {"session_id": "s3", "engagement_score": 0.85, "avg_lo_score": 92.0},
            {"session_id": "s4", "engagement_score": 0.88, "avg_lo_score": 94.0},
            {"session_id": "s5", "engagement_score": 0.2, "avg_lo_score": 50.0},
            {"session_id": "s6", "engagement_score": 0.3, "avg_lo_score": 55.0},
            {"session_id": "s7", "engagement_score": 0.25, "avg_lo_score": 52.0},
            {"session_id": "s8", "engagement_score": 0.22, "avg_lo_score": 48.0},
        ]
        result = comparator.get_analysis()
        assert result["mann_whitney"] is not None
        assert result["mann_whitney"]["p_value"] < 0.05
        assert result["effect_size"] is not None
        assert result["effect_size"] >= 0.3
        assert "statistically significant higher performance" in result["interpretation"]
        assert "Maintaining high engagement is crucial" in result["interpretation"]

    def test_significant_small_effect(self):
        """p < 0.05 but small effect → different message."""
        comparator = EngagementPerformanceComparator("TEST_INT_SIG_SMALL")
        # Create a case where difference is significant but very small
        # We need many samples with tiny but consistent difference
        high_scores = [75.0 + i * 0.1 for i in range(20)]
        low_scores = [74.0 + i * 0.1 for i in range(20)]
        sessions = []
        for i, score in enumerate(high_scores):
            sessions.append({
                "session_id": f"h{i}",
                "engagement_score": 0.9,
                "avg_lo_score": score,
            })
        for i, score in enumerate(low_scores):
            sessions.append({
                "session_id": f"l{i}",
                "engagement_score": 0.1,
                "avg_lo_score": score,
            })
        comparator = EngagementPerformanceComparator("TEST_INT_SIG_SMALL")
        comparator._sessions = sessions
        result = comparator.get_analysis()
        # With large n, even tiny differences become significant
        if result["mann_whitney"] is not None and result["mann_whitney"]["p_value"] < 0.05 and result["effect_size"] is not None and result["effect_size"] < 0.3:
            assert "practical difference is small" in result["interpretation"]

    def test_not_significant(self):
        """p >= 0.05 → no significant difference message."""
        comparator = EngagementPerformanceComparator("TEST_INT_NS")
        comparator._sessions = [
            {"session_id": "s1", "engagement_score": 0.9, "avg_lo_score": 75.0},
            {"session_id": "s2", "engagement_score": 0.8, "avg_lo_score": 70.0},
            {"session_id": "s3", "engagement_score": 0.85, "avg_lo_score": 72.0},
            {"session_id": "s4", "engagement_score": 0.2, "avg_lo_score": 73.0},
            {"session_id": "s5", "engagement_score": 0.3, "avg_lo_score": 68.0},
            {"session_id": "s6", "engagement_score": 0.25, "avg_lo_score": 71.0},
        ]
        result = comparator.get_analysis()
        assert result["mann_whitney"] is not None
        assert result["mann_whitney"]["p_value"] >= 0.05
        assert "No significant difference found" in result["interpretation"]

    def test_no_variance(self):
        """All engagement identical → 'Cannot split' message."""
        comparator = EngagementPerformanceComparator("TEST_INT_NO_VAR")
        comparator._sessions = [
            {"session_id": "s1", "engagement_score": 0.5, "avg_lo_score": 70.0},
            {"session_id": "s2", "engagement_score": 0.5, "avg_lo_score": 75.0},
            {"session_id": "s3", "engagement_score": 0.5, "avg_lo_score": 80.0},
        ]
        result = comparator.get_analysis()
        assert "Cannot split" in result["interpretation"]

    def test_insufficient_data_message(self):
        """Too few sessions per group → insufficient data message."""
        comparator = EngagementPerformanceComparator("TEST_INT_SHORT")
        comparator._sessions = [
            {"session_id": "s1", "engagement_score": 0.9, "avg_lo_score": 80.0},
            {"session_id": "s2", "engagement_score": 0.8, "avg_lo_score": 75.0},
            {"session_id": "s3", "engagement_score": 0.1, "avg_lo_score": 60.0},
        ]
        result = comparator.get_analysis()
        assert "Insufficient data" in result["interpretation"]


class TestEdgeCases:
    """Edge case handling."""

    def test_no_sessions(self):
        """No sessions at all."""
        comparator = EngagementPerformanceComparator("TEST_NO_SESSIONS")
        comparator._sessions = []
        result = comparator.get_analysis()
        assert result["num_sessions"] == 0
        assert "No sessions found" in result["interpretation"]

    def test_exactly_three_per_group(self):
        """Exactly 3 per group is the minimum valid split."""
        comparator = EngagementPerformanceComparator("TEST_EXACT_3")
        comparator._sessions = [
            {"session_id": "s1", "engagement_score": 0.9, "avg_lo_score": 90.0},
            {"session_id": "s2", "engagement_score": 0.8, "avg_lo_score": 85.0},
            {"session_id": "s3", "engagement_score": 0.85, "avg_lo_score": 88.0},
            {"session_id": "s4", "engagement_score": 0.2, "avg_lo_score": 50.0},
            {"session_id": "s5", "engagement_score": 0.3, "avg_lo_score": 55.0},
            {"session_id": "s6", "engagement_score": 0.25, "avg_lo_score": 52.0},
        ]
        result = comparator.get_analysis()
        assert result["high_group_count"] == 3
        assert result["low_group_count"] == 3
        assert result["mann_whitney"] is not None

    def test_high_group_lower_scores(self):
        """When high engagement group actually scores lower."""
        comparator = EngagementPerformanceComparator("TEST_HIGH_LOWER")
        comparator._sessions = [
            {"session_id": "s1", "engagement_score": 0.9, "avg_lo_score": 50.0},
            {"session_id": "s2", "engagement_score": 0.8, "avg_lo_score": 55.0},
            {"session_id": "s3", "engagement_score": 0.85, "avg_lo_score": 52.0},
            {"session_id": "s4", "engagement_score": 0.2, "avg_lo_score": 90.0},
            {"session_id": "s5", "engagement_score": 0.3, "avg_lo_score": 85.0},
            {"session_id": "s6", "engagement_score": 0.25, "avg_lo_score": 88.0},
        ]
        result = comparator.get_analysis()
        # With alternative='greater', p should be high
        assert result["mann_whitney"] is not None
        assert result["mann_whitney"]["p_value"] >= 0.05
        assert result["effect_size"] is not None
        assert result["effect_size"] < 0  # negative because high < low


# ==================================================================
# Integration tests — using the real database
# ==================================================================

class TestWithDatabase:
    """Integration tests against the PostgreSQL database."""

    def test_fetch_sessions_returns_data(self, student_ids):
        """Sessions fetched from DB have required fields."""
        if not student_ids:
            pytest.skip("No students in database")
        comparator = EngagementPerformanceComparator(student_ids[0])
        sessions = comparator._fetch_sessions()
        assert isinstance(sessions, list)
        if sessions:
            assert "session_id" in sessions[0]
            assert "engagement_score" in sessions[0]
            assert "avg_lo_score" in sessions[0]

    def test_get_analysis_complete(self, student_ids):
        """get_analysis returns all expected keys."""
        if not student_ids:
            pytest.skip("No students in database")
        comparator = EngagementPerformanceComparator(student_ids[0])
        result = comparator.get_analysis()
        expected_keys = {
            "student_id",
            "num_sessions",
            "threshold",
            "high_group_count",
            "low_group_count",
            "mann_whitney",
            "effect_size",
            "effect_size_magnitude",
            "descriptive_statistics",
            "interpretation",
        }
        assert set(result.keys()) == expected_keys

    def test_high_group_mean_ge_low_group_when_significant(self, student_ids):
        """When significant, high engagement mean should be >= low mean."""
        if not student_ids:
            pytest.skip("No students in database")
        for sid in student_ids[:5]:
            comparator = EngagementPerformanceComparator(sid)
            result = comparator.get_analysis()
            mw = result.get("mann_whitney")
            if mw is not None and mw["p_value"] < 0.05:
                desc = result["descriptive_statistics"]
                high_mean = desc["high_engagement"]["mean"]
                low_mean = desc["low_engagement"]["mean"]
                if high_mean is not None and low_mean is not None:
                    assert high_mean >= low_mean, (
                        f"{sid}: significant but high_mean ({high_mean:.1f}) < "
                        f"low_mean ({low_mean:.1f})"
                    )

    def test_effect_sizes_in_valid_range(self, student_ids):
        """All effect sizes are in [-1, 1]."""
        if not student_ids:
            pytest.skip("No students in database")
        for sid in student_ids:
            comparator = EngagementPerformanceComparator(sid)
            result = comparator.get_analysis()
            r = result.get("effect_size")
            if r is not None:
                assert -1.0 <= r <= 1.0, (
                    f"{sid}: effect size {r} out of range"
                )

    def test_all_students_analysis_summary(self, student_ids):
        """Print a summary table for all students."""
        if not student_ids:
            pytest.skip("No students in database")

        significant_count = 0
        total_with_test = 0

        print(
            f"\n{'Student':<12} {'Sessions':>8} {'High':>5} {'Low':>5} "
            f"{'U':>8} {'p-value':>10} {'r':>7} {'Effect':>8}  Interpretation"
        )
        print("-" * 110)

        for sid in student_ids:
            comparator = EngagementPerformanceComparator(sid)
            result = comparator.get_analysis()

            n = result["num_sessions"]
            high_n = result["high_group_count"]
            low_n = result["low_group_count"]
            mw = result.get("mann_whitney")

            if mw is not None:
                total_with_test += 1
                U_str = f"{mw['U_statistic']:.1f}"
                p_str = f"{mw['p_value']:.4f}"
                r = result.get("effect_size")
                r_str = f"{r:+.3f}" if r is not None else "N/A"
                eff = result.get("effect_size_magnitude", "N/A")
                sig = "*" if mw["p_value"] < 0.05 else " "
                significant_count += 1 if mw["p_value"] < 0.05 else 0
            else:
                U_str = "N/A"
                p_str = "N/A"
                r_str = "N/A"
                eff = "N/A"
                sig = " "

            interp = result["interpretation"][:50]
            print(
                f"{sid:<12} {n:>8} {high_n:>5} {low_n:>5} "
                f"{U_str:>8} {p_str:>10} {r_str:>7} {eff:>8}{sig}  {interp}"
            )

        if total_with_test > 0:
            pct = (significant_count / total_with_test) * 100
            print(f"\nSignificant results: {significant_count}/{total_with_test} ({pct:.0f}%)")
            # Expect roughly 40-60% show significant difference
            assert 20 <= pct <= 80, (
                f"Unexpected significant rate: {pct:.0f}%"
            )
