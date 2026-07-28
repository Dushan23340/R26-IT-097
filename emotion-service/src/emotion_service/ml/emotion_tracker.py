from __future__ import annotations

import os
import time
from collections import Counter
from dataclasses import dataclass, field
from typing import TypedDict

# FR06: "engagement indicators [computed] within a configurable time
# window" - previously emotion_history grew unbounded for the tracker
# process's entire lifetime, so all the analytics below (duration,
# transition rate, stability, engagement score) silently drifted from
# "how is this student doing right now" toward "how have they done on
# average since the process started", which is a different (and less
# useful) statistic. 60s matches emotion-backend's own EmotionStore window
# (app/services/emotion_store.py) for consistency across the platform.
DEFAULT_WINDOW_SECONDS = float(os.getenv("EMOTION_ANALYTICS_WINDOW_SECONDS", "60"))


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
    # Independent of emotion_history, which now gets window-trimmed - this
    # must keep pointing at the true last update time even once the window
    # empties out, or get_all_students()'s "active"/"inactive" freshness
    # check falls back to session start time and looks permanently stale.
    last_seen_time: float = field(default_factory=time.time)


class EmotionTracker:
    def __init__(self, window_seconds: float = DEFAULT_WINDOW_SECONDS) -> None:
        self._students: dict[str, _StudentState] = {}
        self.window_seconds = window_seconds

    def _get_or_create(self, student_id: str) -> _StudentState:
        key = student_id or "default_student"
        if key not in self._students:
            self._students[key] = _StudentState()
        return self._students[key]

    def _trim_to_window(self, state: _StudentState, now: float) -> None:
        """Drops emotion_history entries older than window_seconds so every
        analytic derived from it (duration, transition rate, stability,
        engagement score, disengagement/negative ratios) reflects only the
        current window - not the whole session. Called both on every
        update() and lazily on read, so a student who's gone quiet (no new
        frames) still sees their windowed stats decay/reset rather than
        staying frozen on old data. state.timeline is untouched - FR07's
        chronological timeline is deliberately a full-session record, a
        separate requirement from FR06's windowed engagement indicators."""
        cutoff = now - self.window_seconds
        if state.emotion_history and state.emotion_history[0]["time"] < cutoff:
            state.emotion_history = [item for item in state.emotion_history if item["time"] >= cutoff]

    def update(self, student_id: str, emotion: str) -> str:
        """
        Applies temporal smoothing via majority voting window of 5, updates
        student state history, tracks transitions, and records timeline snapshots.
        
        Returns:
            The smoothed emotion.
        """
        state = self._get_or_create(student_id)
        current_time = time.time()
        state.last_seen_time = current_time
        self._trim_to_window(state, current_time)

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
        """Transitions per second within the current window only - was
        previously state.transition_count / (now - state.start_time), a
        lifetime-average that kept diluting toward zero the longer a
        session ran, rather than reflecting recent behaviour. Recomputed
        from the (already window-trimmed) emotion_history rather than the
        incrementally-maintained lifetime transition_count, since that
        counter has no per-transition timestamps to filter by window."""
        history = state.emotion_history
        if len(history) < 2:
            return 0.0
        windowed_transitions = sum(
            1 for i in range(1, len(history)) if history[i]["emotion"] != history[i - 1]["emotion"]
        )
        span = min(self.window_seconds, time.time() - state.start_time)
        if span <= 0:
            return 0.0
        return windowed_transitions / span

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
            "currentEmotion": state.last_emotion or "Neutral",
            "engagementIndicators": {
                "engagementScore": engagement_score,
                "disengagementRatio": disengagement_ratio,
                "negativeEmotionRatio": negative_ratio
            },
            # FR06: all of the above (except totalTransitions, a deliberate
            # lifetime counter) are computed over this many trailing
            # seconds, not the whole session - see _trim_to_window.
            "analyticsWindowSeconds": self.window_seconds,
            "timeline": state.timeline
        }

    def get_metrics(self, student_id: str) -> dict:
        state = self._get_or_create(student_id)
        # Trimmed here too (not just in update()) so a student who's gone
        # quiet shows decayed/reset windowed stats on the next poll, rather
        # than staying frozen on whatever was last computed while active.
        self._trim_to_window(state, time.time())
        return self._get_metrics_internal(state)

    def get_all_students(self) -> dict[str, dict]:
        """Real-time snapshot for every student currently being tracked.

        Exists so a dashboard (ours or a teammate's analytics service) can
        pull actual per-student state instead of mock data - this process
        only holds tracker state in memory, so this is a live view, not a
        persisted history.
        """
        for state in self._students.values():
            self._trim_to_window(state, time.time())
        return {
            student_id: {
                **self._get_metrics_internal(state),
                "lastSeenTimestamp": state.last_seen_time,
            }
            for student_id, state in self._students.items()
        }
