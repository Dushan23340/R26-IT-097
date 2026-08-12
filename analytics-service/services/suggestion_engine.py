"""
Module      : suggestion_engine.py
Layers      : Signal Aggregator · Pattern Classifier · Evidence Builder
Part of     : Evidence-Reasoned Suggestion Engine (ERSE)
Component   : Student Profile Management & Advanced Statistical
              Progress Analytics
Project     : AI-Powered Adaptive Learning Platform (R26-IT-097)

Author      : Ranasinghe R.A.R.V.C. (IT22197146)
Supervisor  : Ms. Suranjini Silva
Institution : SLIIT — Department of Information Technology

Description
-----------
Implements the first three layers of the ERSE pipeline:

  Layer 1 — Signal Aggregator
      Collects outputs from all four existing statistical analyzers
      (TrendAnalyzer, StabilityAnalyzer, EmotionCorrelationAnalyzer,
      EngagementPerformanceComparator) and distils them into a unified
      StudentStateVector.  Also fetches historical trend data so that
      pattern shifts (e.g. Recovering Learner) can be detected.

  Layer 2 — Pattern Classifier
      Evaluates the StudentStateVector against an ordered priority
      stack of eight named learning patterns and assigns the single
      strongest matching pattern together with a numeric confidence
      score (0–1) derived from the number of aligned signals.

  Layer 3 — Evidence Builder
      Selects the two or three strongest statistical proof points that
      justify the assigned pattern and returns them as a structured
      list of EvidenceItem objects ready for storage and display.

Dependencies
------------
  services.trend_analyzer          TrendAnalyzer
  services.stability_analyzer      StabilityAnalyzer, compute_class_statistics
  services.emotion_correlator      EmotionCorrelationAnalyzer
  services.engagement_comparator   EngagementPerformanceComparator
  config.database                  get_cursor

Usage
-----
  from services.suggestion_engine import SuggestionEngine

  engine = SuggestionEngine(student_id="STU_001")
  result = engine.run()

  # result is a SuggestionPayload dataclass with:
  #   .state_vector   — StudentStateVector
  #   .pattern        — PatternResult
  #   .evidence       — list[EvidenceItem]
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field, asdict
from typing import Optional

from config.database import get_cursor
from services.trend_analyzer import TrendAnalyzer
from services.stability_analyzer import StabilityAnalyzer, compute_class_statistics
from services.emotion_correlator import EmotionCorrelationAnalyzer
from services.engagement_comparator import EngagementPerformanceComparator

logger = logging.getLogger(__name__)


# ======================================================================
# Constants — Pattern Priority & Thresholds
# ======================================================================

# Pattern names (canonical strings used throughout the system)
PATTERN_DECLINING_ACHIEVER         = "Declining Achiever"
PATTERN_EMOTIONALLY_BLOCKED        = "Emotionally Blocked"
PATTERN_INCONSISTENT_PERFORMER     = "Inconsistent Performer"
PATTERN_EMOTIONALLY_DISENGAGED     = "Emotionally Disengaged"
PATTERN_HIGH_POTENTIAL             = "High Potential Underachiever"
PATTERN_PLATEAUED_LEARNER          = "Plateaued Learner"
PATTERN_RECOVERING_LEARNER         = "Recovering Learner"
PATTERN_STEADY_PERFORMER           = "Steady Performer"
PATTERN_INSUFFICIENT_DATA          = "Insufficient Data"

# Ordered priority stack — evaluated top to bottom; first match wins
PATTERN_PRIORITY_STACK: list[str] = [
    PATTERN_DECLINING_ACHIEVER,         # Priority 1 — most critical
    PATTERN_EMOTIONALLY_BLOCKED,        # Priority 2
    PATTERN_INCONSISTENT_PERFORMER,     # Priority 3
    PATTERN_EMOTIONALLY_DISENGAGED,     # Priority 4
    PATTERN_HIGH_POTENTIAL,             # Priority 5
    PATTERN_PLATEAUED_LEARNER,          # Priority 6
    PATTERN_RECOVERING_LEARNER,         # Priority 7
    PATTERN_STEADY_PERFORMER,           # Priority 8
]

# Statistical thresholds (aligned with proposal validation strategy)
EMOTION_CORRELATION_NEGATIVE_THRESHOLD  = -0.30   # Pearson r (negative)
EMOTION_CORRELATION_POSITIVE_THRESHOLD  =  0.30   # Pearson r (positive)
TREND_SIGNIFICANCE_THRESHOLD            =  0.05   # p-value
CONFIDENCE_HIGH_THRESHOLD               =  0.70   # ≥ 70 % signal alignment
CONFIDENCE_MEDIUM_THRESHOLD             =  0.40   # ≥ 40 % signal alignment

# Minimum sessions required before any pattern can be assigned
MIN_SESSIONS_REQUIRED = 3

# Maximum number of evidence items attached to a suggestion
MAX_EVIDENCE_ITEMS = 3


# ======================================================================
# Data Classes
# ======================================================================

@dataclass
class StudentStateVector:
    """
    Unified representation of a student's current learning state,
    derived from the outputs of all four statistical analyzers.

    Attributes
    ----------
    student_id : str
        The student's unique identifier.
    num_sessions : int
        Total number of learning sessions available for analysis.

    Trend signals (from TrendAnalyzer)
    -----------------------------------
    trend_direction : str
        'improving' | 'declining' | 'stable' | 'insufficient_data'
    trend_slope : Optional[float]
        Linear regression slope (points per session).
    trend_p_value : Optional[float]
        p-value of the regression slope coefficient.
    trend_significant : bool
        True when trend_p_value < TREND_SIGNIFICANCE_THRESHOLD.
    trend_r_squared : Optional[float]
        Coefficient of determination for the regression model.
    historical_trend : str
        Trend direction computed over the student's earliest sessions
        (used to detect Recovering Learner pattern).
        'improving' | 'declining' | 'stable' | 'insufficient_data'

    Stability signals (from StabilityAnalyzer)
    -------------------------------------------
    stability_sd : Optional[float]
        Standard deviation of per-session LO scores.
    stability_cv : Optional[float]
        Coefficient of variation (SD / mean * 100).
    stability_level : str
        'stable' | 'moderate' | 'unstable' | 'insufficient_data'
    at_risk_flag : bool
        True when SD exceeds class_mean_sd + 1.5 * class_sd_of_sds.

    Emotion signals (from EmotionCorrelationAnalyzer)
    --------------------------------------------------
    dominant_emotion : str
        Emotion with highest average intensity across sessions.
    strongest_emotion_r : Optional[float]
        Pearson r of the strongest emotion–LO correlation found.
    strongest_emotion_name : str
        Name of the emotion driving the strongest correlation.
    emotion_impact : str
        'positive' | 'negative' | 'neutral' | 'insufficient_data'
    significant_negative_emotions : list[str]
        Emotions with r < EMOTION_CORRELATION_NEGATIVE_THRESHOLD.

    Engagement signals (from EngagementPerformanceComparator)
    ----------------------------------------------------------
    engagement_level : str
        'high' | 'low' | 'insufficient_data'
    engagement_significant : bool
        True when Mann-Whitney p-value < 0.05.
    engagement_effect_size : Optional[float]
        Effect size r from the Mann-Whitney test.
    mean_engagement_score : Optional[float]
        Mean engagement score across all sessions (0–1 scale).
    """

    # Core
    student_id              : str
    num_sessions            : int                   = 0

    # Trend
    trend_direction         : str                   = "insufficient_data"
    trend_slope             : Optional[float]       = None
    trend_p_value           : Optional[float]       = None
    trend_significant       : bool                  = False
    trend_r_squared         : Optional[float]       = None
    historical_trend        : str                   = "insufficient_data"

    # Stability
    stability_sd            : Optional[float]       = None
    stability_cv            : Optional[float]       = None
    stability_level         : str                   = "insufficient_data"
    at_risk_flag            : bool                  = False

    # Emotion
    dominant_emotion        : str                   = "neutral"
    strongest_emotion_r     : Optional[float]       = None
    strongest_emotion_name  : str                   = "none"
    emotion_impact          : str                   = "insufficient_data"
    significant_negative_emotions: list[str]        = field(default_factory=list)

    # Engagement
    engagement_level        : str                   = "insufficient_data"
    engagement_significant  : bool                  = False
    engagement_effect_size  : Optional[float]       = None
    mean_engagement_score   : Optional[float]       = None

    def to_dict(self) -> dict:
        """Serialise to a plain dictionary for JSONB storage."""
        return asdict(self)


@dataclass
class PatternResult:
    """
    Result of the pattern classification step.

    Attributes
    ----------
    pattern_name : str
        The assigned named learning pattern.
    priority : int
        Position in the priority stack (1 = highest priority).
    confidence_score : float
        Numeric confidence 0–1 (proportion of aligned signals).
    confidence_label : str
        'High' | 'Medium' | 'Low'
    urgency : str
        'Immediate' | 'Monitor' | 'Routine'
    matched_signals : list[str]
        Human-readable descriptions of the signals that triggered
        this pattern.
    """
    pattern_name        : str
    priority            : int
    confidence_score    : float
    confidence_label    : str
    urgency             : str
    matched_signals     : list[str]     = field(default_factory=list)


@dataclass
class EvidenceItem:
    """
    A single statistical proof point attached to a suggestion.

    Attributes
    ----------
    signal : str
        Source analyzer ('trend' | 'stability' | 'emotion' | 'engagement').
    label : str
        Short human-readable label (e.g. 'Declining Trend').
    value : Optional[float]
        The primary numeric value (e.g. slope, r, SD).
    unit : str
        Unit description (e.g. 'pts/session', 'Pearson r', 'SD').
    detail : str
        Full statistical detail sentence shown to the teacher.
    weight : float
        Relative importance of this evidence item (0–1).
    """
    signal  : str
    label   : str
    value   : Optional[float]
    unit    : str
    detail  : str
    weight  : float

    def to_dict(self) -> dict:
        """Serialise to a plain dictionary for JSONB storage."""
        return asdict(self)


@dataclass
class SuggestionPayload:
    """
    Complete output of the SuggestionEngine.

    Passed to SuggestionGenerator (Layer 4) and then stored in the
    suggestions table.

    Attributes
    ----------
    student_id      : str
    state_vector    : StudentStateVector
    pattern         : PatternResult
    evidence        : list[EvidenceItem]
    """
    student_id      : str
    state_vector    : StudentStateVector
    pattern         : PatternResult
    evidence        : list[EvidenceItem]


# ======================================================================
# Layer 1 — Signal Aggregator
# ======================================================================

class SignalAggregator:
    """
    Collects outputs from all four statistical analyzers and builds
    a unified StudentStateVector for the given student.

    The aggregator handles analyzer failures gracefully: if one
    analyzer cannot produce results (e.g. insufficient data), its
    corresponding fields in the state vector remain at their default
    'insufficient_data' values and processing continues.

    Parameters
    ----------
    student_id : str
        The student identifier (primary key in student_profiles).
    """

    def __init__(self, student_id: str) -> None:
        self.student_id = student_id

    # ------------------------------------------------------------------
    # Public
    # ------------------------------------------------------------------

    def aggregate(self) -> StudentStateVector:
        """
        Run all four analyzers and return the unified state vector.

        Returns
        -------
        StudentStateVector
            Populated with all available signals. Fields remain at
            default 'insufficient_data' values where analyzers fail.
        """
        vector = StudentStateVector(student_id=self.student_id)

        try:
            vector = self._apply_trend(vector)
        except Exception as exc:
            logger.warning("_apply_trend failed for %s: %s", self.student_id, exc)
        try:
            vector = self._apply_stability(vector)
        except Exception as exc:
            logger.warning("_apply_stability failed for %s: %s", self.student_id, exc)
        try:
            vector = self._apply_emotion(vector)
        except Exception as exc:
            logger.warning("_apply_emotion failed for %s: %s", self.student_id, exc)
        try:
            vector = self._apply_engagement(vector)
        except Exception as exc:
            logger.warning("_apply_engagement failed for %s: %s", self.student_id, exc)

        # Session count from the richest source available
        if vector.num_sessions == 0:
            vector.num_sessions = self._fetch_session_count()

        logger.info(
            "State vector built for %s: trend=%s stability=%s "
            "emotion_impact=%s engagement=%s sessions=%d",
            self.student_id,
            vector.trend_direction,
            vector.stability_level,
            vector.emotion_impact,
            vector.engagement_level,
            vector.num_sessions,
        )
        return vector

    # ------------------------------------------------------------------
    # Internal: per-analyzer application methods
    # ------------------------------------------------------------------

    def _apply_trend(self, vector: StudentStateVector) -> StudentStateVector:
        """Fetch trend analysis and populate trend fields on the vector."""
        try:
            analyzer = TrendAnalyzer(self.student_id)
            result = analyzer.get_analysis_summary()

            regression = result.get("regression_stats") or {}
            classification = result.get("trend_classification", "stable")

            vector.num_sessions     = result.get("num_sessions", 0)
            vector.trend_direction  = classification

            # Normalise 'unstable' — TrendAnalyzer returns this when slope > 0.5
            # but p-value is not significant. For pattern classification we treat
            # it as 'stable' since instability is captured by StabilityAnalyzer.
            if vector.trend_direction == "unstable":
                vector.trend_direction = "stable"
            vector.trend_slope      = regression.get("slope")
            vector.trend_p_value    = regression.get("p_value")
            vector.trend_r_squared  = regression.get("r_squared")
            vector.trend_significant = (
                vector.trend_p_value is not None
                and vector.trend_p_value < TREND_SIGNIFICANCE_THRESHOLD
            )

            # Historical trend from earlier half of sessions
            vector.historical_trend = self._fetch_historical_trend(analyzer)

        except Exception as exc:
            logger.warning(
                "TrendAnalyzer failed for %s: %s — using defaults",
                self.student_id, exc,
            )
        return vector

    def _apply_stability(self, vector: StudentStateVector) -> StudentStateVector:
        """Fetch stability analysis and populate stability fields."""
        try:
            analyzer    = StabilityAnalyzer(self.student_id)
            result      = analyzer.get_analysis()

            sd  = result.get("sd")
            cv  = result.get("cv")

            vector.stability_sd = sd
            vector.stability_cv = cv
            vector.stability_level = self._classify_stability(cv)

            # at_risk_flag: compare against class baseline
            try:
                all_ids = self._fetch_all_student_ids()
                class_stats = compute_class_statistics(all_ids)
                if sd is not None:
                    vector.at_risk_flag = StabilityAnalyzer.flag_at_risk(
                        sd,
                        class_stats["class_mean_sd"],
                        class_stats["class_sd_of_sds"],
                    )
            except Exception as exc:
                logger.warning(
                    "Class statistics unavailable for at_risk_flag (%s): %s",
                    self.student_id, exc,
                )

        except Exception as exc:
            logger.warning(
                "StabilityAnalyzer failed for %s: %s — using defaults",
                self.student_id, exc,
            )
        return vector

    def _apply_emotion(self, vector: StudentStateVector) -> StudentStateVector:
        """Fetch emotion correlation analysis and populate emotion fields."""
        try:
            analyzer    = EmotionCorrelationAnalyzer(self.student_id)
            result      = analyzer.get_analysis()

            correlations    = result.get("correlations") or {}
            sig_corr        = result.get("significant_correlations") or {}

            if not correlations:
                return vector

            # Dominant emotion: highest absolute correlation
            strongest_name, strongest_r = self._find_strongest_correlation(
                correlations
            )
            vector.strongest_emotion_name   = strongest_name
            vector.strongest_emotion_r      = strongest_r

            # Impact direction from the strongest significant correlation
            vector.emotion_impact = self._classify_emotion_impact(
                correlations, sig_corr
            )

            # Dominant emotion: most frequently dominant across sessions
            vector.dominant_emotion = self._find_dominant_emotion(correlations)

            # All emotions with significant negative correlation
            vector.significant_negative_emotions = [
                emotion for emotion, stats in sig_corr.items()
                if stats.get("r", 0) < EMOTION_CORRELATION_NEGATIVE_THRESHOLD
            ]

        except Exception as exc:
            logger.warning(
                "EmotionCorrelationAnalyzer failed for %s: %s — using defaults",
                self.student_id, exc,
            )
        return vector

    def _apply_engagement(self, vector: StudentStateVector) -> StudentStateVector:
        """Fetch engagement comparison and populate engagement fields."""
        try:
            comparator  = EngagementPerformanceComparator(self.student_id)
            result      = comparator.get_analysis()

            mw          = result.get("mann_whitney") or {}
            p_value     = mw.get("p_value")
            effect_size = result.get("effect_size")
            desc_stats  = result.get("descriptive_statistics") or {}

            vector.engagement_significant = (
                p_value is not None and p_value < TREND_SIGNIFICANCE_THRESHOLD
            )
            vector.engagement_effect_size = effect_size

            # Classify engagement level by mean score across all sessions
            # EngagementPerformanceComparator returns 'high_engagement' and
            # EngagementPerformanceComparator returns 'high_engagement' and
            # 'low_engagement' keys — compute overall mean from both groups
            high = desc_stats.get("high_engagement", {})
            low  = desc_stats.get("low_engagement", {})

            high_count = high.get("count", 0)
            low_count  = low.get("count", 0)
            high_mean  = high.get("mean", 0)
            low_mean   = low.get("mean", 0)
            total      = high_count + low_count

            if total > 0:
                # Weighted mean engagement across all sessions
                mean_eng = (
                    (high_count * high_mean + low_count * low_mean) / total
                ) / 100  # normalise to 0-1 scale
            else:
                mean_eng = None

            vector.mean_engagement_score = mean_eng
            vector.engagement_level = self._classify_engagement_level(mean_eng)

        except Exception as exc:
            logger.warning(
                "EngagementPerformanceComparator failed for %s: %s — using defaults",
                self.student_id, exc,
            )
        return vector

    # ------------------------------------------------------------------
    # Internal: historical trend helper
    # ------------------------------------------------------------------

    def _fetch_historical_trend(self, analyzer: TrendAnalyzer) -> str:
        """
        Compute the trend over the earlier half of the student's
        session history to support Recovering Learner detection.

        Parameters
        ----------
        analyzer : TrendAnalyzer
            Already-initialised TrendAnalyzer for this student.

        Returns
        -------
        str
            'improving' | 'declining' | 'stable' | 'insufficient_data'
        """
        try:
            session_numbers, avg_scores = analyzer.fetch_lo_timeseries()
            n = len(session_numbers)

            if n < MIN_SESSIONS_REQUIRED * 2:
                # Not enough history to split meaningfully
                return "insufficient_data"

            half = n // 2
            hist_numbers    = session_numbers[:half]
            hist_scores     = avg_scores[:half]

            regression  = analyzer.compute_linear_regression(
                hist_numbers, hist_scores
            )
            return analyzer.classify_trend(regression)

        except Exception as exc:
            logger.warning(
                "Historical trend fetch failed for %s: %s",
                self.student_id, exc,
            )
            return "insufficient_data"

    # ------------------------------------------------------------------
    # Internal: classification helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _classify_stability(cv: Optional[float]) -> str:
        """
        Map coefficient of variation to a stability label.

        Thresholds align with the StabilityAnalyzer's internal
        interpretation logic:
          CV < 15 %  → stable
          CV < 30 %  → moderate
          CV ≥ 30 %  → unstable

        Parameters
        ----------
        cv : Optional[float]
            Coefficient of variation (%).

        Returns
        -------
        str
            'stable' | 'moderate' | 'unstable' | 'insufficient_data'
        """
        if cv is None:
            return "insufficient_data"
        if cv < 15.0:
            return "stable"
        if cv < 30.0:
            return "moderate"
        return "unstable"

    @staticmethod
    def _classify_engagement_level(mean_score: Optional[float]) -> str:
        """
        Map mean engagement score (0–1) to a level label.

        Threshold: 0.5 median split consistent with
        EngagementPerformanceComparator.

        Parameters
        ----------
        mean_score : Optional[float]
            Mean engagement score across all sessions (0–1).

        Returns
        -------
        str
            'high' | 'low' | 'insufficient_data'
        """
        if mean_score is None:
            return "insufficient_data"
        return "high" if mean_score >= 0.5 else "low"

    @staticmethod
    def _find_strongest_correlation(
        correlations: dict,
    ) -> tuple[str, Optional[float]]:
        """
        Return the emotion name and Pearson r of the strongest
        (highest absolute value) correlation.

        Parameters
        ----------
        correlations : dict
            Mapping of emotion → {'r': float, 'p_value': float, ...}
            as returned by EmotionCorrelationAnalyzer.

        Returns
        -------
        tuple[str, Optional[float]]
            (emotion_name, r_value)  or  ('none', None) if empty.
        """
        best_name   = "none"
        best_r      = None
        best_abs    = 0.0

        for emotion, stats in correlations.items():
            r = stats.get("r")
            if r is not None and abs(r) > best_abs:
                best_abs    = abs(r)
                best_r      = r
                best_name   = emotion

        return best_name, best_r

    @staticmethod
    def _find_dominant_emotion(correlations: dict) -> str:
        """
        Return the emotion with the largest absolute Pearson r,
        used as the 'dominant' emotion label in the state vector.

        Parameters
        ----------
        correlations : dict
            Mapping of emotion → {'r': float, ...}

        Returns
        -------
        str
            Emotion name, or 'neutral' if correlations is empty.
        """
        if not correlations:
            return "neutral"
        return max(
            correlations,
            key=lambda e: abs(correlations[e].get("r") or 0),
            default="neutral",
        )

    @staticmethod
    def _classify_emotion_impact(
        correlations: dict,
        sig_corr: dict,
    ) -> str:
        """
        Classify the overall emotion impact as positive, negative,
        or neutral based on significant correlations.

        Rules:
          - 'negative' if any significant correlation r < threshold
          - 'positive' if any significant correlation r > threshold
          - 'neutral'  if no significant correlations found

        Parameters
        ----------
        correlations : dict
            All emotion correlations.
        sig_corr : dict
            Only statistically significant correlations.

        Returns
        -------
        str
            'positive' | 'negative' | 'neutral' | 'insufficient_data'
        """
        if not correlations:
            return "insufficient_data"

        for _, stats in sig_corr.items():
            r = stats.get("r", 0)
            if r < EMOTION_CORRELATION_NEGATIVE_THRESHOLD:
                return "negative"
            if r > EMOTION_CORRELATION_POSITIVE_THRESHOLD:
                return "positive"

        return "neutral"

    # ------------------------------------------------------------------
    # Internal: database helpers
    # ------------------------------------------------------------------

    def _fetch_all_student_ids(self) -> list[str]:
        """Return all student IDs from student_profiles."""
        with get_cursor() as cur:
            cur.execute(
                "SELECT student_id FROM student_profiles ORDER BY student_id"
            )
            return [row[0] for row in cur.fetchall()]

    def _fetch_session_count(self) -> int:
        """Return the number of learning sessions for this student."""
        try:
            with get_cursor() as cur:
                cur.execute(
                    "SELECT COUNT(*) FROM learning_sessions "
                    "WHERE student_id = %s",
                    (self.student_id,),
                )
                row = cur.fetchone()
                return int(row[0]) if row else 0
        except Exception as exc:
            logger.warning(
                "Session count fetch failed for %s: %s",
                self.student_id, exc,
            )
            return 0


# ======================================================================
# Layer 2 — Pattern Classifier
# ======================================================================

class PatternClassifier:
    """
    Evaluates a StudentStateVector against the ordered priority stack
    and assigns the single strongest matching named learning pattern.

    The confidence score is computed as the proportion of the pattern's
    defining signals that are strongly confirmed by the state vector.

    Parameters
    ----------
    vector : StudentStateVector
        Populated state vector from SignalAggregator.
    """

    def __init__(self, vector: StudentStateVector) -> None:
        self.vector = vector

    # ------------------------------------------------------------------
    # Public
    # ------------------------------------------------------------------

    def classify(self) -> PatternResult:
        """
        Run the priority stack and return the first matching pattern.

        Returns
        -------
        PatternResult
            Assigned pattern with confidence score and urgency.
        """
        v = self.vector

        if v.num_sessions < MIN_SESSIONS_REQUIRED:
            return self._insufficient_data_result()

        # Evaluate each pattern in priority order
        evaluators = [
            self._eval_declining_achiever,
            self._eval_emotionally_blocked,
            self._eval_inconsistent_performer,
            self._eval_emotionally_disengaged,
            self._eval_high_potential,
            self._eval_plateaued_learner,
            self._eval_recovering_learner,
            self._eval_steady_performer,
        ]

        for priority, evaluator in enumerate(evaluators, start=1):
            result = evaluator(priority)
            if result is not None:
                logger.info(
                    "Pattern assigned for %s: %s (confidence=%.2f)",
                    self.vector.student_id,
                    result.pattern_name,
                    result.confidence_score,
                )
                return result

        # Fallback — should rarely occur if data is sufficient
        return self._insufficient_data_result()

    # ------------------------------------------------------------------
    # Internal: pattern evaluators (one per pattern)
    # ------------------------------------------------------------------

    def _eval_declining_achiever(self, priority: int) -> Optional[PatternResult]:
        """
        Priority 1 — Declining Achiever.
        Conditions: trend declining AND statistically significant.
        """
        v = self.vector
        if not (
            v.trend_direction == "declining"
            and v.trend_significant
        ):
            return None

        signals = ["Statistically significant declining LO trend"]
        if v.at_risk_flag:
            signals.append("At-risk instability flag raised")
        if v.engagement_level == "low":
            signals.append("Low mean engagement score")

        return self._build_result(
            PATTERN_DECLINING_ACHIEVER, priority,
            signals, urgency="Immediate",
            total_possible_signals=3,
        )

    def _eval_emotionally_blocked(self, priority: int) -> Optional[PatternResult]:
        """
        Priority 2 — Emotionally Blocked.
        Conditions: strong negative emotion-LO correlation AND declining trend.
        """
        v = self.vector
        if not (
            v.emotion_impact == "negative"
            and v.strongest_emotion_r is not None
            and v.strongest_emotion_r < EMOTION_CORRELATION_NEGATIVE_THRESHOLD
            and v.trend_direction == "declining"
        ):
            return None

        signals = [
            f"Strong negative emotion–LO correlation "
            f"(r = {v.strongest_emotion_r:.2f} for '{v.strongest_emotion_name}')",
            "Concurrent declining performance trend",
        ]
        if v.trend_significant:
            signals.append("Trend decline is statistically significant")

        return self._build_result(
            PATTERN_EMOTIONALLY_BLOCKED, priority,
            signals, urgency="Immediate",
            total_possible_signals=3,
        )

    def _eval_inconsistent_performer(self, priority: int) -> Optional[PatternResult]:
        """
        Priority 3 — Inconsistent Performer.
        Conditions: at_risk_flag AND stability unstable.
        """
        v = self.vector
        if not (v.at_risk_flag and v.stability_level == "unstable"):
            return None

        signals = [
            f"SD ({v.stability_sd:.2f}) exceeds class at-risk threshold",
            "Unstable performance pattern detected",
        ]
        if v.stability_cv is not None:
            signals.append(
                f"Coefficient of variation = {v.stability_cv:.1f}% (high)"
            )

        return self._build_result(
            PATTERN_INCONSISTENT_PERFORMER, priority,
            signals, urgency="Monitor",
            total_possible_signals=3,
        )

    def _eval_emotionally_disengaged(self, priority: int) -> Optional[PatternResult]:
        """
        Priority 4 — Emotionally Disengaged.
        Conditions: dominant negative emotion (bored/sad) AND low engagement.
        """
        v = self.vector
        negative_emotions = {"bored", "sad", "angry"}
        if not (
            v.dominant_emotion in negative_emotions
            and v.engagement_level == "low"
        ):
            return None

        signals = [
            f"Dominant emotion is '{v.dominant_emotion}'",
            "Low mean engagement score across sessions",
        ]
        if v.significant_negative_emotions:
            signals.append(
                f"Significant negative emotion correlations: "
                f"{', '.join(v.significant_negative_emotions)}"
            )

        return self._build_result(
            PATTERN_EMOTIONALLY_DISENGAGED, priority,
            signals, urgency="Monitor",
            total_possible_signals=3,
        )

    def _eval_high_potential(self, priority: int) -> Optional[PatternResult]:
        """
        Priority 5 — High Potential Underachiever.
        Conditions: high engagement AND significant engagement effect
                    AND trend stable or declining.
        """
        v = self.vector
        if not (
            v.engagement_level == "high"
            and v.engagement_significant
            and v.trend_direction in ("stable", "declining")
        ):
            return None

        signals = [
            "High engagement level — student is invested",
            "Engagement effect on LO scores is statistically significant",
            f"LO trend is {v.trend_direction} despite high engagement",
        ]

        return self._build_result(
            PATTERN_HIGH_POTENTIAL, priority,
            signals, urgency="Monitor",
            total_possible_signals=3,
        )

    def _eval_plateaued_learner(self, priority: int) -> Optional[PatternResult]:
        """
        Priority 6 — Plateaued Learner.
        Conditions: stable trend AND stable performance AND low engagement.
        """
        v = self.vector
        if not (
            v.trend_direction == "stable"
            and v.stability_level == "stable"
            and v.engagement_level == "low"
        ):
            return None

        signals = [
            "Flat LO trend — no improvement over sessions",
            "Consistent but stagnant performance (low variance)",
            "Low engagement score suggests reduced motivation",
        ]

        return self._build_result(
            PATTERN_PLATEAUED_LEARNER, priority,
            signals, urgency="Routine",
            total_possible_signals=3,
        )

    def _eval_recovering_learner(self, priority: int) -> Optional[PatternResult]:
        """
        Priority 7 — Recovering Learner.
        Conditions: current trend improving AND historical trend was declining.
        """
        v = self.vector
        if not (
            v.trend_direction == "improving"
            and v.historical_trend == "declining"
        ):
            return None

        signals = [
            "Current LO trend is improving",
            "Previously exhibited a declining trend — now recovering",
        ]
        if v.trend_significant:
            signals.append("Improvement trend is statistically significant")

        return self._build_result(
            PATTERN_RECOVERING_LEARNER, priority,
            signals, urgency="Routine",
            total_possible_signals=3,
        )

    def _eval_steady_performer(self, priority: int) -> Optional[PatternResult]:
        """
        Priority 8 — Steady Performer (catch-all positive pattern).
        Conditions: trend stable or improving AND stability stable
                    AND engagement high.
        """
        v = self.vector
        if not (
            v.trend_direction in ("stable", "improving")
            and v.stability_level == "stable"
            and v.engagement_level == "high"
        ):
            return None

        signals = [
            f"LO trend is {v.trend_direction}",
            "Consistent performance (low variance)",
            "High engagement across sessions",
        ]

        return self._build_result(
            PATTERN_STEADY_PERFORMER, priority,
            signals, urgency="Routine",
            total_possible_signals=3,
        )

    # ------------------------------------------------------------------
    # Internal: result builder helpers
    # ------------------------------------------------------------------

    def _build_result(
        self,
        pattern_name        : str,
        priority            : int,
        matched_signals     : list[str],
        urgency             : str,
        total_possible_signals: int,
    ) -> PatternResult:
        """
        Build a PatternResult with computed confidence score and label.

        Parameters
        ----------
        pattern_name : str
            Canonical pattern name constant.
        priority : int
            Position in the priority stack.
        matched_signals : list[str]
            Signal descriptions that triggered this pattern.
        urgency : str
            'Immediate' | 'Monitor' | 'Routine'
        total_possible_signals : int
            Maximum number of signals for this pattern (denominator
            for confidence score).

        Returns
        -------
        PatternResult
        """
        raw_score       = len(matched_signals) / max(total_possible_signals, 1)
        # Clamp to [0, 1]
        confidence_score = min(max(raw_score, 0.0), 1.0)
        confidence_label = self._score_to_label(confidence_score)

        return PatternResult(
            pattern_name    = pattern_name,
            priority        = priority,
            confidence_score= round(confidence_score, 3),
            confidence_label= confidence_label,
            urgency         = urgency,
            matched_signals = matched_signals,
        )

    @staticmethod
    def _score_to_label(score: float) -> str:
        """Map a numeric confidence score to a label."""
        if score >= CONFIDENCE_HIGH_THRESHOLD:
            return "High"
        if score >= CONFIDENCE_MEDIUM_THRESHOLD:
            return "Medium"
        return "Low"

    def _insufficient_data_result(self) -> PatternResult:
        """Return a standard Insufficient Data result."""
        return PatternResult(
            pattern_name    = PATTERN_INSUFFICIENT_DATA,
            priority        = 0,
            confidence_score= 0.0,
            confidence_label= "Low",
            urgency         = "Routine",
            matched_signals = [
                f"Only {self.vector.num_sessions} session(s) available; "
                f"minimum {MIN_SESSIONS_REQUIRED} required."
            ],
        )


# ======================================================================
# Layer 3 — Evidence Builder
# ======================================================================

class EvidenceBuilder:
    """
    Selects the strongest statistical proof points from the state
    vector that justify the assigned pattern, returning up to
    MAX_EVIDENCE_ITEMS items ordered by descending weight.

    Parameters
    ----------
    vector  : StudentStateVector
    pattern : PatternResult
    """

    def __init__(
        self,
        vector  : StudentStateVector,
        pattern : PatternResult,
    ) -> None:
        self.vector  = vector
        self.pattern = pattern

    # ------------------------------------------------------------------
    # Public
    # ------------------------------------------------------------------

    def build(self) -> list[EvidenceItem]:
        """
        Build and return the evidence list for the pattern.

        Returns
        -------
        list[EvidenceItem]
            Up to MAX_EVIDENCE_ITEMS items, ordered by weight descending.
        """
        candidates: list[EvidenceItem] = []

        candidates.extend(self._trend_evidence())
        candidates.extend(self._stability_evidence())
        candidates.extend(self._emotion_evidence())
        candidates.extend(self._engagement_evidence())

        # Sort by weight descending and take top N
        candidates.sort(key=lambda e: e.weight, reverse=True)
        selected = candidates[:MAX_EVIDENCE_ITEMS]

        logger.debug(
            "Evidence built for %s pattern '%s': %d items",
            self.vector.student_id,
            self.pattern.pattern_name,
            len(selected),
        )
        return selected

    # ------------------------------------------------------------------
    # Internal: per-signal evidence generators
    # ------------------------------------------------------------------

    def _trend_evidence(self) -> list[EvidenceItem]:
        """Generate evidence items from trend analysis signals."""
        items = []
        v = self.vector

        if v.trend_slope is None or v.trend_p_value is None:
            return items

        direction_word = (
            "increases" if v.trend_direction == "improving" else
            "decreases" if v.trend_direction == "declining" else
            "remains flat"
        )

        # Weight: significant declining trends in critical patterns get max weight
        weight = 0.9 if (
            v.trend_direction == "declining" and v.trend_significant
        ) else (
            0.8 if v.trend_significant else 0.5
        )

        detail = (
            f"Linear regression over {v.num_sessions} sessions: "
            f"slope = {v.trend_slope:+.2f} pts/session "
            f"(p = {v.trend_p_value:.4f}"
            f"{', statistically significant' if v.trend_significant else ''}). "
            f"LO score {direction_word} by ~{abs(v.trend_slope):.1f} pts "
            f"per session."
        )
        if v.trend_r_squared is not None:
            detail += f" R² = {v.trend_r_squared:.3f}."

        items.append(EvidenceItem(
            signal  = "trend",
            label = f"{v.trend_direction.capitalize()} LO Trend ({v.trend_slope:+.2f} pts/session)",
            value   = round(v.trend_slope, 3),
            unit    = "pts/session",
            detail  = detail,
            weight  = weight,
        ))
        return items

    def _stability_evidence(self) -> list[EvidenceItem]:
        """Generate evidence items from stability analysis signals."""
        items = []
        v = self.vector

        if v.stability_sd is None:
            return items

        weight = 0.85 if v.at_risk_flag else (
            0.6 if v.stability_level == "moderate" else 0.3
        )

        detail = (
            f"Performance stability analysis: SD = {v.stability_sd:.2f}"
        )
        if v.stability_cv is not None:
            detail += f", CV = {v.stability_cv:.1f}%"
        if v.at_risk_flag:
            detail += (
                ". SD exceeds class mean + 1.5 SD threshold — "
                "student flagged as at-risk for erratic performance."
            )
        else:
            detail += f". Stability level: {v.stability_level}."

        items.append(EvidenceItem(
            signal  = "stability",
            label   = f"{v.stability_level.capitalize()} Performance Stability",
            value   = round(v.stability_sd, 3),
            unit    = "SD (LO score)",
            detail  = detail,
            weight  = weight,
        ))
        return items

    def _emotion_evidence(self) -> list[EvidenceItem]:
        """Generate evidence items from emotion correlation signals."""
        items = []
        v = self.vector

        if v.strongest_emotion_r is None:
            return items

        abs_r   = abs(v.strongest_emotion_r)
        weight  = (
            0.9 if abs_r >= 0.5 else
            0.7 if abs_r >= 0.3 else
            0.4
        )

        direction = (
            "positively" if v.strongest_emotion_r > 0 else "negatively"
        )
        detail = (
            f"Pearson correlation between '{v.strongest_emotion_name}' "
            f"and LO scores: r = {v.strongest_emotion_r:.3f}. "
            f"'{v.strongest_emotion_name.capitalize()}' is {direction} "
            f"correlated with learning outcomes."
        )
        if v.significant_negative_emotions:
            detail += (
                f" Additional negative correlates: "
                f"{', '.join(v.significant_negative_emotions)}."
            )

        items.append(EvidenceItem(
            signal  = "emotion",
            label   = f"Emotion–LO Correlation ({v.strongest_emotion_name})",
            value   = round(v.strongest_emotion_r, 3),
            unit    = "Pearson r",
            detail  = detail,
            weight  = weight,
        ))
        return items

    def _engagement_evidence(self) -> list[EvidenceItem]:
        """Generate evidence items from engagement comparison signals."""
        items = []
        v = self.vector

        if v.mean_engagement_score is None:
            return items

        weight = (
            0.8 if v.engagement_significant else
            0.5 if v.engagement_level == "high" else
            0.4
        )

        detail = (
            f"Mean engagement score: {v.mean_engagement_score:.2f} / 1.00 "
            f"({v.engagement_level} engagement)."
        )
        if v.engagement_effect_size is not None:
            detail += (
                f" Mann-Whitney effect size r = {v.engagement_effect_size:.3f}"
            )
            if v.engagement_significant:
                detail += " (statistically significant difference between high and low engagement sessions)."
            else:
                detail += "."

        items.append(EvidenceItem(
            signal  = "engagement",
            label   = f"{v.engagement_level.capitalize()} Engagement",
            value   = round(v.mean_engagement_score, 3),
            unit    = "mean score (0–1)",
            detail  = detail,
            weight  = weight,
        ))
        return items


# ======================================================================
# Main Orchestrator — SuggestionEngine
# ======================================================================

class SuggestionEngine:
    """
    Orchestrates the first three layers of the ERSE pipeline for a
    single student and returns a SuggestionPayload ready for the
    SuggestionGenerator (Layer 4).

    Layers executed:
      1. SignalAggregator  → StudentStateVector
      2. PatternClassifier → PatternResult
      3. EvidenceBuilder   → list[EvidenceItem]

    Parameters
    ----------
    student_id : str
        The student identifier (primary key in student_profiles).

    Examples
    --------
    >>> engine = SuggestionEngine("STU_001")
    >>> payload = engine.run()
    >>> print(payload.pattern.pattern_name)
    'Declining Achiever'
    >>> print(payload.pattern.confidence_label)
    'High'
    """

    def __init__(self, student_id: str) -> None:
        self.student_id = student_id

    def run(self) -> SuggestionPayload:
        """
        Execute all three engine layers and return the payload.

        Returns
        -------
        SuggestionPayload
            Contains state_vector, pattern, and evidence list.

        Raises
        ------
        RuntimeError
            If the signal aggregation step fails critically.
        """
        logger.info("SuggestionEngine starting for student %s", self.student_id)

        # Layer 1: aggregate signals
        aggregator      = SignalAggregator(self.student_id)
        state_vector    = aggregator.aggregate()

        # Layer 2: classify pattern
        classifier      = PatternClassifier(state_vector)
        pattern         = classifier.classify()

        # Layer 3: build evidence
        builder         = EvidenceBuilder(state_vector, pattern)
        evidence        = builder.build()

        logger.info(
            "SuggestionEngine complete for %s — pattern: '%s' "
            "confidence: %s urgency: %s evidence_items: %d",
            self.student_id,
            pattern.pattern_name,
            pattern.confidence_label,
            pattern.urgency,
            len(evidence),
        )

        return SuggestionPayload(
            student_id      = self.student_id,
            state_vector    = state_vector,
            pattern         = pattern,
            evidence        = evidence,
        )