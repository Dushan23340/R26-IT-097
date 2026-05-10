from __future__ import annotations

import time
from collections import Counter
from dataclasses import dataclass, field


@dataclass
class _StudentState:
    emotion_history: list[dict[str, float | str]] = field(default_factory=list)
    transition_count: int = 0
    last_emotion: str | None = None
    start_time: float = field(default_factory=time.time)


class EmotionTracker:
    def __init__(self) -> None:
        self._students: dict[str, _StudentState] = {}

    def _get_or_create(self, student_id: str) -> _StudentState:
        key = student_id or "default_student"
        if key not in self._students:
            self._students[key] = _StudentState()
        return self._students[key]

    def update(self, student_id: str, emotion: str) -> None:
        state = self._get_or_create(student_id)
        current_time = time.time()

        state.emotion_history.append({"emotion": emotion, "time": current_time})

        if state.last_emotion is not None and emotion != state.last_emotion:
            state.transition_count += 1

        state.last_emotion = emotion

    def _get_emotion_duration(self, state: _StudentState) -> dict[str, float]:
        durations: dict[str, float] = {}
        for i in range(1, len(state.emotion_history)):
            prev = state.emotion_history[i - 1]
            curr = state.emotion_history[i]
            emotion = str(prev["emotion"])
            delta = float(curr["time"]) - float(prev["time"])
            durations[emotion] = durations.get(emotion, 0.0) + delta
        return durations

    def _get_transition_rate(self, state: _StudentState) -> float:
        total_time = time.time() - state.start_time
        if total_time <= 0:
            return 0.0
        return state.transition_count / total_time

    def _get_stability_score(self, state: _StudentState) -> float:
        if not state.emotion_history:
            return 0.0
        emotions = [str(item["emotion"]) for item in state.emotion_history]
        most_common_count = Counter(emotions).most_common(1)[0][1]
        return most_common_count / len(emotions)

    def get_metrics(self, student_id: str) -> dict[str, float | int | dict[str, float] | dict[str, int]]:
        state = self._get_or_create(student_id)
        emotion_duration = self._get_emotion_duration(state)
        emotion_counts = Counter(str(item["emotion"]) for item in state.emotion_history)
        return {
            "emotionDuration": emotion_duration,
            "transitionRate": self._get_transition_rate(state),
            "stabilityScore": self._get_stability_score(state),
            "emotionCounts": dict(emotion_counts),
            "totalTransitions": state.transition_count,
        }
