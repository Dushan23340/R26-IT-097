import json
from datetime import datetime
from typing import List, Dict, Optional
from collections import deque

from app.redis_client import redis_client

STATE_KEY = "dashboard:state"


class DashboardStore:
    """
    Redis-backed store for dashboard aggregation results and intervention
    history (state now lives in Redis instead of process memory — see the
    target production architecture). Keeps the last N snapshots for trend
    visualization.
    """

    def __init__(self, max_snapshots: int = 20, max_interventions: int = 50):
        self.aggregated_results: deque = deque(maxlen=max_snapshots)
        self.intervention_history: deque = deque(maxlen=max_interventions)
        self.max_snapshots = max_snapshots
        self.max_interventions = max_interventions

    def _load(self) -> None:
        raw = redis_client.get(STATE_KEY)
        data = json.loads(raw) if raw else {}
        self.aggregated_results = deque(data.get("aggregated_results", []), maxlen=self.max_snapshots)
        self.intervention_history = deque(data.get("intervention_history", []), maxlen=self.max_interventions)

    def _save(self) -> None:
        redis_client.set(STATE_KEY, json.dumps({
            "aggregated_results": list(self.aggregated_results),
            "intervention_history": list(self.intervention_history),
        }))

    def add_snapshot(self, distribution: Dict[str, float], dominant: str) -> None:
        """
        Store a new aggregation snapshot.
        """
        self._load()
        snapshot = {
            "timestamp": datetime.utcnow().isoformat(),
            "distribution": distribution,
            "dominant_emotion": dominant,
        }
        self.aggregated_results.append(snapshot)
        self._save()

    def get_latest(self) -> Optional[Dict]:
        """
        Return the most recent aggregation snapshot.
        """
        self._load()
        if not self.aggregated_results:
            return None
        return dict(self.aggregated_results[-1])

    def get_last_n(self, n: int = 10) -> List[Dict]:
        """
        Return the last N aggregation snapshots (oldest first).
        """
        self._load()
        count = min(n, len(self.aggregated_results))
        return [dict(item) for item in list(self.aggregated_results)[-count:]]

    def get_all(self) -> List[Dict]:
        """
        Return all stored snapshots (oldest first).
        """
        self._load()
        return [dict(item) for item in list(self.aggregated_results)]

    def add_intervention(self, intervention: Dict) -> None:
        """Add a new intervention record."""
        self._load()
        self.intervention_history.append({
            **intervention,
            "status": "pending",
            "reduction_pct": None,
        })
        self._save()

    def complete_intervention(self, intervention_id: str, record: Dict) -> None:
        """Mark an intervention as completed with reduction data."""
        self._load()
        for item in self.intervention_history:
            if item.get("intervention_id") == intervention_id:
                item["status"] = "completed"
                item["reduction_pct"] = record.get("negative_emotion_reduction_pct")
                break
        self._save()

    def get_intervention_history(self, n: int = 20) -> List[Dict]:
        """Return the last N intervention records."""
        self._load()
        count = min(n, len(self.intervention_history))
        return [dict(item) for item in list(self.intervention_history)[-count:]]

    def clear(self) -> None:
        """Clear all stored snapshots and interventions."""
        self.aggregated_results.clear()
        self.intervention_history.clear()
        self._save()


# Global dashboard store instance
dashboard_store = DashboardStore(max_snapshots=20)
