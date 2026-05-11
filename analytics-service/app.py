"""
Analytics Service REST API (Flask).

Provides endpoints for student learning analytics:
- trend analysis (linear regression)
- stability analysis (variance-based)
- emotion–LO correlation (Pearson)
- engagement–performance comparison (Mann-Whitney U)

Run:
    python app.py

Port: 5001
"""

import logging
import time
from datetime import datetime, timezone

from flask import Flask, jsonify, request
from flask_cors import CORS

from config.database import get_cursor, test_connection
from services.trend_analyzer import TrendAnalyzer
from services.stability_analyzer import StabilityAnalyzer, compute_class_statistics
from services.emotion_correlator import EmotionCorrelationAnalyzer
from services.engagement_comparator import EngagementPerformanceComparator

# ------------------------------------------------------------------
# Logging setup
# ------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ------------------------------------------------------------------
# Flask app + CORS
# ------------------------------------------------------------------
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

PORT = 5001


# ==================================================================
# Helpers
# ==================================================================
def _student_exists(student_id: str) -> bool:
    """Check whether a student_id is present in student_profiles."""
    try:
        with get_cursor() as cur:
            cur.execute(
                "SELECT 1 FROM student_profiles WHERE student_id = %s",
                (student_id,),
            )
            return cur.fetchone() is not None
    except Exception as exc:
        logger.error("DB error checking student existence: %s", exc)
        return False


def _json_safe(obj):
    """Recursively convert numpy scalars / types to plain Python types."""
    import numpy as np

    if isinstance(obj, dict):
        return {k: _json_safe(v) for k, v in obj.items()}
    if isinstance(obj, list | tuple):
        return [_json_safe(v) for v in obj]
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.floating):
        return float(obj)
    if isinstance(obj, np.bool_):
        return bool(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    return obj


# ==================================================================
# Request logging
# ==================================================================
@app.before_request
def _log_request():
    logger.info("%s %s", request.method, request.path)


# ==================================================================
# Routes
# ==================================================================

@app.route("/api/analytics/health", methods=["GET"])
def health():
    """Health check with DB connectivity test."""
    try:
        db_ok = test_connection()
        return jsonify(
            {
                "status": "ok" if db_ok else "degraded",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "database_connected": db_ok,
            }
        )
    except Exception as exc:
        logger.error("Health check failed: %s", exc)
        return jsonify(
            {
                "status": "error",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "database_connected": False,
                "error": str(exc),
            }
        ), 500


@app.route("/api/analytics/students", methods=["GET"])
def students():
    """List all student IDs and names."""
    try:
        with get_cursor() as cur:
            cur.execute(
                "SELECT student_id, full_name FROM student_profiles ORDER BY student_id"
            )
            rows = cur.fetchall()

        data = [{"student_id": sid, "full_name": name} for sid, name in rows]
        return jsonify({"count": len(data), "students": data})
    except Exception as exc:
        logger.error("Failed to fetch students: %s", exc)
        return jsonify({"error": str(exc)}), 500


@app.route("/api/analytics/student/<student_id>/profile", methods=["GET"])
def student_profile(student_id: str):
    """Complete student profile with all sessions."""
    try:
        if not _student_exists(student_id):
            return jsonify({"error": f"Student '{student_id}' not found"}), 404

        # Profile
        with get_cursor() as cur:
            cur.execute(
                """
                SELECT student_id, full_name, email, enrollment_date, grade_level
                FROM student_profiles WHERE student_id = %s
                """,
                (student_id,),
            )
            row = cur.fetchone()
        profile = {
            "student_id": row[0],
            "full_name": row[1],
            "email": row[2],
            "enrollment_date": row[3].isoformat() if row[3] else None,
            "grade_level": row[4],
        }

        # Sessions with engagement and avg LO score
        with get_cursor() as cur:
            cur.execute(
                """
                SELECT
                    ls.session_id,
                    ls.lesson_title,
                    ls.start_time,
                    ls.duration_seconds,
                    em.engagement_score,
                    AVG(lo.score) AS avg_lo_score
                FROM learning_sessions ls
                LEFT JOIN engagement_metrics em
                    ON ls.session_id = em.session_id
                LEFT JOIN lo_achievement_scores lo
                    ON ls.session_id = lo.session_id
                WHERE ls.student_id = %s
                GROUP BY ls.session_id, ls.lesson_title, ls.start_time,
                         ls.duration_seconds, em.engagement_score
                ORDER BY ls.start_time
                """,
                (student_id,),
            )
            session_rows = cur.fetchall()

        sessions = []
        for r in session_rows:
            sessions.append(
                {
                    "session_id": str(r[0]),
                    "lesson_title": r[1],
                    "start_time": r[2].isoformat() if r[2] else None,
                    "duration_seconds": r[3],
                    "engagement_score": float(r[4]) if r[4] is not None else None,
                    "avg_lo_score": float(r[5]) if r[5] is not None else None,
                }
            )

        return jsonify({"profile": profile, "sessions": sessions})
    except Exception as exc:
        logger.error("Profile error for %s: %s", student_id, exc)
        return jsonify({"error": str(exc)}), 500


@app.route("/api/analytics/student/<student_id>/trend", methods=["GET"])
def student_trend(student_id: str):
    """Linear-regression trend analysis."""
    try:
        if not _student_exists(student_id):
            return jsonify({"error": f"Student '{student_id}' not found"}), 404

        analyzer = TrendAnalyzer(student_id)
        result = analyzer.get_analysis_summary()
        return jsonify(_json_safe(result))
    except Exception as exc:
        logger.error("Trend error for %s: %s", student_id, exc)
        return jsonify({"error": str(exc)}), 500


@app.route("/api/analytics/student/<student_id>/stability", methods=["GET"])
def student_stability(student_id: str):
    """Variance-based stability analysis."""
    try:
        if not _student_exists(student_id):
            return jsonify({"error": f"Student '{student_id}' not found"}), 404

        analyzer = StabilityAnalyzer(student_id)
        result = analyzer.get_analysis()

        # Include class-level baseline for at-risk context
        try:
            with get_cursor() as cur:
                cur.execute(
                    "SELECT student_id FROM student_profiles ORDER BY student_id"
                )
                all_ids = [r[0] for r in cur.fetchall()]
            class_stats = compute_class_statistics(all_ids)
            result["class_baseline"] = {
                "class_mean_sd": class_stats["class_mean_sd"],
                "class_sd_of_sds": class_stats["class_sd_of_sds"],
            }
            sd = result.get("sd")
            if sd is not None:
                result["at_risk"] = StabilityAnalyzer.flag_at_risk(
                    sd,
                    class_stats["class_mean_sd"],
                    class_stats["class_sd_of_sds"],
                )
            else:
                result["at_risk"] = None
        except Exception as exc:
            logger.warning("Could not compute class stats: %s", exc)
            result["class_baseline"] = None
            result["at_risk"] = None

        return jsonify(_json_safe(result))
    except Exception as exc:
        logger.error("Stability error for %s: %s", student_id, exc)
        return jsonify({"error": str(exc)}), 500


@app.route("/api/analytics/student/<student_id>/emotions", methods=["GET"])
def student_emotions(student_id: str):
    """Emotion–learning outcome correlation analysis."""
    try:
        if not _student_exists(student_id):
            return jsonify({"error": f"Student '{student_id}' not found"}), 404

        analyzer = EmotionCorrelationAnalyzer(student_id)
        result = analyzer.get_analysis()
        return jsonify(_json_safe(result))
    except Exception as exc:
        logger.error("Emotion error for %s: %s", student_id, exc)
        return jsonify({"error": str(exc)}), 500


@app.route("/api/analytics/student/<student_id>/engagement", methods=["GET"])
def student_engagement(student_id: str):
    """Engagement–performance Mann-Whitney comparison."""
    try:
        if not _student_exists(student_id):
            return jsonify({"error": f"Student '{student_id}' not found"}), 404

        comparator = EngagementPerformanceComparator(student_id)
        result = comparator.get_analysis()
        return jsonify(_json_safe(result))
    except Exception as exc:
        logger.error("Engagement error for %s: %s", student_id, exc)
        return jsonify({"error": str(exc)}), 500


@app.route("/api/analytics/student/<student_id>/complete", methods=["GET"])
def student_complete(student_id: str):
    """All analytics combined in one response."""
    try:
        if not _student_exists(student_id):
            return jsonify({"error": f"Student '{student_id}' not found"}), 404

        response = {"student_id": student_id}

        # Trend
        try:
            trend = TrendAnalyzer(student_id).get_analysis_summary()
            response["trend"] = _json_safe(trend)
        except Exception as exc:
            logger.warning("Trend failed for %s: %s", student_id, exc)
            response["trend"] = {"error": str(exc)}

        # Stability
        try:
            stability = StabilityAnalyzer(student_id).get_analysis()
            with get_cursor() as cur:
                cur.execute(
                    "SELECT student_id FROM student_profiles ORDER BY student_id"
                )
                all_ids = [r[0] for r in cur.fetchall()]
            class_stats = compute_class_statistics(all_ids)
            stability["at_risk"] = None
            if stability.get("sd") is not None:
                stability["at_risk"] = StabilityAnalyzer.flag_at_risk(
                    stability["sd"],
                    class_stats["class_mean_sd"],
                    class_stats["class_sd_of_sds"],
                )
            response["stability"] = _json_safe(stability)
        except Exception as exc:
            logger.warning("Stability failed for %s: %s", student_id, exc)
            response["stability"] = {"error": str(exc)}

        # Emotions
        try:
            emotions = EmotionCorrelationAnalyzer(student_id).get_analysis()
            response["emotions"] = _json_safe(emotions)
        except Exception as exc:
            logger.warning("Emotions failed for %s: %s", student_id, exc)
            response["emotions"] = {"error": str(exc)}

        # Engagement
        try:
            engagement = EngagementPerformanceComparator(student_id).get_analysis()
            response["engagement"] = _json_safe(engagement)
        except Exception as exc:
            logger.warning("Engagement failed for %s: %s", student_id, exc)
            response["engagement"] = {"error": str(exc)}

        return jsonify(response)
    except Exception as exc:
        logger.error("Complete analysis error for %s: %s", student_id, exc)
        return jsonify({"error": str(exc)}), 500


# ==================================================================
# Error handlers
# ==================================================================
@app.errorhandler(404)
def _not_found(e):
    logger.warning("404: %s", request.path)
    return jsonify({"error": "Endpoint not found", "path": request.path}), 404


@app.errorhandler(500)
def _server_error(e):
    logger.error("500: %s", e)
    return jsonify({"error": "Internal server error"}), 500


# ==================================================================
# Main
# ==================================================================
if __name__ == "__main__":
    logger.info("Starting Analytics API on port %d", PORT)
    app.run(host="0.0.0.0", port=PORT, debug=True)
