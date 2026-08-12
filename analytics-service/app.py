"""
Analytics Service REST API (Flask).

Provides endpoints for student learning analytics:
- trend analysis (linear regression)
- stability analysis (variance-based)
- emotion-LO correlation (Pearson)
- engagement-performance comparison (Mann-Whitney U)
- ERSE AI-driven suggestion engine (Layers 1-6)

Run:
    python app.py

Port: 5001
"""

import logging
import json as _json_mod
from datetime import datetime, timezone

from flask import Flask, jsonify, request
from flask_cors import CORS

from config.database import get_cursor, test_connection
from services.trend_analyzer import TrendAnalyzer
from services.stability_analyzer import StabilityAnalyzer, compute_class_statistics
from services.emotion_correlator import EmotionCorrelationAnalyzer
from services.engagement_comparator import EngagementPerformanceComparator
from services.suggestion_engine import SuggestionEngine
from services.suggestion_generator import SuggestionGenerator
from services.outcome_tracker import OutcomeTracker

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
    if isinstance(obj, (list, tuple)):
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
# Core Analytics Routes
# ==================================================================

@app.route("/api/analytics/health", methods=["GET"])
def health():
    """Health check with DB connectivity test."""
    try:
        db_ok = test_connection()
        return jsonify({
            "status": "ok" if db_ok else "degraded",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "database_connected": db_ok,
        })
    except Exception as exc:
        logger.error("Health check failed: %s", exc)
        return jsonify({
            "status": "error",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "database_connected": False,
            "error": str(exc),
        }), 500


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
            "student_id":      row[0],
            "full_name":       row[1],
            "email":           row[2],
            "enrollment_date": row[3].isoformat() if row[3] else None,
            "grade_level":     row[4],
        }

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
                LEFT JOIN engagement_metrics em ON ls.session_id = em.session_id
                LEFT JOIN lo_achievement_scores lo ON ls.session_id = lo.session_id
                WHERE ls.student_id = %s
                GROUP BY ls.session_id, ls.lesson_title, ls.start_time,
                         ls.duration_seconds, em.engagement_score
                ORDER BY ls.start_time
                """,
                (student_id,),
            )
            session_rows = cur.fetchall()

        sessions = [
            {
                "session_id":       str(r[0]),
                "lesson_title":     r[1],
                "start_time":       r[2].isoformat() if r[2] else None,
                "duration_seconds": r[3],
                "engagement_score": float(r[4]) if r[4] is not None else None,
                "avg_lo_score":     float(r[5]) if r[5] is not None else None,
            }
            for r in session_rows
        ]

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

        try:
            with get_cursor() as cur:
                cur.execute(
                    "SELECT student_id FROM student_profiles ORDER BY student_id"
                )
                all_ids = [r[0] for r in cur.fetchall()]
            class_stats = compute_class_statistics(all_ids)
            result["class_baseline"] = {
                "class_mean_sd":    class_stats["class_mean_sd"],
                "class_sd_of_sds":  class_stats["class_sd_of_sds"],
            }
            sd = result.get("sd")
            result["at_risk"] = (
                StabilityAnalyzer.flag_at_risk(
                    sd,
                    class_stats["class_mean_sd"],
                    class_stats["class_sd_of_sds"],
                )
                if sd is not None else None
            )
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
    """Emotion-learning outcome correlation analysis."""
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
    """Engagement-performance Mann-Whitney comparison."""
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

        try:
            response["trend"] = _json_safe(TrendAnalyzer(student_id).get_analysis_summary())
        except Exception as exc:
            response["trend"] = {"error": str(exc)}

        try:
            stability = StabilityAnalyzer(student_id).get_analysis()
            with get_cursor() as cur:
                cur.execute("SELECT student_id FROM student_profiles ORDER BY student_id")
                all_ids = [r[0] for r in cur.fetchall()]
            class_stats = compute_class_statistics(all_ids)
            stability["at_risk"] = (
                StabilityAnalyzer.flag_at_risk(
                    stability["sd"],
                    class_stats["class_mean_sd"],
                    class_stats["class_sd_of_sds"],
                )
                if stability.get("sd") is not None else None
            )
            response["stability"] = _json_safe(stability)
        except Exception as exc:
            response["stability"] = {"error": str(exc)}

        try:
            response["emotions"] = _json_safe(EmotionCorrelationAnalyzer(student_id).get_analysis())
        except Exception as exc:
            response["emotions"] = {"error": str(exc)}

        try:
            response["engagement"] = _json_safe(EngagementPerformanceComparator(student_id).get_analysis())
        except Exception as exc:
            response["engagement"] = {"error": str(exc)}

        return jsonify(response)
    except Exception as exc:
        logger.error("Complete analysis error for %s: %s", student_id, exc)
        return jsonify({"error": str(exc)}), 500


# ==================================================================
# ERSE — Suggestion Engine Routes
# ==================================================================

@app.route(
    "/api/analytics/student/<student_id>/suggestions",
    methods=["GET"],
)
def student_suggestions(student_id: str):
    """
    Run the ERSE pipeline for a student and return a new suggestion.

    Query parameters
    ----------------
    save : bool (default true)
        Pass ?save=false to preview without persisting to the database.

    Returns
    -------
    200 : Suggestion object with pattern, evidence, and generated text.
    404 : Student not found.
    500 : Internal error.
    """
    try:
        if not _student_exists(student_id):
            return jsonify({"error": f"Student '{student_id}' not found"}), 404

        save = request.args.get("save", "true").lower() != "false"

        engine      = SuggestionEngine(student_id)
        payload     = engine.run()
        generator   = SuggestionGenerator(payload)
        suggestion  = generator.generate()

        result = {
            "student_id":         student_id,
            "pattern": {
                "name":             payload.pattern.pattern_name,
                "priority":         payload.pattern.priority,
                "confidence":       payload.pattern.confidence_label,
                "confidence_score": payload.pattern.confidence_score,
                "urgency":          payload.pattern.urgency,
                "matched_signals":  payload.pattern.matched_signals,
            },
            "evidence":           [e.to_dict() for e in payload.evidence],
            "state_vector":       payload.state_vector.to_dict(),
            "teacher_suggestion": suggestion.teacher_suggestion,
            "student_suggestion": suggestion.student_suggestion,
            "expected_outcome":   suggestion.expected_outcome,
            "llm_model":          suggestion.llm_model,
            "llm_used":           suggestion.llm_used,
            "suggestion_id":      None,
        }

        if save:
            result["suggestion_id"] = _persist_suggestion(
                student_id, payload, suggestion
            )

        return jsonify(_json_safe(result))

    except Exception as exc:
        logger.error("ERSE error for %s: %s", student_id, exc)
        return jsonify({"error": str(exc)}), 500


@app.route(
    "/api/analytics/student/<student_id>/suggestions/history",
    methods=["GET"],
)
def student_suggestions_history(student_id: str):
    """
    Return all past suggestions for a student, ordered newest first.

    Query parameters
    ----------------
    status : str (optional) — 'pending' | 'approved' | 'modified' | 'dismissed'
    limit  : int (default 20)
    """
    try:
        if not _student_exists(student_id):
            return jsonify({"error": f"Student '{student_id}' not found"}), 404

        status = request.args.get("status")
        limit  = min(int(request.args.get("limit", 20)), 100)

        query  = """
            SELECT suggestion_id, pattern_name, confidence, urgency,
                   teacher_suggestion, student_suggestion, expected_outcome,
                   status, teacher_notes, created_at, reviewed_at,
                   outcome_tracked, outcome_summary, llm_used
            FROM suggestions
            WHERE student_id = %s
        """
        params = [student_id]

        if status:
            query  += " AND status = %s"
            params.append(status)

        query += " ORDER BY created_at DESC LIMIT %s"
        params.append(limit)

        with get_cursor() as cur:
            cur.execute(query, params)
            rows = cur.fetchall()

        suggestions = [
            {
                "suggestion_id":      str(r[0]),
                "pattern_name":       r[1],
                "confidence":         r[2],
                "urgency":            r[3],
                "teacher_suggestion": r[4],
                "student_suggestion": r[5],
                "expected_outcome":   r[6],
                "status":             r[7],
                "teacher_notes":      r[8],
                "created_at":         r[9].isoformat() if r[9] else None,
                "reviewed_at":        r[10].isoformat() if r[10] else None,
                "outcome_tracked":    r[11],
                "outcome_summary":    r[12],
                "llm_used":           r[13],
            }
            for r in rows
        ]

        return jsonify({
            "student_id":  student_id,
            "count":       len(suggestions),
            "suggestions": suggestions,
        })

    except Exception as exc:
        logger.error("Suggestion history error for %s: %s", student_id, exc)
        return jsonify({"error": str(exc)}), 500


@app.route(
    "/api/analytics/student/<student_id>/suggestions/<suggestion_id>/review",
    methods=["POST"],
)
def review_suggestion(student_id: str, suggestion_id: str):
    """
    Teacher review action: approve, modify, or dismiss a suggestion.

    Request body (JSON)
    -------------------
    action              : 'approve' | 'modify' | 'dismiss'  (required)
    teacher_notes       : rationale (required for dismiss, optional for approve)
    modified_suggestion : replacement text (required when action = 'modify')
    reviewed_by         : teacher identifier (optional)
    """
    try:
        if not _student_exists(student_id):
            return jsonify({"error": f"Student '{student_id}' not found"}), 404

        body          = request.get_json(silent=True) or {}
        action        = body.get("action", "").lower()
        teacher_notes = body.get("teacher_notes", "")
        modified_text = body.get("modified_suggestion", "")
        reviewed_by   = body.get("reviewed_by", "")

        valid_actions = {"approve", "modify", "dismiss"}
        if action not in valid_actions:
            return jsonify({
                "error": f"Invalid action '{action}'. Must be one of: {sorted(valid_actions)}"
            }), 400

        if action == "modify" and not modified_text.strip():
            return jsonify({
                "error": "Field 'modified_suggestion' is required when action = 'modify'."
            }), 400

        if action == "dismiss" and not teacher_notes.strip():
            return jsonify({
                "error": "Field 'teacher_notes' is required when action = 'dismiss'."
            }), 400

        status_map = {"approve": "approved", "modify": "modified", "dismiss": "dismissed"}
        new_status = status_map[action]

        with get_cursor() as cur:
            cur.execute(
                "SELECT status FROM suggestions WHERE suggestion_id = %s AND student_id = %s",
                (suggestion_id, student_id),
            )
            row = cur.fetchone()

        if row is None:
            return jsonify({
                "error": f"Suggestion '{suggestion_id}' not found for student '{student_id}'."
            }), 404

        if row[0] != "pending":
            return jsonify({
                "error": f"Suggestion already reviewed (status = '{row[0]}'). "
                         "Only pending suggestions can be reviewed."
            }), 409

        reviewed_at = datetime.now(timezone.utc)

        with get_cursor() as cur:
            cur.execute(
                """
                UPDATE suggestions
                SET status              = %s,
                    teacher_notes       = %s,
                    modified_suggestion = %s,
                    reviewed_at         = %s,
                    reviewed_by         = %s,
                    updated_at          = CURRENT_TIMESTAMP
                WHERE suggestion_id = %s
                RETURNING suggestion_id, pattern_name, confidence, urgency,
                          teacher_suggestion, student_suggestion, expected_outcome,
                          status, teacher_notes, modified_suggestion,
                          reviewed_at, reviewed_by
                """,
                (
                    new_status,
                    teacher_notes or None,
                    modified_text or None,
                    reviewed_at,
                    reviewed_by or None,
                    suggestion_id,
                ),
            )
            updated = cur.fetchone()

        return jsonify({
            "message":            f"Suggestion {action}d successfully.",
            "suggestion_id":      str(updated[0]),
            "pattern_name":       updated[1],
            "confidence":         updated[2],
            "urgency":            updated[3],
            "teacher_suggestion": updated[4],
            "student_suggestion": updated[5],
            "expected_outcome":   updated[6],
            "status":             updated[7],
            "teacher_notes":      updated[8],
            "modified_suggestion":updated[9],
            "reviewed_at":        updated[10].isoformat() if updated[10] else None,
            "reviewed_by":        updated[11],
        })

    except Exception as exc:
        logger.error("Review error for suggestion %s: %s", suggestion_id, exc)
        return jsonify({"error": str(exc)}), 500


@app.route(
    "/api/analytics/student/<student_id>/suggestions/<suggestion_id>/outcome",
    methods=["GET"],
)
def suggestion_outcome(student_id: str, suggestion_id: str):
    """Return the outcome tracking summary for a specific suggestion."""
    try:
        if not _student_exists(student_id):
            return jsonify({"error": f"Student '{student_id}' not found"}), 404

        tracker = OutcomeTracker(suggestion_id)
        summary = tracker.get_outcome_summary()

        if "error" in summary:
            return jsonify(summary), 500

        return jsonify(_json_safe(summary))

    except Exception as exc:
        logger.error("Outcome fetch error for suggestion %s: %s", suggestion_id, exc)
        return jsonify({"error": str(exc)}), 500


@app.route(
    "/api/analytics/student/<student_id>/suggestions/<suggestion_id>/track",
    methods=["POST"],
)
def track_suggestion_session(student_id: str, suggestion_id: str):
    """
    Track a specific session against an approved/modified suggestion.

    Request body (JSON)
    -------------------
    session_id : str — UUID of the session to track (required)
    """
    try:
        if not _student_exists(student_id):
            return jsonify({"error": f"Student '{student_id}' not found"}), 404

        body       = request.get_json(silent=True) or {}
        session_id = body.get("session_id", "").strip()

        if not session_id:
            return jsonify({
                "error": "Field 'session_id' is required in the request body."
            }), 400

        tracker = OutcomeTracker(suggestion_id)
        result  = tracker.track_next_session(session_id)

        if result is None:
            return jsonify({
                "message": "Session could not be tracked. The suggestion may not be "
                           "in an active state, or this session was already tracked."
            }), 200

        return jsonify(_json_safe({
            "suggestion_id":    result.suggestion_id,
            "session_id":       result.session_id,
            "student_id":       result.student_id,
            "session_index":    result.session_index,
            "lo_score_baseline":result.lo_score_baseline,
            "lo_score_session": result.lo_score_session,
            "lo_delta":         result.lo_delta,
            "pattern_changed":  result.pattern_changed,
            "new_pattern":      result.new_pattern,
            "engagement_score": result.engagement_score,
            "outcome_id":       result.outcome_id,
        }))

    except Exception as exc:
        logger.error("Track session error for suggestion %s: %s", suggestion_id, exc)
        return jsonify({"error": str(exc)}), 500


@app.route("/api/analytics/suggestions/pending", methods=["GET"])
def all_pending_suggestions():
    """
    Return all pending suggestions across all students.

    Query parameters
    ----------------
    urgency : str (optional) — 'Immediate' | 'Monitor' | 'Routine'
    limit   : int (default 50)
    """
    try:
        urgency = request.args.get("urgency")
        limit   = min(int(request.args.get("limit", 50)), 200)

        query  = """
            SELECT s.suggestion_id, s.student_id, sp.full_name,
                   s.pattern_name, s.confidence, s.urgency,
                   s.teacher_suggestion, s.expected_outcome, s.created_at
            FROM suggestions s
            JOIN student_profiles sp ON s.student_id = sp.student_id
            WHERE s.status = 'pending'
        """
        params = []

        if urgency:
            query  += " AND s.urgency = %s"
            params.append(urgency)

        query += """
            ORDER BY
                CASE s.urgency
                    WHEN 'Immediate' THEN 1
                    WHEN 'Monitor'   THEN 2
                    WHEN 'Routine'   THEN 3
                    ELSE 4
                END,
                s.created_at DESC
            LIMIT %s
        """
        params.append(limit)

        with get_cursor() as cur:
            cur.execute(query, params)
            rows = cur.fetchall()

        suggestions = [
            {
                "suggestion_id":      str(r[0]),
                "student_id":         r[1],
                "student_name":       r[2],
                "pattern_name":       r[3],
                "confidence":         r[4],
                "urgency":            r[5],
                "teacher_suggestion": r[6],
                "expected_outcome":   r[7],
                "created_at":         r[8].isoformat() if r[8] else None,
            }
            for r in rows
        ]

        return jsonify({"count": len(suggestions), "suggestions": suggestions})

    except Exception as exc:
        logger.error("Pending suggestions fetch error: %s", exc)
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
# Internal helpers
# ==================================================================

def _persist_suggestion(student_id: str, payload, suggestion) -> str:
    """Insert a new suggestion row and return the UUID."""
    with get_cursor() as cur:
        cur.execute(
            """
            INSERT INTO suggestions (
                student_id, pattern_name, pattern_priority,
                confidence, urgency, confidence_score,
                teacher_suggestion, student_suggestion, expected_outcome,
                evidence, state_vector, llm_model, llm_used
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s::jsonb, %s::jsonb, %s, %s
            )
            RETURNING suggestion_id
            """,
            (
                student_id,
                payload.pattern.pattern_name,
                payload.pattern.priority,
                payload.pattern.confidence_label,
                payload.pattern.urgency,
                payload.pattern.confidence_score,
                suggestion.teacher_suggestion,
                suggestion.student_suggestion,
                suggestion.expected_outcome,
                _json_mod.dumps([e.to_dict() for e in payload.evidence]),
                _json_mod.dumps(payload.state_vector.to_dict()),
                suggestion.llm_model,
                suggestion.llm_used,
            ),
        )
        row = cur.fetchone()
    return str(row[0])


# ==================================================================
# Main
# ==================================================================
if __name__ == "__main__":
    logger.info("Starting Analytics API on port %d", PORT)
    app.run(host="0.0.0.0", port=PORT, debug=True)