from datetime import datetime
from typing import Dict, List
import random

from app.models.schemas import GameRecommendation, RecommendationResponse


class RecommendationEngine:
    """
    Game recommendation engine based on dominant emotions and subjects.
    Uses rule-based logic to suggest appropriate learning games.
    """

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

    def get_recommendation(self, dominant_emotion: str) -> RecommendationResponse:
        """
        Get game recommendation based on dominant emotion.
        Returns primary recommendation + 2 alternatives.
        """
        emotion = dominant_emotion.upper()

        if emotion not in self.GAME_CATALOG:
            emotion = "NORMAL"

        games = self.GAME_CATALOG[emotion]
        primary = random.choice(games)

        # Build alternatives from other emotions for variety
        alternatives = []
        all_emotions = list(self.GAME_CATALOG.keys())
        all_emotions.remove(emotion)
        random.shuffle(all_emotions)

        for alt_emotion in all_emotions[:2]:
            alt_games = self.GAME_CATALOG[alt_emotion]
            alternatives.append(random.choice(alt_games))

        trigger_reason = self._get_trigger_reason(emotion)

        return RecommendationResponse(
            timestamp=datetime.utcnow(),
            dominant_emotion=emotion,
            trigger_reason=trigger_reason,
            recommendation=primary,
            alternatives=alternatives
        )

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
