"""
Stability Analyzer for Student Learning Outcomes.

Performs variance-based stability analysis to identify at-risk students
with erratic performance patterns.

Uses the connection pool from config.database.

Usage:
    from services.stability_analyzer import StabilityAnalyzer, compute_class_statistics

    analyzer = StabilityAnalyzer(student_id="STU_001")
    result = analyzer.get_analysis()
    print(result["interpretation"])

    # Class-level baseline
    stats = compute_class_statistics(student_ids=["STU_001", "STU_002", ...])
"""

import logging

import numpy as np

from config.database import get_cursor

logger = logging.getLogger(__name__)

# Minimum sessions for meaningful stability analysis
MIN_SESSIONS = 3


class StabilityAnalyzer:
    """Variance-based stability analysis for a single student."""

    def __init__(self, student_id: str):
        """Store student ID and fetch LO scores.

        Parameters
        ----------
        student_id : str
            The student identifier (primary key in student_profiles).
        """
        self.student_id = student_id
        self._scores: np.ndarray | None = None

    # ------------------------------------------------------------------
    # Fetch LO scores
    # ------------------------------------------------------------------
    def fetch_lo_scores(self) -> np.ndarray:
        """Query average LO score per session in chronological order.

        Returns
        -------
        np.ndarray
            Array of per-session average LO scores, ordered chronologically.
            Empty array if insufficient data.
        """
        if self._scores is not None:
            return self._scores

        try:
            with get_cursor() as cur:
                cur.execute(
                    """
                    SELECT AVG(score) AS avg_score
                    FROM lo_achievement_scores
                    WHERE student_id = %s
                    GROUP BY session_id
                    ORDER BY MIN(created_at)
                    """,
                    (self.student_id,),
                )
                rows = cur.fetchall()
        except Exception as exc:
            logger.error("Failed to fetch LO scores for %s: %s", self.student_id, exc)
            self._scores = np.array([])
            return self._scores

        if not rows:
            logger.warning("No LO scores found for student %s", self.student_id)
            self._scores = np.array([])
            return self._scores

        scores = [float(row[0]) for row in rows if row[0] is not None and not np.isnan(float(row[0]))]
        self._scores = np.array(scores)
        return self._scores

    # ------------------------------------------------------------------
    # Compute variance
    # ------------------------------------------------------------------
    def compute_variance(self) -> float | None:
        """Calculate sample variance of LO scores.

        Uses np.var(scores, ddof=1) for unbiased sample variance.

        Returns
        -------
        float or None
            Sample variance, or None if insufficient data.
        """
        scores = self.fetch_lo_scores()
        if len(scores) < MIN_SESSIONS:
            return None
        return float(np.var(scores, ddof=1))

    # ------------------------------------------------------------------
    # Compute rolling variance
    # ------------------------------------------------------------------
    def compute_rolling_variance(self, window_size: int = 3) -> list[tuple[int, float]]:
        """Calculate rolling-window variance across sessions.

        For each position *i*, compute variance of
        scores[i : i + window_size].

        Parameters
        ----------
        window_size : int
            Number of consecutive sessions in each window (default 3).

        Returns
        -------
        list of (session_index, variance)
            Each tuple maps a starting session index to the variance
            within that window.  Empty list if insufficient data.
        """
        scores = self.fetch_lo_scores()
        if len(scores) < window_size:
            return []

        rolling: list[tuple[int, float]] = []
        for i in range(len(scores) - window_size + 1):
            window = scores[i : i + window_size]
            var = float(np.var(window, ddof=1)) if len(window) >= 2 else 0.0
            rolling.append((i, var))
        return rolling

    # ------------------------------------------------------------------
    # Compute standard deviation
    # ------------------------------------------------------------------
    def compute_standard_deviation(self) -> float | None:
        """Calculate sample standard deviation of LO scores.

        Uses np.std(scores, ddof=1).

        Returns
        -------
        float or None
            Sample SD, or None if insufficient data.
        """
        scores = self.fetch_lo_scores()
        if len(scores) < MIN_SESSIONS:
            return None
        return float(np.std(scores, ddof=1))

    # ------------------------------------------------------------------
    # Compute coefficient of variation
    # ------------------------------------------------------------------
    def compute_coefficient_of_variation(self) -> float | None:
        """Calculate Coefficient of Variation (CV) as a percentage.

        Formula:  CV = (SD / Mean) × 100

        Returns
        -------
        float or None
            CV percentage, None if mean is zero / near-zero or
            insufficient data.
        """
        scores = self.fetch_lo_scores()
        if len(scores) < MIN_SESSIONS:
            return None

        mean = float(np.mean(scores))
        sd = float(np.std(scores, ddof=1))

        if abs(mean) < 1e-10:
            logger.warning(
                "Mean is ~0 for %s — CV is undefined", self.student_id,
            )
            return None

        return (sd / abs(mean)) * 100.0

    # ------------------------------------------------------------------
    # Flag at-risk
    # ------------------------------------------------------------------
    @staticmethod
    def flag_at_risk(
        student_sd: float,
        class_mean_sd: float,
        class_sd_of_sds: float,
        threshold_multiplier: float = 1.5,
    ) -> bool:
        """Flag a student as at-risk based on their SD vs the class.

        Formula:
            student_SD > class_mean_SD + (threshold_multiplier × class_SD_of_SDs)

        Parameters
        ----------
        student_sd : float
            The student's standard deviation.
        class_mean_sd : float
            Mean of all students' SDs.
        class_sd_of_sds : float
            Standard deviation of all students' SDs.
        threshold_multiplier : float
            Number of SDs above the mean to flag (default 1.5).

        Returns
        -------
        bool
            True if the student is at-risk, False otherwise.
        """
        if class_sd_of_sds == 0:
            # All students have the same SD — no one is an outlier
            return False
        return student_sd > class_mean_sd + (threshold_multiplier * class_sd_of_sds)

    # ------------------------------------------------------------------
    # Get complete analysis
    # ------------------------------------------------------------------
    def get_analysis(self) -> dict:
        """Return complete stability analysis for the student.

        Returns
        -------
        dict with keys: student_id, num_sessions, variance, sd, cv,
              rolling_variance, interpretation.
        """
        scores = self.fetch_lo_scores()
        n = len(scores)

        if n < MIN_SESSIONS:
            return {
                "student_id": self.student_id,
                "num_sessions": n,
                "variance": None,
                "sd": None,
                "cv": None,
                "rolling_variance": [],
                "interpretation": "Insufficient data for stability analysis.",
            }

        variance = self.compute_variance()
        sd = self.compute_standard_deviation()
        cv = self.compute_coefficient_of_variation()
        rolling = self.compute_rolling_variance()
        interpretation = self._interpret(cv, sd, variance)

        return {
            "student_id": self.student_id,
            "num_sessions": n,
            "variance": variance,
            "sd": sd,
            "cv": cv,
            "rolling_variance": rolling,
            "interpretation": interpretation,
        }

    # ------------------------------------------------------------------
    # Internal: interpretation
    # ------------------------------------------------------------------
    @staticmethod
    def _interpret(cv: float | None, sd: float | None, variance: float | None) -> str:
        """Generate natural-language interpretation from CV value."""
        if cv is None:
            if sd is not None and sd == 0:
                return (
                    "All scores are identical — zero variance. "
                    "Performance is perfectly stable but may indicate "
                    "ceiling or floor effects."
                )
            return "Insufficient data for stability analysis."

        if cv < 10:
            return "Very stable performance."
        if cv < 20:
            return "Stable performance with minor fluctuations."
        if cv < 30:
            return "Moderate performance variability."
        if cv < 50:
            return "High performance variability — student may need support."
        return "Very high performance variability — at-risk student."


# ======================================================================
# Module-level: class-level statistics
# ======================================================================
def compute_class_statistics(student_ids: list[str]) -> dict:
    """Compute baseline class-level SD statistics.

    For each student, calculate their SD. Then compute the mean and SD
    of those SDs to establish a class baseline for at-risk flagging.

    Parameters
    ----------
    student_ids : list[str]
        List of student identifiers to include.

    Returns
    -------
    dict with keys:
        student_sds  — dict mapping student_id → SD (or None)
        class_mean_sd — float, mean of all valid SDs
        class_sd_of_sds — float, SD of all valid SDs
        num_valid — int, count of students with valid SDs
    """
    student_sds: dict[str, float | None] = {}
    valid_sds: list[float] = []

    for sid in student_ids:
        analyzer = StabilityAnalyzer(student_id=sid)
        sd = analyzer.compute_standard_deviation()
        student_sds[sid] = sd
        if sd is not None:
            valid_sds.append(sd)

    if not valid_sds:
        return {
            "student_sds": student_sds,
            "class_mean_sd": 0.0,
            "class_sd_of_sds": 0.0,
            "num_valid": 0,
        }

    sd_array = np.array(valid_sds)
    class_mean_sd = float(np.mean(sd_array))
    class_sd_of_sds = float(np.std(sd_array, ddof=1)) if len(valid_sds) > 1 else 0.0

    return {
        "student_sds": student_sds,
        "class_mean_sd": class_mean_sd,
        "class_sd_of_sds": class_sd_of_sds,
        "num_valid": len(valid_sds),
    }
