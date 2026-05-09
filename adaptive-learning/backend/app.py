"""
app.py — Flask API for Learning Outcome Achievement & Adaptive Support
Endpoints:
  GET  /api/learning-outcomes     → List all Bloom's LOs
  POST /api/quiz/submit           → Submit quiz, get score + weak areas
  POST /api/recommendations       → Get resource recommendations
  POST /api/adaptive-path         → Generate personalized learning path
  POST /api/full-report           → Complete adaptive learning report
  POST /api/time-estimate         → Estimate mastery time
  GET  /api/health                → Health check
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import sys

# Ensure data.py and recommendation.py are importable
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from data import LEARNING_OUTCOMES, LO_DESCRIPTIONS, SAMPLE_QUIZ_RESULTS
from recommendation import (
    calculate_score,
    get_weak_LOs,
    get_strong_LOs,
    classify_support_level,
    get_recommendations,
    generate_adaptive_path,
    estimate_time_to_master,
    generate_full_report
)

# ───────────────────────────────────────────────
# Flask App Setup
# ───────────────────────────────────────────────

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend integration

# ───────────────────────────────────────────────
# Health Check
# ───────────────────────────────────────────────

@app.route("/api/health", methods=["GET"])
def health_check():
    return jsonify({
        "status": "healthy",
        "service": "adaptive-learning-api",
        "version": "1.0.0"
    })


# ───────────────────────────────────────────────
# GET Learning Outcomes
# ───────────────────────────────────────────────

@app.route("/api/learning-outcomes", methods=["GET"])
def get_learning_outcomes():
    """Return all defined learning outcomes with descriptions."""
    outcomes = [
        {
            "name": lo,
            "description": LO_DESCRIPTIONS.get(lo, ""),
            "level": idx + 1
        }
        for idx, lo in enumerate(LEARNING_OUTCOMES)
    ]
    return jsonify({
        "success": True,
        "data": outcomes
    })


# ───────────────────────────────────────────────
# POST Submit Quiz
# ───────────────────────────────────────────────

@app.route("/api/quiz/submit", methods=["POST"])
def submit_quiz():
    """
    Submit quiz results and receive:
    - Overall score
    - Weak areas
    - Strong areas
    - Support level classification
    """
    data = request.get_json() or {}
    results = data.get("results", SAMPLE_QUIZ_RESULTS)
    student_id = data.get("student_id", "anonymous")

    # Validate results
    if not isinstance(results, dict):
        return jsonify({"success": False, "error": "results must be a dict {lo: bool}"}), 400

    score = calculate_score(results)
    weak = get_weak_LOs(results)
    strong = get_strong_LOs(results)
    support = classify_support_level(score, len(weak), len(results))

    return jsonify({
        "success": True,
        "student_id": student_id,
        "data": {
            "overall_score": score,
            "total_los": len(results),
            "mastered_count": len(strong),
            "weak_count": len(weak),
            "mastered_areas": strong,
            "weak_areas": weak,
            "support_level": support["name"],
            "support_description": support["description"],
            "check_in_frequency": support["check_in_frequency"]
        }
    })


# ───────────────────────────────────────────────
# POST Get Recommendations
# ───────────────────────────────────────────────

@app.route("/api/recommendations", methods=["POST"])
def recommendations():
    """
    Get personalized resource recommendations for weak areas.
    
    Body: { "results": {lo: bool}, "student_id": "..." }
    """
    data = request.get_json() or {}
    results = data.get("results", SAMPLE_QUIZ_RESULTS)
    student_id = data.get("student_id", "anonymous")

    if not isinstance(results, dict):
        return jsonify({"success": False, "error": "results must be a dict {lo: bool}"}), 400

    score = calculate_score(results)
    weak = get_weak_LOs(results)
    support = classify_support_level(score, len(weak), len(results))
    recs = get_recommendations(weak, support)

    # Format response with LO descriptions
    formatted_recs = []
    for lo, resources in recs.items():
        formatted_recs.append({
            "learning_outcome": lo,
            "description": LO_DESCRIPTIONS.get(lo, ""),
            "resources": resources
        })

    return jsonify({
        "success": True,
        "student_id": student_id,
        "data": {
            "overall_score": score,
            "support_level": support["name"],
            "weak_areas_count": len(weak),
            "recommendations": formatted_recs
        }
    })


# ───────────────────────────────────────────────
# POST Generate Adaptive Path
# ───────────────────────────────────────────────

@app.route("/api/adaptive-path", methods=["POST"])
def adaptive_path():
    """
    Generate a step-by-step personalized learning path.
    
    Body: { "results": {lo: bool}, "student_id": "..." }
    """
    data = request.get_json() or {}
    results = data.get("results", SAMPLE_QUIZ_RESULTS)
    student_id = data.get("student_id", "anonymous")

    if not isinstance(results, dict):
        return jsonify({"success": False, "error": "results must be a dict {lo: bool}"}), 400

    path = generate_adaptive_path(results)

    return jsonify({
        "success": True,
        "student_id": student_id,
        "data": path
    })


# ───────────────────────────────────────────────
# POST Full Adaptive Report
# ───────────────────────────────────────────────

@app.route("/api/full-report", methods=["POST"])
def full_report():
    """
    Generate a complete adaptive learning report.
    
    Body: { "results": {lo: bool}, "student_id": "..." }
    """
    data = request.get_json() or {}
    results = data.get("results", SAMPLE_QUIZ_RESULTS)
    student_id = data.get("student_id", "anonymous")

    if not isinstance(results, dict):
        return jsonify({"success": False, "error": "results must be a dict {lo: bool}"}), 400

    report = generate_full_report(student_id, results)

    return jsonify({
        "success": True,
        "data": report
    })


# ───────────────────────────────────────────────
# POST Time Estimate
# ───────────────────────────────────────────────

@app.route("/api/time-estimate", methods=["POST"])
def time_estimate():
    """
    Estimate time needed to master weak areas.
    
    Body: { "results": {lo: bool}, "student_id": "..." }
    """
    data = request.get_json() or {}
    results = data.get("results", SAMPLE_QUIZ_RESULTS)
    student_id = data.get("student_id", "anonymous")

    if not isinstance(results, dict):
        return jsonify({"success": False, "error": "results must be a dict {lo: bool}"}), 400

    score = calculate_score(results)
    weak = get_weak_LOs(results)
    support = classify_support_level(score, len(weak), len(results))
    estimate = estimate_time_to_master(weak, support)

    return jsonify({
        "success": True,
        "student_id": student_id,
        "data": {
            "overall_score": score,
            "support_level": support["name"],
            "weak_areas": weak,
            "time_estimate": estimate
        }
    })


# ───────────────────────────────────────────────
# POST Simulate Quiz (for testing)
# ───────────────────────────────────────────────

@app.route("/api/quiz/simulate", methods=["POST"])
def simulate_quiz():
    """
    Simulate a quiz with random results for testing.
    
    Body: { "student_id": "..." } (optional)
    """
    import random
    data = request.get_json() or {}
    student_id = data.get("student_id", "anonymous")

    simulated = {lo: random.choice([True, False]) for lo in LEARNING_OUTCOMES}

    score = calculate_score(simulated)
    weak = get_weak_LOs(simulated)
    strong = get_strong_LOs(simulated)
    support = classify_support_level(score, len(weak), len(simulated))

    return jsonify({
        "success": True,
        "student_id": student_id,
        "simulated": True,
        "data": {
            "results": simulated,
            "overall_score": score,
            "weak_areas": weak,
            "strong_areas": strong,
            "support_level": support["name"]
        }
    })


# ───────────────────────────────────────────────
# Error Handlers
# ───────────────────────────────────────────────

@app.errorhandler(404)
def not_found(error):
    return jsonify({"success": False, "error": "Endpoint not found"}), 404

@app.errorhandler(500)
def server_error(error):
    return jsonify({"success": False, "error": "Internal server error"}), 500


# ───────────────────────────────────────────────
# Run Server
# ───────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "true").lower() == "true"

    print(f"Adaptive Learning API starting on http://127.0.0.1:{port}")
    print("Available endpoints:")
    print("  GET  /api/learning-outcomes")
    print("  POST /api/quiz/submit")
    print("  POST /api/quiz/simulate")
    print("  POST /api/recommendations")
    print("  POST /api/adaptive-path")
    print("  POST /api/full-report")
    print("  POST /api/time-estimate")
    print("  GET  /api/health")

    app.run(host="0.0.0.0", port=port, debug=debug)
