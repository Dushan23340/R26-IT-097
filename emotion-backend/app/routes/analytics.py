from fastapi import APIRouter
from typing import List

from app.models.schemas import CurrentAnalyticsResponse, EmotionTrendResponse, TrendResponse, TrendPoint
from app.services.emotion_store import emotion_store

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
