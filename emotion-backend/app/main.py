import asyncio
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.routes import analytics, recommendations, emotions, class_session, quiz_broadcast, message_broadcast, class_ws
from app.services.analytics_service import aggregate_and_store


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Background aggregation tick: re-computes the class emotion
    distribution every AGGREGATION_INTERVAL_SECONDS so the pattern
    detector's "sustained for N minutes" streak advances on its own, even
    when nothing is hitting /analytics/*. Without this the pattern streak
    only moved when a client happened to call /analytics/distribution."""

    async def _tick():
        while True:
            try:
                aggregate_and_store()
            except Exception as exc:  # never let the loop die
                print(f"[aggregation-tick] error: {exc}")
            await asyncio.sleep(settings.AGGREGATION_INTERVAL_SECONDS)

    task = asyncio.create_task(_tick())
    try:
        yield
    finally:
        task.cancel()


app = FastAPI(
    title=settings.APP_NAME,
    description="AI-Powered Adaptive Learning Platform - Emotion Processing & Game Recommendation API",
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

# CORS configuration for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration = round((time.time() - start) * 1000, 2)
    print(f"[{request.method}] {request.url.path} - {response.status_code} ({duration}ms)")
    return response

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"success": False, "message": "Internal server error", "detail": str(exc) if settings.DEBUG else None}
    )

# Include routers
app.include_router(emotions.router)
app.include_router(emotions.event_router)
app.include_router(analytics.router)
app.include_router(recommendations.router)
app.include_router(class_session.router)
app.include_router(quiz_broadcast.router)
app.include_router(message_broadcast.router)
app.include_router(class_ws.router)


@app.get("/")
async def root():
    return {
        "message": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "health": "/health",
        "endpoints": {
            "ingest_emotion": {"method": "POST", "path": "/emotions"},
            "ingest_emotion_event": {"method": "POST", "path": "/emotion-event"},
            "analytics_current": {"method": "GET", "path": "/analytics/current"},
            "analytics_trend": {"method": "GET", "path": "/analytics/trend?n=10"},
            "analytics_distribution": {"method": "GET", "path": "/analytics/distribution"},
            "analytics_window_stats": {"method": "GET", "path": "/analytics/window-stats"},
            "analytics_pattern": {"method": "GET", "path": "/analytics/pattern"},
            "recommendation_latest": {"method": "GET", "path": "/recommendation/latest"},
            "recommendation_generate": {"method": "GET", "path": "/recommendation/generate?emotion=BORED&subject=Math"},
            "recommendation_active_get": {"method": "GET", "path": "/recommendation/active"},
            "recommendation_active_set": {"method": "POST", "path": "/recommendation/active", "body": {"game_key": "pirate"}},
            "recommendation_active_end": {"method": "POST", "path": "/recommendation/active/end"},
            "recommendation_active_join": {"method": "POST", "path": "/recommendation/active/join", "body": {"student_id": "s1", "session_id": "abc123"}},
            "recommendation_active_finish": {"method": "POST", "path": "/recommendation/active/finish", "body": {"student_id": "s1", "session_id": "abc123", "outcome": "win", "score": 75}},
            "recommendation_active_stats": {"method": "GET", "path": "/recommendation/active/stats"},
            "recommendation_history": {"method": "GET", "path": "/recommendation/history"},
            "recommendation_effectiveness": {"method": "GET", "path": "/recommendation/effectiveness"},
            "recommendation_variation_window": {"method": "GET", "path": "/recommendation/variation-window"},
            "recommendation_pending": {"method": "GET", "path": "/recommendation/pending"},
            "recommendation_feedback": {"method": "POST", "path": "/recommendation/intervention/{id}/feedback"},
            "class_session_state": {"method": "GET", "path": "/class-session/state"},
            "class_session_start": {"method": "POST", "path": "/class-session/start", "body": {"subject": "Mathematics", "started_by": "Dr. Sarah Johnson"}},
            "class_session_end": {"method": "POST", "path": "/class-session/end"},
            "class_session_join": {"method": "POST", "path": "/class-session/join", "body": {"student_id": "s1", "session_id": "abc123", "student_name": "Jane Doe"}},
            "class_session_students": {"method": "GET", "path": "/class-session/students"},
            "quiz_broadcast_state": {"method": "GET", "path": "/quiz-broadcast/state"},
            "quiz_broadcast_start": {"method": "POST", "path": "/quiz-broadcast/start", "body": {"lesson_id": "photosynthesis", "lesson_title": "Photosynthesis", "started_by": "Dr. Sarah Johnson"}},
            "quiz_broadcast_end": {"method": "POST", "path": "/quiz-broadcast/end"},
            "message_broadcast_state": {"method": "GET", "path": "/message-broadcast/state"},
            "message_broadcast_send": {"method": "POST", "path": "/message-broadcast/send", "body": {"message": "Great work today!", "sent_by": "Dr. Sarah Johnson"}},
            "message_broadcast_clear": {"method": "POST", "path": "/message-broadcast/clear"}
        }
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "emotion-analytics", "version": settings.APP_VERSION}
