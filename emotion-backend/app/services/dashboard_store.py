from datetime import datetime
from typing import List, Dict, Optional
from collections import deque


class DashboardStore:
    """
    In-memory store for dashboard aggregation results.
    Keeps the last N snapshots for trend visualization.
    """

    def __init__(self, max_snapshots: int = 20):
        self.aggregated_results: deque = deque(maxlen=max_snapshots)
        self.max_snapshots = max_snapshots

    def add_snapshot(self, distribution: Dict[str, float], dominant: str) -> None:
        """
        Store a new aggregation snapshot.
        """
        snapshot = {
            "timestamp": datetime.utcnow().isoformat(),
            "distribution": distribution,
            "dominant_emotion": dominant,
        }
        self.aggregated_results.append(snapshot)

    def get_latest(self) -> Optional[Dict]:
        """
        Return the most recent aggregation snapshot.
        """
        if not self.aggregated_results:
            return None
        return dict(self.aggregated_results[-1])

    def get_last_n(self, n: int = 10) -> List[Dict]:
        """
        Return the last N aggregation snapshots (oldest first).
        """
        count = min(n, len(self.aggregated_results))
        return [dict(item) for item in list(self.aggregated_results)[-count:]]

    def get_all(self) -> List[Dict]:
        """
        Return all stored snapshots (oldest first).
        """
        return [dict(item) for item in list(self.aggregated_results)]

    def clear(self) -> None:
        """Clear all stored snapshots."""
        self.aggregated_results.clear()


# Global dashboard store instance
dashboard_store = DashboardStore(max_snapshots=20)
