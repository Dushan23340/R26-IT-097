from fastapi import APIRouter
from typing import List, Dict

from app.models.schemas import CurrentAnalyticsResponse, EmotionTrendResponse, TrendResponse, TrendPoint
from app.services.emotion_store import emotion_store
from app.services.analytics_service import calculate_emotion_distribution, get_window_stats
from app.services.pattern_detection_service import pattern_detector

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


@router.get("/trend", response_model=EmotionTrendResponse)
async def get_emotion_trend(points: int = 12):
    """
    Get emotion trend over time for line/area charts.
    Returns time-bucketed emotion counts.
    """
    raw_trends = emotion_store.get_trend_data(points=points)

    # Group by emotion
    emotion_groups = {}
    for item in raw_trends:
        emotion = item["emotion"]
        if emotion not in emotion_groups:
            emotion_groups[emotion] = []
        emotion_groups[emotion].append(
            TrendPoint(
                timestamp=item["timestamp"],
                emotion=emotion,
                student_count=item["student_count"]
            )
        )

    trends = [
        TrendResponse(emotion=emotion, data=data)
        for emotion, data in emotion_groups.items()
    ]

    return EmotionTrendResponse(
        trends=trends,
        time_range=f"Last {emotion_store.window_seconds} seconds"
    )


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
