from fastapi import APIRouter
from typing import List, Dict

from app.models.schemas import CurrentAnalyticsResponse, EmotionTrendResponse, TrendResponse, TrendPoint
from app.services.emotion_store import emotion_store
from app.services.analytics_service import calculate_emotion_distribution, get_window_stats
from app.services.pattern_detection_service import pattern_detector
from app.services.dashboard_store import dashboard_store

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/current", response_model=CurrentAnalyticsResponse)
async def get_current_analytics():
    """
    Get current emotion percentage distribution for the class.
    Uses a sliding window of the last 60 seconds.
    Returns data suitable for pie/bar charts.
    """
    data = emotion_store.get_current_distribution()

    return CurrentAnalyticsResponse(
        timestamp=data["timestamp"],
        total_students=data["total_students"],
        active_students=data["active_students"],
        window_seconds=data["window_seconds"],
        distribution=data["distribution"],
        dominant_emotion=data["dominant_emotion"],
        dominant_percentage=data["dominant_percentage"],
        class_engagement_score=data["class_engagement_score"]
    )


@router.get("/trend")
async def get_emotion_trend(n: int = 10):
    """
    Get the last N stored aggregation results for trend charts.
    Returns clean JSON: [{timestamp, distribution, dominant_emotion}, ...]
    """
    snapshots = dashboard_store.get_last_n(n)
    return {
        "count": len(snapshots),
        "time_range": f"Last {len(snapshots)} snapshots",
        "snapshots": snapshots
    }


@router.get("/distribution")
async def get_distribution() -> Dict[str, float]:
    """
    Get clean emotion percentage distribution.
    Returns only emotions with count > 0.
    Example: {"HAPPY": 20.0, "BORED": 30.0, "CONFUSED": 25.0}
    """
    return calculate_emotion_distribution(emotion_store.events)


@router.get("/window-stats")
async def get_window_statistics() -> Dict:
    """
    Get full sliding window statistics including distribution,
    dominant emotion, and active student count.
    """
    return get_window_stats(emotion_store.events)


@router.get("/pattern")
async def get_detected_pattern():
    """
    Detect dominant emotional pattern that persists for 2 consecutive cycles.
    Returns detected emotion or null.
    """
    return pattern_detector.get_pattern_status()
