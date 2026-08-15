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
    # Parallel to emotion_history, but records the RAW model label
    # (Normal/Happy/Bored/...) each frame arrived with, not the derived
    # student_state that predict_student_state() produced from it. Exists
    # so stability/transition/duration can be computed from the underlying
    # signal instead of the tracker's own past output - see
    # _get_raw_stability_score's docstring for why that distinction matters.
    raw_history: list[EmotionHistoryItem] = field(default_factory=list)
    # Last-5 raw labels, used ONLY to majority-vote-smooth what gets
    # appended to raw_history (see update()) - a single noisy/low-confidence
    # raw reading (e.g. one "Angry" blip at 0.51 confidence, surrounded by
    # "Normal" before and after) would otherwise break raw_history's
    # continuity check and silently reset a real, sustained Bored streak's
    # duration back to ~0 the moment the next frame arrived - diagnosed
    # from a real session where exactly this happened after 32s of
    # correctly-sustained Bored. Deliberately a PLAIN majority vote with no
    # high-confidence bypass (unlike raw_window below) - this window's only
    # job is noise tolerance for behavioral tracking, not responsiveness.
    raw_signal_window: list[str] = field(default_factory=list)
    transition_count: int = 0
    last_emotion: str | None = None
    start_time: float = field(default_factory=time.time)

    # Refactored/added fields:
    raw_window: list[str] = field(default_factory=list)
    timeline: list[dict[str, float | str | dict | int]] = field(default_factory=list)
    last_timeline_snapshot: float = 0.0
    # Grace-period bookkeeping for update() - a candidate that would change
    # the confirmed last_emotion must win the majority vote on 2
    # consecutive calls before it's adopted (see update() docstring).
    pending_emotion: str | None = None
    pending_count: int = 0
    # Independent of emotion_history, which now gets window-trimmed - this
    # must keep pointing at the true last update time even once the window
    # empties out, or get_all_students()'s "active"/"inactive" freshness
    # check falls back to session start time and looks permanently stale.
    last_seen_time: float = field(default_factory=time.time)
    # Face-validity tracking (mark_invalid) - separate from last_seen_time
    # (which now also advances on invalid frames, since the student IS
    # present and frames ARE arriving) and separate from last_emotion
    # (which previously just stayed frozen on the last successfully
    # classified value, misleadingly, whenever the camera couldn't see a
    # valid face - see mark_invalid's docstring).
    last_valid_time: float | None = None
    last_invalid_time: float | None = None
    last_invalid_reason: str | None = None
    # Streak-start tracking for _get_current_continuous_duration /
    # _get_raw_continuous_duration - deliberately tracked directly instead
    # of derived by walking back through emotion_history/raw_history,
    # because those lists are window-trimmed (see _trim_to_window). A streak
    # walk-back can only ever reach as far as the OLDEST entry still in the
    # window, so any real streak longer than window_seconds (60s) silently
    # hard-capped its own reported duration at ~60s the moment its true
    # start entry aged out of the window - diagnosed from a real session
    # showing a genuine ~90s+ Bored streak plateau at ~57-60s. Set to None
    # (unknown/broken) by mark_invalid() and re-armed by the next update()
    # regardless of window trimming, so streaks of any length are tracked
    # correctly and a no-face gap still correctly resets them (same
    # behaviour as the two duration bugs fixed earlier this session, now
    # achieved directly rather than via in-loop window-boundary guards).
    derived_streak_start_time: float | None = None
    raw_streak_start_time: float | None = None
    last_raw_emotion: str | None = None


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
        if state.raw_history and state.raw_history[0]["time"] < cutoff:
            state.raw_history = [item for item in state.raw_history if item["time"] >= cutoff]

    # A single frame this confident is trusted immediately, bypassing both
    # the majority vote and the grace period below - diagnosed from a real
    # session (session_logs/session_20260812_202742.csv) where a
    # 0.99-confidence Happy frame still displayed as "Confused" for 2 more
    # polls (~5s) because 5-frame plurality voting requires several
    # corroborating frames to override recent history.
    #
    # 0.6, not 0.95: replaying that same real session showed 22 of 27
    # frames fell in the 0.6-0.95 band - at 0.95 the grace period below
    # ended up gating almost every transition (including clearly-confident
    # ones), which just relocated the sticky-lag problem rather than fixing
    # it. 0.6 sits just below student_state.py's direct-mapping thresholds
    # (0.65/0.7 for Angry/Happy, 0.45-0.5 for the model's own
    # Bored/Confused/Frustrated classes) - readings confident enough for
    # that layer to trust outright are confident enough to skip the grace
    # period too; only genuinely marginal 0.35-0.6 readings still need it.
    HIGH_CONFIDENCE_BYPASS = 0.6

    def update(
        self,
        student_id: str,
        emotion: str,
        confidence: float | None = None,
        raw_emotion: str | None = None,
    ) -> str:
        """
        Applies temporal smoothing via majority voting window of 5, updates
        student state history, tracks transitions, and records timeline snapshots.

        `confidence` (the raw model confidence for THIS frame's `emotion`,
        optional for backward compatibility) gates two anti-flicker/anti-lag
        mechanisms on top of the majority vote:
          - >= HIGH_CONFIDENCE_BYPASS: adopt `emotion` immediately, skipping
            the vote entirely (fixes real lag observed on strong signals).
          - otherwise: a candidate that would CHANGE the currently-confirmed
            state must win the majority vote on 2 consecutive calls before
            being adopted (fixes a single noisy/ambiguous frame flipping the
            state - and resetting current_continuous_duration - on its own).

        `raw_emotion` (optional, e.g. "Normal"/"Bored"/"Happy" - the fused
        model's own label, BEFORE predict_student_state() turns it into
        `emotion`) is recorded separately into raw_history purely so
        _get_raw_stability_score/_get_raw_transition_rate/
        _get_raw_continuous_duration can describe the underlying signal's
        own behaviour - see those methods' docstrings for why that's a
        different, necessary thing from the emotion_history-based versions.

        Returns:
            The smoothed emotion.
        """
        state = self._get_or_create(student_id)
        current_time = time.time()
        state.last_seen_time = current_time
        state.last_valid_time = current_time
        self._trim_to_window(state, current_time)

        if raw_emotion is not None:
            state.raw_signal_window.append(raw_emotion)
            if len(state.raw_signal_window) > 5:
                state.raw_signal_window.pop(0)

            raw_counter = Counter(state.raw_signal_window)
            raw_most_common = raw_counter.most_common()
            raw_max_count = raw_most_common[0][1]
            raw_candidates = [e for e, c in raw_most_common if c == raw_max_count]

            if len(raw_candidates) == 1:
                smoothed_raw = raw_candidates[0]
            else:
                smoothed_raw = raw_emotion
                for item in reversed(state.raw_signal_window):
                    if item in raw_candidates:
                        smoothed_raw = item
                        break

            state.raw_history.append({"emotion": smoothed_raw, "time": current_time})

            if smoothed_raw != state.last_raw_emotion or state.raw_streak_start_time is None:
                state.raw_streak_start_time = current_time
            state.last_raw_emotion = smoothed_raw

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
            candidate = candidates[0]
        else:
            candidate = emotion
            for item in reversed(state.raw_window):
                if item in candidates:
                    candidate = item
                    break

        if confidence is not None and confidence >= self.HIGH_CONFIDENCE_BYPASS:
            smoothed_emotion = emotion
            state.pending_emotion = None
            state.pending_count = 0
        elif state.last_emotion is None or candidate == state.last_emotion:
            smoothed_emotion = candidate
            state.pending_emotion = None
            state.pending_count = 0
        else:
            if candidate == state.pending_emotion:
                state.pending_count += 1
            else:
                state.pending_emotion = candidate
                state.pending_count = 1

            if state.pending_count >= 2:
                smoothed_emotion = candidate
                state.pending_emotion = None
                state.pending_count = 0
            else:
                smoothed_emotion = state.last_emotion  # not confirmed yet - hold

        # 2. Update Smoothed History and transitions
        state.emotion_history.append({"emotion": smoothed_emotion, "time": current_time})

        if state.last_emotion is not None and smoothed_emotion != state.last_emotion:
            state.transition_count += 1

        if smoothed_emotion != state.last_emotion or state.derived_streak_start_time is None:
            state.derived_streak_start_time = current_time

        state.last_emotion = smoothed_emotion

        # 3. Timeline Buffering (record timeline snapshot every 5 seconds)
        if state.last_timeline_snapshot == 0.0:
            state.last_timeline_snapshot = current_time
            self._take_timeline_snapshot(state, smoothed_emotion, current_time)
        elif current_time - state.last_timeline_snapshot >= 5.0:
            self._take_timeline_snapshot(state, smoothed_emotion, current_time)
            state.last_timeline_snapshot = current_time

        return smoothed_emotion

    def mark_invalid(self, student_id: str, reason: str) -> None:
        """Records that this poll's frame arrived but failed the face-
        validity gate (occluded / looking away / no face detected at all)
        - deliberately does NOT touch emotion_history/last_emotion, so a
        student's real emotion trend isn't polluted by frames where no
        real classification happened.

        Still updates last_seen_time (the student IS present, SOME frame
        arrived) but NOT last_valid_time - this is what lets get_metrics()
        distinguish "camera's been off/tab closed for 15s" (last_seen_time
        stale) from "looking away/occluded right now, but still present"
        (last_seen_time fresh, last_valid_time stale) - previously neither
        was tracked for invalid frames at all, so the dashboard just kept
        showing whatever emotion was last successfully detected, at full
        opacity, with no indication anything had changed.

        Also breaks both streak trackers (derived_streak_start_time,
        raw_streak_start_time) - a gap means we don't know whether the
        emotion stayed the same throughout it, so neither streak can be
        verified to have continued past this point. The next update() call
        re-arms whichever streak resumes (see its None-check), regardless
        of what emotion resumes - a fresh streak, not a continuation."""
        state = self._get_or_create(student_id)
        current_time = time.time()
        state.last_seen_time = current_time
        state.last_invalid_time = current_time
        state.last_invalid_reason = reason
        state.derived_streak_start_time = None
        state.raw_streak_start_time = None

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
        """How long the derived (smoothed) emotion has held, via
        derived_streak_start_time - see that field's docstring on
        _StudentState for why this is tracked directly rather than derived
        by walking back through the (window-trimmed) emotion_history: a
        streak longer than window_seconds used to have its own start entry
        silently trimmed out of the window, hard-capping the reported
        duration at ~window_seconds no matter how much longer the streak
        actually continued - diagnosed from a real session showing a
        genuine ~90s+ Bored streak plateau at ~57-60s. mark_invalid()
        resets this to None on any no-face gap, so gap-handling (previously
        two separate bugs, fixed earlier this session) falls out of the
        same None-check for free."""
        if state.derived_streak_start_time is None:
            return 0.0
        return max(0.0, time.time() - state.derived_streak_start_time)

    def _get_transition_rate(self, state: _StudentState) -> float:
        """Transitions per second within the current window only - was
        previously state.transition_count / (now - state.start_time), a
        lifetime-average that kept diluting toward zero the longer a
        session ran, rather than reflecting recent behaviour. Recomputed
        from the (already window-trimmed) emotion_history rather than the
        incrementally-maintained lifetime transition_count, since that
        counter has no per-transition timestamps to filter by window."""
        return self._transition_rate(state, state.emotion_history)

    def _transition_rate(self, state: _StudentState, history: list[EmotionHistoryItem]) -> float:
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
        return self._stability_score(state.emotion_history)

    def _stability_score(self, history: list[EmotionHistoryItem]) -> float:
        if not history:
            return 0.0
        emotions = [str(item["emotion"]) for item in history]
        most_common_count = Counter(emotions).most_common(1)[0][1]
        return most_common_count / len(emotions)

    # --- Raw-signal-based variants -----------------------------------
    #
    # predict_student_state()'s Bored/Confused/Engaged behavioral fallback
    # exists to answer "has the underlying facial signal been flat/noisy/
    # calm over the last window" - but it was being fed stability/
    # transition/duration computed from emotion_history, which stores this
    # SAME tracker's own past smoothed output, not the raw model label.
    # That's a feedback loop: predict_student_state()'s own prior decisions
    # become the input to its next decision. Two real sessions showed the
    # consequence -
    #   1) a student reading raw="Normal" on ~27 of 28 frames still had
    #      emotion_history alternate Neutral/Engaged almost every poll
    #      (each Engaged verdict, once added to history, nudges the next
    #      stability/transition computation enough to flip back) - transition
    #      rate never dropped below Bored's 0.18 ceiling despite the raw
    #      signal being rock-stable, so Bored could never fire no matter how
    #      long the student was actually motionless.
    #   2) a single early raw="Bored" reading (real, direct-classified) was
    #      followed by 20 raw="Normal" readings - but that one entry, once
    #      in emotion_history, kept stability artificially low for the rest
    #      of the 60s window (Bored/Engaged/Neutral/Confused all mixed
    #      together with no majority), blocking Bored from ever being
    #      recognized even though the raw signal was overwhelmingly Normal
    #      for the following ~85 seconds.
    # Tracking a SEPARATE raw_history (the fused model's own label, before
    # predict_student_state touches it - see update()'s raw_emotion param)
    # and computing these same three metrics from THAT instead breaks the
    # loop: a one-off raw blip ages out of the window on its own timeline,
    # and a genuinely flat raw signal reads as low-transition/high-stability
    # immediately, regardless of how noisy the derived state has been.

    def _get_raw_continuous_duration(self, state: _StudentState) -> float:
        """See _get_current_continuous_duration's docstring - same direct
        streak-start-time tracking (raw_streak_start_time), same reasoning,
        applied to the raw-signal stream instead of the derived one."""
        if state.raw_streak_start_time is None:
            return 0.0
        return max(0.0, time.time() - state.raw_streak_start_time)

    def _get_raw_transition_rate(self, state: _StudentState) -> float:
        return self._transition_rate(state, state.raw_history)

    def _get_raw_stability_score(self, state: _StudentState) -> float:
        return self._stability_score(state.raw_history)

    def _face_detected(self, state: _StudentState) -> bool:
        """True unless the MOST RECENT event for this student was an
        invalid frame (mark_invalid) that hasn't since been superseded by
        a successful classification (update())."""
        if state.last_invalid_time is None:
            return True
        if state.last_valid_time is None:
            return False
        return state.last_valid_time >= state.last_invalid_time

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
            "faceDetected": self._face_detected(state),
            "invalidReason": state.last_invalid_reason if not self._face_detected(state) else None,
            # Raw-signal-based (see the "Raw-signal-based variants" section
            # above) - these, not the derived-state ones above, are what
            # flask_api.py now feeds into predict_student_state() for the
            # NEXT frame's decision, and what gets CSV-logged alongside it.
            "rawStabilityScore": self._get_raw_stability_score(state),
            "rawTransitionRate": self._get_raw_transition_rate(state),
            "rawContinuousDuration": self._get_raw_continuous_duration(state),
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
