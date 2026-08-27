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
from lessons import list_lessons, get_lesson, get_quiz_for_lesson, get_lesson_difficulty
import advisor_recommendations
import lesson_progress
from mastery import score_submission, score_generated_submission
from semantic_recommender import recommend_resources
from analytics_bridge import push_quiz_result_async, get_latest_weak_los, get_live_emotion, get_class_dominant_emotion
from quiz_gen.generator import generate_quiz, strip_answers, SUPPORTED_LESSONS as QUIZ_GEN_LESSONS
from quiz_gen import store as quiz_store

# ───────────────────────────────────────────────
# Flask App Setup
# ───────────────────────────────────────────────

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend integration


def _quiz_locked_response(access: dict):
    reason = "locked_by_teacher" if access["completed"] else "not_completed"
    message = (
        "Your teacher hasn't unlocked this quiz yet."
        if reason == "locked_by_teacher"
        else "Attend the live class for this lesson before taking its quiz."
    )
    return jsonify({"success": False, "error": message, "reason": reason, "access": access}), 403

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
    emotion = data.get("emotion")

    if not isinstance(results, dict):
        return jsonify({"success": False, "error": "results must be a dict {lo: bool}"}), 400

    score = calculate_score(results)
    weak = get_weak_LOs(results)
    support = classify_support_level(score, len(weak), len(results))
    recs = get_recommendations(weak, support, emotion=emotion)

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
    emotion = data.get("emotion")

    if not isinstance(results, dict):
        return jsonify({"success": False, "error": "results must be a dict {lo: bool}"}), 400

    report = generate_full_report(student_id, results, emotion=emotion)

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
# GET Lessons (real per-lesson content, not generic Bloom categories)
# ───────────────────────────────────────────────

@app.route("/api/lessons", methods=["GET"])
def get_lessons():
    return jsonify({"success": True, "data": list_lessons()})


@app.route("/api/lessons/<lesson_id>/complete", methods=["POST"])
def complete_lesson(lesson_id):
    """Internal ingestion point for emotion-backend's
    adaptive_learning_bridge.py: called when a teacher ends a live class
    that was started for this lesson_id. Body:
    { "completions": [{"student_id": "...", "dominant_emotion": "bored" | null}, ...] }
    Marks each student as having completed this lesson with their real,
    session-long dominant emotion - independent of the teacher's separate
    lock/unlock decision (see /lock below)."""
    if not get_lesson(lesson_id):
        return jsonify({"success": False, "error": f"Unknown lesson: {lesson_id}"}), 404

    data = request.get_json(force=True) or {}
    completions = data.get("completions", [])
    if not isinstance(completions, list):
        return jsonify({"success": False, "error": "completions must be a list"}), 400

    count = 0
    for entry in completions:
        student_id = entry.get("student_id")
        if not student_id:
            continue
        lesson_progress.mark_completed(student_id, lesson_id, entry.get("dominant_emotion"))
        count += 1

    return jsonify({"success": True, "marked_completed": count}), 201


@app.route("/api/lessons/<lesson_id>/access", methods=["GET"])
def get_lesson_access(lesson_id):
    """Whether this student can currently take this lesson's quiz - used by
    the frontend to show the quiz card visibly but disabled with a real
    reason, rather than only enforcing this at submit time."""
    student_id = request.args.get("student_id")
    if not student_id:
        return jsonify({"success": False, "error": "student_id query param is required"}), 400
    if not get_lesson(lesson_id):
        return jsonify({"success": False, "error": f"Unknown lesson: {lesson_id}"}), 404

    return jsonify({"success": True, "data": lesson_progress.get_access(student_id, lesson_id)})


@app.route("/api/lessons/locks", methods=["GET"])
def get_lesson_locks():
    """Teacher-facing: current lock state for every lesson the teacher has
    ever explicitly touched. A lesson_id absent here is still locked (the
    default) - the frontend should treat any of the 6 real lesson_ids not
    in this dict as locked."""
    return jsonify({"success": True, "data": lesson_progress.get_all_locks()})


@app.route("/api/lessons/<lesson_id>/lock", methods=["POST"])
def set_lesson_lock(lesson_id):
    """Teacher-facing: publish (unlock) or withdraw (lock) this lesson's
    quiz. Body: { "locked": true | false }. Same trust level as every
    other route in this platform - no auth exists anywhere in this
    service, so this is real, backend-enforced state, but not
    cryptographically verified as coming from an actual teacher."""
    if not get_lesson(lesson_id):
        return jsonify({"success": False, "error": f"Unknown lesson: {lesson_id}"}), 404

    data = request.get_json(force=True) or {}
    if "locked" not in data:
        return jsonify({"success": False, "error": "locked (bool) is required"}), 400

    lesson_progress.set_lock(lesson_id, bool(data["locked"]))
    return jsonify({"success": True, "lesson_id": lesson_id, "locked": bool(data["locked"])})


@app.route("/api/lessons/<lesson_id>/quiz", methods=["GET"])
def get_lesson_quiz(lesson_id):
    student_id = request.args.get("student_id")
    if not student_id:
        return jsonify({"success": False, "error": "student_id query param is required"}), 400

    access = lesson_progress.get_access(student_id, lesson_id)
    if not access["can_take_quiz"]:
        return _quiz_locked_response(access)

    # Pilot lessons: every request (first attempt AND every retake) gets a
    # freshly generated 18-question instance instead of picking between 2
    # static sets - the `set` query param is ignored for these, since
    # "always different" supersedes "1 of 2 fixed variants". Falls back to
    # the static PDF content (set 1) if generation raises for any reason,
    # so a bug in quiz_gen never takes the lesson offline.
    if lesson_id in QUIZ_GEN_LESSONS:
        lesson = get_lesson(lesson_id)
        if lesson:
            try:
                quiz = generate_quiz(lesson_id, lesson["title"], lesson["subject"])
                instance_id = quiz_store.save(quiz)
                response = strip_answers(quiz)
                response["quiz_set"] = instance_id
                return jsonify({"success": True, "data": response})
            except Exception:
                app.logger.exception(f"quiz_gen failed for {lesson_id}, falling back to static set 1")

    quiz_set = request.args.get("set", default=1, type=int)
    quiz = get_quiz_for_lesson(lesson_id, quiz_set=quiz_set)
    if not quiz:
        return jsonify({"success": False, "error": f"Unknown lesson: {lesson_id}"}), 404
    return jsonify({"success": True, "data": quiz})


@app.route("/api/lessons/<lesson_id>/quiz/submit", methods=["POST"])
def submit_lesson_quiz(lesson_id):
    """
    Score a real quiz submission with the good/average/weak mastery-tier
    model (mastery.py), generate emotion+mastery-aware Sentence-BERT
    recommendations for average/weak LOs, and push the result to
    analytics-service (best-effort).

    Body: { "student_id": "...", "student_name": "...", "student_email": "...",
            "answers": {question_id: free-text answer}, "quiz_set": 1 (optional),
            "emotion": "confused" (optional) }
    """
    if not get_lesson(lesson_id):
        return jsonify({"success": False, "error": f"Unknown lesson: {lesson_id}"}), 404

    data = request.get_json() or {}
    student_id = data.get("student_id", "anonymous")
    student_name = data.get("student_name", "")
    student_email = data.get("student_email", "")
    answers = data.get("answers", {})
    emotion = data.get("emotion")
    quiz_set = data.get("quiz_set", 1)
    duration_seconds = data.get("duration_seconds")

    if not isinstance(answers, dict):
        return jsonify({"success": False, "error": "answers must be a dict {question_id: free-text answer}"}), 400

    access = lesson_progress.get_access(student_id, lesson_id)
    if not access["can_take_quiz"]:
        return _quiz_locked_response(access)

    # No frontend page sends "emotion" explicitly. Prefer the real
    # dominant_emotion recorded from the live class this student actually
    # completed for this lesson (lesson_progress, pushed by emotion-
    # backend's class_session.py at class-end) - a genuine session-long
    # signal, not an instantaneous or decoupled guess. Fall back to the
    # older best-effort inference chain only for the edge case where a
    # teacher manually unlocked a lesson without a completed live-class
    # record (get_access still allowed it through, just with no emotion).
    if not emotion and student_id != "anonymous":
        emotion = access["dominant_emotion"] or get_class_dominant_emotion(student_id) or get_live_emotion(student_id)

    # If quiz_set is a quiz_gen instance_id (a string handed out by the GET
    # route above, not the legacy int 1/2), score against that generated
    # instance's real answer key instead of the static LESSONS content.
    generated_instance = quiz_store.get(quiz_set) if isinstance(quiz_set, str) else None
    if generated_instance:
        result = score_generated_submission(lesson_id, generated_instance["questions"], answers, quiz_set)
    else:
        result = score_submission(lesson_id, answers, quiz_set=quiz_set)

    recommendations = {
        lo: recommend_resources(lesson_id, lo, emotion=emotion, mastery_tier=result["lo_scores"][lo]["mastery_tier"], top_k=3)
        for lo in result["weak_los"]
    }

    if student_id != "anonymous":
        lesson = get_lesson(lesson_id)
        push_quiz_result_async(
            student_id, lesson_id, lesson["title"], result, student_name, student_email,
            answered_count=len(answers), total_questions=sum(len(v["items"]) for v in result["lo_scores"].values()),
            duration_seconds=duration_seconds,
            difficulty=get_lesson_difficulty(lesson_id),
        )

    return jsonify({
        "success": True,
        "student_id": student_id,
        "data": {**result, "recommendations": recommendations},
    })


# ───────────────────────────────────────────────
# GET Student Dashboard Recommendations (real, derived from the student's
# most recent quiz performance via analytics-service - not static/fake)
# ───────────────────────────────────────────────

@app.route("/api/students/<student_id>/recommendations", methods=["GET"])
def student_dashboard_recommendations(student_id):
    """Resource recommendations for the student dashboard's "Recommended
    for You" panel, based on whichever LOs were still weak in this
    student's most recent lesson attempt (via analytics-service) - the
    same semantic_recommender used right after a quiz submission, just
    retrievable without requiring a fresh submission first.

    Also merges in any advisor_recommendations forwarded from
    IT22197146's analytics-service when a teacher approved/modified a
    statistically-grounded suggestion for this student - a distinct signal
    from the weak-LO resource links above, so kept in its own field rather
    than mixed into `recommendations`."""
    latest = get_latest_weak_los(student_id)
    lesson_id = latest["lesson_id"] if latest else None
    resources = []
    if latest:
        lesson = get_lesson(latest["lesson_id"])
        emotion = None
        if student_id != "anonymous":
            emotion = get_class_dominant_emotion(student_id) or get_live_emotion(student_id)
        for lo in latest["weak_los"]:
            for res in recommend_resources(latest["lesson_id"], lo, emotion=emotion, top_k=2):
                resources.append({**res, "lo_level": lo, "lesson_title": lesson["title"] if lesson else latest["lesson_id"]})

    return jsonify({
        "success": True,
        "data": {
            "lesson_id": lesson_id,
            "recommendations": resources,
            "advisor_recommendations": advisor_recommendations.get_for_student(student_id),
        },
    })


@app.route("/api/students/<student_id>/advisor-recommendations", methods=["POST"])
def receive_advisor_recommendation(student_id):
    """Ingestion point for IT22197146's analytics-service: called when a
    teacher/advisor approves or modifies a statistically-grounded
    recommendation, so it reaches the student the same way weak-LO
    resource recommendations already do."""
    data = request.get_json(force=True) or {}
    lesson_id = data.get("lesson_id")
    text = data.get("text")
    if not lesson_id or not text:
        return jsonify({"error": "lesson_id and text are required"}), 400

    rec_id = advisor_recommendations.add(
        student_id,
        lesson_id,
        text,
        data.get("insight_type", "advisor"),
        data.get("source", "analytics-service"),
    )
    return jsonify({"success": True, "id": rec_id}), 201


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
    # 5000 is unusable as a default on macOS - AirPlay Receiver (ControlCenter)
    # binds it by default, so this must not silently fall back to 5000.
    port = int(os.environ.get("PORT", 5005))
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
    print("  GET  /api/lessons/<id>/access")
    print("  GET  /api/lessons/locks")
    print("  POST /api/lessons/<id>/lock")
    print("  POST /api/lessons/<id>/complete")

    app.run(host="0.0.0.0", port=port, debug=debug)
