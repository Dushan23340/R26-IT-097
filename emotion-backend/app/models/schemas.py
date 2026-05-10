from pydantic import BaseModel, Field, ConfigDict
from typing import List, Dict, Optional
from datetime import datetime
from enum import Enum


class EmotionType(str, Enum):
    HAPPY = "HAPPY"
    NORMAL = "NORMAL"
    CONFUSED = "CONFUSED"
    BORED = "BORED"
    FRUSTRATED = "FRUSTRATED"
    ANGRY = "ANGRY"


class EmotionEventInput(BaseModel):
    """Input schema for POST /emotion-event with camelCase support."""
    model_config = ConfigDict(populate_by_name=True)

    student_id: int = Field(..., alias="studentId", description="Student identifier (number)")
    session_id: str = Field(..., alias="sessionId", description="Session identifier")
    emotion: EmotionType
    timestamp: datetime = Field(..., description="ISO 8601 timestamp (auto-parsed from string)")


class EmotionEvent(BaseModel):
    student_id: str
    emotion: EmotionType
    subject: Optional[str] = None
    timestamp: Optional[datetime] = None
    confidence: float = 1.0


class EmotionDistribution(BaseModel):
    emotion: str
    percentage: float
    count: int


class CurrentAnalyticsResponse(BaseModel):
    timestamp: datetime
    total_students: int
    active_students: int
    window_seconds: int
    distribution: List[EmotionDistribution]
    dominant_emotion: str
    dominant_percentage: float
    class_engagement_score: float


class TrendPoint(BaseModel):
    timestamp: datetime
    emotion: str
    student_count: int


class TrendResponse(BaseModel):
    emotion: str
    data: List[TrendPoint]


class EmotionTrendResponse(BaseModel):
    trends: List[TrendResponse]
    time_range: str


class GameRecommendation(BaseModel):
    game_id: str
    title: str
    description: str
    subject: str
    game_type: str
    difficulty: str
    target_emotion: str
    estimated_duration_minutes: int
    engagement_score: float


class RecommendationResponse(BaseModel):
    timestamp: datetime
    dominant_emotion: str
    trigger_reason: str
    recommendation: GameRecommendation
    alternatives: List[GameRecommendation]


class EmotionDistributionMap(BaseModel):
    """Flat emotion distribution for intervention tracking."""
    HAPPY: float = 0.0
    NORMAL: float = 0.0
    CONFUSED: float = 0.0
    BORED: float = 0.0
    FRUSTRATED: float = 0.0
    ANGRY: float = 0.0


class InterventionRecord(BaseModel):
    intervention_id: str
    timestamp: datetime
    subject: str
    recommended_game: GameRecommendation
    pre_emotions: Dict[str, float]
    post_emotions: Optional[Dict[str, float]] = None
    negative_emotion_reduction_pct: Optional[float] = None
    status: str = "pending"  # pending, completed


class EffectivenessMetrics(BaseModel):
    total_interventions: int
    completed_interventions: int
    average_reduction_pct: float
    target_reduction_pct: float = 20.0
    target_met: bool
    recent_results: List[Dict]


class VariationWindowConfig(BaseModel):
    window_minutes: int = 30
    recent_history: List[Dict]
