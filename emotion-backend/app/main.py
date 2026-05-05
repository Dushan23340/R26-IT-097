from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import analytics, recommendations

app = FastAPI(
    title="Emotion Analytics Backend",
    description="AI-Powered Adaptive Learning Platform - Emotion Processing & Game Recommendation API",
    version="1.0.0"
)

# CORS configuration for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8080",
        "http://localhost:8081",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(analytics.router)
app.include_router(recommendations.router)


@app.get("/")
async def root():
    return {
        "message": "Emotion Analytics Backend",
        "docs": "/docs",
        "endpoints": {
            "analytics_current": "/analytics/current",
            "analytics_trend": "/analytics/trend",
            "recommendation_latest": "/recommendation/latest"
        }
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "emotion-analytics"}
