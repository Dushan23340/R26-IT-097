"""
Manual "active game" broadcast - separate from RecommendationEngine, which
is entirely emotion-driven (auto-generates a suggestion from the current
dominant emotion). This is a simple teacher-controlled override: the
teacher explicitly picks a game from the dashboard, and any game page
polling GET /recommendation/active picks up the change and can prompt the
student to switch.

Each broadcast is a "session" (session_id) so join/finish events can be
scoped to *this* run of the game - a student's stale join/finish call from
a previous session (or after the teacher ended it) doesn't pollute the
current one, and re-broadcasting the same game starts a fresh count.
"""

from datetime import datetime
from typing import Dict, List, Optional
import uuid

GAME_LIBRARY: Dict[str, Dict[str, str]] = {
    "fraction_room": {"route": "/fraction-room", "label": "Fraction Room", "badge": "Game 1"},
    "track_field": {"route": "/track-field-analytics", "label": "Track & Field Analytics", "badge": "Game 2"},
    "dark_room": {"route": "/dark-room-escape", "label": "Escape the Dark Room", "badge": "Game 3"},
    "pirate": {"route": "/pirate-navigator", "label": "Uncharted Waters: The Pirate Navigator", "badge": "Game 4"},
    "equations_eco": {"route": "/equations-eco", "label": "Equations Eco: Forest Restoration", "badge": "Game 5"},
    "fish_tank_shop": {"route": "/fish-tank-shop", "label": "Fish Tank Shop", "badge": "Game 6"},
    "pattern_islands": {"route": "/pattern-islands", "label": "Pattern Islands", "badge": "Game 7"},
}


class ActiveRecommendationStore:
    def __init__(self) -> None:
        self.active_game: Optional[str] = None
        self.updated_at: Optional[datetime] = None
        self.session_id: Optional[str] = None
        self.joined_students: set = set()
        self.results: List[Dict] = []

    def set_active(self, game_key: str) -> None:
        if game_key not in GAME_LIBRARY:
            raise ValueError(f"Unknown game_key '{game_key}'. Known keys: {list(GAME_LIBRARY)}")
        self.active_game = game_key
        self.updated_at = datetime.utcnow()
        self.session_id = str(uuid.uuid4())[:8]
        self.joined_students = set()
        self.results = []

    def end_active(self) -> None:
        self.active_game = None
        self.updated_at = datetime.utcnow()
        self.session_id = None
        self.joined_students = set()
        self.results = []

    def get_active(self) -> Dict:
        if not self.active_game:
            return {"active_game": None}
        return {
            "active_game": self.active_game,
            "session_id": self.session_id,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            **GAME_LIBRARY[self.active_game],
        }

    def join(self, student_id: str, session_id: str) -> bool:
        """Register a student as having opened the currently broadcast
        game. Returns False (no-op) if session_id doesn't match the
        current session - e.g. the teacher ended or switched games between
        the student loading the banner and clicking Play Now."""
        if not self.active_game or session_id != self.session_id:
            return False
        self.joined_students.add(student_id)
        return True

    def record_result(
        self,
        student_id: str,
        session_id: str,
        outcome: str,
        score: Optional[float],
        student_name: Optional[str] = None,
        correct_count: Optional[int] = None,
        total_count: Optional[int] = None,
        duration_seconds: Optional[float] = None,
    ) -> bool:
        if not self.active_game or session_id != self.session_id:
            return False
        self.results.append({
            "student_id": student_id,
            "student_name": student_name or student_id,
            "outcome": outcome,
            "score": score,
            "correct_count": correct_count,
            "total_count": total_count,
            "duration_seconds": duration_seconds,
            "timestamp": datetime.utcnow().isoformat(),
        })
        return True

    def get_stats(self) -> Dict:
        if not self.active_game:
            return {"active_game": None, "session_id": None, "joined_count": 0, "finished_count": 0, "results": []}
        return {
            "active_game": self.active_game,
            "session_id": self.session_id,
            "joined_count": len(self.joined_students),
            "finished_count": len(self.results),
            "results": self.results,
            **GAME_LIBRARY[self.active_game],
        }


active_recommendation_store = ActiveRecommendationStore()
