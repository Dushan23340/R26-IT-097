from __future__ import annotations

from statistics import mean

from flask import Blueprint, jsonify

from services import fairness_service, profile_service

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
    return jsonify(fairness_service.compute_disparate_impact(avg_scores, groups)), 200


@bp.route("/fairness/variance-calibration", methods=["GET"])
def variance_calibration():
    avg_scores, groups = _student_avg_scores_and_groups()
    return jsonify(fairness_service.compute_variance_calibration(avg_scores, groups)), 200
