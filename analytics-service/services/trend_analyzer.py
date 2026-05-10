"""
Trend Analyzer for Student Learning Outcomes.

Performs linear-regression analysis on per-session average LO scores
to detect improving, declining, or stable learning trends.

Uses the connection pool from config.database.

Usage:
    from services.trend_analyzer import TrendAnalyzer

    analyzer = TrendAnalyzer(student_id="STU_001")
    summary = analyzer.get_analysis_summary()
    analyzer.generate_visualization("output/trend_STU_001.png")
"""

import logging
import os
from pathlib import Path

import matplotlib
matplotlib.use("Agg")  # non-interactive backend — safe for servers
import matplotlib.pyplot as plt
import numpy as np
from scipy import stats

from config.database import get_cursor

logger = logging.getLogger(__name__)

# Minimum sessions required for meaningful regression
MIN_SESSIONS = 3


class TrendAnalyzer:
    """Analyse learning-outcome trends for a single student."""

    def __init__(self, student_id: str):
        """Initialise the analyser and fetch session metadata.

        Parameters
        ----------
        student_id : str
            The student identifier (primary key in student_profiles).
        """
        self.student_id = student_id
        self.sessions: list[dict] = []
        self._fetch_sessions()

    # ------------------------------------------------------------------
    # Internal: load sessions ordered chronologically
    # ------------------------------------------------------------------
    def _fetch_sessions(self) -> None:
        """Fetch all learning sessions for the student, ordered by time."""
        try:
            with get_cursor() as cur:
                cur.execute(
                    """
                    SELECT session_id, start_time, lesson_id
                    FROM learning_sessions
                    WHERE student_id = %s
                    ORDER BY start_time ASC
                    """,
                    (self.student_id,),
                )
                rows = cur.fetchall()
                self.sessions = [
                    {
                        "session_id": row[0],
                        "start_time": row[1],
                        "lesson_id": row[2],
                    }
                    for row in rows
                ]
            logger.info(
                "Fetched %d sessions for student %s",
                len(self.sessions), self.student_id,
            )
        except Exception as exc:
            logger.error("Failed to fetch sessions for %s: %s", self.student_id, exc)
            self.sessions = []

    # ------------------------------------------------------------------
    # 1. Fetch LO time-series
    # ------------------------------------------------------------------
    def fetch_lo_timeseries(self) -> tuple[np.ndarray, np.ndarray]:
        """Query LO achievement scores and return per-session averages.

        Returns
        -------
        session_numbers : np.ndarray
            Sequential session indices [1, 2, 3, …].
        avg_scores : np.ndarray
            Mean LO score for each session.
        """
        if len(self.sessions) < MIN_SESSIONS:
            logger.warning(
                "Student %s has only %d session(s) — need at least %d",
                self.student_id, len(self.sessions), MIN_SESSIONS,
            )
            return np.array([]), np.array([])

        # Map session_id → chronological position (1-based)
        session_id_to_num = {
            sess["session_id"]: idx + 1
            for idx, sess in enumerate(self.sessions)
        }

        try:
            with get_cursor() as cur:
                cur.execute(
                    """
                    SELECT session_id, AVG(score) AS avg_score
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
            return np.array([]), np.array([])

        if not rows:
            logger.warning("No LO scores found for student %s", self.student_id)
            return np.array([]), np.array([])

        session_numbers: list[float] = []
        avg_scores: list[float] = []

        for session_id, avg_score in rows:
            num = session_id_to_num.get(session_id)
            if num is not None and avg_score is not None:
                # Guard against NaN
                if np.isnan(float(avg_score)):
                    continue
                session_numbers.append(float(num))
                avg_scores.append(float(avg_score))

        return np.array(session_numbers), np.array(avg_scores)

    # ------------------------------------------------------------------
    # 2. Compute linear regression
    # ------------------------------------------------------------------
    def compute_linear_regression(
        self,
        session_numbers: np.ndarray | None = None,
        avg_scores: np.ndarray | None = None,
    ) -> dict:
        """Run scipy.stats.linregress on the LO time-series.

        Parameters
        ----------
        session_numbers, avg_scores : np.ndarray, optional
            Pre-fetched arrays.  If omitted, ``fetch_lo_timeseries()``
            is called automatically.

        Returns
        -------
        dict with keys: slope, intercept, r_value, p_value, std_err,
                        r_squared.  Returns empty dict on error or
                        insufficient data.
        """
        if session_numbers is None or avg_scores is None:
            session_numbers, avg_scores = self.fetch_lo_timeseries()

        if len(session_numbers) < MIN_SESSIONS:
            logger.warning(
                "Insufficient data points (%d) for regression on %s",
                len(session_numbers), self.student_id,
            )
            return {}

        # Replace any remaining NaN values
        try:
            mask = ~(np.isnan(session_numbers) | np.isnan(avg_scores))
            session_numbers = session_numbers[mask]
            avg_scores = avg_scores[mask]
        except TypeError:
            logger.error("Failed to filter NaN values for %s", self.student_id)
            return {}

        if len(session_numbers) < MIN_SESSIONS:
            return {}

        try:
            result = stats.linregress(session_numbers, avg_scores)
        except (ValueError, ZeroDivisionError) as exc:
            logger.error("Regression failed for %s: %s", self.student_id, exc)
            return {}

        return {
            "slope": float(result.slope),
            "intercept": float(result.intercept),
            "r_value": float(result.rvalue),
            "p_value": float(result.pvalue),
            "std_err": float(result.stderr),
            "r_squared": float(result.rvalue ** 2),
        }

    # ------------------------------------------------------------------
    # 3. Classify trend
    # ------------------------------------------------------------------
    @staticmethod
    def classify_trend(regression_results: dict) -> str:
        """Classify the trend based on regression statistics.

        Returns
        -------
        'improving'  — slope > 0.5 AND p_value < 0.05
        'declining'  — slope < -0.5 AND p_value < 0.05
        'stable'     — |slope| <= 0.5
        'unstable'   — trend exists but is not statistically significant
        """
        if not regression_results:
            return "unstable"

        slope = regression_results.get("slope", 0.0)
        p_value = regression_results.get("p_value", 1.0)

        # Handle NaN
        if np.isnan(slope) or np.isnan(p_value):
            return "unstable"

        if abs(slope) <= 0.5:
            return "stable"
        if slope > 0.5 and p_value < 0.05:
            return "improving"
        if slope < -0.5 and p_value < 0.05:
            return "declining"
        return "unstable"

    # ------------------------------------------------------------------
    # 4. Generate visualization
    # ------------------------------------------------------------------
    def generate_visualization(
        self,
        output_path: str,
        session_numbers: np.ndarray | None = None,
        avg_scores: np.ndarray | None = None,
        regression_results: dict | None = None,
    ) -> str:
        """Create a scatter plot with regression line and save as PNG.

        Parameters
        ----------
        output_path : str
            File path for the output PNG.
        session_numbers, avg_scores : np.ndarray, optional
            Pre-fetched arrays.  If omitted, fetched automatically.
        regression_results : dict, optional
            Pre-computed regression.  If omitted, computed automatically.

        Returns
        -------
        The absolute path of the saved PNG, or empty string on error.
        """
        if session_numbers is None or avg_scores is None:
            session_numbers, avg_scores = self.fetch_lo_timeseries()

        if len(session_numbers) < MIN_SESSIONS:
            logger.warning(
                "Cannot generate visualization for %s — only %d data points",
                self.student_id, len(session_numbers),
            )
            return ""

        if regression_results is None:
            regression_results = self.compute_linear_regression(
                session_numbers, avg_scores,
            )

        if not regression_results:
            logger.warning("No regression results — skipping visualization for %s", self.student_id)
            return ""

        slope = regression_results["slope"]
        intercept = regression_results["intercept"]
        r_squared = regression_results["r_squared"]

        # Build plot
        fig, ax = plt.subplots(figsize=(8, 5))

        # Scatter: actual data points
        ax.scatter(session_numbers, avg_scores, color="steelblue",
                   edgecolors="white", s=60, zorder=3, label="Avg LO Score")

        # Regression line
        x_line = np.linspace(session_numbers.min(), session_numbers.max(), 100)
        y_line = slope * x_line + intercept
        ax.plot(x_line, y_line, color="crimson", linewidth=2,
                label=f"Fit: y = {slope:.2f}x + {intercept:.1f}")

        # Annotations
        equation = f"y = {slope:.2f}x + {intercept:.1f}"
        ax.set_title(
            f"LO Score Trend — {self.student_id}\n"
            f"{equation}   (R² = {r_squared:.3f})",
            fontsize=12,
        )
        ax.set_xlabel("Session Number", fontsize=11)
        ax.set_ylabel("Average LO Score", fontsize=11)
        ax.legend(loc="best", fontsize=10)
        ax.set_ylim(bottom=0, top=100)
        ax.grid(True, alpha=0.3)

        fig.tight_layout()

        # Ensure output directory exists
        out = Path(output_path)
        out.parent.mkdir(parents=True, exist_ok=True)

        try:
            fig.savefig(str(out), dpi=150)
            logger.info("Visualization saved to %s", out.resolve())
        except Exception as exc:
            logger.error("Failed to save visualization: %s", exc)
            return ""
        finally:
            plt.close(fig)

        return str(out.resolve())

    # ------------------------------------------------------------------
    # 5. Complete analysis summary
    # ------------------------------------------------------------------
    def get_analysis_summary(self) -> dict:
        """Return a complete analysis dict for the student.

        Keys: student_id, num_sessions, regression_stats,
              trend_classification, interpretation.
        """
        session_numbers, avg_scores = self.fetch_lo_timeseries()
        regression = self.compute_linear_regression(session_numbers, avg_scores)
        classification = self.classify_trend(regression)

        # Natural-language interpretation
        interpretation = self._interpret(classification, regression, avg_scores)

        return {
            "student_id": self.student_id,
            "num_sessions": len(self.sessions),
            "regression_stats": regression,
            "trend_classification": classification,
            "interpretation": interpretation,
        }

    # ------------------------------------------------------------------
    # Internal: human-readable interpretation
    # ------------------------------------------------------------------
    @staticmethod
    def _interpret(classification: str, regression: dict, scores: np.ndarray) -> str:
        """Generate a natural-language description of the trend."""
        if not regression or len(scores) == 0:
            return (
                "Insufficient data to determine a learning trend. "
                "At least 3 sessions with LO scores are required."
            )

        slope = regression["slope"]
        r_sq = regression["r_squared"]
        p = regression["p_value"]
        mean_score = float(np.mean(scores))

        if classification == "improving":
            return (
                f"This student shows a statistically significant improving trend "
                f"(slope = {slope:+.2f} pts/session, p = {p:.4f}). "
                f"On average, LO scores increase by approximately "
                f"{abs(slope):.1f} points each session. "
                f"The model explains {r_sq * 100:.1f}% of the variance "
                f"(R² = {r_sq:.3f}). Mean score: {mean_score:.1f}."
            )
        if classification == "declining":
            return (
                f"This student shows a statistically significant declining trend "
                f"(slope = {slope:+.2f} pts/session, p = {p:.4f}). "
                f"On average, LO scores decrease by approximately "
                f"{abs(slope):.1f} points each session. "
                f"Intervention may be needed. "
                f"The model explains {r_sq * 100:.1f}% of the variance "
                f"(R² = {r_sq:.3f}). Mean score: {mean_score:.1f}."
            )
        if classification == "stable":
            return (
                f"This student's performance is stable "
                f"(slope = {slope:+.2f} pts/session, |slope| ≤ 0.5). "
                f"Scores are consistent around {mean_score:.1f}. "
                f"R² = {r_sq:.3f}."
            )
        # unstable
        return (
            f"A trend is present (slope = {slope:+.2f}) but it is not "
            f"statistically significant (p = {p:.4f} ≥ 0.05). "
            f"More data is needed to confirm the direction. "
            f"Mean score: {mean_score:.1f}, R² = {r_sq:.3f}."
        )
