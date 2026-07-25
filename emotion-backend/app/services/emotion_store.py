from datetime import datetime, timedelta
from typing import List, Dict, Optional
from collections import defaultdict

from app.models.schemas import EmotionEvent, EmotionType, EmotionDistribution


class EmotionStore:
    """
    In-memory emotion storage with sliding window support.
    Stores emotion events and provides aggregated analytics.
    """

    def __init__(self, window_seconds: int = 60):
        self.events: List[EmotionEvent] = []
        self.window_seconds = window_seconds
        self._known_students: set = set()

    def add_event(self, event: EmotionEvent) -> None:
        """Add a new emotion event."""
        self.events.append(event)
        self._known_students.add(event.student_id)
        self._cleanup_old_events()

    def _cleanup_old_events(self) -> None:
        """Remove events outside the sliding window."""
        cutoff = datetime.utcnow() - timedelta(seconds=self.window_seconds)
        self.events = [e for e in self.events if e.timestamp >= cutoff]

    def get_current_distribution(self) -> Dict:
        """
        Get emotion distribution for the current sliding window.
        Returns percentages and counts for chart visualization.
        """
        self._cleanup_old_events()

        if not self.events:
            return self._empty_distribution()

        # Count emotions in window
        emotion_counts = defaultdict(int)
        active_students = set()
        for event in self.events:
            emotion_counts[event.emotion.value] += 1
            active_students.add(event.student_id)

        total = sum(emotion_counts.values())
        all_emotions = [e.value for e in EmotionType]

        distribution = []
        for emotion in all_emotions:
            count = emotion_counts.get(emotion, 0)
            percentage = round((count / total) * 100, 1) if total > 0 else 0.0
            distribution.append(EmotionDistribution(
                emotion=emotion,
                percentage=percentage,
                count=count
            ))

        # Sort by percentage descending
        distribution.sort(key=lambda x: x.percentage, reverse=True)

        dominant = distribution[0]

        # Calculate engagement score (HAPPY + NORMAL = engaged)
        engaged_count = emotion_counts.get("HAPPY", 0) + emotion_counts.get("NORMAL", 0)
        engagement_score = round((engaged_count / total) * 100, 1) if total > 0 else 0.0

        return {
            "timestamp": datetime.utcnow(),
            "total_students": len(self._known_students),
            "active_students": len(active_students),
            "window_seconds": self.window_seconds,
            "distribution": distribution,
            "dominant_emotion": dominant.emotion,
            "dominant_percentage": dominant.percentage,
            "class_engagement_score": engagement_score
        }

    def _empty_distribution(self) -> Dict:
        """Return empty distribution structure."""
        return {
            "timestamp": datetime.utcnow(),
            "total_students": len(self._known_students),
            "active_students": 0,
            "window_seconds": self.window_seconds,
            "distribution": [
                EmotionDistribution(emotion=e.value, percentage=0.0, count=0)
                for e in EmotionType
            ],
            "dominant_emotion": "UNKNOWN",
            "dominant_percentage": 0.0,
            "class_engagement_score": 0.0
        }

    def get_trend_data(self, points: int = 12) -> List[Dict]:
        """
        Get emotion trend data over time for chart visualization.
        Returns time-bucketed counts for each emotion.
        """
        now = datetime.utcnow()
        bucket_size = self.window_seconds // points
        if bucket_size < 1:
            bucket_size = 5

        trends = []
        all_emotions = [e.value for e in EmotionType]

        for i in range(points):
            end_time = now - timedelta(seconds=i * bucket_size)
            start_time = end_time - timedelta(seconds=bucket_size)

            bucket_events = [
                e for e in self.events
                if start_time <= e.timestamp < end_time
            ]

            emotion_counts = defaultdict(int)
            for event in bucket_events:
                emotion_counts[event.emotion.value] += 1

            for emotion in all_emotions:
                trends.append({
                    "timestamp": end_time,
                    "emotion": emotion,
                    "student_count": emotion_counts.get(emotion, 0)
                })

        return list(reversed(trends))

    def get_dominant_emotion(self) -> str:
        """Get the current dominant emotion."""
        result = self.get_current_distribution()
        return result["dominant_emotion"]


# Global store instance
emotion_store = EmotionStore(window_seconds=60)
