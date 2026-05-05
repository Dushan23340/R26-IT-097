from fastapi import APIRouter

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
