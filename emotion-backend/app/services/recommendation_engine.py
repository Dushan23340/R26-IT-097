import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import random

from app.models.schemas import GameRecommendation, RecommendationResponse
from app.services.game_catalog import get_all_games_for, get_games_for, get_games_for_lesson
from app.redis_client import redis_client

STATE_KEY = "recommendation:history"

# Emotion->game mapping is intentionally OFF for now (explicit instruction:
# "don't map games with emotions still... only do when teacher click
# recommend button display games"). generate_recommendation() below picks
# from every real game for the subject via get_all_games_for(), cycling
# through them with the existing variation-window logic instead of pinning
# to a specific emotion bucket. To re-enable emotion-based selection later,
# swap the games = get_all_games_for(subject) line back to
# games = get_games_for(subject, emotion).


class RecommendationEngine:
    """
    Subject-aware game recommendation engine with time-based variation tracking.
    Maps (subject, dominant_emotion) pairs to appropriate educational games.
    Ensures identical game types are not recommended within a configurable window.
    """

    def __init__(self, variation_window_minutes: int = 30):
        self.variation_window_minutes = variation_window_minutes
        self.recommendation_history: List[Dict] = []

    def _load(self) -> None:
        raw = redis_client.get(STATE_KEY)
        self.recommendation_history = json.loads(raw) if raw else []

    def _save(self) -> None:
        redis_client.set(STATE_KEY, json.dumps(self.recommendation_history))

    def generate_recommendation(
        self,
        dominant_emotion: str,
        subject: str = "General",
        lesson_id: Optional[str] = None
    ) -> Dict:
        """
        Generate a subject-aware game recommendation, optionally narrowed
        to a specific real lesson.

        Args:
            dominant_emotion: The detected dominant emotion (e.g., "BORED")
            subject: The lesson subject (e.g., "Mathematics", "Science")
            lesson_id: A real lesson id from adaptive-learning's
                GET /api/lessons (e.g. "fractions-bodmas"). Only games
                explicitly tagged to this lesson (game_catalog.py) are
                used; if none are tagged yet, falls back to the normal
                subject-wide pool and reports lesson_matched=False so the
                caller can be honest about it rather than pretending
                relevance.

        Returns:
            Dict with recommended game, alternatives, and metadata.
        """
        self._load()
        emotion = dominant_emotion.upper()
        subject = subject.strip() or "General"
        lesson_id = (lesson_id or "").strip() or None

        # Step 1: All real games for the subject, ignoring emotion (see
        # module docstring note above - emotion mapping is off for now).
        # If a lesson was picked, narrow to games tagged to it - if none
        # are tagged, fall back to the full subject pool.
        lesson_matched = False
        games = get_all_games_for(subject)
        if lesson_id:
            lesson_games = get_games_for_lesson(subject, lesson_id)
            if lesson_games:
                games = lesson_games
                lesson_matched = True

        # Step 2: Filter out recently used game types within the window, so
        # repeated "Recommend" clicks cycle to a different game instead of
        # returning the same one every time.
        recent_game_types = self._get_recent_game_types()
        available_games = [g for g in games if g.game_type not in recent_game_types]

        # Step 3: If all filtered out, pick from least-recent game type
        if not available_games:
            available_games = games

        # Step 4: Never repeat the exact same game as the last click, when
        # there's another option - the game-type filter alone can still
        # land on the same game twice in a row once every type has been
        # seen recently (e.g. only 2 real games/types exist right now).
        last_game_id = self.recommendation_history[-1]["game_id"] if self.recommendation_history else None
        not_last = [g for g in available_games if g.game_id != last_game_id]
        if not_last:
            available_games = not_last

        primary = random.choice(available_games)

        # Step 5: Build alternatives from other emotions in same subject
        alternatives = self._build_alternatives(subject, emotion)

        # Step 6: Store in history
        self._add_to_history(primary.game_id, primary.game_type, emotion, subject)
        self._save()

        return {
            "timestamp": datetime.utcnow().isoformat(),
            "dominant_emotion": emotion,
            "subject": subject,
            "lesson_id": lesson_id,
            "lesson_matched": lesson_matched,
            "game_type": primary.game_type,
            "recommendation": primary,
            "alternatives": alternatives,
            "trigger_reason": self._get_trigger_reason(emotion),
        }

    def _get_recent_game_types(self) -> set:
        """
        Return game types recommended within the variation window.
        """
        cutoff = datetime.utcnow() - timedelta(minutes=self.variation_window_minutes)
        recent_types = set()
        for rec in self.recommendation_history:
            rec_time = datetime.fromisoformat(rec["timestamp"])
            if rec_time >= cutoff:
                recent_types.add(rec["game_type"])
        return recent_types

    def _build_alternatives(
        self,
        subject: str,
        current_emotion: str
    ) -> List[GameRecommendation]:
        """
        Build 2 alternative recommendations from other emotions in the same subject.
        """
        alternatives = []
        other_emotions = ["HAPPY", "NORMAL", "CONFUSED", "BORED", "FRUSTRATED", "ANGRY"]
        other_emotions = [e for e in other_emotions if e != current_emotion]
        random.shuffle(other_emotions)

        recent_game_types = self._get_recent_game_types()

        for alt_emotion in other_emotions[:2]:
            alt_games = get_games_for(subject, alt_emotion)
            alt_available = [g for g in alt_games if g.game_type not in recent_game_types]
            if not alt_available:
                alt_available = alt_games
            if alt_available:
                alternatives.append(random.choice(alt_available))

        return alternatives

    def _add_to_history(
        self,
        game_id: str,
        game_type: str,
        emotion: str,
        subject: str
    ) -> None:
        """Add a recommendation to history with timestamp."""
        self.recommendation_history.append({
            "game_id": game_id,
            "game_type": game_type,
            "emotion": emotion,
            "subject": subject,
            "timestamp": datetime.utcnow().isoformat(),
        })

    def get_recommendation(self, dominant_emotion: str, subject: str = "General") -> RecommendationResponse:
        """
        Get game recommendation with full response model.
        """
        result = self.generate_recommendation(dominant_emotion, subject)

        return RecommendationResponse(
            timestamp=datetime.utcnow(),
            dominant_emotion=result["dominant_emotion"],
            trigger_reason=result["trigger_reason"],
            recommendation=result["recommendation"],
            alternatives=result["alternatives"],
        )

    def get_recommendation_history(self, since_minutes: Optional[int] = None) -> List[Dict]:
        """
        Return recommendation history, optionally filtered by time window.
        """
        self._load()
        if since_minutes is None:
            return list(self.recommendation_history)

        cutoff = datetime.utcnow() - timedelta(minutes=since_minutes)
        return [
            rec for rec in self.recommendation_history
            if datetime.fromisoformat(rec["timestamp"]) >= cutoff
        ]

    def get_variation_window_config(self) -> Dict:
        """
        Return current variation window configuration and recent history.
        """
        recent = self.get_recommendation_history(since_minutes=self.variation_window_minutes)
        return {
            "window_minutes": self.variation_window_minutes,
            "recent_history": recent,
            "blocked_game_types": list(self._get_recent_game_types()),
        }

    def can_recommend(self, game_id: str) -> bool:
        """Check if a game was recently recommended (within variation window)."""
        self._load()
        cutoff = datetime.utcnow() - timedelta(minutes=self.variation_window_minutes)
        for rec in self.recommendation_history:
            if rec["game_id"] == game_id:
                rec_time = datetime.fromisoformat(rec["timestamp"])
                if rec_time >= cutoff:
                    return False
        return True

    def _get_trigger_reason(self, emotion: str) -> str:
        """Generate human-readable trigger reason."""
        reasons = {
            "HAPPY": "Class is highly engaged. Let's channel this energy into collaborative challenges!",
            "NORMAL": "Class is steady. Maintain momentum with interactive content.",
            "CONFUSED": "Students are struggling with concepts. Simplify and provide scaffolding.",
            "BORED": "Attention is dropping. Introduce high-energy, competitive activities.",
            "FRUSTRATED": "Students are hitting roadblocks. Build confidence with review content.",
            "ANGRY": "Elevated negative emotions detected. Calm-down activity recommended first.",
        }
        return reasons.get(emotion, "General recommendation based on class state.")


# Global engine instance
recommendation_engine = RecommendationEngine(variation_window_minutes=30)
