"""
Pytest unit-test suite for the ERSE Suggestion Engine.

Tests cover:
  - StudentStateVector construction and serialisation
  - SignalAggregator — graceful failure handling
  - PatternClassifier — all 8 patterns + priority ordering
  - PatternClassifier — insufficient data guard
  - PatternClassifier — confidence scoring
  - EvidenceBuilder — max 3 items, weight ordering, None skipping
  - SuggestionEngine — full pipeline orchestration

Run:
    cd analytics-service
    python -m pytest tests/test_suggestion_engine.py -v
"""

import json
import sys
from dataclasses import asdict
from pathlib import Path
from unittest.mock import MagicMock, patch

import numpy as np
import pytest

# Ensure analytics-service root is on sys.path
_service_root = str(Path(__file__).resolve().parents[1])
if _service_root not in sys.path:
    sys.path.insert(0, _service_root)

from services.suggestion_engine import (
    EvidenceBuilder,
    EvidenceItem,
    PatternClassifier,
    PatternResult,
    SignalAggregator,
    StudentStateVector,
    SuggestionEngine,
    SuggestionPayload,
    PATTERN_DECLINING_ACHIEVER,
    PATTERN_EMOTIONALLY_BLOCKED,
    PATTERN_EMOTIONALLY_DISENGAGED,
    PATTERN_HIGH_POTENTIAL,
    PATTERN_INCONSISTENT_PERFORMER,
    PATTERN_INSUFFICIENT_DATA,
    PATTERN_PLATEAUED_LEARNER,
    PATTERN_RECOVERING_LEARNER,
    PATTERN_STEADY_PERFORMER,
    MIN_SESSIONS_REQUIRED,
)


# ==================================================================
# Helpers — build state vectors for specific patterns
# ==================================================================

def _base_vector(student_id: str = "TEST_STU", num_sessions: int = 10) -> StudentStateVector:
    """Return a minimal state vector with safe defaults."""
    return StudentStateVector(
        student_id=student_id,
        num_sessions=num_sessions,
        trend_direction="stable",
        trend_slope=0.1,
        trend_p_value=0.5,
        trend_significant=False,
        trend_r_squared=0.01,
        historical_trend="stable",
        stability_sd=5.0,
        stability_cv=8.0,
        stability_level="stable",
        at_risk_flag=False,
        dominant_emotion="neutral",
        strongest_emotion_r=0.1,
        strongest_emotion_name="neutral",
        emotion_impact="neutral",
        significant_negative_emotions=[],
        engagement_level="high",
        engagement_significant=False,
        engagement_effect_size=0.2,
        mean_engagement_score=0.65,
    )


def _declining_achiever_vector() -> StudentStateVector:
    v = _base_vector()
    v.trend_direction   = "declining"
    v.trend_slope       = -2.5
    v.trend_p_value     = 0.02
    v.trend_significant = True
    return v


def _emotionally_blocked_vector() -> StudentStateVector:
    v = _base_vector()
    v.trend_direction           = "declining"
    v.trend_slope               = -1.5
    v.trend_p_value             = 0.08
    v.trend_significant         = False
    v.emotion_impact            = "negative"
    v.strongest_emotion_r       = -0.65
    v.strongest_emotion_name    = "confused"
    return v


def _inconsistent_performer_vector() -> StudentStateVector:
    v = _base_vector()
    v.at_risk_flag      = True
    v.stability_level   = "unstable"
    v.stability_sd      = 18.0
    v.stability_cv      = 32.0
    return v


def _emotionally_disengaged_vector() -> StudentStateVector:
    v = _base_vector()
    v.dominant_emotion  = "bored"
    v.engagement_level  = "low"
    v.mean_engagement_score = 0.3
    return v


def _high_potential_vector() -> StudentStateVector:
    v = _base_vector()
    v.engagement_level      = "high"
    v.engagement_significant = True
    v.trend_direction       = "stable"
    return v


def _plateaued_learner_vector() -> StudentStateVector:
    v = _base_vector()
    v.trend_direction   = "stable"
    v.stability_level   = "stable"
    v.engagement_level  = "low"
    return v


def _recovering_learner_vector() -> StudentStateVector:
    v = _base_vector()
    v.trend_direction   = "improving"
    v.historical_trend  = "declining"
    return v


def _steady_performer_vector() -> StudentStateVector:
    v = _base_vector()
    v.trend_direction   = "stable"
    v.stability_level   = "stable"
    v.engagement_level  = "high"
    return v


# ==================================================================
# Tests — StudentStateVector
# ==================================================================

class TestStudentStateVector:
    """StudentStateVector construction and serialisation."""

    def test_default_fields_are_insufficient_data(self):
        """Uninitialised fields default to 'insufficient_data' strings."""
        v = StudentStateVector(student_id="STU_X", num_sessions=0)
        assert v.trend_direction == "insufficient_data"
        assert v.stability_level == "insufficient_data"
        assert v.engagement_level == "insufficient_data"
        assert v.emotion_impact == "insufficient_data"

    def test_to_dict_returns_plain_dict(self):
        """to_dict() returns a plain dict with no dataclass metadata."""
        v = _base_vector()
        result = v.to_dict()
        assert isinstance(result, dict)
        assert result["student_id"] == "TEST_STU"
        assert result["num_sessions"] == 10

    def test_to_dict_is_json_serialisable(self):
        """to_dict() output must serialise to JSON without errors."""
        v = _declining_achiever_vector()
        result = v.to_dict()
        serialised = json.dumps(result)
        assert isinstance(serialised, str)

    def test_to_dict_contains_all_fields(self):
        """to_dict() must include every field defined on the dataclass."""
        v = _base_vector()
        result = v.to_dict()
        expected_keys = {
            "student_id", "num_sessions",
            "trend_direction", "trend_slope", "trend_p_value",
            "trend_significant", "trend_r_squared", "historical_trend",
            "stability_sd", "stability_cv", "stability_level", "at_risk_flag",
            "dominant_emotion", "strongest_emotion_r", "strongest_emotion_name",
            "emotion_impact", "significant_negative_emotions",
            "engagement_level", "engagement_significant",
            "engagement_effect_size", "mean_engagement_score",
        }
        assert expected_keys.issubset(set(result.keys()))


# ==================================================================
# Tests — SignalAggregator
# ==================================================================

class TestSignalAggregator:
    """SignalAggregator — graceful failure and output validation."""

    def test_aggregate_returns_state_vector(self, sample_student_id):
        """aggregate() returns a StudentStateVector for a real student."""
        aggregator = SignalAggregator(sample_student_id)
        result = aggregator.aggregate()
        assert isinstance(result, StudentStateVector)
        assert result.student_id == sample_student_id

    def test_aggregate_populates_num_sessions(self, sample_student_id):
        """aggregate() sets num_sessions > 0 for a student with sessions."""
        aggregator = SignalAggregator(sample_student_id)
        result = aggregator.aggregate()
        assert result.num_sessions > 0

    def test_aggregate_handles_trend_analyzer_failure(self, sample_student_id):
        """If TrendAnalyzer raises, other signals still populate."""
        aggregator = SignalAggregator(sample_student_id)
        with patch.object(aggregator, "_apply_trend", side_effect=Exception("mock failure")):
            # Should not raise — failure is caught internally
            result = aggregator.aggregate()
        assert isinstance(result, StudentStateVector)

    def test_aggregate_handles_all_analyzers_failing(self):
        """If all analyzers fail, returns vector with safe defaults."""
        aggregator = SignalAggregator("NONEXISTENT_STU")
        result = aggregator.aggregate()
        assert isinstance(result, StudentStateVector)
        assert result.student_id == "NONEXISTENT_STU"

    def test_historical_trend_insufficient_with_few_sessions(self):
        """historical_trend = insufficient_data when < 6 sessions available."""
        aggregator = SignalAggregator("NONEXISTENT_STU")
        vector = StudentStateVector(student_id="NONEXISTENT_STU", num_sessions=4)

        mock_analyzer = MagicMock()
        mock_analyzer.fetch_lo_timeseries.return_value = (
            np.array([1.0, 2.0, 3.0, 4.0]),
            np.array([70.0, 72.0, 68.0, 74.0]),
        )
        result = aggregator._fetch_historical_trend(mock_analyzer)
        assert result == "insufficient_data"

    def test_to_dict_no_numpy_types(self, sample_student_id):
        """to_dict() output must not contain numpy scalar types."""
        aggregator = SignalAggregator(sample_student_id)
        result = aggregator.aggregate().to_dict()
        for key, val in result.items():
            assert not isinstance(val, (np.integer, np.floating, np.bool_)), \
                f"Field '{key}' contains numpy type {type(val)}"


# ==================================================================
# Tests — PatternClassifier (all 8 patterns)
# ==================================================================

class TestPatternClassifier:
    """PatternClassifier — correct pattern assigned for each trigger condition."""

    def test_declining_achiever(self):
        """Declining + significant trend → Declining Achiever (Priority 1)."""
        result = PatternClassifier(_declining_achiever_vector()).classify()
        assert result.pattern_name == PATTERN_DECLINING_ACHIEVER
        assert result.priority == 1
        assert result.urgency == "Immediate"

    def test_emotionally_blocked(self):
        """Negative emotion correlation + declining trend → Emotionally Blocked."""
        result = PatternClassifier(_emotionally_blocked_vector()).classify()
        assert result.pattern_name == PATTERN_EMOTIONALLY_BLOCKED
        assert result.priority == 2
        assert result.urgency == "Immediate"

    def test_inconsistent_performer(self):
        """at_risk_flag + unstable stability → Inconsistent Performer."""
        result = PatternClassifier(_inconsistent_performer_vector()).classify()
        assert result.pattern_name == PATTERN_INCONSISTENT_PERFORMER
        assert result.priority == 3
        assert result.urgency == "Monitor"

    def test_emotionally_disengaged(self):
        """Negative dominant emotion + low engagement → Emotionally Disengaged."""
        result = PatternClassifier(_emotionally_disengaged_vector()).classify()
        assert result.pattern_name == PATTERN_EMOTIONALLY_DISENGAGED
        assert result.priority == 4
        assert result.urgency == "Monitor"

    def test_high_potential_underachiever(self):
        """High engagement + significant effect + stable trend → High Potential."""
        result = PatternClassifier(_high_potential_vector()).classify()
        assert result.pattern_name == PATTERN_HIGH_POTENTIAL
        assert result.priority == 5
        assert result.urgency == "Monitor"

    def test_plateaued_learner(self):
        """Stable trend + stable stability + low engagement → Plateaued."""
        result = PatternClassifier(_plateaued_learner_vector()).classify()
        assert result.pattern_name == PATTERN_PLATEAUED_LEARNER
        assert result.priority == 6
        assert result.urgency == "Routine"

    def test_recovering_learner(self):
        """Improving now + historically declining → Recovering Learner."""
        result = PatternClassifier(_recovering_learner_vector()).classify()
        assert result.pattern_name == PATTERN_RECOVERING_LEARNER
        assert result.priority == 7
        assert result.urgency == "Routine"

    def test_steady_performer(self):
        """Stable/improving + stable + high engagement → Steady Performer."""
        result = PatternClassifier(_steady_performer_vector()).classify()
        assert result.pattern_name == PATTERN_STEADY_PERFORMER
        assert result.priority == 8
        assert result.urgency == "Routine"

    def test_insufficient_data_when_few_sessions(self):
        """num_sessions < MIN_SESSIONS_REQUIRED → Insufficient Data."""
        v = _base_vector(num_sessions=MIN_SESSIONS_REQUIRED - 1)
        result = PatternClassifier(v).classify()
        assert result.pattern_name == PATTERN_INSUFFICIENT_DATA
        assert result.priority == 0

    def test_priority_1_beats_priority_3(self):
        """Vector matching both Priority 1 and Priority 3 → Priority 1 returned."""
        v = _declining_achiever_vector()
        v.at_risk_flag    = True   # Priority 3 condition
        v.stability_level = "unstable"
        result = PatternClassifier(v).classify()
        assert result.pattern_name == PATTERN_DECLINING_ACHIEVER

    def test_priority_2_beats_priority_3(self):
        """Vector matching both Priority 2 and Priority 3 → Priority 2 returned."""
        v = _emotionally_blocked_vector()
        v.at_risk_flag    = True
        v.stability_level = "unstable"
        result = PatternClassifier(v).classify()
        assert result.pattern_name == PATTERN_EMOTIONALLY_BLOCKED

    def test_confidence_high_for_full_signals(self):
        """Pattern with all possible signals matched → confidence_label High."""
        v = _declining_achiever_vector()
        v.at_risk_flag      = True
        v.engagement_level  = "low"
        result = PatternClassifier(v).classify()
        assert result.confidence_label == "High"

    def test_confidence_low_for_single_signal(self):
        """Pattern with only 1 of 3 signals matched → confidence_label Low."""
        v = _declining_achiever_vector()
        # Only trend signal — no at_risk or low engagement
        result = PatternClassifier(v).classify()
        assert result.confidence_label == "Low"

    def test_result_is_pattern_result_type(self):
        """classify() always returns a PatternResult instance."""
        result = PatternClassifier(_base_vector()).classify()
        assert isinstance(result, PatternResult)

    def test_matched_signals_is_list(self):
        """matched_signals is always a list."""
        result = PatternClassifier(_declining_achiever_vector()).classify()
        assert isinstance(result.matched_signals, list)
        assert len(result.matched_signals) >= 1

    def test_confidence_score_in_range(self):
        """confidence_score is always between 0 and 1 inclusive."""
        for vector_fn in [
            _declining_achiever_vector, _emotionally_blocked_vector,
            _inconsistent_performer_vector, _emotionally_disengaged_vector,
            _high_potential_vector, _plateaued_learner_vector,
            _recovering_learner_vector, _steady_performer_vector,
        ]:
            result = PatternClassifier(vector_fn()).classify()
            assert 0.0 <= result.confidence_score <= 1.0, \
                f"confidence_score out of range for {result.pattern_name}"


# ==================================================================
# Tests — EvidenceBuilder
# ==================================================================

class TestEvidenceBuilder:
    """EvidenceBuilder — item count, weight ordering, None skipping."""

    def test_never_exceeds_max_items(self):
        """build() returns at most 3 evidence items regardless of signals."""
        v       = _declining_achiever_vector()
        pattern = PatternClassifier(v).classify()
        items   = EvidenceBuilder(v, pattern).build()
        assert len(items) <= 3

    def test_sorted_by_weight_descending(self):
        """Evidence items are ordered by weight descending."""
        v       = _declining_achiever_vector()
        pattern = PatternClassifier(v).classify()
        items   = EvidenceBuilder(v, pattern).build()
        if len(items) >= 2:
            for i in range(len(items) - 1):
                assert items[i].weight >= items[i + 1].weight, \
                    "Evidence items are not sorted by weight descending"

    def test_skips_none_trend_slope(self):
        """If trend_slope is None, no trend evidence item is included."""
        v           = _base_vector()
        v.trend_slope = None
        pattern     = PatternClassifier(v).classify()
        items       = EvidenceBuilder(v, pattern).build()
        signals     = [item.signal for item in items]
        assert "trend" not in signals

    def test_skips_none_stability_sd(self):
        """If stability_sd is None, no stability evidence item is included."""
        v               = _base_vector()
        v.stability_sd  = None
        pattern         = PatternClassifier(v).classify()
        items           = EvidenceBuilder(v, pattern).build()
        signals         = [item.signal for item in items]
        assert "stability" not in signals

    def test_skips_none_emotion_r(self):
        """If strongest_emotion_r is None, no emotion evidence item is included."""
        v                       = _base_vector()
        v.strongest_emotion_r   = None
        pattern                 = PatternClassifier(v).classify()
        items                   = EvidenceBuilder(v, pattern).build()
        signals                 = [item.signal for item in items]
        assert "emotion" not in signals

    def test_skips_none_engagement_score(self):
        """If mean_engagement_score is None, no engagement evidence item included."""
        v                       = _base_vector()
        v.mean_engagement_score = None
        pattern                 = PatternClassifier(v).classify()
        items                   = EvidenceBuilder(v, pattern).build()
        signals                 = [item.signal for item in items]
        assert "engagement" not in signals

    def test_returns_list_of_evidence_items(self):
        """build() always returns a list of EvidenceItem objects."""
        v       = _declining_achiever_vector()
        pattern = PatternClassifier(v).classify()
        items   = EvidenceBuilder(v, pattern).build()
        assert isinstance(items, list)
        for item in items:
            assert isinstance(item, EvidenceItem)

    def test_evidence_item_to_dict_is_json_serialisable(self):
        """EvidenceItem.to_dict() output serialises to JSON cleanly."""
        v       = _declining_achiever_vector()
        pattern = PatternClassifier(v).classify()
        items   = EvidenceBuilder(v, pattern).build()
        for item in items:
            serialised = json.dumps(item.to_dict())
            assert isinstance(serialised, str)

    def test_declining_achiever_includes_trend_evidence(self):
        """Declining Achiever pattern always includes trend evidence."""
        v       = _declining_achiever_vector()
        pattern = PatternClassifier(v).classify()
        items   = EvidenceBuilder(v, pattern).build()
        signals = [item.signal for item in items]
        assert "trend" in signals

    def test_weight_is_float_in_range(self):
        """All evidence item weights are floats between 0 and 1."""
        v       = _declining_achiever_vector()
        pattern = PatternClassifier(v).classify()
        items   = EvidenceBuilder(v, pattern).build()
        for item in items:
            assert isinstance(item.weight, float)
            assert 0.0 <= item.weight <= 1.0


# ==================================================================
# Tests — SuggestionEngine (full pipeline)
# ==================================================================

class TestSuggestionEngine:
    """SuggestionEngine — full pipeline orchestration."""

    def test_run_returns_suggestion_payload(self, sample_student_id):
        """run() returns a SuggestionPayload for a real student."""
        payload = SuggestionEngine(sample_student_id).run()
        assert isinstance(payload, SuggestionPayload)

    def test_run_populates_student_id(self, sample_student_id):
        """SuggestionPayload.student_id matches the input."""
        payload = SuggestionEngine(sample_student_id).run()
        assert payload.student_id == sample_student_id

    def test_run_returns_valid_pattern(self, sample_student_id):
        """Pattern name is one of the 9 known pattern constants."""
        valid_patterns = {
            PATTERN_DECLINING_ACHIEVER, PATTERN_EMOTIONALLY_BLOCKED,
            PATTERN_INCONSISTENT_PERFORMER, PATTERN_EMOTIONALLY_DISENGAGED,
            PATTERN_HIGH_POTENTIAL, PATTERN_PLATEAUED_LEARNER,
            PATTERN_RECOVERING_LEARNER, PATTERN_STEADY_PERFORMER,
            PATTERN_INSUFFICIENT_DATA,
        }
        payload = SuggestionEngine(sample_student_id).run()
        assert payload.pattern.pattern_name in valid_patterns

    def test_run_evidence_is_list(self, sample_student_id):
        """payload.evidence is a list."""
        payload = SuggestionEngine(sample_student_id).run()
        assert isinstance(payload.evidence, list)

    def test_run_evidence_max_3_items(self, sample_student_id):
        """payload.evidence contains at most 3 items."""
        payload = SuggestionEngine(sample_student_id).run()
        assert len(payload.evidence) <= 3

    def test_run_state_vector_serialisable(self, sample_student_id):
        """state_vector.to_dict() produces valid JSON."""
        payload = SuggestionEngine(sample_student_id).run()
        serialised = json.dumps(payload.state_vector.to_dict())
        assert isinstance(serialised, str)

    def test_run_all_20_students_no_exception(self, db_student_ids):
        """SuggestionEngine.run() completes without exception for all students."""
        for student_id in db_student_ids:
            payload = SuggestionEngine(student_id).run()
            assert isinstance(payload, SuggestionPayload), \
                f"Expected SuggestionPayload for {student_id}"

    def test_run_nonexistent_student_returns_payload(self):
        """run() returns Insufficient Data payload for unknown student_id."""
        payload = SuggestionEngine("NONEXISTENT_XYZ").run()
        assert isinstance(payload, SuggestionPayload)
        assert payload.pattern.pattern_name == PATTERN_INSUFFICIENT_DATA