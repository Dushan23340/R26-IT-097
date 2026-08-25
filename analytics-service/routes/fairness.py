from __future__ import annotations

from statistics import mean

from flask import Blueprint, jsonify, request

from services import fairness_audit_service, fairness_service, profile_service

bp = Blueprint("fairness", __name__)


def _student_avg_scores_and_groups():
    students = profile_service.get_all_students()
    avg_scores: dict[str, float] = {}
    groups: dict[str, str] = {}
    for s in students:
        history = profile_service.get_student_lo_history(s["student_id"])
        if not history:
            continue
        avg_scores[s["student_id"]] = mean(float(row["score"]) for row in history)
        if s.get("demographic_group"):
            groups[s["student_id"]] = s["demographic_group"]
    return avg_scores, groups


@bp.route("/fairness/disparate-impact", methods=["GET"])
def disparate_impact():
    avg_scores, groups = _student_avg_scores_and_groups()
    result = fairness_service.compute_disparate_impact(avg_scores, groups)
    fairness_audit_service.record_disparate_impact_result(result)
    return jsonify(result), 200


@bp.route("/fairness/variance-calibration", methods=["GET"])
def variance_calibration():
    avg_scores, groups = _student_avg_scores_and_groups()
    result = fairness_service.compute_variance_calibration(avg_scores, groups)
    fairness_audit_service.record_variance_calibration_result(result)
    return jsonify(result), 200


@bp.route("/fairness/alerts", methods=["GET"])
def alerts():
    status = request.args.get("status", "open")
    return jsonify({"alerts": fairness_audit_service.list_alerts(status)}), 200


@bp.route("/fairness/alerts/<int:audit_id>/resolve", methods=["POST"])
def resolve_alert(audit_id: int):
    data = request.get_json(force=True) or {}
    reviewer = data.get("reviewer")
    if not reviewer:
        return jsonify({"error": "reviewer is required"}), 400
    try:
        updated = fairness_audit_service.resolve_alert(audit_id, reviewer)
    except LookupError as exc:
        return jsonify({"error": str(exc)}), 404
    return jsonify(updated), 200
