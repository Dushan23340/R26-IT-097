from __future__ import annotations

import time
from collections import Counter
from dataclasses import dataclass, field
from typing import TypedDict


class EmotionHistoryItem(TypedDict):
    emotion: str
    time: float


@dataclass
class _StudentState:
    emotion_history: list[EmotionHistoryItem] = field(default_factory=list)
    transition_count: int = 0
    last_emotion: str | None = None
    start_time: float = field(default_factory=time.time)
    
    # Refactored/added fields:
    raw_window: list[str] = field(default_factory=list)
    timeline: list[dict[str, float | str | dict | int]] = field(default_factory=list)
    last_timeline_snapshot: float = 0.0


class EmotionTracker:
    def __init__(self) -> None:
        self._students: dict[str, _StudentState] = {}

    def _get_or_create(self, student_id: str) -> _StudentState:
        key = student_id or "default_student"
        if key not in self._students:
            self._students[key] = _StudentState()
        return self._students[key]

    def update(self, student_id: str, emotion: str) -> str:
        """
        Applies temporal smoothing via majority voting window of 5, updates
        student state history, tracks transitions, and records timeline snapshots.
        
        Returns:
            The smoothed emotion.
        """
        state = self._get_or_create(student_id)
        current_time = time.time()

        # 1. Temporal Smoothing (Sliding Window of 5 Majority Voting)
        state.raw_window.append(emotion)
        if len(state.raw_window) > 5:
            state.raw_window.pop(0)

        counter = Counter(state.raw_window)
        most_common = counter.most_common()
        max_count = most_common[0][1]
        candidates = [emo for emo, count in most_common if count == max_count]

        # Break ties by selecting the most recent candidate in the raw window
        if len(candidates) == 1:
            smoothed_emotion = candidates[0]
        else:
            smoothed_emotion = emotion
            for item in reversed(state.raw_window):
                if item in candidates:
                    smoothed_emotion = item
                    break

        # 2. Update Smoothed History and transitions
        state.emotion_history.append({"emotion": smoothed_emotion, "time": current_time})

        if state.last_emotion is not None and smoothed_emotion != state.last_emotion:
            state.transition_count += 1

        state.last_emotion = smoothed_emotion

        # 3. Timeline Buffering (record timeline snapshot every 5 seconds)
        if state.last_timeline_snapshot == 0.0:
            state.last_timeline_snapshot = current_time
            self._take_timeline_snapshot(state, smoothed_emotion, current_time)
        elif current_time - state.last_timeline_snapshot >= 5.0:
            self._take_timeline_snapshot(state, smoothed_emotion, current_time)
            state.last_timeline_snapshot = current_time

        return smoothed_emotion

    def _take_timeline_snapshot(self, state: _StudentState, emotion: str, timestamp: float) -> None:
        metrics = self._get_metrics_internal(state)
        snapshot = {
            "timestamp": timestamp,
            "emotion": emotion,
            "currentContinuousDuration": metrics["currentContinuousDuration"],
            "transitionRate": metrics["transitionRate"],
            "stabilityScore": metrics["stabilityScore"],
            "engagementScore": metrics["engagementIndicators"]["engagementScore"]
        }
        state.timeline.append(snapshot)

    def _get_emotion_duration(self, state: _StudentState) -> dict[str, float]:
        durations: dict[str, float] = {}
        for i in range(1, len(state.emotion_history)):
            prev = state.emotion_history[i - 1]
            curr = state.emotion_history[i]
            emotion = prev["emotion"]
            delta = curr["time"] - prev["time"]
            durations[emotion] = durations.get(emotion, 0.0) + delta
        return durations

    def _get_current_continuous_duration(self, state: _StudentState) -> float:
        if not state.emotion_history:
            return 0.0
        
        history = state.emotion_history
        latest_emotion = history[-1]["emotion"]
        latest_time = history[-1]["time"]
        start_time = latest_time
        
        for i in range(len(history) - 2, -1, -1):
            if history[i]["emotion"] == latest_emotion:
                start_time = history[i]["time"]
            else:
                break
        
        duration = time.time() - start_time
        return max(0.0, duration)

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

    def _get_metrics_internal(self, state: _StudentState) -> dict:
        emotion_duration = self._get_emotion_duration(state)
        emotion_counts = Counter(str(item["emotion"]) for item in state.emotion_history)
        
        current_emotion = state.last_emotion or "Engaged"
        stability_score = self._get_stability_score(state)
        transition_rate = self._get_transition_rate(state)
        
        # Calculate Engagement Score
        weight_map = {
            "Engaged": 1.0,
            "Confused": 0.6,
            "Bored": 0.45,
            "Frustrated": 0.3
        }
        emotion_weight = weight_map.get(current_emotion, 0.5)
        transition_penalty = max(0.0, 1.0 - transition_rate * 2.0)
        engagement_score = int((emotion_weight * 0.5 + stability_score * 0.35 + transition_penalty * 0.15) * 100)
        
        # Calculate Disengagement Ratio (time spent in Bored / Frustrated)
        disengaged_duration = emotion_duration.get("Bored", 0.0) + emotion_duration.get("Frustrated", 0.0)
        total_duration = sum(emotion_duration.values())
        disengagement_ratio = disengaged_duration / total_duration if total_duration > 0.0 else 0.0
        
        # Calculate Negative Emotion Ratio
        negative_count = sum(1 for item in state.emotion_history if item["emotion"] in {"Bored", "Confused", "Frustrated"})
        negative_ratio = negative_count / len(state.emotion_history) if state.emotion_history else 0.0
        
        return {
            "emotionDuration": emotion_duration,
            "currentContinuousDuration": self._get_current_continuous_duration(state),
            "transitionRate": transition_rate,
            "stabilityScore": stability_score,
            "emotionCounts": dict(emotion_counts),
            "totalTransitions": state.transition_count,
            "engagementIndicators": {
                "engagementScore": engagement_score,
                "disengagementRatio": disengagement_ratio,
                "negativeEmotionRatio": negative_ratio
            },
            "timeline": state.timeline
        }

    def get_metrics(self, student_id: str) -> dict:
        state = self._get_or_create(student_id)
        return self._get_metrics_internal(state)
