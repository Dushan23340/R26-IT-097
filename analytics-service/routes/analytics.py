from __future__ import annotations

from collections import Counter
from statistics import mean

from flask import Blueprint, jsonify

from services import fairness_service, profile_service, statistics_service

bp = Blueprint("analytics", __name__)


@bp.route("/students/<student_id>/analytics/trend", methods=["GET"])
def lo_trend(student_id: str):
    history = profile_service.get_student_lo_history(student_id)
    return jsonify(statistics_service.analyze_lo_trend(history)), 200


@bp.route("/students/<student_id>/analytics/stability", methods=["GET"])
def stability(student_id: str):
    history = profile_service.get_student_lo_history(student_id)
    return jsonify(statistics_service.compute_stability(history)), 200


@bp.route("/students/<student_id>/analytics/emotion-correlation", methods=["GET"])
def emotion_correlation(student_id: str):
    history = profile_service.get_student_lo_history(student_id)
    emotional_states = profile_service.get_student_emotional_states(student_id)
    return jsonify(statistics_service.analyze_emotion_lo_correlation(history, emotional_states)), 200


@bp.route("/students/<student_id>/analytics/engagement-performance", methods=["GET"])
def engagement_performance(student_id: str):
    history = profile_service.get_student_lo_history(student_id)
    engagement = profile_service.get_student_engagement(student_id)
    return jsonify(statistics_service.analyze_engagement_performance(history, engagement)), 200


@bp.route("/class/stability-baseline", methods=["GET"])
def class_stability_baseline():
    students = profile_service.get_all_students()
    all_history = {s["student_id"]: profile_service.get_student_lo_history(s["student_id"]) for s in students}
    return jsonify(statistics_service.compute_class_stability_baseline(all_history)), 200


@bp.route("/class/overview", methods=["GET"])
def class_overview():
    """Single aggregate endpoint for the advisor dashboard - avoids N+1
    calls from the frontend for what is fundamentally one page."""
    students = profile_service.get_all_students()
    all_history = {s["student_id"]: profile_service.get_student_lo_history(s["student_id"]) for s in students}
    baseline = statistics_service.compute_class_stability_baseline(all_history)

    student_rows = []
    all_scores = []
    lo_level_scores: dict[str, list[float]] = {}
    avg_score_by_student: dict[str, float] = {}
    group_by_student: dict[str, str] = {}
    at_risk_count = 0

    for s in students:
        student_id = s["student_id"]
        history = all_history[student_id]
        if not history:
            continue

        scores = [float(row["score"]) for row in history]
        avg_score = mean(scores)
        all_scores.extend(scores)
        avg_score_by_student[student_id] = avg_score
        if s.get("demographic_group"):
            group_by_student[student_id] = s["demographic_group"]

        for row in history:
            lo_level_scores.setdefault(row["lo_level"], []).append(float(row["score"]))

        trend = statistics_service.analyze_lo_trend(history)
        direction = trend["direction"] if trend.get("available") else "insufficient_data"

        stability = statistics_service.compute_stability(history)
        is_at_risk = stability.get("available") and statistics_service.is_at_risk_by_stability(
            stability["std_dev"], baseline
        )
        if is_at_risk:
            at_risk_count += 1

        emotional_states = profile_service.get_student_emotional_states(student_id)
        dominant_emotion = None
        if emotional_states:
            dominant_emotion = Counter(row["emotion_label"] for row in emotional_states).most_common(1)[0][0]

        risk = "high" if is_at_risk and direction == "declining" else "med" if is_at_risk or direction == "declining" else "low"

        student_rows.append({
            "student_id": student_id,
            "full_name": s.get("full_name"),
            "avg_score": round(avg_score, 1),
            "trend": direction,
            "dominant_emotion": dominant_emotion,
            "at_risk": bool(is_at_risk),
            "risk": risk,
        })

    student_rows.sort(key=lambda r: r["avg_score"], reverse=True)

    struggling_areas = sorted(
        (
            {"lo_level": level, "avg_score": round(mean(vals), 1), "count": len(vals)}
            for level, vals in lo_level_scores.items()
        ),
        key=lambda r: r["avg_score"],
    )

    disparate_impact = fairness_service.compute_disparate_impact(avg_score_by_student, group_by_student)

    return jsonify({
        "total_students": len(students),
        "avg_lo_score": round(mean(all_scores), 1) if all_scores else None,
        "at_risk_count": at_risk_count,
        "students": student_rows,
        "struggling_areas": struggling_areas,
        "fairness": disparate_impact,
    }), 200
