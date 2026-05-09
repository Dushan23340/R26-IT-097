from fastapi import APIRouter
from typing import Dict, Optional

from app.models.schemas import RecommendationResponse
from app.services.emotion_store import emotion_store
from app.services.recommendation_engine import recommendation_engine

router = APIRouter(prefix="/recommendation", tags=["recommendations"])


@router.get("/latest", response_model=RecommendationResponse)
async def get_latest_recommendation():
    """
    Get the latest game recommendation based on current dominant emotion.
    Returns primary recommendation + 2 alternatives.
    """
    dominant_emotion = emotion_store.get_dominant_emotion()
    return recommendation_engine.get_recommendation(dominant_emotion)


@router.get("/generate")
async def generate_recommendation(
    emotion: Optional[str] = None,
    subject: str = "General"
) -> Dict:
    """
    Generate a game recommendation with subject context.
    Avoids repeating the last 3 recommendations.

    Args:
        emotion: Dominant emotion (auto-detected if not provided)
        subject: Subject area (e.g., "Mathematics", "Science")
    """
    dominant = emotion.upper() if emotion else emotion_store.get_dominant_emotion()
    return recommendation_engine.generate_recommendation(dominant, subject)


@router.get("/history")
async def get_recommendation_history():
    """
    Get the last 3 game recommendations (for deduplication tracking).
    """
    return {
        "history": recommendation_engine.get_recommendation_history(),
        "max_history": recommendation_engine.max_history,
    }
