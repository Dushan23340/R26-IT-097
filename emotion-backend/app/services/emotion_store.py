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

    def add_event(self, event: EmotionEvent) -> None:
        """Add a new emotion event."""
        self.events.append(event)
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

        # Each student's most-recent reading within the window is their
        # "current" emotion. Counting raw events instead (as this used to)
        # double/triple-counts a single student who's polled several times
        # in the last window_seconds - e.g. EmotionDetector posts every
        # ~2.5s, so one real student alone can produce ~24 events in a 60s
        # window, showing up as "11 students Neutral, 2 students Frustrated"
        # in the UI when only 1 student was ever actually present.
        latest_by_student: Dict[str, EmotionEvent] = {}
        for event in self.events:
            existing = latest_by_student.get(event.student_id)
            if existing is None or event.timestamp > existing.timestamp:
                latest_by_student[event.student_id] = event

        emotion_counts = defaultdict(int)
        active_students = set()
        for student_id, event in latest_by_student.items():
            emotion_counts[event.emotion.value] += 1
            active_students.add(student_id)

        total = len(latest_by_student)
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
            # No real class-roster system exists to source a "total
            # students" distinct from who's actually emitting readings
            # right now - it used to be a lifetime-cumulative count of
            # every student_id ever seen since the process started (never
            # cleared), so it kept climbing and showing e.g. "1 of 5" after
            # just one real student joined. Window-scoped like
            # active_students instead, so the two numbers agree.
            "total_students": len(active_students),
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
            "total_students": 0,
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
