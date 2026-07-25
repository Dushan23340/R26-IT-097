from __future__ import annotations

from datetime import datetime

from flask import Blueprint, jsonify, request

from services import profile_service

bp = Blueprint("profiles", __name__)


@bp.route("/students", methods=["POST"])
def upsert_student():
    data = request.get_json(force=True) or {}
    required = ["student_id", "full_name", "email", "enrollment_date", "grade_level"]
    missing = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({"error": f"missing fields: {missing}"}), 400

    profile_service.upsert_student(
        student_id=data["student_id"],
        full_name=data["full_name"],
        email=data["email"],
        enrollment_date=data["enrollment_date"],
        grade_level=data["grade_level"],
        demographic_group=data.get("demographic_group"),
    )
    return jsonify({"success": True}), 201


@bp.route("/students", methods=["GET"])
def list_students():
    return jsonify({"students": profile_service.get_all_students()}), 200


@bp.route("/students/<student_id>/history", methods=["GET"])
def student_history(student_id: str):
    return jsonify({
        "student_id": student_id,
        "lo_history": profile_service.get_student_lo_history(student_id),
        "emotional_states": profile_service.get_student_emotional_states(student_id),
        "engagement": profile_service.get_student_engagement(student_id),
    }), 200


@bp.route("/sessions", methods=["POST"])
def create_session():
    data = request.get_json(force=True) or {}
    required = ["student_id", "lesson_id", "lesson_title", "start_time"]
    missing = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({"error": f"missing fields: {missing}"}), 400

    start_time = datetime.fromisoformat(data["start_time"])
    end_time = datetime.fromisoformat(data["end_time"]) if data.get("end_time") else None

    session_id = profile_service.create_session(
        student_id=data["student_id"],
        lesson_id=data["lesson_id"],
        lesson_title=data["lesson_title"],
        start_time=start_time,
        end_time=end_time,
        difficulty=data.get("difficulty"),
    )
    return jsonify({"session_id": session_id}), 201


@bp.route("/lo-scores", methods=["POST"])
def record_lo_score():
    data = request.get_json(force=True) or {}
    required = ["session_id", "student_id", "lo_level", "score"]
    missing = [f for f in required if data.get(f) is None]
    if missing:
        return jsonify({"error": f"missing fields: {missing}"}), 400

    profile_service.record_lo_score(
        session_id=data["session_id"],
        student_id=data["student_id"],
        lo_level=data["lo_level"],
        score=float(data["score"]),
        max_score=float(data.get("max_score", 100.0)),
    )
    return jsonify({"success": True}), 201


@bp.route("/emotional-states", methods=["POST"])
def record_emotional_state():
    """Ingestion point for real-time emotion data from IT22140784's
    emotion-service (per the proposal's Figure 4 input source)."""
    data = request.get_json(force=True) or {}
    required = ["session_id", "student_id", "emotion_label"]
    missing = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({"error": f"missing fields: {missing}"}), 400

    timestamp = datetime.fromisoformat(data["timestamp"]) if data.get("timestamp") else None

    profile_service.record_emotional_state(
        session_id=data["session_id"],
        student_id=data["student_id"],
        emotion_label=data["emotion_label"],
        confidence=float(data.get("confidence", 1.0)),
        timestamp=timestamp,
    )
    return jsonify({"success": True}), 201


@bp.route("/engagement-metrics", methods=["POST"])
def record_engagement_metrics():
    data = request.get_json(force=True) or {}
    required = ["session_id", "student_id", "engagement_score", "time_on_task_seconds", "interaction_count"]
    missing = [f for f in required if data.get(f) is None]
    if missing:
        return jsonify({"error": f"missing fields: {missing}"}), 400

    profile_service.record_engagement_metrics(
        session_id=data["session_id"],
        student_id=data["student_id"],
        engagement_score=float(data["engagement_score"]),
        time_on_task_seconds=int(data["time_on_task_seconds"]),
        interaction_count=int(data["interaction_count"]),
        quiz_attempts=int(data.get("quiz_attempts", 0)),
    )
    return jsonify({"success": True}), 201
