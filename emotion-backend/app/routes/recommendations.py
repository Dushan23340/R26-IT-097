from fastapi import APIRouter
from typing import Dict, Optional

from app.models.schemas import RecommendationResponse
from app.services.emotion_store import emotion_store
from app.services.recommendation_engine import recommendation_engine
from app.services.intervention_tracker import intervention_tracker
from app.services.dashboard_store import dashboard_store

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
    Generate a subject-aware game recommendation with variation tracking.
    Auto-detects emotion if not provided. Records pre-intervention snapshot.

    Args:
        emotion: Dominant emotion (auto-detected if not provided)
        subject: Subject area (e.g., "Mathematics", "Science")
    """
    dominant = emotion.upper() if emotion else emotion_store.get_dominant_emotion()

    # Get current emotion distribution for pre-intervention snapshot
    pre_distribution = {
        d.emotion: d.percentage
        for d in emotion_store.get_current_distribution()["distribution"]
    }

    # Generate recommendation
    result = recommendation_engine.generate_recommendation(dominant, subject)

    # Start intervention tracking
    intervention_id = intervention_tracker.start_intervention(
        subject=subject,
        game=result["recommendation"],
        pre_distribution=pre_distribution
    )

    # Add to dashboard store
    dashboard_store.add_intervention({
        "intervention_id": intervention_id,
        "timestamp": result["timestamp"],
        "subject": subject,
        "dominant_emotion": dominant,
        "game_title": result["recommendation"].title,
        "game_type": result["recommendation"].game_type,
    })

    result["intervention_id"] = intervention_id
    return result


@router.get("/history")
async def get_recommendation_history(since_minutes: Optional[int] = None):
    """
    Get recommendation history, optionally filtered by time window.
    """
    return {
        "history": recommendation_engine.get_recommendation_history(since_minutes),
        "variation_window_minutes": recommendation_engine.variation_window_minutes,
    }


@router.post("/intervention/{intervention_id}/feedback")
async def record_intervention_feedback(intervention_id: str, body: Dict) -> Dict:
    """
    Record post-intervention emotion distribution.
    Computes negative emotion reduction percentage.

    Body: {"post_emotions": {"HAPPY": 30.0, "BORED": 10.0, ...}}
    """
    post_distribution = body.get("post_emotions", {})
    record = intervention_tracker.record_post_emotions(
        intervention_id, post_distribution
    )

    if record:
        # Update dashboard store
        dashboard_store.complete_intervention(intervention_id, record)
        return {
            "success": True,
            "intervention_id": intervention_id,
            "reduction_pct": record["negative_emotion_reduction_pct"],
            "status": "completed",
        }

    return {
        "success": False,
        "message": f"Intervention {intervention_id} not found",
    }


@router.get("/effectiveness")
async def get_effectiveness() -> Dict:
    """
    Get effectiveness metrics for game interventions.
    Returns average negative emotion reduction percentage.
    """
    return intervention_tracker.get_effectiveness_metrics()


@router.get("/variation-window")
async def get_variation_window() -> Dict:
    """
    Get current variation window config and recent recommendation history.
    """
    return recommendation_engine.get_variation_window_config()


@router.get("/pending")
async def get_pending_interventions() -> Dict:
    """
    Get all pending interventions waiting for post-emotion feedback.
    """
    return {
        "pending": intervention_tracker.get_pending_interventions(),
        "count": len(intervention_tracker.get_pending_interventions()),
    }
