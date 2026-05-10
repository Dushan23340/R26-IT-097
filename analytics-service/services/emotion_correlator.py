"""
Emotion–Learning Outcome Correlation Analyzer.

Performs Pearson correlation analysis between emotional states and
learning outcome scores to identify significant emotion–performance
relationships.

Uses the connection pool from config.database.

Usage:
    from services.emotion_correlator import EmotionCorrelationAnalyzer

    analyzer = EmotionCorrelationAnalyzer(student_id="STU_001")
    result = analyzer.get_analysis()
    print(result["summary"])
"""

import logging
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from scipy.stats import pearsonr

from config.database import get_cursor

logger = logging.getLogger(__name__)

MIN_SESSIONS = 3

# Emotions in the database (schema constraint)
DB_EMOTIONS = ["happy", "neutral", "sad", "angry", "surprised", "confused", "bored"]

# Full analysis list (includes 'frustrated' for completeness — will show
# "not observed" since it is mapped to 'angry' in the data generator)
ALL_EMOTIONS = DB_EMOTIONS + ["frustrated"]


# ======================================================================
# Helper: classify correlation strength / direction
# ======================================================================
def _classify_strength(r: float) -> str:
    """Classify the absolute magnitude of a correlation coefficient."""
    ar = abs(r)
    if ar < 0.3:
        return "weak"
    if ar < 0.5:
        return "moderate"
    if ar < 0.7:
        return "strong"
    return "very strong"


def _classify_direction(r: float) -> str:
    """Classify the direction of a correlation coefficient."""
    if r > 0:
        return "positive"
    if r < 0:
        return "negative"
    return "none"


# ======================================================================
# EmotionCorrelationAnalyzer
# ======================================================================
class EmotionCorrelationAnalyzer:
    """Pearson correlation analysis between emotions and LO scores."""

    def __init__(self, student_id: str):
        """Store student ID and fetch session-level data.

        Parameters
        ----------
        student_id : str
            The student identifier (primary key in student_profiles).
        """
        self.student_id = student_id
        self._emotion_map: dict | None = None
        self._lo_map: dict | None = None

    # ------------------------------------------------------------------
    # Map emotion percentages to sessions
    # ------------------------------------------------------------------
    def map_emotions_to_sessions(self) -> dict:
        """Calculate emotion percentages per session.

        For each learning session, count occurrences of each
        emotion_label and express as a percentage of total snapshots
        in that session.

        Returns
        -------
        dict
            {session_id: {emotion: percentage, ...}, ...}
        """
        if self._emotion_map is not None:
            return self._emotion_map

        try:
            with get_cursor() as cur:
                cur.execute(
                    """
                    SELECT session_id, emotion_label, COUNT(*) AS cnt
                    FROM emotional_states
                    WHERE student_id = %s
                    GROUP BY session_id, emotion_label
                    ORDER BY session_id
                    """,
                    (self.student_id,),
                )
                rows = cur.fetchall()
        except Exception as exc:
            logger.error("Failed to fetch emotions for %s: %s", self.student_id, exc)
            self._emotion_map = {}
            return self._emotion_map

        if not rows:
            self._emotion_map = {}
            return self._emotion_map

        # First pass: count total snapshots per session
        session_totals: dict = {}
        session_emotion_counts: dict = {}
        for session_id, emotion, cnt in rows:
            if session_id not in session_totals:
                session_totals[session_id] = 0
                session_emotion_counts[session_id] = {}
            session_totals[session_id] += cnt
            session_emotion_counts[session_id][emotion] = cnt

        # Second pass: compute percentages
        self._emotion_map = {}
        for session_id, total in session_totals.items():
            self._emotion_map[session_id] = {}
            for emotion in DB_EMOTIONS:
                count = session_emotion_counts[session_id].get(emotion, 0)
                self._emotion_map[session_id][emotion] = (count / total) * 100.0

        return self._emotion_map

    # ------------------------------------------------------------------
    # Fetch per-session average LO scores
    # ------------------------------------------------------------------
    def _fetch_lo_scores(self) -> dict:
        """Fetch per-session average LO score.

        Returns
        -------
        dict
            {session_id: avg_score, ...}
        """
        if self._lo_map is not None:
            return self._lo_map

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
            self._lo_map = {}
            return self._lo_map

        self._lo_map = {row[0]: float(row[1]) for row in rows if row[1] is not None}
        return self._lo_map

    # ------------------------------------------------------------------
    # Correlate a single emotion with LO scores
    # ------------------------------------------------------------------
    def correlate_emotion_with_lo(self, emotion_type: str) -> dict:
        """Pearson correlation between an emotion's percentage and LO scores.

        Parameters
        ----------
        emotion_type : str
            The emotion label (e.g. 'happy', 'bored').

        Returns
        -------
        dict
            Keys: r, p_value, strength, direction, significant, note
        """
        emotion_map = self.map_emotions_to_sessions()
        lo_map = self._fetch_lo_scores()

        # Find sessions that have both emotion data and LO scores
        common_sessions = set(emotion_map.keys()) & set(lo_map.keys())

        if len(common_sessions) < MIN_SESSIONS:
            return {
                "r": None,
                "p_value": None,
                "strength": "N/A",
                "direction": "N/A",
                "significant": False,
                "note": "Insufficient data for correlation analysis.",
            }

        # Build paired arrays
        x_list: list[float] = []
        y_list: list[float] = []
        for sid in common_sessions:
            pct = emotion_map[sid].get(emotion_type, 0.0)
            score = lo_map[sid]
            x_list.append(pct)
            y_list.append(score)

        x = np.array(x_list)
        y = np.array(y_list)

        # Handle "emotion not observed" — zero variance in X
        if np.std(x) < 1e-10:
            return {
                "r": 0.0,
                "p_value": 1.0,
                "strength": "weak",
                "direction": "none",
                "significant": False,
                "note": "Emotion not observed (zero variance).",
            }

        try:
            r, p = pearsonr(x, y)
        except (ValueError, ZeroDivisionError) as exc:
            logger.warning("pearsonr failed for %s / %s: %s", self.student_id, emotion_type, exc)
            return {
                "r": 0.0,
                "p_value": 1.0,
                "strength": "weak",
                "direction": "none",
                "significant": False,
                "note": f"Correlation computation failed: {exc}",
            }

        # Handle NaN from scipy
        if np.isnan(r) or np.isnan(p):
            return {
                "r": 0.0,
                "p_value": 1.0,
                "strength": "weak",
                "direction": "none",
                "significant": False,
                "note": "Correlation resulted in NaN.",
            }

        return {
            "r": float(r),
            "p_value": float(p),
            "strength": _classify_strength(r),
            "direction": _classify_direction(r),
            "significant": bool(p < 0.05),
            "note": "",
        }

    # ------------------------------------------------------------------
    # Compute correlations for all emotions
    # ------------------------------------------------------------------
    def compute_all_correlations(self) -> dict:
        """Run Pearson correlation for every emotion.

        Returns
        -------
        dict
            {emotion_type: {r, p_value, strength, direction, significant, note}, ...}
        """
        results = {}
        for emotion in ALL_EMOTIONS:
            results[emotion] = self.correlate_emotion_with_lo(emotion)
        return results

    # ------------------------------------------------------------------
    # Identify significant correlations
    # ------------------------------------------------------------------
    def identify_significant_correlations(
        self,
        alpha: float = 0.05,
        min_r: float = 0.3,
    ) -> dict:
        """Filter to only statistically significant and meaningful correlations.

        Parameters
        ----------
        alpha : float
            Significance threshold for p-value (default 0.05).
        min_r : float
            Minimum absolute r-value for practical significance (default 0.3).

        Returns
        -------
        dict
            Subset of compute_all_correlations where p < alpha and |r| >= min_r.
        """
        all_corr = self.compute_all_correlations()
        significant = {}
        for emotion, result in all_corr.items():
            if result["r"] is None:
                continue
            if result["p_value"] < alpha and abs(result["r"]) >= min_r:
                significant[emotion] = result
        return significant

    # ------------------------------------------------------------------
    # Generate scatter plot visualization
    # ------------------------------------------------------------------
    def generate_visualization(
        self,
        emotion_type: str,
        output_path: str,
    ) -> str:
        """Create a scatter plot: emotion % vs LO score, with regression line.

        Parameters
        ----------
        emotion_type : str
            The emotion label to plot.
        output_path : str
            File path for the output PNG.

        Returns
        -------
        str
            Absolute path of the saved PNG, or empty string on error.
        """
        emotion_map = self.map_emotions_to_sessions()
        lo_map = self._fetch_lo_scores()
        common_sessions = set(emotion_map.keys()) & set(lo_map.keys())

        if len(common_sessions) < MIN_SESSIONS:
            logger.warning(
                "Cannot generate visualization for %s/%s — only %d sessions",
                self.student_id, emotion_type, len(common_sessions),
            )
            return ""

        x_list = [emotion_map[sid].get(emotion_type, 0.0) for sid in common_sessions]
        y_list = [lo_map[sid] for sid in common_sessions]
        x = np.array(x_list)
        y = np.array(y_list)

        corr = self.correlate_emotion_with_lo(emotion_type)
        r = corr["r"] if corr["r"] is not None else 0.0
        p = corr["p_value"] if corr["p_value"] is not None else 1.0
        strength = corr["strength"]
        direction = corr["direction"]

        # Build figure
        fig, ax = plt.subplots(figsize=(8, 5))

        ax.scatter(x, y, color="steelblue", edgecolors="white", s=60, zorder=3,
                   label="Sessions")

        # Regression line (only if there is variance)
        if np.std(x) > 1e-10 and corr["r"] is not None:
            m, b = np.polyfit(x, y, 1)
            x_line = np.linspace(x.min(), x.max(), 100)
            ax.plot(x_line, m * x_line + b, color="crimson", linewidth=2,
                    label=f"Fit: y = {m:.2f}x + {b:.1f}")

        title = (
            f"{emotion_type.capitalize()} vs LO Score — {self.student_id}\n"
            f"r = {r:+.3f}  (p = {p:.4f})  [{strength} {direction}]"
        )
        ax.set_title(title, fontsize=12)
        ax.set_xlabel(f"{emotion_type.capitalize()} (%)", fontsize=11)
        ax.set_ylabel("Average LO Score", fontsize=11)
        ax.set_ylim(bottom=0, top=100)
        ax.legend(loc="best", fontsize=10)
        ax.grid(True, alpha=0.3)
        fig.tight_layout()

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
    # Complete analysis
    # ------------------------------------------------------------------
    def get_analysis(self) -> dict:
        """Return complete correlation analysis with summary.

        Returns
        -------
        dict
            Keys: student_id, num_sessions, correlations,
                  significant_correlations, summary
        """
        emotion_map = self.map_emotions_to_sessions()
        lo_map = self._fetch_lo_scores()
        common_sessions = set(emotion_map.keys()) & set(lo_map.keys())
        n = len(common_sessions)

        if n < MIN_SESSIONS:
            return {
                "student_id": self.student_id,
                "num_sessions": n,
                "correlations": {},
                "significant_correlations": {},
                "summary": "Insufficient data for correlation analysis.",
            }

        all_corr = self.compute_all_correlations()
        sig_corr = self.identify_significant_correlations()
        summary = self._build_summary(all_corr, sig_corr, n)

        return {
            "student_id": self.student_id,
            "num_sessions": n,
            "correlations": all_corr,
            "significant_correlations": sig_corr,
            "summary": summary,
        }

    # ------------------------------------------------------------------
    # Internal: natural-language summary
    # ------------------------------------------------------------------
    @staticmethod
    def _build_summary(all_corr: dict, sig_corr: dict, n_sessions: int) -> str:
        """Build a human-readable summary of the correlation analysis."""
        lines = [f"Analysis across {n_sessions} sessions."]

        if not sig_corr:
            lines.append(
                "No emotions showed a statistically significant correlation "
                "with learning outcomes (p >= 0.05 or |r| < 0.3)."
            )
        else:
            lines.append("Significant correlations found:")
            for emotion, result in sig_corr.items():
                direction_word = "higher" if result["direction"] == "positive" else "lower"
                lines.append(
                    f"  • {emotion}: r={result['r']:+.3f}, p={result['p_value']:.4f} "
                    f"({result['strength']} {result['direction']}) — "
                    f"more {emotion} → {direction_word} LO scores"
                )

        # Mention key expected patterns regardless of significance
        for emotion in ["happy", "bored", "confused"]:
            if emotion in all_corr and all_corr[emotion]["r"] is not None:
                r = all_corr[emotion]["r"]
                dir_label = "positive" if r > 0 else "negative" if r < 0 else "neutral"
                lines.append(f"  {emotion}: {dir_label} trend (r={r:+.3f})")

        return "\n".join(lines)