"""
app.py — Flask API for Student Profile Management & Advanced Statistical
Progress Analytics (IT22197146).

Endpoints:
  POST /students                                    -> upsert a student profile
  GET  /students                                     -> list all profiles
  GET  /students/<id>/history                        -> full LO/emotion/engagement history
  POST /sessions                                     -> start a learning session
  POST /lo-scores                                     -> record a learning-outcome score
  POST /emotional-states                              -> record an emotion observation
  POST /engagement-metrics                            -> record session engagement
  GET  /students/<id>/analytics/trend                 -> LO trend regression
  GET  /students/<id>/analytics/stability              -> score variance/std-dev
  GET  /students/<id>/analytics/emotion-correlation    -> Pearson's r per emotion
  GET  /students/<id>/analytics/engagement-performance -> Mann-Whitney U
  GET  /class/stability-baseline                       -> class-wide at-risk threshold
  POST /students/<id>/analyze                          -> run stats + queue recommendations
  GET  /recommendations/pending                        -> expert review queue
  GET  /recommendations/approved                       -> approved recommendations
  POST /recommendations/<id>/review                    -> approve/modify/reject
  GET  /fairness/disparate-impact                      -> 80%-rule audit
  GET  /fairness/variance-calibration                  -> Levene's test audit
  GET  /health
"""

from __future__ import annotations

import os

from dotenv import load_dotenv
from flask import Flask, jsonify
from flask_cors import CORS

load_dotenv()

from routes import analytics, fairness, profiles, validation  # noqa: E402

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

app.register_blueprint(profiles.bp)
app.register_blueprint(analytics.bp)
app.register_blueprint(validation.bp)
app.register_blueprint(fairness.bp)


@app.route("/")
def root():
    return jsonify({
        "service": "Student Profile Management & Advanced Statistical Progress Analytics",
        "component": "IT22197146",
        "health": "/health",
    })


@app.route("/health")
def health():
    from config.database import test_connection
    db_ok = test_connection()
    return jsonify({
        "status": "healthy" if db_ok else "degraded",
        "service": "analytics-service",
        "database_connected": db_ok,
    }), 200 if db_ok else 503


if __name__ == "__main__":
    port = int(os.environ.get("ANALYTICS_SERVICE_PORT", 5010))
    debug = os.environ.get("ANALYTICS_SERVICE_DEBUG", "true").lower() == "true"
    print(f"Analytics service starting on http://127.0.0.1:{port}")
    app.run(host="0.0.0.0", port=port, debug=debug)
