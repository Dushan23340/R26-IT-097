"""
Pytest suite for the Flask REST API (app.py).

Test cases:
  - All API endpoints return 200
  - 404 for non-existent student
  - JSON response structure validation
  - CORS headers present
  - Error handlers
  - Request logging

Run:
    cd analytics-service
    python -m pytest tests/test_api.py -v
"""

import sys
from pathlib import Path

import pytest

# Ensure analytics-service root is on sys.path
_sys_path = str(Path(__file__).resolve().parents[1])
if _sys_path not in sys.path:
    sys.path.insert(0, _sys_path)

from app import app, _json_safe


# ==================================================================
# Health & metadata endpoints
# ==================================================================

class TestHealthEndpoint:
    """Test /api/analytics/health."""

    def test_health_status_ok(self, flask_client):
        """Health endpoint returns 200 and expected keys."""
        resp = flask_client.get("/api/analytics/health")
        assert resp.status_code == 200
        data = resp.get_json()
        assert "status" in data
        assert "timestamp" in data
        assert "database_connected" in data
        assert isinstance(data["database_connected"], bool)

    def test_health_json_content_type(self, flask_client):
        """Response Content-Type is application/json."""
        resp = flask_client.get("/api/analytics/health")
        assert resp.content_type.startswith("application/json")


class TestStudentsEndpoint:
    """Test /api/analytics/students."""

    def test_students_status_200(self, flask_client):
        """Students list returns 200."""
        resp = flask_client.get("/api/analytics/students")
        assert resp.status_code == 200

    def test_students_response_structure(self, flask_client):
        """Response contains count and students array."""
        resp = flask_client.get("/api/analytics/students")
        data = resp.get_json()
        assert "count" in data
        assert "students" in data
        assert isinstance(data["students"], list)


# ==================================================================
# Student analytics endpoints (mocked analyzers)
# ==================================================================

class TestTrendEndpoint:
    """Test /api/analytics/student/<id>/trend."""

    def test_trend_200(self, flask_client, mock_student_exists, mock_analyzers):
        """Trend endpoint returns 200 with regression stats."""
        resp = flask_client.get("/api/analytics/student/STU_TEST/trend")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["student_id"] == "STU_TEST"
        assert data["trend_classification"] == "improving"
        assert "regression_stats" in data
        assert "interpretation" in data

    def test_trend_404(self, flask_client):
        """Trend endpoint returns 404 for unknown student."""
        resp = flask_client.get("/api/analytics/student/FAKE_STUDENT/trend")
        assert resp.status_code == 404
        data = resp.get_json()
        assert "error" in data


class TestStabilityEndpoint:
    """Test /api/analytics/student/<id>/stability."""

    def test_stability_200(self, flask_client, mock_student_exists, mock_analyzers):
        """Stability endpoint returns 200 with variance metrics."""
        resp = flask_client.get("/api/analytics/student/STU_TEST/stability")
        assert resp.status_code == 200
        data = resp.get_json()
        assert "variance" in data
        assert "sd" in data
        assert "cv" in data
        assert "at_risk" in data

    def test_stability_404(self, flask_client):
        """Stability endpoint returns 404 for unknown student."""
        resp = flask_client.get("/api/analytics/student/FAKE_STUDENT/stability")
        assert resp.status_code == 404


class TestEmotionsEndpoint:
    """Test /api/analytics/student/<id>/emotions."""

    def test_emotions_200(self, flask_client, mock_student_exists, mock_analyzers):
        """Emotions endpoint returns 200 with correlation data."""
        resp = flask_client.get("/api/analytics/student/STU_TEST/emotions")
        assert resp.status_code == 200
        data = resp.get_json()
        assert "correlations" in data
        assert "num_sessions" in data

    def test_emotions_404(self, flask_client):
        """Emotions endpoint returns 404 for unknown student."""
        resp = flask_client.get("/api/analytics/student/FAKE_STUDENT/emotions")
        assert resp.status_code == 404


class TestEngagementEndpoint:
    """Test /api/analytics/student/<id>/engagement."""

    def test_engagement_200(self, flask_client, mock_student_exists, mock_analyzers):
        """Engagement endpoint returns 200 with Mann-Whitney stats."""
        resp = flask_client.get("/api/analytics/student/STU_TEST/engagement")
        assert resp.status_code == 200
        data = resp.get_json()
        assert "mann_whitney" in data
        assert "effect_size" in data
        assert "descriptive_statistics" in data

    def test_engagement_404(self, flask_client):
        """Engagement endpoint returns 404 for unknown student."""
        resp = flask_client.get("/api/analytics/student/FAKE_STUDENT/engagement")
        assert resp.status_code == 404


class TestProfileEndpoint:
    """Test /api/analytics/student/<id>/profile."""

    def test_profile_404(self, flask_client):
        """Profile endpoint returns 404 for unknown student."""
        resp = flask_client.get("/api/analytics/student/FAKE_STUDENT/profile")
        assert resp.status_code == 404


class TestCompleteEndpoint:
    """Test /api/analytics/student/<id>/complete."""

    def test_complete_200(self, flask_client, mock_student_exists, mock_analyzers):
        """Complete endpoint returns 200 with all 4 analytics sections."""
        resp = flask_client.get("/api/analytics/student/STU_TEST/complete")
        assert resp.status_code == 200
        data = resp.get_json()
        assert "student_id" in data
        assert "trend" in data
        assert "stability" in data
        assert "emotions" in data
        assert "engagement" in data

    def test_complete_404(self, flask_client):
        """Complete endpoint returns 404 for unknown student."""
        resp = flask_client.get("/api/analytics/student/FAKE_STUDENT/complete")
        assert resp.status_code == 404


# ==================================================================
# CORS headers
# ==================================================================

class TestCorsHeaders:
    """Verify CORS headers are present on responses."""

    def test_cors_on_health(self, flask_client):
        """Health endpoint includes Access-Control-Allow-Origin."""
        resp = flask_client.get("/api/analytics/health")
        assert "Access-Control-Allow-Origin" in resp.headers

    def test_cors_on_students(self, flask_client):
        """Students endpoint includes Access-Control-Allow-Origin."""
        resp = flask_client.get("/api/analytics/students")
        assert "Access-Control-Allow-Origin" in resp.headers

    def test_cors_preflight_options(self, flask_client):
        """OPTIONS preflight request returns 200 with CORS headers."""
        resp = flask_client.options(
            "/api/analytics/health",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert resp.status_code == 200
        assert "Access-Control-Allow-Origin" in resp.headers
        assert "Access-Control-Allow-Methods" in resp.headers


# ==================================================================
# Error handlers
# ==================================================================

class TestErrorHandlers:
    """Test 404 and 500 error handlers."""

    def test_404_handler(self, flask_client):
        """Unknown endpoint returns JSON 404."""
        resp = flask_client.get("/api/analytics/nonexistent")
        assert resp.status_code == 404
        data = resp.get_json()
        assert "error" in data
        assert "path" in data

    def test_405_handler(self, flask_client):
        """POST to GET-only endpoint returns 405."""
        resp = flask_client.post("/api/analytics/health")
        assert resp.status_code == 405


# ==================================================================
# JSON safe helper
# ==================================================================

class TestJsonSafeHelper:
    """Test _json_safe numpy-to-native conversion."""

    def test_numpy_int(self):
        import numpy as np
        assert _json_safe(np.int64(42)) == 42

    def test_numpy_float(self):
        import numpy as np
        assert _json_safe(np.float64(3.14)) == pytest.approx(3.14)

    def test_numpy_bool(self):
        import numpy as np
        assert _json_safe(np.bool_(True)) is True

    def test_numpy_array(self):
        import numpy as np
        arr = np.array([1, 2, 3])
        assert _json_safe(arr) == [1, 2, 3]

    def test_nested_dict(self):
        import numpy as np
        obj = {"count": np.int64(5), "score": np.float64(88.5)}
        result = _json_safe(obj)
        assert result == {"count": 5, "score": pytest.approx(88.5)}

    def test_list_of_numpy(self):
        import numpy as np
        obj = [np.int64(1), np.float64(2.5)]
        result = _json_safe(obj)
        assert result == [1, pytest.approx(2.5)]

    def test_plain_types_unchanged(self):
        assert _json_safe(42) == 42
        assert _json_safe(3.14) == pytest.approx(3.14)
        assert _json_safe("hello") == "hello"
        assert _json_safe(True) is True
