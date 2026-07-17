from datetime import datetime
from typing import List, Dict, Optional
from collections import deque


class DashboardStore:
    """
    In-memory store for dashboard aggregation results and intervention history.
    Keeps the last N snapshots for trend visualization.
    """

    def __init__(self, max_snapshots: int = 20, max_interventions: int = 50):
        self.aggregated_results: deque = deque(maxlen=max_snapshots)
        self.intervention_history: deque = deque(maxlen=max_interventions)
        self.max_snapshots = max_snapshots
        self.max_interventions = max_interventions

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

    def add_intervention(self, intervention: Dict) -> None:
        """Add a new intervention record."""
        self.intervention_history.append({
            **intervention,
            "status": "pending",
            "reduction_pct": None,
        })

    def complete_intervention(self, intervention_id: str, record: Dict) -> None:
        """Mark an intervention as completed with reduction data."""
        for item in self.intervention_history:
            if item.get("intervention_id") == intervention_id:
                item["status"] = "completed"
                item["reduction_pct"] = record.get("negative_emotion_reduction_pct")
                break

    def get_intervention_history(self, n: int = 20) -> List[Dict]:
        """Return the last N intervention records."""
        count = min(n, len(self.intervention_history))
        return [dict(item) for item in list(self.intervention_history)[-count:]]

    def clear(self) -> None:
        """Clear all stored snapshots and interventions."""
        self.aggregated_results.clear()
        self.intervention_history.clear()


# Global dashboard store instance
dashboard_store = DashboardStore(max_snapshots=20)
