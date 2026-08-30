import json
from datetime import datetime
from typing import Dict, List, Optional
from collections import deque
import uuid

from app.models.schemas import GameRecommendation
from app.redis_client import redis_client

NEGATIVE_EMOTIONS = {"CONFUSED", "BORED", "FRUSTRATED", "ANGRY"}
STATE_KEY = "intervention:history"


def _serialize(record: Dict) -> Dict:
    """A plain dict is JSON-safe except recommended_game, which is a
    GameRecommendation pydantic model."""
    out = dict(record)
    out["recommended_game"] = record["recommended_game"].model_dump(mode="json")
    return out


def _deserialize(record: Dict) -> Dict:
    out = dict(record)
    out["recommended_game"] = GameRecommendation(**record["recommended_game"])
    return out


class InterventionTracker:
    """
    Redis-backed tracker for game interventions and their effectiveness at
    reducing class-level negative emotions (state now lives in Redis
    instead of process memory — see the target production architecture).
    """

    def __init__(self, max_history: int = 50):
        self.interventions: deque = deque(maxlen=max_history)
        self.max_history = max_history

    def _load(self) -> None:
        raw = redis_client.get(STATE_KEY)
        records = [_deserialize(r) for r in json.loads(raw)] if raw else []
        self.interventions = deque(records, maxlen=self.max_history)

    def _save(self) -> None:
        redis_client.set(STATE_KEY, json.dumps([_serialize(r) for r in self.interventions]))

    def start_intervention(
        self,
        subject: str,
        game: GameRecommendation,
        pre_distribution: Dict[str, float]
    ) -> str:
        """
        Start tracking a new intervention.
        Records pre-intervention emotion distribution.
        """
        self._load()
        intervention_id = str(uuid.uuid4())[:8]
        record = {
            "intervention_id": intervention_id,
            "timestamp": datetime.utcnow().isoformat(),
            "subject": subject,
            "recommended_game": game,
            "pre_emotions": dict(pre_distribution),
            "post_emotions": None,
            "negative_emotion_reduction_pct": None,
            "status": "pending",
        }
        self.interventions.append(record)
        self._save()
        return intervention_id

    def record_post_emotions(
        self,
        intervention_id: str,
        post_distribution: Dict[str, float]
    ) -> Optional[Dict]:
        """
        Record post-intervention emotions and compute reduction percentage.
        Returns the updated record or None if not found.
        """
        self._load()
        for record in self.interventions:
            if record["intervention_id"] == intervention_id:
                record["post_emotions"] = dict(post_distribution)
                reduction = self._calculate_reduction(
                    record["pre_emotions"],
                    post_distribution
                )
                record["negative_emotion_reduction_pct"] = reduction
                record["status"] = "completed"
                self._save()
                return dict(record)
        return None

    def _calculate_reduction(
        self,
        pre: Dict[str, float],
        post: Dict[str, float]
    ) -> float:
        """
        Calculate negative emotion reduction percentage.
        Returns 0.0 if no negative emotions were present pre-intervention.
        """
        pre_negative = sum(pre.get(e, 0.0) for e in NEGATIVE_EMOTIONS)
        post_negative = sum(post.get(e, 0.0) for e in NEGATIVE_EMOTIONS)

        if pre_negative <= 0:
            return 0.0

        reduction = ((pre_negative - post_negative) / pre_negative) * 100
        return round(reduction, 1)

    def get_effectiveness_metrics(self) -> Dict:
        """
        Return overall effectiveness metrics.
        """
        self._load()
        completed = [
            rec for rec in self.interventions
            if rec["status"] == "completed" and rec["negative_emotion_reduction_pct"] is not None
        ]

        if not completed:
            return {
                "total_interventions": len(self.interventions),
                "completed_interventions": 0,
                "average_reduction_pct": 0.0,
                "target_reduction_pct": 20.0,
                "target_met": False,
                "recent_results": [],
            }

        avg_reduction = round(
            sum(r["negative_emotion_reduction_pct"] for r in completed) / len(completed),
            1
        )

        recent = [
            {
                "intervention_id": r["intervention_id"],
                "timestamp": r["timestamp"],
                "subject": r["subject"],
                "reduction_pct": r["negative_emotion_reduction_pct"],
                "game_title": r["recommended_game"].title,
            }
            for r in list(completed)[-10:]
        ]

        return {
            "total_interventions": len(self.interventions),
            "completed_interventions": len(completed),
            "average_reduction_pct": avg_reduction,
            "target_reduction_pct": 20.0,
            "target_met": avg_reduction >= 20.0,
            "recent_results": recent,
        }

    def get_pending_interventions(self) -> List[Dict]:
        """Return all pending interventions waiting for post-emotion feedback."""
        self._load()
        return [
            {
                "intervention_id": r["intervention_id"],
                "timestamp": r["timestamp"],
                "subject": r["subject"],
                "game_title": r["recommended_game"].title,
                "pre_emotions": r["pre_emotions"],
            }
            for r in self.interventions
            if r["status"] == "pending"
        ]

    def get_intervention_by_id(self, intervention_id: str) -> Optional[Dict]:
        """Get a single intervention record by ID."""
        self._load()
        for record in self.interventions:
            if record["intervention_id"] == intervention_id:
                return dict(record)
        return None


# Global tracker instance
intervention_tracker = InterventionTracker(max_history=50)
