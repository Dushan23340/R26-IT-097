from datetime import datetime, timedelta
from typing import Dict, List
from collections import defaultdict

from app.models.schemas import EmotionEvent, EmotionType
from app.services.pattern_detection_service import pattern_detector
from app.services.dashboard_store import dashboard_store


WINDOW_SECONDS = 60


def calculate_emotion_distribution(
    events: List[EmotionEvent],
    window_seconds: int = WINDOW_SECONDS
) -> Dict[str, float]:
    """
    Calculate emotion percentage distribution over a sliding window.

    Args:
        events: List of emotion events.
        window_seconds: Sliding window size in seconds (default: 60).

    Returns:
        Dictionary mapping emotion name to percentage (0-100).
        Only emotions with count > 0 are included.
        Example: {"HAPPY": 20.0, "BORED": 30.0, "CONFUSED": 25.0}
    """
    # Step 1: Filter events within the sliding window
    cutoff = datetime.utcnow() - timedelta(seconds=window_seconds)
    recent_events = [e for e in events if e.timestamp and e.timestamp >= cutoff]

    # Step 2: Handle empty window
    if not recent_events:
        return {}

    # Step 3: Count each emotion type
    emotion_counts = defaultdict(int)
    for event in recent_events:
        emotion_counts[event.emotion.value] += 1

    # Step 4: Calculate total and percentages
    total = sum(emotion_counts.values())
    distribution = {}

    for emotion_name, count in emotion_counts.items():
        percentage = round((count / total) * 100, 1)
        distribution[emotion_name] = percentage

    # Store result for pattern detection (last 2 cycles)
    pattern_detector.store_aggregation_result(distribution)

    # Store snapshot for dashboard trend
    dominant = max(distribution, key=distribution.get) if distribution else None
    dashboard_store.add_snapshot(distribution, dominant)

    return distribution


def get_emotion_counts(
    events: List[EmotionEvent],
    window_seconds: int = WINDOW_SECONDS
) -> Dict[str, int]:
    """
    Return raw emotion counts within the sliding window.

    Returns:
        Dictionary mapping emotion name to raw count.
        Example: {"HAPPY": 4, "BORED": 6, "CONFUSED": 5}
    """
    cutoff = datetime.utcnow() - timedelta(seconds=window_seconds)
    recent_events = [e for e in events if e.timestamp and e.timestamp >= cutoff]

    emotion_counts = defaultdict(int)
    for event in recent_events:
        emotion_counts[event.emotion.value] += 1

    return dict(emotion_counts)


def get_window_stats(
    events: List[EmotionEvent],
    window_seconds: int = WINDOW_SECONDS
) -> Dict:
    """
    Get comprehensive sliding window statistics.

    Returns:
        {
            "window_seconds": 60,
            "total_events": 15,
            "active_students": 12,
            "dominant_emotion": "BORED",
            "dominant_percentage": 40.0,
            "distribution": {"HAPPY": 20.0, "BORED": 40.0, ...}
        }
    """
    cutoff = datetime.utcnow() - timedelta(seconds=window_seconds)
    recent_events = [e for e in events if e.timestamp and e.timestamp >= cutoff]

    total_events = len(recent_events)
    active_students = len({e.student_id for e in recent_events})

    distribution = calculate_emotion_distribution(events, window_seconds)

    dominant_emotion = None
    dominant_percentage = 0.0

    if distribution:
        dominant_emotion = max(distribution, key=distribution.get)
        dominant_percentage = distribution[dominant_emotion]

    return {
        "window_seconds": window_seconds,
        "total_events": total_events,
        "active_students": active_students,
        "dominant_emotion": dominant_emotion,
        "dominant_percentage": dominant_percentage,
        "distribution": distribution
    }
