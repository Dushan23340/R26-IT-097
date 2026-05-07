from datetime import datetime
from typing import Dict, Optional, List


# Threshold rules for pattern detection
PATTERN_THRESHOLDS = {
    "BORED": 30.0,
    "CONFUSED": 25.0,
    "FRUSTRATED": 20.0,
}


class PatternDetector:
    """
    Detects dominant emotional patterns that persist across
    consecutive aggregation cycles.
    """

    def __init__(self):
        # Store last two aggregation cycle results
        self.aggregation_history: List[Dict] = []
        self.max_history = 2

    def store_aggregation_result(self, distribution: Dict[str, float]) -> None:
        """
        Store the latest aggregation result.
        Keeps only the last 2 results for consecutive cycle checks.
        """
        self.aggregation_history.append({
            "timestamp": datetime.utcnow().isoformat(),
            "distribution": distribution
        })
        # Keep only last 2
        if len(self.aggregation_history) > self.max_history:
            self.aggregation_history.pop(0)

    def detect_dominant_pattern(self) -> Optional[str]:
        """
        Detect if an emotional pattern persists for 2 consecutive cycles.

        Rules:
            - BORED > 30%
            - CONFUSED > 25%
            - FRUSTRATED > 20%

        Returns:
            Detected emotion string (e.g., "BORED") or None if no pattern.
        """
        # Need at least 2 consecutive results
        if len(self.aggregation_history) < 2:
            return None

        # Get the last two distributions
        prev = self.aggregation_history[-2]["distribution"]
        curr = self.aggregation_history[-1]["distribution"]

        # Check each rule against both cycles
        for emotion, threshold in PATTERN_THRESHOLDS.items():
            prev_value = prev.get(emotion, 0.0)
            curr_value = curr.get(emotion, 0.0)

            if prev_value > threshold and curr_value > threshold:
                return emotion

        return None

    def get_pattern_status(self) -> Dict:
        """
        Get full pattern detection status for API response.
        """
        detected = self.detect_dominant_pattern()

        return {
            "detected": detected is not None,
            "emotion": detected,
            "thresholds": PATTERN_THRESHOLDS,
            "cycles_checked": len(self.aggregation_history),
            "history": [
                {
                    "timestamp": h["timestamp"],
                    "distribution": h["distribution"]
                }
                for h in self.aggregation_history
            ]
        }


# Global detector instance
pattern_detector = PatternDetector()
