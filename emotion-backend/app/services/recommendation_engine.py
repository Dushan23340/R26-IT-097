from datetime import datetime
from typing import Dict, List, Optional, Tuple
import random

from app.models.schemas import GameRecommendation, RecommendationResponse


# Game type mapping by emotion
GAME_TYPE_MAP = {
    "BORED": "quiz game",
    "CONFUSED": "concept-based game",
    "FRUSTRATED": "easy challenge game",
    "HAPPY": "collaborative game",
    "NORMAL": "interactive game",
    "ANGRY": "calm-down game",
}


class RecommendationEngine:
    """
    Game recommendation engine based on dominant emotions and subjects.
    Uses rule-based logic to suggest appropriate learning games.
    Tracks history to avoid repeating the last 3 recommendations.
    """

    # Keep track of last recommendations to avoid repetition
    recommendation_history: List[Dict] = []
    max_history = 3

    GAME_CATALOG = {
        "HAPPY": [
            GameRecommendation(
                game_id="gm_happy_01",
                title="Knowledge Relay Race",
                description="Team-based quiz competition with increasing difficulty levels.",
                subject="General",
                difficulty="Medium",
                target_emotion="HAPPY",
                estimated_duration_minutes=15,
                engagement_score=9.2
            ),
            GameRecommendation(
                game_id="gm_happy_02",
                title="Creative Challenge Builder",
                description="Students create their own quiz questions for peers to solve.",
                subject="General",
                difficulty="Hard",
                target_emotion="HAPPY",
                estimated_duration_minutes=20,
                engagement_score=9.5
            ),
        ],
        "NORMAL": [
            GameRecommendation(
                game_id="gm_norm_01",
                title="Interactive Lecture Quest",
                description="Gamified lecture with checkpoints and instant feedback.",
                subject="General",
                difficulty="Easy",
                target_emotion="NORMAL",
                estimated_duration_minutes=15,
                engagement_score=7.8
            ),
            GameRecommendation(
                game_id="gm_norm_02",
                title="Collaborative Mind Map",
                description="Build knowledge maps together in real-time.",
                subject="General",
                difficulty="Medium",
                target_emotion="NORMAL",
                estimated_duration_minutes=12,
                engagement_score=8.0
            ),
        ],
        "CONFUSED": [
            GameRecommendation(
                game_id="gm_conf_01",
                title="Step-by-Step Solver",
                description="Guided problem-solving with hints and visual explanations.",
                subject="Mathematics",
                difficulty="Easy",
                target_emotion="CONFUSED",
                estimated_duration_minutes=10,
                engagement_score=8.5
            ),
            GameRecommendation(
                game_id="gm_conf_02",
                title="Concept Clarifier",
                description="Interactive analogy game connecting concepts to real life.",
                subject="Science",
                difficulty="Easy",
                target_emotion="CONFUSED",
                estimated_duration_minutes=8,
                engagement_score=8.7
            ),
        ],
        "BORED": [
            GameRecommendation(
                game_id="gm_bored_01",
                title="Speed Challenge",
                description="Timed rapid-fire questions to increase adrenaline and focus.",
                subject="General",
                difficulty="Medium",
                target_emotion="BORED",
                estimated_duration_minutes=5,
                engagement_score=8.9
            ),
            GameRecommendation(
                game_id="gm_bored_02",
                title="Escape Room Puzzle",
                description="Subject-themed escape room with team collaboration.",
                subject="General",
                difficulty="Medium",
                target_emotion="BORED",
                estimated_duration_minutes=15,
                engagement_score=9.1
            ),
        ],
        "FRUSTRATED": [
            GameRecommendation(
                game_id="gm_frust_01",
                title="Confidence Builder",
                description="Review previously mastered topics to rebuild confidence.",
                subject="General",
                difficulty="Easy",
                target_emotion="FRUSTRATED",
                estimated_duration_minutes=8,
                engagement_score=8.3
            ),
            GameRecommendation(
                game_id="gm_frust_02",
                title="Peer Helper",
                description="Pair stronger students to mentor others collaboratively.",
                subject="General",
                difficulty="Easy",
                target_emotion="FRUSTRATED",
                estimated_duration_minutes=10,
                engagement_score=8.6
            ),
        ],
        "ANGRY": [
            GameRecommendation(
                game_id="gm_angry_01",
                title="Calm Down Challenge",
                description="Breathing exercise + simple puzzle to reset emotional state.",
                subject="General",
                difficulty="Easy",
                target_emotion="ANGRY",
                estimated_duration_minutes=5,
                engagement_score=7.5
            ),
            GameRecommendation(
                game_id="gm_angry_02",
                title="Physical Brain Break",
                description="Quick movement activity followed by gentle review.",
                subject="General",
                difficulty="Easy",
                target_emotion="ANGRY",
                estimated_duration_minutes=7,
                engagement_score=7.8
            ),
        ],
    }

    def generate_recommendation(
        self,
        dominant_emotion: str,
        subject: str = "General"
    ) -> Dict:
        """
        Generate a game recommendation based on dominant emotion and subject.
        Ensures the last 3 recommendations are not repeated.

        Args:
            dominant_emotion: The detected dominant emotion (e.g., "BORED")
            subject: The subject area (e.g., "Mathematics")

        Returns:
            Dict with recommended game type, game details, and subject info.
        """
        emotion = dominant_emotion.upper()

        if emotion not in self.GAME_CATALOG:
            emotion = "NORMAL"

        # Get the game type for this emotion
        game_type = GAME_TYPE_MAP.get(emotion, "interactive game")

        # Get available games, filtering out recently recommended ones
        games = self.GAME_CATALOG[emotion]
        recent_game_ids = {rec["game_id"] for rec in self.recommendation_history}

        available_games = [g for g in games if g.game_id not in recent_game_ids]

        # If all games were recently used, reset filter for this emotion
        if not available_games:
            available_games = games

        # Select primary recommendation
        primary = random.choice(available_games)

        # Build alternatives from other emotions
        alternatives = []
        all_emotions = list(self.GAME_CATALOG.keys())
        all_emotions.remove(emotion)
        random.shuffle(all_emotions)

        for alt_emotion in all_emotions[:2]:
            alt_games = self.GAME_CATALOG[alt_emotion]
            # Filter out recently used alternatives too
            alt_available = [g for g in alt_games if g.game_id not in recent_game_ids]
            if not alt_available:
                alt_available = alt_games
            alternatives.append(random.choice(alt_available))

        # Store in history
        self._add_to_history(primary.game_id, emotion, subject)

        return {
            "timestamp": datetime.utcnow().isoformat(),
            "dominant_emotion": emotion,
            "subject": subject,
            "game_type": game_type,
            "recommendation": primary,
            "alternatives": alternatives,
            "trigger_reason": self._get_trigger_reason(emotion),
        }

    def _add_to_history(self, game_id: str, emotion: str, subject: str) -> None:
        """Add a recommendation to history, keeping only last 3."""
        self.recommendation_history.append({
            "game_id": game_id,
            "emotion": emotion,
            "subject": subject,
            "timestamp": datetime.utcnow().isoformat(),
        })
        if len(self.recommendation_history) > self.max_history:
            self.recommendation_history.pop(0)

    def get_recommendation(self, dominant_emotion: str) -> RecommendationResponse:
        """
        Get game recommendation based on dominant emotion (legacy wrapper).
        Returns primary recommendation + 2 alternatives.
        """
        result = self.generate_recommendation(dominant_emotion)

        return RecommendationResponse(
            timestamp=datetime.utcnow(),
            dominant_emotion=result["dominant_emotion"],
            trigger_reason=result["trigger_reason"],
            recommendation=result["recommendation"],
            alternatives=result["alternatives"],
        )

    def get_recommendation_history(self) -> List[Dict]:
        """Return the last 3 recommendation records."""
        return self.recommendation_history

    def can_recommend(self, game_id: str) -> bool:
        """Check if a game was recently recommended (within last 3)."""
        return game_id not in {rec["game_id"] for rec in self.recommendation_history}

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
recommendation_engine = RecommendationEngine()
