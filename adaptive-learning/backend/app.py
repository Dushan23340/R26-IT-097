# HOW TO RUN:
# 1. Seed the database (one time only):
#    node backend/seeds/seedAdaptiveData.js
#
# 2. Start the Node.js backend:
#    cd backend && node index.js
#
# 3. Start the Python adaptive backend:
#    cd adaptive-learning/backend
#    pip install -r requirements.txt
#    python app.py
#
# 4. Start the frontend:
#    cd frontend && npm run dev

"""
app.py — Flask API for Adaptive Learning Quiz System
Connects to MongoDB to manage quizzes, results, and recommendations.

Endpoints:
  GET  /api/quiz/units                  → List available units
  GET  /api/quiz/:unit/:quizSet         → Fetch quiz questions
  POST /api/quiz/submit                 → Submit quiz, calculate results
  POST /api/recommendations/get         → Get personalized resources
  GET  /api/quiz/attempt/:attemptId     → Retrieve saved attempt
  GET  /api/health                      → Health check
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from bson import ObjectId
import os
from dotenv import load_dotenv

# Load environment variables
# Load .env from project root (two levels up from adaptive-learning/backend/)
_root_env = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '.env')
load_dotenv(dotenv_path=_root_env)

# ───────────────────────────────────────────────
# Flask App & MongoDB Setup
# ───────────────────────────────────────────────

app = Flask(__name__)
CORS(app)

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb+srv://dasanayakadushan_db_user:Dushan23340@cluster0.1jmbism.mongodb.net/test?appName=Cluster0")
DB_NAME = os.getenv("MONGODB_DB_NAME", "test")

try:
    client = MongoClient(MONGODB_URI)
    db = client[DB_NAME]
    quizzes_collection = db["quizzes"]
    recommendations_collection = db["recommendations"]
    quizattempts_collection = db["quizattempts"]
    print(f"✅ Connected to MongoDB database: {DB_NAME}")
except Exception as e:
    print(f"❌ MongoDB connection error: {e}")
    db = None


# ───────────────────────────────────────────────
# Health Check
# ───────────────────────────────────────────────

@app.route("/api/health", methods=["GET"])
def health_check():
    """Health check endpoint."""
    try:
        if db:
            db.command("ping")
            db_status = "connected"
        else:
            db_status = "disconnected"

        return jsonify({
            "status": "healthy",
            "service": "adaptive-learning-api",
            "database": db_status,
            "version": "2.0.0"
        })
    except Exception as e:
        return jsonify({
            "status": "unhealthy",
            "error": str(e)
        }), 500


# ───────────────────────────────────────────────
# GET /api/quiz/units
# ───────────────────────────────────────────────

@app.route("/api/quiz/units", methods=["GET"])
def get_units():
    """Get list of available quiz units."""
    try:
        units = quizzes_collection.distinct("unit")
        return jsonify({
            "success": True,
            "data": sorted(units)
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# ───────────────────────────────────────────────
# GET /api/quiz/:unit/:quizSet
# ───────────────────────────────────────────────

@app.route("/api/quiz/<unit>/<quiz_set>", methods=["GET"])
def get_quiz(unit, quiz_set):
    """
    Fetch quiz questions for a unit.
    Returns questions WITHOUT correctIndex for security.
    """
    try:
        quiz = quizzes_collection.find_one({
            "unit": unit,
            "quizSet": quiz_set,
            "isActive": True
        })

        if not quiz:
            return jsonify({
                "success": False,
                "error": f"Quiz not found: {unit} {quiz_set}"
            }), 404

        # Strip correctIndex from questions
        # NEW — uses questionNumber as fallback ID when _id is absent
        questions = []
        for idx, q in enumerate(quiz.get("questions", [])):
            q_id = str(q["_id"]) if "_id" in q else f"q{q.get('questionNumber', idx + 1)}"
            question_data = {
                 "_id": q_id,
                 "questionNumber": q.get("questionNumber", idx + 1),
                 "bloomLevel": q.get("bloomLevel", ""),
                "text": q.get("text", ""),
                "options": q.get("options", []),
            }
            questions.append(question_data)

        return jsonify({
            "success": True,
            "data": {
                "unit": quiz["unit"],
                "quizSet": quiz["quizSet"],
                "questions": questions
            }
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# ───────────────────────────────────────────────
# POST /api/quiz/submit
# ───────────────────────────────────────────────

@app.route("/api/quiz/submit", methods=["POST"])
def submit_quiz():
    """
    Submit quiz answers, calculate Bloom level results, and save attempt.

    Body: {
        "unit": "Number Patterns",
        "quizSet": "Q1",
        "emotion": "Confused",
        "studentId": "507f1f77bcf86cd799439011",
        "answers": [
            {"questionId": "507f1f77bcf86cd799439012", "selectedIndex": 0},
            ...
        ]
    }
    """
    try:
        data = request.get_json()
        unit = data.get("unit")
        quiz_set = data.get("quizSet")
        emotion = data.get("emotion")
        student_id = data.get("studentId", "anonymous")
        answers = data.get("answers", [])

        if not unit or not quiz_set:
            return jsonify({
                "success": False,
                "error": "unit and quizSet are required"
            }), 400

        # Fetch the quiz from MongoDB
        quiz = quizzes_collection.find_one({
            "unit": unit,
            "quizSet": quiz_set,
            "isActive": True
        })

        if not quiz:
            return jsonify({
                "success": False,
                "error": f"Quiz not found: {unit} {quiz_set}"
            }), 404

        # Build a map of questions by ID
        # NEW — uses same fallback ID so submit can match what get_quiz returned
        question_map = {}
        for idx, q in enumerate(quiz.get("questions", [])):
            q_id = str(q["_id"]) if "_id" in q else f"q{q.get('questionNumber', idx + 1)}"
            question_map[q_id] = q

        # Calculate results
        bloom_results = {
            "Remembering": {"correct": 0, "total": 0, "passed": False},
            "Understanding": {"correct": 0, "total": 0, "passed": False},
            "Applying": {"correct": 0, "total": 0, "passed": False},
            "Analyzing": {"correct": 0, "total": 0, "passed": False},
            "Evaluating": {"correct": 0, "total": 0, "passed": False},
            "Creating": {"correct": 0, "total": 0, "passed": False},
        }

        scored_answers = []
        total_correct = 0

        for answer in answers:
            question_id = answer.get("questionId")
            selected_index = answer.get("selectedIndex")

            if question_id not in question_map:
                continue

            question = question_map[question_id]
            correct_index = question.get("correctIndex")
            bloom_level = question.get("bloomLevel")

            is_correct = selected_index == correct_index
            if is_correct:
                total_correct += 1

            # Update bloom level stats
            bloom_results[bloom_level]["total"] += 1
            if is_correct:
                bloom_results[bloom_level]["correct"] += 1

            # NEW — store as plain string
            scored_answers.append({
                "questionId": question_id,
                "selectedIndex": selected_index,
                "isCorrect": is_correct,
                "bloomLevel": bloom_level
            })

        # Determine pass/fail for each bloom level (threshold: 2/3 correct)
        for bloom_level, result in bloom_results.items():
            if result["total"] > 0:
                percentage = result["correct"] / result["total"]
                result["passed"] = percentage >= (2/3)

        total_questions = len(answers)
        percentage_score = (total_correct / total_questions * 100) if total_questions > 0 else 0

        # Get failed levels
        failed_levels = [level for level, result in bloom_results.items() if result["total"] > 0 and not result["passed"]]
        passed_levels = [level for level, result in bloom_results.items() if result["total"] > 0 and result["passed"]]

        # Save attempt to MongoDB
        # NEW — safe conversion with fallback
        try:
            student_id_stored = ObjectId(student_id) if student_id != "anonymous" else student_id
        except Exception:
            student_id_stored = student_id

        attempt = {
            "studentId": student_id_stored,
            "unit": unit,
            "quizSet": quiz_set,
            "emotion": emotion,
            "answers": scored_answers,
            "bloomResults": bloom_results,
            "totalCorrect": total_correct,
            "totalQuestions": total_questions,
            "percentageScore": percentage_score,
        }

        result = quizattempts_collection.insert_one(attempt)
        attempt_id = str(result.inserted_id)

        return jsonify({
            "success": True,
            "data": {
                "attemptId": attempt_id,
                "bloomResults": bloom_results,
                "totalCorrect": total_correct,
                "totalQuestions": total_questions,
                "percentageScore": percentage_score,
                "failedLevels": failed_levels,
                "passedLevels": passed_levels
            }
        })

    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# ───────────────────────────────────────────────
# POST /api/recommendations/get
# ───────────────────────────────────────────────

def find_recommendation(unit, bloom_level, emotion, performance_level=None):
    query = {
        "unit": unit,
        "bloomLevel": bloom_level,
        "emotion": emotion,
    }

    if performance_level:
        recommended = recommendations_collection.find_one({
            **query,
            "performanceLevel": performance_level,
            "source": "real_data",
        })
        if recommended:
            return recommended

    recommended = recommendations_collection.find_one({
        **query,
        "source": "real_data",
    })
    if recommended:
        return recommended

    return recommendations_collection.find_one(query)


@app.route("/api/recommendations/get", methods=["POST"])
def get_recommendations():
    """
    Get personalized resource recommendations based on failed bloom levels and emotion.

    Body: {
        "unit": "Number Patterns",
        "failedLevels": ["Remembering", "Understanding"],
        "emotion": "Confused"
    }
    """
    try:
        data = request.get_json()
        unit = data.get("unit")
        failed_levels = data.get("failedLevels", [])
        emotion = data.get("emotion", "Normal")
        performance_level = data.get("performanceLevel")

        if not unit:
            return jsonify({
                "success": False,
                "error": "unit is required"
            }), 400

        # Query recommendations for each failed level
        recommendations = []
        for bloom_level in failed_levels:
            rec = find_recommendation(unit, bloom_level, emotion, performance_level)
            if rec:
                recommendations.append({
                    "bloomLevel": bloom_level,
                    "emotion": emotion,
                    "resources": rec.get("resources", [])
                })

        # If no emotion-specific recommendations, fall back to "Normal"
        if not recommendations and emotion != "Normal":
            for bloom_level in failed_levels:
                rec = find_recommendation(unit, bloom_level, "Normal", performance_level)
                if rec:
                    recommendations.append({
                        "bloomLevel": bloom_level,
                        "emotion": "Normal",
                        "resources": rec.get("resources", [])
                    })

        return jsonify({
            "success": True,
            "data": {
                "recommendations": recommendations
            }
        })

    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# ───────────────────────────────────────────────
# GET /api/quiz/attempt/:attemptId
# ───────────────────────────────────────────────

@app.route("/api/quiz/attempt/<attempt_id>", methods=["GET"])
def get_attempt(attempt_id):
    """Retrieve a saved quiz attempt by ID."""
    try:
        attempt = quizattempts_collection.find_one({
            "_id": ObjectId(attempt_id)
        })

        if not attempt:
            return jsonify({
                "success": False,
                "error": "Attempt not found"
            }), 404

        # Convert ObjectId to string for JSON serialization
        attempt["_id"] = str(attempt["_id"])
        if isinstance(attempt.get("studentId"), ObjectId):
            attempt["studentId"] = str(attempt["studentId"])

        return jsonify({
            "success": True,
            "data": attempt
        })

    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# ───────────────────────────────────────────────
# Error Handlers
# ───────────────────────────────────────────────

@app.errorhandler(404)
def not_found(e):
    return jsonify({
        "success": False,
        "error": "Endpoint not found"
    }), 404


@app.errorhandler(500)
def internal_error(e):
    return jsonify({
        "success": False,
        "error": "Internal server error"
    }), 500


# ───────────────────────────────────────────────
# Run Server
# ───────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.getenv("FLASK_PORT", 5000))
    app.run(debug=True, host="0.0.0.0", port=port)
