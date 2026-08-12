"""
Module      : suggestion_generator.py
Layer       : Suggestion Generator (Layer 4) — LLM Integration
Part of     : Evidence-Reasoned Suggestion Engine (ERSE)
Component   : Student Profile Management & Advanced Statistical
              Progress Analytics
Project     : AI-Powered Adaptive Learning Platform (R26-IT-097)

Author      : Ranasinghe R.A.R.V.C. (IT22197146)
Supervisor  : Ms. Suranjini Silva
Institution : SLIIT — Department of Information Technology

Description
-----------
Implements Layer 4 of the ERSE pipeline: LLM-powered natural language
suggestion generation.

Given a SuggestionPayload (state vector + pattern + evidence) from
Layer 3, this module:

  1. Constructs a structured prompt with full statistical context.
  2. Calls the Anthropic Claude API (claude-sonnet-4-6) to generate:
       - Teacher suggestion  (analytical, action-oriented, 2–3 sentences)
       - Student suggestion  (encouraging, plain language, 1–2 sentences)
       - Expected outcome    (measurable, one sentence)
  3. Validates and parses the JSON response.
  4. Falls back to deterministic rule-based text if the LLM is
     unavailable or returns an invalid response.
  5. Returns a GeneratedSuggestion ready for database storage.

Design principles
-----------------
  - LLM key loaded exclusively from environment (never hardcoded).
  - Retry with exponential backoff (max 3 attempts, 30-second timeout).
  - Fallback text is always available — the system never fails silently.
  - All LLM responses are validated before use.
  - Provider is swappable: only this module touches the Anthropic SDK.

Dependencies
------------
  anthropic          (pip install anthropic)
  services.suggestion_engine  SuggestionPayload, PatternResult,
                               EvidenceItem, StudentStateVector

Environment variables
---------------------
  ANTHROPIC_API_KEY  — Anthropic API key (required for LLM mode)
"""

from __future__ import annotations

import json
import logging
import os
import time
from dataclasses import dataclass

import anthropic

from services.suggestion_engine import (
    SuggestionPayload,
    PatternResult,
    EvidenceItem,
    StudentStateVector,
    PATTERN_DECLINING_ACHIEVER,
    PATTERN_EMOTIONALLY_BLOCKED,
    PATTERN_INCONSISTENT_PERFORMER,
    PATTERN_EMOTIONALLY_DISENGAGED,
    PATTERN_HIGH_POTENTIAL,
    PATTERN_PLATEAUED_LEARNER,
    PATTERN_RECOVERING_LEARNER,
    PATTERN_STEADY_PERFORMER,
    PATTERN_INSUFFICIENT_DATA,
)

logger = logging.getLogger(__name__)


# ======================================================================
# Constants
# ======================================================================

LLM_MODEL               = "claude-sonnet-4-6"
LLM_MAX_TOKENS          = 1000
LLM_TIMEOUT_SECONDS     = 30
LLM_MAX_RETRIES         = 3
LLM_RETRY_BASE_DELAY    = 2.0   # seconds (doubles each retry)

# Required keys in every valid LLM JSON response
REQUIRED_RESPONSE_KEYS  = {
    "teacher_suggestion",
    "student_suggestion",
    "expected_outcome",
}


# ======================================================================
# Data Class — GeneratedSuggestion
# ======================================================================

@dataclass
class GeneratedSuggestion:
    """
    Complete output of the SuggestionGenerator.

    Ready for insertion into the suggestions table.

    Attributes
    ----------
    teacher_suggestion : str
        Analytical, action-oriented text addressed to the teacher.
    student_suggestion : str
        Encouraging, plain-language text addressed to the student.
    expected_outcome : str
        One measurable sentence describing the anticipated improvement.
    llm_model : str
        Name of the LLM model used, or 'fallback' if rule-based text
        was used.
    llm_used : bool
        True if the LLM successfully generated the text; False if the
        fallback rule-based generator was used.
    """
    teacher_suggestion  : str
    student_suggestion  : str
    expected_outcome    : str
    llm_model           : str
    llm_used            : bool


# ======================================================================
# LLM Prompt Builder
# ======================================================================

class PromptBuilder:
    """
    Constructs the system and user prompts sent to the LLM.

    The prompt provides full statistical context so the LLM can
    generate grounded, evidence-based suggestions rather than
    generic advice.

    Parameters
    ----------
    payload : SuggestionPayload
        Complete engine output from Layers 1–3.
    """

    # System prompt — defines the LLM's role and output contract
    SYSTEM_PROMPT = """You are an expert educational analytics AI assistant \
integrated into the AI-Powered Adaptive Learning Platform (R26-IT-097).

Your role is to generate evidence-based, personalised learning suggestions \
for teachers and students based on rigorous statistical analysis of student \
learning data. All suggestions must be:
  - Grounded in the statistical evidence provided
  - Specific and actionable (not generic advice)
  - Professionally worded for teachers; encouraging for students
  - Realistic and measurable

You must respond ONLY with a valid JSON object. No preamble, no explanation, \
no markdown code fences. The JSON must contain exactly these three keys:
  "teacher_suggestion"  : string (2–3 sentences, analytical, action-oriented)
  "student_suggestion"  : string (1–2 sentences, encouraging, plain language)
  "expected_outcome"    : string (1 sentence, measurable improvement statement)"""

    def __init__(self, payload: SuggestionPayload) -> None:
        self.payload = payload

    def build_user_prompt(self) -> str:
        """
        Construct the user message with full statistical context.

        Returns
        -------
        str
            Formatted prompt string ready to send to the LLM.
        """
        v       = self.payload.state_vector
        pattern = self.payload.pattern
        evidence= self.payload.evidence

        lines = [
            "=== STUDENT LEARNING PATTERN ANALYSIS ===",
            "",
            f"Pattern Identified  : {pattern.pattern_name}",
            f"Confidence          : {pattern.confidence_label} "
            f"({pattern.confidence_score:.0%})",
            f"Urgency             : {pattern.urgency}",
            f"Total Sessions      : {v.num_sessions}",
            "",
            "=== STATISTICAL EVIDENCE ===",
        ]

        for i, item in enumerate(evidence, start=1):
            lines += [
                f"Evidence {i}: {item.label}",
                f"  Value  : {item.value} {item.unit}",
                f"  Detail : {item.detail}",
            ]

        lines += [
            "",
            "=== SIGNAL SUMMARY ===",
            f"Trend               : {v.trend_direction}"
            + (f" (slope={v.trend_slope:+.2f}, p={v.trend_p_value:.4f})"
               if v.trend_slope is not None and v.trend_p_value is not None
               else ""),
            f"Stability           : {v.stability_level}"
            + (f" (SD={v.stability_sd:.2f})"
               if v.stability_sd is not None else ""),
            f"At-Risk Flag        : {'Yes' if v.at_risk_flag else 'No'}",
            f"Dominant Emotion    : {v.dominant_emotion}",
            f"Emotion Impact      : {v.emotion_impact}"
            + (f" (r={v.strongest_emotion_r:.3f} for '{v.strongest_emotion_name}')"
               if v.strongest_emotion_r is not None else ""),
            f"Engagement Level    : {v.engagement_level}"
            + (f" (mean={v.mean_engagement_score:.2f})"
               if v.mean_engagement_score is not None else ""),
            f"Engagement Significant: {'Yes' if v.engagement_significant else 'No'}",
            "",
            "=== MATCHED SIGNALS ===",
        ]
        for signal in pattern.matched_signals:
            lines.append(f"  • {signal}")

        lines += [
            "",
            "=== TASK ===",
            "Generate a JSON response with the following three fields:",
            "1. teacher_suggestion — Tell the teacher what to do about this "
            "student. Be analytical, specific, and reference the statistics. "
            "(2–3 sentences)",
            "2. student_suggestion — Encourage the student directly. Use plain, "
            "supportive language. Do NOT mention statistics or scores. "
            "(1–2 sentences)",
            "3. expected_outcome — Describe the measurable improvement expected "
            "if the suggestion is implemented. (1 sentence)",
        ]

        return "\n".join(lines)


# ======================================================================
# Fallback Rule-Based Generator
# ======================================================================

class FallbackGenerator:
    """
    Generates deterministic suggestion text when the LLM is
    unavailable or returns an invalid response.

    Each pattern maps to a pre-written teacher suggestion, student
    suggestion, and expected outcome.  Text is parameterised with
    key statistical values from the state vector where available.

    Parameters
    ----------
    payload : SuggestionPayload
    """

    def __init__(self, payload: SuggestionPayload) -> None:
        self.payload = payload

    def generate(self) -> GeneratedSuggestion:
        """
        Return fallback suggestion text for the assigned pattern.

        Returns
        -------
        GeneratedSuggestion
            With llm_used=False and llm_model='fallback'.
        """
        v       = self.payload.state_vector
        pattern = self.payload.pattern.pattern_name

        if pattern == PATTERN_DECLINING_ACHIEVER:
            teacher = (
                f"This student is showing a statistically significant declining "
                f"trend in Learning Outcome scores"
                + (f" (slope = {v.trend_slope:+.2f} pts/session, "
                   f"p = {v.trend_p_value:.4f})"
                   if v.trend_slope is not None else "")
                + ". Immediate intervention is recommended: schedule a one-to-one "
                "review session to identify content gaps and adjust the learning "
                "path accordingly. Consider reducing lesson complexity temporarily "
                "to rebuild foundational understanding."
            )
            student = (
                "Your recent sessions have been challenging, but you're not alone "
                "— your teacher is here to help you get back on track. "
                "Let's take it one step at a time together."
            )
            outcome = (
                "LO scores are expected to stabilise and begin improving within "
                "3–5 sessions following targeted intervention."
            )

        elif pattern == PATTERN_EMOTIONALLY_BLOCKED:
            teacher = (
                f"Statistical analysis shows a significant negative correlation "
                f"between '{v.strongest_emotion_name}' and LO achievement"
                + (f" (r = {v.strongest_emotion_r:.3f})"
                   if v.strongest_emotion_r is not None else "")
                + " alongside a declining performance trend. "
                "Review recent lesson content and delivery for sources of "
                f"confusion or frustration. Consider introducing shorter tasks, "
                "more frequent check-ins, and positive reinforcement strategies."
            )
            student = (
                "It's completely normal to feel overwhelmed sometimes — what "
                "matters is that you keep going. Your teacher has some ideas to "
                "make learning feel more manageable."
            )
            outcome = (
                "Reduction in negative emotion frequency and stabilisation of "
                "LO scores within 4 sessions following content adjustment."
            )

        elif pattern == PATTERN_INCONSISTENT_PERFORMER:
            teacher = (
                f"This student's performance variance is significantly above the "
                f"class baseline"
                + (f" (SD = {v.stability_sd:.2f})"
                   if v.stability_sd is not None else "")
                + ", indicating highly erratic learning outcomes. "
                "Investigate potential external factors (test anxiety, inconsistent "
                "study habits) and introduce structured review routines. "
                "Regular low-stakes formative assessments may help stabilise "
                "performance."
            )
            student = (
                "You have real ability — some of your sessions have been excellent. "
                "Let's work on making your performance more consistent so your "
                "best work shows up every time."
            )
            outcome = (
                "Performance standard deviation expected to reduce toward the "
                "class mean within 5 sessions with structured routine support."
            )

        elif pattern == PATTERN_EMOTIONALLY_DISENGAGED:
            teacher = (
                f"The dominant emotional state for this student is "
                f"'{v.dominant_emotion}' combined with low engagement "
                + (f"(mean score = {v.mean_engagement_score:.2f})"
                   if v.mean_engagement_score is not None else "")
                + ". Consider introducing more interactive content formats, "
                "peer collaboration activities, or gamified elements to rebuild "
                "motivation. A brief check-in conversation may also help identify "
                "underlying barriers."
            )
            student = (
                "Learning is more enjoyable when you feel connected to what "
                "you're doing. Try engaging with the material in a new way — "
                "you might be surprised what captures your interest."
            )
            outcome = (
                "Engagement scores expected to increase by at least 0.10 points "
                "within 4 sessions following motivational intervention."
            )

        elif pattern == PATTERN_HIGH_POTENTIAL:
            teacher = (
                "This student demonstrates high engagement levels but LO scores "
                "are not reflecting their effort — suggesting a gap between "
                "motivation and effective learning strategy. "
                "Review whether the student is applying deep learning techniques "
                "or surface-level strategies. Targeted study skills coaching or "
                "Socratic questioning may help convert engagement into achievement."
            )
            student = (
                "You're clearly putting in the effort — that's something to be "
                "proud of. Let's make sure your hard work translates into the "
                "results you deserve by fine-tuning how you approach the material."
            )
            outcome = (
                "LO scores expected to align with engagement levels within "
                "4–6 sessions following learning strategy adjustment."
            )

        elif pattern == PATTERN_PLATEAUED_LEARNER:
            teacher = (
                "This student's performance has plateaued — scores are consistent "
                "but show no improvement trend, and engagement is low. "
                "Introduce progressively challenging content to prevent "
                "complacency and stimulate growth. Setting clear short-term "
                "achievement goals may reignite motivation."
            )
            student = (
                "You've been doing steadily — now it's time to push a little "
                "further. Taking on slightly harder challenges is how real "
                "progress happens."
            )
            outcome = (
                "Positive LO trend expected to emerge within 5 sessions "
                "following introduction of appropriately challenging content."
            )

        elif pattern == PATTERN_RECOVERING_LEARNER:
            teacher = (
                "This student was previously on a declining trend but is now "
                "showing measurable improvement — a positive pattern shift. "
                "Maintain current support strategies and acknowledge the "
                "student's progress explicitly to reinforce motivation. "
                "Continue monitoring to ensure the recovery trend is sustained."
            )
            student = (
                "You've turned things around and your progress is showing. "
                "Keep doing what you're doing — this momentum is real."
            )
            outcome = (
                "Improving trend expected to continue and stabilise over the "
                "next 4 sessions with consistent support."
            )

        elif pattern == PATTERN_STEADY_PERFORMER:
            teacher = (
                "This student is performing consistently with high engagement "
                "and a stable or improving trend. "
                "Consider introducing extension tasks or peer mentoring "
                "opportunities to further challenge and develop this student's "
                "potential."
            )
            student = (
                "You're doing really well and your consistency is impressive. "
                "Why not challenge yourself with something a little harder?"
            )
            outcome = (
                "Continued stable or improving performance expected; extension "
                "challenges may drive further LO score growth."
            )

        else:
            # PATTERN_INSUFFICIENT_DATA or unknown
            teacher = (
                "Insufficient session data is available to generate a reliable "
                "suggestion for this student at this time. "
                "Ensure the student completes at least 3 learning sessions "
                "before the analytics engine re-evaluates."
            )
            student = (
                "Keep working through your sessions — your teacher will have "
                "personalised feedback for you soon."
            )
            outcome = (
                "Pattern classification and targeted suggestions will become "
                "available after at least 3 sessions are recorded."
            )

        return GeneratedSuggestion(
            teacher_suggestion  = teacher,
            student_suggestion  = student,
            expected_outcome    = outcome,
            llm_model           = "fallback",
            llm_used            = False,
        )


# ======================================================================
# Main — SuggestionGenerator
# ======================================================================

class SuggestionGenerator:
    """
    Orchestrates Layer 4 of the ERSE pipeline: calls the LLM API to
    generate natural language suggestion text, validates the response,
    and falls back to deterministic text if the LLM is unavailable.

    Parameters
    ----------
    payload : SuggestionPayload
        Complete output from SuggestionEngine (Layers 1–3).

    Examples
    --------
    >>> generator = SuggestionGenerator(payload)
    >>> suggestion = generator.generate()
    >>> print(suggestion.teacher_suggestion)
    >>> print(suggestion.llm_used)
    """

    def __init__(self, payload: SuggestionPayload) -> None:
        self.payload    = payload
        self._client    = self._init_client()

    # ------------------------------------------------------------------
    # Public
    # ------------------------------------------------------------------

    def generate(self) -> GeneratedSuggestion:
        """
        Generate suggestion text via LLM (with fallback).

        Attempts up to LLM_MAX_RETRIES calls with exponential backoff.
        Falls back to FallbackGenerator on any unrecoverable failure.

        Returns
        -------
        GeneratedSuggestion
        """
        if self._client is None:
            logger.warning(
                "Anthropic client unavailable — using fallback generator "
                "for student %s", self.payload.student_id
            )
            return FallbackGenerator(self.payload).generate()

        prompt_builder  = PromptBuilder(self.payload)
        system_prompt   = PromptBuilder.SYSTEM_PROMPT
        user_prompt     = prompt_builder.build_user_prompt()

        for attempt in range(1, LLM_MAX_RETRIES + 1):
            try:
                logger.info(
                    "LLM call attempt %d/%d for student %s",
                    attempt, LLM_MAX_RETRIES, self.payload.student_id,
                )
                raw_text = self._call_llm(system_prompt, user_prompt)
                parsed   = self._parse_and_validate(raw_text)

                logger.info(
                    "LLM generation successful for student %s (attempt %d)",
                    self.payload.student_id, attempt,
                )
                return GeneratedSuggestion(
                    teacher_suggestion  = parsed["teacher_suggestion"].strip(),
                    student_suggestion  = parsed["student_suggestion"].strip(),
                    expected_outcome    = parsed["expected_outcome"].strip(),
                    llm_model           = LLM_MODEL,
                    llm_used            = True,
                )

            except _RetryableError as exc:
                wait = LLM_RETRY_BASE_DELAY * (2 ** (attempt - 1))
                logger.warning(
                    "LLM attempt %d failed (retryable): %s — "
                    "retrying in %.1fs", attempt, exc, wait,
                )
                if attempt < LLM_MAX_RETRIES:
                    time.sleep(wait)

            except _FatalError as exc:
                logger.error(
                    "LLM fatal error for student %s: %s — "
                    "switching to fallback", self.payload.student_id, exc,
                )
                break

            except Exception as exc:
                logger.error(
                    "Unexpected LLM error for student %s: %s — "
                    "switching to fallback", self.payload.student_id, exc,
                )
                break

        logger.warning(
            "All LLM attempts exhausted for student %s — using fallback",
            self.payload.student_id,
        )
        return FallbackGenerator(self.payload).generate()

    # ------------------------------------------------------------------
    # Internal: LLM interaction
    # ------------------------------------------------------------------

    def _call_llm(self, system_prompt: str, user_prompt: str) -> str:
        """
        Execute one LLM API call and return the raw response text.

        Parameters
        ----------
        system_prompt : str
        user_prompt   : str

        Returns
        -------
        str
            Raw text content from the LLM response.

        Raises
        ------
        _RetryableError
            On rate limit or transient server errors.
        _FatalError
            On authentication errors or invalid requests.
        """
        try:
            response = self._client.messages.create(
                model       = LLM_MODEL,
                max_tokens  = LLM_MAX_TOKENS,
                system      = system_prompt,
                messages    = [{"role": "user", "content": user_prompt}],
                timeout     = LLM_TIMEOUT_SECONDS,
            )
            return response.content[0].text

        except anthropic.RateLimitError as exc:
            raise _RetryableError(f"Rate limit: {exc}") from exc
        except anthropic.InternalServerError as exc:
            raise _RetryableError(f"Server error: {exc}") from exc
        except anthropic.AuthenticationError as exc:
            raise _FatalError(f"Authentication failed: {exc}") from exc
        except anthropic.BadRequestError as exc:
            raise _FatalError(f"Bad request: {exc}") from exc

    def _parse_and_validate(self, raw_text: str) -> dict:
        """
        Parse the LLM response as JSON and validate required keys.

        Parameters
        ----------
        raw_text : str
            Raw string returned by the LLM.

        Returns
        -------
        dict
            Parsed JSON with all required keys present.

        Raises
        ------
        _FatalError
            If the response cannot be parsed or is missing required keys.
        """
        # Strip markdown code fences if present
        cleaned = raw_text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```")[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
            cleaned = cleaned.strip()

        try:
            data = json.loads(cleaned)
        except json.JSONDecodeError as exc:
            raise _FatalError(
                f"LLM response is not valid JSON: {exc}\n"
                f"Raw response (first 300 chars): {raw_text[:300]}"
            ) from exc

        missing = REQUIRED_RESPONSE_KEYS - set(data.keys())
        if missing:
            raise _FatalError(
                f"LLM response missing required keys: {missing}"
            )

        # Validate that values are non-empty strings
        for key in REQUIRED_RESPONSE_KEYS:
            if not isinstance(data[key], str) or not data[key].strip():
                raise _FatalError(
                    f"LLM response key '{key}' is empty or not a string"
                )

        return data

    # ------------------------------------------------------------------
    # Internal: client initialisation
    # ------------------------------------------------------------------

    @staticmethod
    def _init_client() -> Optional[anthropic.Anthropic]:
        """
        Initialise the Anthropic client from the environment variable.

        Returns
        -------
        Optional[anthropic.Anthropic]
            Configured client, or None if API key is not set.
        """
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            logger.warning(
                "ANTHROPIC_API_KEY not set — LLM generation disabled; "
                "fallback text will be used."
            )
            return None
        return anthropic.Anthropic(api_key=api_key)


# ======================================================================
# Internal exception types
# ======================================================================

class _RetryableError(Exception):
    """Raised for transient LLM errors that warrant a retry."""


class _FatalError(Exception):
    """Raised for LLM errors that should not be retried."""