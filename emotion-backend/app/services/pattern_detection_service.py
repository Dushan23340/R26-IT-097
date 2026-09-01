from datetime import datetime
from typing import Dict, Optional, List

from app.config import settings


# Threshold rules for pattern detection - a negative emotion must exceed
# its percentage of the class...
PATTERN_THRESHOLDS = {
    "BORED": 30.0,
    "CONFUSED": 25.0,
    "FRUSTRATED": 20.0,
}

# ...AND stay above it, unbroken, for this long before it counts as a
# real pattern the teacher should act on (config-driven: 10 min by
# default, lower it for a demo). A single over-threshold aggregation, or
# a threshold that keeps flickering on and off, never fires.
SUSTAINED_SECONDS = settings.PATTERN_SUSTAINED_SECONDS

# Most-severe-first, used to pick one emotion when several have each been
# sustained past the bar at the same time.
_PRIORITY = ["FRUSTRATED", "CONFUSED", "BORED"]


class PatternDetector:
    """
    Detects a dominant negative emotional pattern that has persisted above
    its threshold for a sustained period (SUSTAINED_SECONDS), rather than
    just across two back-to-back aggregation cycles.
    """

    def __init__(self):
        # emotion -> datetime the current unbroken over-threshold run began
        # (None = not currently over threshold).
        self.streak_start: Dict[str, Optional[datetime]] = {e: None for e in PATTERN_THRESHOLDS}
        # Rolling log of recent aggregation snapshots, for the /analytics/
        # pattern response's "history" field (visibility only).
        self.aggregation_history: List[Dict] = []
        self.max_history = 20

    def store_aggregation_result(self, distribution: Dict[str, float]) -> None:
        """
        Feed one aggregation snapshot in. Extends or breaks each emotion's
        over-threshold streak accordingly. Called by the background
        aggregation tick (every AGGREGATION_INTERVAL_SECONDS) and by the
        /analytics/distribution + /analytics/window-stats routes.
        """
        now = datetime.utcnow()

        for emotion, threshold in PATTERN_THRESHOLDS.items():
            if distribution.get(emotion, 0.0) > threshold:
                if self.streak_start[emotion] is None:
                    self.streak_start[emotion] = now
            else:
                self.streak_start[emotion] = None

        self.aggregation_history.append({
            "timestamp": now.isoformat(),
            "distribution": distribution,
        })
        if len(self.aggregation_history) > self.max_history:
            self.aggregation_history.pop(0)

    def _streak_seconds(self, emotion: str, now: Optional[datetime] = None) -> float:
        start = self.streak_start.get(emotion)
        if start is None:
            return 0.0
        return ((now or datetime.utcnow()) - start).total_seconds()

    def detect_dominant_pattern(self) -> Optional[str]:
        """
        Return the emotion whose over-threshold streak has lasted at least
        SUSTAINED_SECONDS, or None. If several qualify, the most severe one
        (FRUSTRATED > CONFUSED > BORED) wins.
        """
        now = datetime.utcnow()
        qualifying = [e for e in PATTERN_THRESHOLDS if self._streak_seconds(e, now) >= SUSTAINED_SECONDS]
        if not qualifying:
            return None
        for emotion in _PRIORITY:
            if emotion in qualifying:
                return emotion
        return qualifying[0]

    def get_pattern_status(self) -> Dict:
        """
        Full pattern-detection status for the API response, including how
        far along each emotion's streak is so the dashboard can show
        "bored 7m 30s - alerts at 10m".
        """
        now = datetime.utcnow()
        detected = self.detect_dominant_pattern()
        streaks = {
            emotion: round(self._streak_seconds(emotion, now), 1)
            for emotion in PATTERN_THRESHOLDS
        }

        return {
            "detected": detected is not None,
            "emotion": detected,
            "thresholds": PATTERN_THRESHOLDS,
            "sustained_seconds": SUSTAINED_SECONDS,
            "streak_seconds": streaks,
            "detected_streak_seconds": streaks.get(detected) if detected else 0.0,
            "cycles_checked": len(self.aggregation_history),
            "history": [
                {"timestamp": h["timestamp"], "distribution": h["distribution"]}
                for h in self.aggregation_history
            ],
        }


# Global detector instance
pattern_detector = PatternDetector()
