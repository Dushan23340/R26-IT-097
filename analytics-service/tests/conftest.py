"""
Shared pytest fixtures for the analytics-service test suite.

Fixtures:
  - sys_path_setup: Ensures analytics-service root is on sys.path.
  - db_student_ids: All student IDs from the database (module scope).
  - sample_student_id: A single real student ID for integration tests.
  - mock_sessions_improving: Mock session metadata for an improving student.
  - mock_sessions_declining: Mock session metadata for a declining student.
  - mock_sessions_stable: Mock session metadata for a stable student.
  - mock_lo_scores_improving: Mock LO scores trending upward.
  - mock_lo_scores_declining: Mock LO scores trending downward.
  - mock_lo_scores_stable: Mock LO scores with no trend.
  - flask_client: Flask test client for API endpoint tests.
  - mock_student_exists: Patches _student_exists to always return True.
  - mock_analyzers: Patches analyzer classes to return predictable data.
"""

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import numpy as np
import pytest

# ------------------------------------------------------------------
# Ensure analytics-service root is on sys.path
# ------------------------------------------------------------------
_service_root = str(Path(__file__).resolve().parents[1])
if _service_root not in sys.path:
    sys.path.insert(0, _service_root)

from config.database import get_cursor, test_connection


# ------------------------------------------------------------------
# Database fixtures
# ------------------------------------------------------------------
@pytest.fixture(scope="session")
def db_available():
    """Check whether the PostgreSQL database is reachable."""
    return test_connection()


@pytest.fixture(scope="module")
def db_student_ids():
    """Fetch every student_id from the database."""
    try:
        with get_cursor() as cur:
            cur.execute(
                "SELECT student_id FROM student_profiles ORDER BY student_id"
            )
            return [row[0] for row in cur.fetchall()]
    except Exception as exc:
        pytest.skip(f"Database unreachable — cannot fetch student IDs: {exc}")


@pytest.fixture(scope="module")
def sample_student_id(db_student_ids):
    """Return the first real student ID for integration tests."""
    if not db_student_ids:
        pytest.skip("No students in database.")
    return db_student_ids[0]


# ------------------------------------------------------------------
# Mock data fixtures for TrendAnalyzer
# ------------------------------------------------------------------
@pytest.fixture
def mock_sessions_improving():
    """10 sessions for an improving student."""
    return [
        {"session_id": f"sess_{i:02d}", "start_time": None, "lesson_id": f"L{i}"}
        for i in range(1, 11)
    ]


@pytest.fixture
def mock_sessions_declining():
    """10 sessions for a declining student."""
    return [
        {"session_id": f"sess_{i:02d}", "start_time": None, "lesson_id": f"L{i}"}
        for i in range(1, 11)
    ]


@pytest.fixture
def mock_sessions_stable():
    """10 sessions for a stable student."""
    return [
        {"session_id": f"sess_{i:02d}", "start_time": None, "lesson_id": f"L{i}"}
        for i in range(1, 11)
    ]


@pytest.fixture
def mock_lo_scores_improving():
    """LO scores that rise strongly (slope ~+2.5, p < 0.05)."""
    return np.array([55.0, 58.0, 62.0, 65.0, 70.0, 75.0, 78.0, 82.0, 85.0, 90.0])


@pytest.fixture
def mock_lo_scores_declining():
    """LO scores that fall strongly (slope ~-2.5, p < 0.05)."""
    return np.array([90.0, 85.0, 82.0, 78.0, 75.0, 70.0, 65.0, 62.0, 58.0, 55.0])


@pytest.fixture
def mock_lo_scores_stable():
    """LO scores that stay flat (slope ~0, p > 0.05)."""
    return np.array([78.0, 80.0, 79.0, 81.0, 77.0, 80.0, 79.0, 82.0, 78.0, 80.0])


# ------------------------------------------------------------------
# Flask test client fixture
# ------------------------------------------------------------------
@pytest.fixture
def flask_client():
    """Yield a Flask test client for the analytics API."""
    from app import app

    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


# ------------------------------------------------------------------
# Mock _student_exists for API tests
# ------------------------------------------------------------------
@pytest.fixture
def mock_student_exists():
    """Patch _student_exists to return True for any ID."""
    with patch("app._student_exists", return_value=True):
        yield


# ------------------------------------------------------------------
# Mock analyzer classes for API tests
# ------------------------------------------------------------------
@pytest.fixture
def mock_analyzers():
    """Patch all analyzer classes to return deterministic test data."""
    trend_data = {
        "student_id": "STU_TEST",
        "num_sessions": 10,
        "regression_stats": {
            "slope": 2.5,
            "intercept": 50.0,
            "r_value": 0.95,
            "p_value": 0.001,
            "std_err": 0.3,
            "r_squared": 0.9025,
        },
        "trend_classification": "improving",
        "interpretation": "Test interpretation for improving trend.",
    }

    stability_data = {
        "student_id": "STU_TEST",
        "variance": 12.5,
        "sd": 3.54,
        "cv": 4.5,
        "mean": 78.0,
        "num_sessions": 10,
        "at_risk": False,
        "rolling_variance": [[0, 8.0], [1, 10.0], [2, 15.0]],
        "interpretation": "Performance is stable.",
    }

    emotions_data = {
        "student_id": "STU_TEST",
        "num_sessions": 10,
        "correlations": {
            "happy": {
                "r": 0.65,
                "p_value": 0.04,
                "significant": True,
                "direction": "positive",
                "strength": "strong",
            },
            "confused": {
                "r": -0.55,
                "p_value": 0.10,
                "significant": False,
                "direction": "negative",
                "strength": "strong",
            },
        },
        "significant_correlations": {"happy": 0.65},
        "summary": "Happy correlates positively with LO scores.",
    }

    engagement_data = {
        "student_id": "STU_TEST",
        "mann_whitney": {
            "U_statistic": 85.0,
            "p_value": 0.02,
            "significant": True,
        },
        "effect_size": 0.45,
        "descriptive_statistics": {
            "high_engagement": {"count": 5, "mean": 85.0, "median": 86.0, "sd": 5.0},
            "low_engagement": {"count": 5, "mean": 70.0, "median": 69.0, "sd": 6.0},
        },
        "interpretation": "High engagement sessions show significantly better performance.",
    }

    with patch("app.TrendAnalyzer") as MockTrend, \
         patch("app.StabilityAnalyzer") as MockStab, \
         patch("app.EmotionCorrelationAnalyzer") as MockEmo, \
         patch("app.EngagementPerformanceComparator") as MockEng, \
         patch("app.compute_class_statistics") as MockClassStats:

        trend_inst = MagicMock()
        trend_inst.get_analysis_summary.return_value = trend_data
        MockTrend.return_value = trend_inst

        stab_inst = MagicMock()
        stab_inst.get_analysis.return_value = stability_data.copy()
        MockStab.return_value = stab_inst
        MockStab.flag_at_risk.return_value = False

        emo_inst = MagicMock()
        emo_inst.get_analysis.return_value = emotions_data
        MockEmo.return_value = emo_inst

        eng_inst = MagicMock()
        eng_inst.get_analysis.return_value = engagement_data
        MockEng.return_value = eng_inst

        MockClassStats.return_value = {
            "class_mean_sd": 5.0,
            "class_sd_of_sds": 1.5,
        }

        yield {
            "trend": trend_data,
            "stability": stability_data,
            "emotions": emotions_data,
            "engagement": engagement_data,
        }
