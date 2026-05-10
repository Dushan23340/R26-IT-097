"""
Engagement–Performance Comparator.

Compares learning outcomes between high and low engagement sessions
using the Mann-Whitney U test (non-parametric) to determine whether
students perform significantly better when highly engaged.

Uses the connection pool from config.database.

Usage:
    from services.engagement_comparator import EngagementPerformanceComparator

    comparator = EngagementPerformanceComparator(student_id="STU_001")
    result = comparator.get_analysis()
    print(result["interpretation"])
"""

import logging
import warnings

import numpy as np
from scipy.stats import mannwhitneyu

from config.database import get_cursor

logger = logging.getLogger(__name__)

MIN_SESSIONS_PER_GROUP = 3


# =============================================================================
# EngagementPerformanceComparator
# =============================================================================
class EngagementPerformanceComparator:
    """Mann-Whitney U comparison of LO scores by engagement level."""

    def __init__(self, student_id: str):
        """Store student ID and initialise internal caches.

        Parameters
        ----------
        student_id : str
            The student identifier (primary key in student_profiles).
        """
        self.student_id = student_id
        self._sessions: list[dict] | None = None
        self._high_sessions: list[dict] | None = None
        self._low_sessions: list[dict] | None = None

    # ------------------------------------------------------------------
    # Fetch sessions with engagement + LO scores
    # ------------------------------------------------------------------
    def _fetch_sessions(self) -> list[dict]:
        """Query every session for this student with engagement score
        and average LO score.

        Returns
        -------
        list[dict]
            Each dict has keys: session_id, engagement_score, avg_lo_score.
        """
        if self._sessions is not None:
            return self._sessions

        try:
            with get_cursor() as cur:
                cur.execute(
                    """
                    SELECT
                        ls.session_id,
                        em.engagement_score,
                        AVG(lo.score) AS avg_lo_score
                    FROM learning_sessions ls
                    JOIN engagement_metrics em
                        ON ls.session_id = em.session_id
                    LEFT JOIN lo_achievement_scores lo
                        ON ls.session_id = lo.session_id
                    WHERE ls.student_id = %s
                    GROUP BY ls.session_id, em.engagement_score
                    ORDER BY ls.start_time
                    """,
                    (self.student_id,),
                )
                rows = cur.fetchall()
        except Exception as exc:
            logger.error(
                "Failed to fetch sessions for %s: %s", self.student_id, exc
            )
            self._sessions = []
            return self._sessions

        sessions: list[dict] = []
        for row in rows:
            session_id, engagement_score, avg_lo_score = row
            if avg_lo_score is not None:
                sessions.append(
                    {
                        "session_id": session_id,
                        "engagement_score": float(engagement_score),
                        "avg_lo_score": float(avg_lo_score),
                    }
                )

        self._sessions = sessions
        return self._sessions

    # ------------------------------------------------------------------
    # Classify sessions by engagement threshold
    # ------------------------------------------------------------------
    def classify_sessions_by_engagement(
        self, threshold: float | None = None
    ) -> tuple[list[dict], list[dict]]:
        """Split sessions into high- and low-engagement groups.

        Parameters
        ----------
        threshold : float or None
            If None, the median engagement score is used as the cut-off.
            If provided, sessions with engagement_score >= threshold are
            placed in the high group.

        Returns
        -------
        tuple(high_engagement_sessions, low_engagement_sessions)
            Both are lists of session dicts.
        """
        sessions = self._fetch_sessions()

        if not sessions:
            self._high_sessions = []
            self._low_sessions = []
            return (self._high_sessions, self._low_sessions)

        engagement_scores = [s["engagement_score"] for s in sessions]

        # Guard: zero variance in engagement scores
        if len(set(engagement_scores)) == 1:
            self._high_sessions = []
            self._low_sessions = []
            return (self._high_sessions, self._low_sessions)

        if threshold is None:
            threshold = float(np.median(engagement_scores))

        high = [s for s in sessions if s["engagement_score"] >= threshold]
        low = [s for s in sessions if s["engagement_score"] < threshold]

        self._high_sessions = high
        self._low_sessions = low
        return (high, low)

    # ------------------------------------------------------------------
    # Extract LO score arrays for each group
    # ------------------------------------------------------------------
    def extract_lo_scores_by_group(self) -> tuple[np.ndarray, np.ndarray]:
        """Return numpy arrays of avg LO scores for high / low groups.

        Returns
        -------
        tuple(high_engagement_scores, low_engagement_scores)
        """
        if self._high_sessions is None or self._low_sessions is None:
            self.classify_sessions_by_engagement()

        high_scores = np.array(
            [s["avg_lo_score"] for s in self._high_sessions]
        )
        low_scores = np.array(
            [s["avg_lo_score"] for s in self._low_sessions]
        )
        return (high_scores, low_scores)

    # ------------------------------------------------------------------
    # Mann-Whitney U test
    # ------------------------------------------------------------------
    def perform_mann_whitney_test(self) -> tuple[float, float] | None:
        """Run scipy.stats.mannwhitneyu with alternative='greater'.

        Tests whether the high-engagement group has *higher* LO scores
        than the low-engagement group.

        Returns
        -------
        tuple(U_statistic, p_value) or None
            None is returned when there are fewer than
            MIN_SESSIONS_PER_GROUP in either group.
        """
        high_scores, low_scores = self.extract_lo_scores_by_group()

        if (
            len(high_scores) < MIN_SESSIONS_PER_GROUP
            or len(low_scores) < MIN_SESSIONS_PER_GROUP
        ):
            return None

        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            try:
                result = mannwhitneyu(
                    high_scores,
                    low_scores,
                    alternative="greater",
                )
            except ValueError as exc:
                logger.warning(
                    "Mann-Whitney U failed for %s: %s", self.student_id, exc
                )
                return None

        return (float(result.statistic), float(result.pvalue))

    # ------------------------------------------------------------------
    # Effect size (rank-biserial correlation)
    # ------------------------------------------------------------------
    def compute_effect_size(self) -> float | None:
        """Calculate rank-biserial correlation as effect size.

        The formula is sign-adjusted so that a *positive* value means the
        high-engagement group scored higher (which matches the
        interpretation logic).

        Returns
        -------
        float or None
            Effect size r, or None if the test could not be performed.
        """
        test_result = self.perform_mann_whitney_test()
        if test_result is None:
            return None

        U_stat, _ = test_result
        high_scores, low_scores = self.extract_lo_scores_by_group()
        n1, n2 = len(high_scores), len(low_scores)

        # Sign-adjusted formula so that r > 0 when high > low.
        # (Equivalent in magnitude to 1 - (2*U)/(n1*n2).)
        r = (2.0 * U_stat) / (n1 * n2) - 1.0
        return float(r)

    # ------------------------------------------------------------------
    # Descriptive statistics
    # ------------------------------------------------------------------
    def get_descriptive_statistics(self) -> dict:
        """Compute mean, median, std, min, max, count for both groups.

        Returns
        -------
        dict
            Keys: high_engagement, low_engagement.
            Each maps to a dict with keys: mean, median, std_dev,
            min, max, count.
        """
        high_scores, low_scores = self.extract_lo_scores_by_group()

        def _stats(arr: np.ndarray) -> dict:
            if len(arr) == 0:
                return {
                    "mean": None,
                    "median": None,
                    "std_dev": None,
                    "min": None,
                    "max": None,
                    "count": 0,
                }
            return {
                "mean": float(np.mean(arr)),
                "median": float(np.median(arr)),
                "std_dev": (
                    float(np.std(arr, ddof=1)) if len(arr) > 1 else 0.0
                ),
                "min": float(np.min(arr)),
                "max": float(np.max(arr)),
                "count": int(len(arr)),
            }

        return {
            "high_engagement": _stats(high_scores),
            "low_engagement": _stats(low_scores),
        }

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    @staticmethod
    def _classify_effect_size(r: float) -> str:
        """Classify absolute effect size magnitude."""
        ar = abs(r)
        if ar < 0.3:
            return "small"
        if ar < 0.5:
            return "medium"
        return "large"

    # ------------------------------------------------------------------
    # Complete analysis
    # ------------------------------------------------------------------
    def get_analysis(self) -> dict:
        """Return complete comparison analysis with interpretation.

        Returns
        -------
        dict with keys:
            student_id, num_sessions, threshold,
            high_group_count, low_group_count,
            mann_whitney, effect_size, effect_size_magnitude,
            descriptive_statistics, interpretation
        """
        sessions = self._fetch_sessions()

        # -- no sessions at all --
        if not sessions:
            return {
                "student_id": self.student_id,
                "num_sessions": 0,
                "threshold": None,
                "high_group_count": 0,
                "low_group_count": 0,
                "mann_whitney": None,
                "effect_size": None,
                "effect_size_magnitude": None,
                "descriptive_statistics": self.get_descriptive_statistics(),
                "interpretation": "No sessions found for this student.",
            }

        engagement_scores = [s["engagement_score"] for s in sessions]

        # -- no variance in engagement --
        if len(set(engagement_scores)) == 1:
            return {
                "student_id": self.student_id,
                "num_sessions": len(sessions),
                "threshold": engagement_scores[0],
                "high_group_count": 0,
                "low_group_count": 0,
                "mann_whitney": None,
                "effect_size": None,
                "effect_size_magnitude": None,
                "descriptive_statistics": self.get_descriptive_statistics(),
                "interpretation": (
                    "Cannot split - no variance in engagement."
                ),
            }

        high, low = self.classify_sessions_by_engagement()
        threshold = float(np.median(engagement_scores))

        # -- insufficient data per group --
        if (
            len(high) < MIN_SESSIONS_PER_GROUP
            or len(low) < MIN_SESSIONS_PER_GROUP
        ):
            return {
                "student_id": self.student_id,
                "num_sessions": len(sessions),
                "threshold": threshold,
                "high_group_count": len(high),
                "low_group_count": len(low),
                "mann_whitney": None,
                "effect_size": None,
                "effect_size_magnitude": None,
                "descriptive_statistics": self.get_descriptive_statistics(),
                "interpretation": (
                    "Insufficient data (need at least 3 per group)."
                ),
            }

        # -- run statistical test --
        mw_result = self.perform_mann_whitney_test()
        if mw_result is None:
            return {
                "student_id": self.student_id,
                "num_sessions": len(sessions),
                "threshold": threshold,
                "high_group_count": len(high),
                "low_group_count": len(low),
                "mann_whitney": None,
                "effect_size": None,
                "effect_size_magnitude": None,
                "descriptive_statistics": self.get_descriptive_statistics(),
                "interpretation": (
                    "Statistical test could not be performed."
                ),
            }

        U_stat, p_value = mw_result
        r = self.compute_effect_size()
        magnitude = (
            self._classify_effect_size(r) if r is not None else None
        )

        # -- interpretation logic --
        if p_value < 0.05 and r is not None and r >= 0.3:
            interpretation = (
                f"Student shows statistically significant higher performance "
                f"in high-engagement sessions with a {magnitude} effect size. "
                f"Maintaining high engagement is crucial."
            )
        elif p_value < 0.05 and r is not None and r < 0.3:
            interpretation = (
                "While statistically significant, the practical difference is "
                "small. Engagement may be one of several factors affecting "
                "performance."
            )
        else:
            interpretation = (
                "No significant difference found. For this student, engagement "
                "level may not be a primary driver of performance."
            )

        return {
            "student_id": self.student_id,
            "num_sessions": len(sessions),
            "threshold": threshold,
            "high_group_count": len(high),
            "low_group_count": len(low),
            "mann_whitney": {
                "U_statistic": U_stat,
                "p_value": p_value,
            },
            "effect_size": r,
            "effect_size_magnitude": magnitude,
            "descriptive_statistics": self.get_descriptive_statistics(),
            "interpretation": interpretation,
        }
