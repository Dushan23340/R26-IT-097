from __future__ import annotations

from flask import Blueprint, jsonify, request

from services import profile_service, statistics_service, validation_service

bp = Blueprint("validation", __name__)


@bp.route("/students/<student_id>/analyze", methods=["POST"])
def analyze_student(student_id: str):
    """Runs the statistics engine for one student and queues a
    recommendation for each significant/meaningful finding."""
    students = profile_service.get_all_students()
    all_history = {s["student_id"]: profile_service.get_student_lo_history(s["student_id"]) for s in students}
    baseline = statistics_service.compute_class_stability_baseline(all_history)

    created_ids = validation_service.analyze_student_and_queue_recommendations(student_id, baseline)
    return jsonify({"created_recommendation_ids": created_ids, "count": len(created_ids)}), 201


@bp.route("/recommendations/pending", methods=["GET"])
def pending_recommendations():
    return jsonify({"recommendations": validation_service.list_pending_recommendations()}), 200


@bp.route("/recommendations/approved", methods=["GET"])
def approved_recommendations():
    student_id = request.args.get("student_id")
    return jsonify({"recommendations": validation_service.list_approved_recommendations(student_id)}), 200


@bp.route("/recommendations/<int:recommendation_id>/review", methods=["POST"])
def review_recommendation(recommendation_id: int):
    data = request.get_json(force=True) or {}
    action = data.get("action")
    reviewer = data.get("reviewer")
    if not action or not reviewer:
        return jsonify({"error": "action and reviewer are required"}), 400

    try:
        updated = validation_service.review_recommendation(
            recommendation_id,
            action=action,
            reviewer=reviewer,
            modified_text=data.get("modified_text"),
            rejection_rationale=data.get("rejection_rationale"),
        )
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except LookupError as exc:
        return jsonify({"error": str(exc)}), 404

    return jsonify(updated), 200
