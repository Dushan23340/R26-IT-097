"""
Pytest unit-test suite for the ERSE Suggestion Generator.

Tests cover:
  - FallbackGenerator — distinct text per pattern
  - FallbackGenerator — all required fields present
  - FallbackGenerator — llm_used=False, llm_model='fallback'
  - SuggestionGenerator — uses fallback when API key not set
  - SuggestionGenerator — uses fallback when LLM returns invalid JSON
  - SuggestionGenerator — uses fallback after max retries exhausted
  - PromptBuilder — prompt contains pattern and evidence data

Run:
    cd analytics-service
    python -m pytest tests/test_suggestion_generator.py -v
"""

import json
import os
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Ensure analytics-service root is on sys.path
_service_root = str(Path(__file__).resolve().parents[1])
if _service_root not in sys.path:
    sys.path.insert(0, _service_root)

from services.suggestion_engine import (
    EvidenceItem,
    PatternResult,
    StudentStateVector,
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
)
from services.suggestion_generator import (
    FallbackGenerator,
    GeneratedSuggestion,
    PromptBuilder,
    SuggestionGenerator,
)


# ==================================================================
# Helpers
# ==================================================================

ALL_PATTERNS = [
    PATTERN_DECLINING_ACHIEVER,
    PATTERN_EMOTIONALLY_BLOCKED,
    PATTERN_INCONSISTENT_PERFORMER,
    PATTERN_EMOTIONALLY_DISENGAGED,
    PATTERN_HIGH_POTENTIAL,
    PATTERN_PLATEAUED_LEARNER,
    PATTERN_RECOVERING_LEARNER,
    PATTERN_STEADY_PERFORMER,
    PATTERN_INSUFFICIENT_DATA,
]


def _make_payload(pattern_name: str, priority: int = 1) -> SuggestionPayload:
    """Build a minimal SuggestionPayload for a given pattern name."""
    vector = StudentStateVector(
        student_id="TEST_STU",
        num_sessions=10,
        trend_direction="declining",
        trend_slope=-1.5,
        trend_p_value=0.03,
        trend_significant=True,
        trend_r_squared=0.45,
        historical_trend="stable",
        stability_sd=7.5,
        stability_cv=11.0,
        stability_level="stable",
        at_risk_flag=False,
        dominant_emotion="bored",
        strongest_emotion_r=-0.55,
        strongest_emotion_name="bored",
        emotion_impact="negative",
        significant_negative_emotions=["bored"],
        engagement_level="high",
        engagement_significant=False,
        engagement_effect_size=0.3,
        mean_engagement_score=0.65,
    )

    pattern = PatternResult(
        pattern_name=pattern_name,
        priority=priority,
        confidence_score=0.67,
        confidence_label="Medium",
        urgency="Monitor",
        matched_signals=["Test signal one", "Test signal two"],
    )

    evidence = [
        EvidenceItem(
            signal="trend",
            label="Declining LO Trend",
            value=-1.5,
            unit="pts/session",
            detail="Linear regression: slope = -1.5 pts/session (p = 0.03).",
            weight=0.9,
        ),
        EvidenceItem(
            signal="emotion",
            label="Emotion-LO Correlation (bored)",
            value=-0.55,
            unit="Pearson r",
            detail="Pearson r = -0.55 for 'bored'.",
            weight=0.7,
        ),
    ]

    return SuggestionPayload(
        student_id="TEST_STU",
        state_vector=vector,
        pattern=pattern,
        evidence=evidence,
    )


# ==================================================================
# Tests — FallbackGenerator
# ==================================================================

class TestFallbackGenerator:
    """FallbackGenerator — quality, distinctness, and structure."""

    def test_returns_generated_suggestion_type(self):
        """generate() returns a GeneratedSuggestion instance."""
        payload = _make_payload(PATTERN_DECLINING_ACHIEVER)
        result  = FallbackGenerator(payload).generate()
        assert isinstance(result, GeneratedSuggestion)

    def test_llm_used_is_false(self):
        """FallbackGenerator always sets llm_used=False."""
        payload = _make_payload(PATTERN_DECLINING_ACHIEVER)
        result  = FallbackGenerator(payload).generate()
        assert result.llm_used is False

    def test_llm_model_is_fallback(self):
        """FallbackGenerator always sets llm_model='fallback'."""
        payload = _make_payload(PATTERN_DECLINING_ACHIEVER)
        result  = FallbackGenerator(payload).generate()
        assert result.llm_model == "fallback"

    def test_all_three_fields_non_empty(self):
        """teacher_suggestion, student_suggestion, expected_outcome are non-empty."""
        for pattern in ALL_PATTERNS:
            payload = _make_payload(pattern)
            result  = FallbackGenerator(payload).generate()
            assert result.teacher_suggestion.strip(), \
                f"teacher_suggestion empty for {pattern}"
            assert result.student_suggestion.strip(), \
                f"student_suggestion empty for {pattern}"
            assert result.expected_outcome.strip(), \
                f"expected_outcome empty for {pattern}"

    def test_distinct_teacher_text_per_pattern(self):
        """Each pattern produces distinct teacher_suggestion text."""
        texts = set()
        for pattern in ALL_PATTERNS:
            payload = _make_payload(pattern)
            result  = FallbackGenerator(payload).generate()
            texts.add(result.teacher_suggestion)
        assert len(texts) == len(ALL_PATTERNS), \
            "Some patterns share identical teacher_suggestion text"

    def test_distinct_student_text_per_pattern(self):
        """Each pattern produces distinct student_suggestion text."""
        texts = set()
        for pattern in ALL_PATTERNS:
            payload = _make_payload(pattern)
            result  = FallbackGenerator(payload).generate()
            texts.add(result.student_suggestion)
        assert len(texts) == len(ALL_PATTERNS), \
            "Some patterns share identical student_suggestion text"

    def test_teacher_text_references_stats(self):
        """Teacher suggestion for Declining Achiever references statistical values."""
        payload = _make_payload(PATTERN_DECLINING_ACHIEVER)
        result  = FallbackGenerator(payload).generate()
        # Should mention the slope value from state_vector
        assert "-1.67" in result.teacher_suggestion or \
               "declining" in result.teacher_suggestion.lower() or \
               "slope" in result.teacher_suggestion.lower() or \
               "trend" in result.teacher_suggestion.lower()

    def test_student_text_has_no_statistical_numbers(self):
        """Student suggestion should not contain raw p-values or slope numbers."""
        for pattern in ALL_PATTERNS:
            payload = _make_payload(pattern)
            result  = FallbackGenerator(payload).generate()
            # Student text should not contain p= or r= notation
            assert "p = " not in result.student_suggestion, \
                f"p-value found in student_suggestion for {pattern}"
            assert "slope" not in result.student_suggestion.lower(), \
                f"'slope' found in student_suggestion for {pattern}"

    def test_insufficient_data_pattern_handled(self):
        """PATTERN_INSUFFICIENT_DATA produces a valid fallback response."""
        payload = _make_payload(PATTERN_INSUFFICIENT_DATA, priority=0)
        result  = FallbackGenerator(payload).generate()
        assert result.teacher_suggestion.strip()
        assert result.student_suggestion.strip()
        assert result.expected_outcome.strip()


# ==================================================================
# Tests — PromptBuilder
# ==================================================================

class TestPromptBuilder:
    """PromptBuilder — prompt content and structure."""

    def test_system_prompt_is_non_empty(self):
        """SYSTEM_PROMPT class variable is a non-empty string."""
        assert isinstance(PromptBuilder.SYSTEM_PROMPT, str)
        assert len(PromptBuilder.SYSTEM_PROMPT) > 50

    def test_system_prompt_requests_json(self):
        """SYSTEM_PROMPT instructs the LLM to respond with JSON only."""
        assert "JSON" in PromptBuilder.SYSTEM_PROMPT

    def test_user_prompt_contains_pattern_name(self):
        """build_user_prompt() includes the pattern name."""
        payload = _make_payload(PATTERN_DECLINING_ACHIEVER)
        prompt  = PromptBuilder(payload).build_user_prompt()
        assert PATTERN_DECLINING_ACHIEVER in prompt

    def test_user_prompt_contains_evidence_label(self):
        """build_user_prompt() includes evidence item labels."""
        payload = _make_payload(PATTERN_DECLINING_ACHIEVER)
        prompt  = PromptBuilder(payload).build_user_prompt()
        assert "Declining LO Trend" in prompt

    def test_user_prompt_contains_num_sessions(self):
        """build_user_prompt() includes the session count."""
        payload = _make_payload(PATTERN_DECLINING_ACHIEVER)
        prompt  = PromptBuilder(payload).build_user_prompt()
        assert "10" in prompt

    def test_user_prompt_contains_confidence(self):
        """build_user_prompt() includes confidence label."""
        payload = _make_payload(PATTERN_DECLINING_ACHIEVER)
        prompt  = PromptBuilder(payload).build_user_prompt()
        assert "Medium" in prompt

    def test_user_prompt_is_string(self):
        """build_user_prompt() returns a string."""
        payload = _make_payload(PATTERN_DECLINING_ACHIEVER)
        prompt  = PromptBuilder(payload).build_user_prompt()
        assert isinstance(prompt, str)
        assert len(prompt) > 100


# ==================================================================
# Tests — SuggestionGenerator
# ==================================================================

class TestSuggestionGenerator:
    """SuggestionGenerator — fallback activation and LLM failure handling."""

    def test_fallback_when_no_api_key(self):
        """No ANTHROPIC_API_KEY → llm_used=False, fallback text returned."""
        payload = _make_payload(PATTERN_DECLINING_ACHIEVER)
        with patch.dict(os.environ, {}, clear=True):
            # Ensure key is absent
            os.environ.pop("ANTHROPIC_API_KEY", None)
            generator = SuggestionGenerator(payload)
            result    = generator.generate()
        assert result.llm_used is False
        assert result.llm_model == "fallback"
        assert result.teacher_suggestion.strip()

    def test_fallback_when_json_missing_key(self):
        """LLM returns JSON without 'expected_outcome' → fallback used."""
        payload      = _make_payload(PATTERN_DECLINING_ACHIEVER)
        invalid_json = json.dumps({
            "teacher_suggestion": "Some teacher text.",
            "student_suggestion": "Some student text.",
            # expected_outcome deliberately omitted
        })

        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.content = [MagicMock(text=invalid_json)]
        mock_client.messages.create.return_value = mock_response

        generator = SuggestionGenerator(payload)
        generator._client = mock_client
        result = generator.generate()

        assert result.llm_used is False
        assert result.llm_model == "fallback"

    def test_fallback_when_llm_returns_invalid_json(self):
        """LLM returns non-JSON text → fallback used."""
        payload      = _make_payload(PATTERN_DECLINING_ACHIEVER)
        invalid_text = "Sorry I cannot help with that."

        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.content = [MagicMock(text=invalid_text)]
        mock_client.messages.create.return_value = mock_response

        generator         = SuggestionGenerator(payload)
        generator._client = mock_client
        result            = generator.generate()

        assert result.llm_used is False

    def test_fallback_when_all_retries_exhausted(self):
        """RateLimitError on every attempt → fallback after max retries."""
        import anthropic
        payload = _make_payload(PATTERN_DECLINING_ACHIEVER)

        mock_client = MagicMock()
        mock_client.messages.create.side_effect = anthropic.RateLimitError(
            message="rate limit", response=MagicMock(), body={}
        )

        generator         = SuggestionGenerator(payload)
        generator._client = mock_client

        with patch("services.suggestion_generator.time.sleep"):
            result = generator.generate()

        assert result.llm_used is False
        assert result.llm_model == "fallback"
        # Verify it retried the configured number of times
        assert mock_client.messages.create.call_count == 3

    def test_successful_llm_response(self):
        """Valid LLM JSON response → llm_used=True, correct fields returned."""
        payload = _make_payload(PATTERN_DECLINING_ACHIEVER)
        valid_response = json.dumps({
            "teacher_suggestion": "Schedule a review session immediately.",
            "student_suggestion": "Your teacher is here to help you.",
            "expected_outcome":   "LO scores stabilise within 3 sessions.",
        })

        mock_client   = MagicMock()
        mock_response = MagicMock()
        mock_response.content = [MagicMock(text=valid_response)]
        mock_client.messages.create.return_value = mock_response

        generator         = SuggestionGenerator(payload)
        generator._client = mock_client
        result            = generator.generate()

        assert result.llm_used is True
        assert result.teacher_suggestion == "Schedule a review session immediately."
        assert result.student_suggestion == "Your teacher is here to help you."
        assert result.expected_outcome   == "LO scores stabilise within 3 sessions."

    def test_markdown_fences_stripped(self):
        """LLM response wrapped in ```json fences is parsed correctly."""
        payload = _make_payload(PATTERN_DECLINING_ACHIEVER)
        fenced_response = (
            "```json\n"
            + json.dumps({
                "teacher_suggestion": "Teacher text here.",
                "student_suggestion": "Student text here.",
                "expected_outcome":   "Expected outcome here.",
            })
            + "\n```"
        )

        mock_client   = MagicMock()
        mock_response = MagicMock()
        mock_response.content = [MagicMock(text=fenced_response)]
        mock_client.messages.create.return_value = mock_response

        generator         = SuggestionGenerator(payload)
        generator._client = mock_client
        result            = generator.generate()

        assert result.llm_used is True
        assert result.teacher_suggestion == "Teacher text here."

    def test_generate_returns_generated_suggestion_type(self):
        """generate() always returns a GeneratedSuggestion instance."""
        payload = _make_payload(PATTERN_DECLINING_ACHIEVER)
        with patch.dict(os.environ, {}, clear=True):
            os.environ.pop("ANTHROPIC_API_KEY", None)
            generator = SuggestionGenerator(payload)
            result    = generator.generate()
        assert isinstance(result, GeneratedSuggestion)

    def test_fallback_authentication_error(self):
        """AuthenticationError (fatal) → fallback without retrying."""
        import anthropic
        payload = _make_payload(PATTERN_DECLINING_ACHIEVER)

        mock_client = MagicMock()
        mock_client.messages.create.side_effect = anthropic.AuthenticationError(
            message="invalid key", response=MagicMock(), body={}
        )

        generator         = SuggestionGenerator(payload)
        generator._client = mock_client
        result            = generator.generate()

        assert result.llm_used is False
        # Fatal error — should NOT retry (called only once)
        assert mock_client.messages.create.call_count == 1