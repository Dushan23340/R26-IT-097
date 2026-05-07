import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.routes import analytics, recommendations, emotions

app = FastAPI(
    title=settings.APP_NAME,
    description="AI-Powered Adaptive Learning Platform - Emotion Processing & Game Recommendation API",
    version=settings.APP_VERSION
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


@app.get("/")
async def root():
    return {
        "message": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "health": "/health",
        "endpoints": {
            "ingest_emotion": {"method": "POST", "path": "/emotions"},
            "analytics_current": {"method": "GET", "path": "/analytics/current"},
            "analytics_trend": {"method": "GET", "path": "/analytics/trend"},
            "recommendation_latest": {"method": "GET", "path": "/recommendation/latest"}
        }
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "emotion-analytics", "version": settings.APP_VERSION}
