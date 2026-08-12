"""
Module      : outcome_tracker.py
Layer       : Outcome Tracker (Layer 6)
Part of     : Evidence-Reasoned Suggestion Engine (ERSE)
Component   : Student Profile Management & Advanced Statistical
              Progress Analytics
Project     : AI-Powered Adaptive Learning Platform (R26-IT-097)

Author      : Ranasinghe R.A.R.V.C. (IT22197146)
Supervisor  : Ms. Suranjini Silva
Institution : SLIIT — Department of Information Technology

Description
-----------
Implements Layer 6 of the ERSE pipeline: session-by-session outcome
tracking for approved and modified suggestions.

For each new learning session completed after a suggestion was reviewed:
  1. Retrieves the pre-suggestion LO score baseline for the student.
  2. Computes the LO score for the new session.
  3. Calculates the delta (session score − baseline).
  4. Re-runs the SuggestionEngine to detect whether the student's
     pattern has changed.
  5. Writes one suggestion_outcomes row per session.
  6. Updates the parent suggestions row with an outcome summary.

The tracker is designed to be called:
  - Automatically by the /suggestions/<id>/track endpoint after each
    new session is recorded for a student with an active suggestion.
  - Or manually for batch back-fill via OutcomeTracker.backfill().

Dependencies
------------
  config.database              get_cursor
  services.suggestion_engine   SuggestionEngine

Usage
-----
  from services.outcome_tracker import OutcomeTracker

  tracker = OutcomeTracker(suggestion_id="<uuid>")
  result  = tracker.track_next_session(session_id="<uuid>")
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional
from uuid import UUID

from config.database import get_cursor
from services.suggestion_engine import SuggestionEngine, PATTERN_INSUFFICIENT_DATA

logger = logging.getLogger(__name__)


# ======================================================================
# Constants
# ======================================================================

# Minimum sessions used to compute the pre-suggestion LO baseline
BASELINE_SESSION_COUNT  = 3

# Delta thresholds for outcome summary classification
DELTA_IMPROVED_THRESHOLD    =  2.0   # score points
DELTA_DECLINED_THRESHOLD    = -2.0   # score points


# ======================================================================
# Data Classes
# ======================================================================

@dataclass
class TrackingResult:
    """
    Result of tracking one session against an active suggestion.

    Attributes
    ----------
    suggestion_id   : str
    session_id      : str
    student_id      : str
    session_index   : int
        Session number after the suggestion was reviewed (1-based).
    lo_score_baseline : float
        Average LO score across BASELINE_SESSION_COUNT sessions
        immediately before the suggestion was created.
    lo_score_session : float
        Average LO score in this specific session.
    lo_delta : float
        session score − baseline (positive = improvement).
    pattern_changed : bool
        Whether the student's pattern changed in this session.
    new_pattern : Optional[str]
        New pattern name if changed, else None.
    engagement_score : Optional[float]
        Engagement score recorded in this session.
    outcome_id : str
        UUID of the newly inserted suggestion_outcomes row.
    """
    suggestion_id       : str
    session_id          : str
    student_id          : str
    session_index       : int
    lo_score_baseline   : float
    lo_score_session    : float
    lo_delta            : float
    pattern_changed     : bool
    new_pattern         : Optional[str]
    engagement_score    : Optional[float]
    outcome_id          : str


# ======================================================================
# OutcomeTracker
# ======================================================================

class OutcomeTracker:
    """
    Session-by-session outcome tracker for a single suggestion.

    Tracks the effect of an approved or modified suggestion by
    comparing LO scores in each subsequent session against the
    pre-suggestion baseline.

    Parameters
    ----------
    suggestion_id : str
        UUID of the suggestion to track (must exist in the
        suggestions table with status 'approved' or 'modified').
    """

    def __init__(self, suggestion_id: str) -> None:
        self.suggestion_id  = suggestion_id
        self._meta          : Optional[dict] = None

    # ------------------------------------------------------------------
    # Public
    # ------------------------------------------------------------------

    def track_next_session(self, session_id: str) -> Optional[TrackingResult]:
        """
        Track one new session against the active suggestion.

        Computes the LO delta, checks for pattern change, writes the
        outcome row, and updates the parent suggestion summary.

        Parameters
        ----------
        session_id : str
            UUID of the learning session to evaluate.

        Returns
        -------
        Optional[TrackingResult]
            Populated result, or None if the session cannot be tracked
            (e.g. already tracked, or the suggestion is not active).
        """
        meta = self._load_suggestion_meta()
        if meta is None:
            logger.warning(
                "Suggestion %s not found or not trackable",
                self.suggestion_id,
            )
            return None

        student_id = meta["student_id"]

        # Guard: skip if this session was already tracked
        if self._outcome_exists(session_id):
            logger.info(
                "Session %s already tracked for suggestion %s — skipping",
                session_id, self.suggestion_id,
            )
            return None

        # Guard: session must belong to the same student
        if not self._session_belongs_to_student(session_id, student_id):
            logger.warning(
                "Session %s does not belong to student %s — skipping",
                session_id, student_id,
            )
            return None

        # Compute baseline and session scores
        baseline    = self._compute_baseline(student_id, meta["created_at"])
        lo_session  = self._compute_session_lo_score(session_id)

        if baseline is None or lo_session is None:
            logger.warning(
                "Insufficient LO score data to track session %s "
                "for suggestion %s", session_id, self.suggestion_id,
            )
            return None

        # Session index (how many sessions after suggestion is this?)
        session_index = self._compute_session_index(
            student_id, meta["created_at"], session_id
        )

        # Pattern change detection
        pattern_changed, new_pattern = self._detect_pattern_change(
            student_id, meta["pattern_name"]
        )

        # Engagement score for this session
        engagement = self._fetch_engagement_score(session_id)

        # Persist the outcome row
        outcome_id = self._insert_outcome(
            student_id      = student_id,
            session_id      = session_id,
            session_index   = session_index,
            lo_baseline     = baseline,
            lo_session      = lo_session,
            pattern_changed = pattern_changed,
            new_pattern     = new_pattern,
            engagement      = engagement,
        )

        # Update the parent suggestion summary
        self._update_suggestion_summary(student_id, meta["created_at"])

        delta = round(lo_session - baseline, 2)

        logger.info(
            "Tracked session %s for suggestion %s: delta=%.2f "
            "pattern_changed=%s",
            session_id, self.suggestion_id, delta, pattern_changed,
        )

        return TrackingResult(
            suggestion_id       = self.suggestion_id,
            session_id          = session_id,
            student_id          = student_id,
            session_index       = session_index,
            lo_score_baseline   = round(baseline, 2),
            lo_score_session    = round(lo_session, 2),
            lo_delta            = delta,
            pattern_changed     = pattern_changed,
            new_pattern         = new_pattern,
            engagement_score    = engagement,
            outcome_id          = outcome_id,
        )

    def backfill(self) -> list[TrackingResult]:
        """
        Track all sessions recorded after the suggestion was reviewed
        that have not yet been tracked.

        Useful for catching up after system downtime or for initial
        processing of historical data.

        Returns
        -------
        list[TrackingResult]
            One TrackingResult per newly tracked session.
        """
        meta = self._load_suggestion_meta()
        if meta is None:
            logger.warning(
                "Suggestion %s not found — backfill aborted",
                self.suggestion_id,
            )
            return []

        untracked = self._fetch_untracked_sessions(
            meta["student_id"], meta["created_at"]
        )

        results = []
        for session_id in untracked:
            result = self.track_next_session(session_id)
            if result is not None:
                results.append(result)

        logger.info(
            "Backfill complete for suggestion %s: %d sessions tracked",
            self.suggestion_id, len(results),
        )
        return results

    def get_outcome_summary(self) -> dict:
        """
        Return a summary of all tracked outcomes for this suggestion.

        Returns
        -------
        dict
            Keys: suggestion_id, total_sessions_tracked, mean_delta,
                  improved_sessions, declined_sessions, stable_sessions,
                  pattern_changed, latest_pattern, outcome_rows.
        """
        try:
            with get_cursor() as cur:
                cur.execute(
                    """
                    SELECT
                        outcome_id,
                        session_id,
                        session_index,
                        lo_score_baseline,
                        lo_score_session,
                        lo_delta,
                        pattern_changed,
                        new_pattern,
                        engagement_score,
                        created_at
                    FROM suggestion_outcomes
                    WHERE suggestion_id = %s
                    ORDER BY session_index ASC
                    """,
                    (self.suggestion_id,),
                )
                rows = cur.fetchall()

        except Exception as exc:
            logger.error(
                "Failed to fetch outcome summary for %s: %s",
                self.suggestion_id, exc,
            )
            return {"error": str(exc)}

        if not rows:
            return {
                "suggestion_id"         : self.suggestion_id,
                "total_sessions_tracked": 0,
                "mean_delta"            : None,
                "improved_sessions"     : 0,
                "declined_sessions"     : 0,
                "stable_sessions"       : 0,
                "pattern_changed"       : False,
                "latest_pattern"        : None,
                "outcome_rows"          : [],
            }

        deltas = [float(r[5]) for r in rows]
        improved    = sum(1 for d in deltas if d >= DELTA_IMPROVED_THRESHOLD)
        declined    = sum(1 for d in deltas if d <= DELTA_DECLINED_THRESHOLD)
        stable      = len(deltas) - improved - declined
        any_changed = any(r[6] for r in rows)
        latest_pat  = next(
            (r[7] for r in reversed(rows) if r[7] is not None), None
        )

        outcome_rows = [
            {
                "outcome_id"        : str(r[0]),
                "session_id"        : str(r[1]),
                "session_index"     : r[2],
                "lo_score_baseline" : float(r[3]),
                "lo_score_session"  : float(r[4]),
                "lo_delta"          : float(r[5]),
                "pattern_changed"   : r[6],
                "new_pattern"       : r[7],
                "engagement_score"  : float(r[8]) if r[8] is not None else None,
                "created_at"      : r[9].isoformat() if r[9] else None,
            }
            for r in rows
        ]

        return {
            "suggestion_id"         : self.suggestion_id,
            "total_sessions_tracked": len(rows),
            "mean_delta"            : round(sum(deltas) / len(deltas), 2),
            "improved_sessions"     : improved,
            "declined_sessions"     : declined,
            "stable_sessions"       : stable,
            "pattern_changed"       : any_changed,
            "latest_pattern"        : latest_pat,
            "outcome_rows"          : outcome_rows,
        }

    # ------------------------------------------------------------------
    # Internal: computation helpers
    # ------------------------------------------------------------------

    def _compute_baseline(
        self,
        student_id  : str,
        before_ts   : object,
    ) -> Optional[float]:
        """
        Compute the average LO score across the BASELINE_SESSION_COUNT
        sessions immediately before the suggestion was created.

        Parameters
        ----------
        student_id : str
        before_ts  : datetime
            suggestion.created_at — only sessions before this are used.

        Returns
        -------
        Optional[float]
            Mean LO score, or None if insufficient data.
        """
        try:
            with get_cursor() as cur:
                cur.execute(
                    """
                    SELECT AVG(lo.score)
                    FROM lo_achievement_scores lo
                    JOIN learning_sessions ls
                        ON lo.session_id = ls.session_id
                    WHERE lo.student_id = %s
                      AND ls.start_time < %s
                    """,
                    (student_id, before_ts),
                )
                row = cur.fetchone()
            return float(row[0]) if row and row[0] is not None else None
        except Exception as exc:
            logger.error(
                "Baseline computation failed for student %s: %s",
                student_id, exc,
            )
            return None

    def _compute_session_lo_score(self, session_id: str) -> Optional[float]:
        """
        Return the average LO score for a single session.

        Parameters
        ----------
        session_id : str

        Returns
        -------
        Optional[float]
        """
        try:
            with get_cursor() as cur:
                cur.execute(
                    """
                    SELECT AVG(score)
                    FROM lo_achievement_scores
                    WHERE session_id = %s
                    """,
                    (session_id,),
                )
                row = cur.fetchone()
            return float(row[0]) if row and row[0] is not None else None
        except Exception as exc:
            logger.error(
                "Session LO score fetch failed for session %s: %s",
                session_id, exc,
            )
            return None

    def _compute_session_index(
        self,
        student_id  : str,
        after_ts    : object,
        session_id  : str,
    ) -> int:
        """
        Determine the 1-based index of a session among all sessions
        recorded after the suggestion was created.

        Parameters
        ----------
        student_id : str
        after_ts   : datetime
        session_id : str

        Returns
        -------
        int
            1-based session index (1 = first post-suggestion session).
        """
        try:
            with get_cursor() as cur:
                cur.execute(
                    """
                    SELECT session_id
                    FROM learning_sessions
                    WHERE student_id = %s
                      AND start_time > %s
                    ORDER BY start_time ASC
                    """,
                    (student_id, after_ts),
                )
                rows = cur.fetchall()
            ids = [str(r[0]) for r in rows]
            return ids.index(str(session_id)) + 1 if str(session_id) in ids else 1
        except Exception as exc:
            logger.warning(
                "Session index computation failed: %s — defaulting to 1", exc
            )
            return 1

    def _detect_pattern_change(
        self,
        student_id      : str,
        original_pattern: str,
    ) -> tuple[bool, Optional[str]]:
        """
        Re-run the SuggestionEngine and compare the new pattern
        against the original to detect a shift.

        Parameters
        ----------
        student_id       : str
        original_pattern : str
            The pattern assigned when the suggestion was created.

        Returns
        -------
        tuple[bool, Optional[str]]
            (pattern_changed, new_pattern_name)
        """
        try:
            engine  = SuggestionEngine(student_id)
            payload = engine.run()
            new_pat = payload.pattern.pattern_name

            if new_pat == PATTERN_INSUFFICIENT_DATA:
                return False, None

            changed = new_pat != original_pattern
            return changed, (new_pat if changed else None)

        except Exception as exc:
            logger.warning(
                "Pattern change detection failed for student %s: %s",
                student_id, exc,
            )
            return False, None

    def _fetch_engagement_score(self, session_id: str) -> Optional[float]:
        """Return the engagement score for a session, or None."""
        try:
            with get_cursor() as cur:
                cur.execute(
                    """
                    SELECT engagement_score
                    FROM engagement_metrics
                    WHERE session_id = %s
                    LIMIT 1
                    """,
                    (session_id,),
                )
                row = cur.fetchone()
            return float(row[0]) if row and row[0] is not None else None
        except Exception as exc:
            logger.warning(
                "Engagement score fetch failed for session %s: %s",
                session_id, exc,
            )
            return None

    # ------------------------------------------------------------------
    # Internal: database read helpers
    # ------------------------------------------------------------------

    def _load_suggestion_meta(self) -> Optional[dict]:
        """
        Load the suggestion metadata required for tracking.

        Returns
        -------
        Optional[dict]
            Keys: student_id, pattern_name, created_at, status.
            None if the suggestion does not exist or is not trackable.
        """
        if self._meta is not None:
            return self._meta

        try:
            with get_cursor() as cur:
                cur.execute(
                    """
                    SELECT student_id, pattern_name, created_at, status
                    FROM suggestions
                    WHERE suggestion_id = %s
                    """,
                    (self.suggestion_id,),
                )
                row = cur.fetchone()

            if row is None:
                return None

            status = row[3]
            if status not in ("approved", "modified"):
                logger.info(
                    "Suggestion %s has status '%s' — tracking only applies "
                    "to approved/modified suggestions", self.suggestion_id, status
                )
                return None

            self._meta = {
                "student_id"    : row[0],
                "pattern_name"  : row[1],
                "created_at"    : row[2],
                "status"        : status,
            }
            return self._meta

        except Exception as exc:
            logger.error(
                "Failed to load suggestion meta for %s: %s",
                self.suggestion_id, exc,
            )
            return None

    def _outcome_exists(self, session_id: str) -> bool:
        """Return True if this session is already tracked."""
        try:
            with get_cursor() as cur:
                cur.execute(
                    """
                    SELECT 1 FROM suggestion_outcomes
                    WHERE suggestion_id = %s AND session_id = %s
                    """,
                    (self.suggestion_id, session_id),
                )
                return cur.fetchone() is not None
        except Exception as exc:
            logger.warning("Outcome existence check failed: %s", exc)
            return False

    def _session_belongs_to_student(
        self, session_id: str, student_id: str
    ) -> bool:
        """Return True if session_id belongs to student_id."""
        try:
            with get_cursor() as cur:
                cur.execute(
                    """
                    SELECT 1 FROM learning_sessions
                    WHERE session_id = %s AND student_id = %s
                    """,
                    (session_id, student_id),
                )
                return cur.fetchone() is not None
        except Exception as exc:
            logger.warning("Session ownership check failed: %s", exc)
            return False

    def _fetch_untracked_sessions(
        self, student_id: str, after_ts: object
    ) -> list[str]:
        """
        Return session IDs recorded after after_ts that have not
        yet been tracked for this suggestion.

        Parameters
        ----------
        student_id : str
        after_ts   : datetime

        Returns
        -------
        list[str]
            Session UUIDs ordered chronologically.
        """
        try:
            with get_cursor() as cur:
                cur.execute(
                    """
                    SELECT ls.session_id
                    FROM learning_sessions ls
                    WHERE ls.student_id = %s
                      AND ls.start_time > %s
                      AND NOT EXISTS (
                          SELECT 1 FROM suggestion_outcomes so
                          WHERE so.suggestion_id = %s
                            AND so.session_id = ls.session_id
                      )
                    ORDER BY ls.start_time ASC
                    """,
                    (student_id, after_ts, self.suggestion_id),
                )
                return [str(r[0]) for r in cur.fetchall()]
        except Exception as exc:
            logger.error(
                "Untracked session fetch failed for student %s: %s",
                student_id, exc,
            )
            return []

    # ------------------------------------------------------------------
    # Internal: database write helpers
    # ------------------------------------------------------------------

    def _insert_outcome(
        self,
        student_id      : str,
        session_id      : str,
        session_index   : int,
        lo_baseline     : float,
        lo_session      : float,
        pattern_changed : bool,
        new_pattern     : Optional[str],
        engagement      : Optional[float],
    ) -> str:
        """
        Insert one row into suggestion_outcomes and return the UUID.

        Parameters
        ----------
        (see TrackingResult fields)

        Returns
        -------
        str
            UUID of the inserted outcome row.
        """
        with get_cursor() as cur:
            cur.execute(
                """
                INSERT INTO suggestion_outcomes (
                    suggestion_id,
                    session_id,
                    student_id,
                    session_index,
                    lo_score_baseline,
                    lo_score_session,
                    pattern_changed,
                    new_pattern,
                    engagement_score
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING outcome_id
                """,
                (
                    self.suggestion_id,
                    session_id,
                    student_id,
                    session_index,
                    lo_baseline,
                    lo_session,
                    pattern_changed,
                    new_pattern,
                    engagement,
                ),
            )
            row = cur.fetchone()
        return str(row[0])

    def _update_suggestion_summary(
        self, student_id: str, created_at: object
    ) -> None:
        """
        Recompute and update the outcome_summary on the parent
        suggestions row based on all tracked outcomes so far.

        Parameters
        ----------
        student_id : str
        created_at : datetime
        """
        try:
            summary_data = self.get_outcome_summary()
            n       = summary_data.get("total_sessions_tracked", 0)
            delta   = summary_data.get("mean_delta")
            changed = summary_data.get("pattern_changed", False)
            latest  = summary_data.get("latest_pattern")

            if n == 0 or delta is None:
                return

            if delta >= DELTA_IMPROVED_THRESHOLD:
                trend_word = "improving"
            elif delta <= DELTA_DECLINED_THRESHOLD:
                trend_word = "declining"
            else:
                trend_word = "stable"

            summary_text = (
                f"Tracked over {n} session(s). "
                f"Mean LO delta: {delta:+.2f} pts ({trend_word})."
            )
            if changed and latest:
                summary_text += f" Pattern shifted to '{latest}'."

            with get_cursor() as cur:
                cur.execute(
                    """
                    UPDATE suggestions
                    SET outcome_summary  = %s,
                        outcome_tracked  = TRUE,
                        updated_at       = CURRENT_TIMESTAMP
                    WHERE suggestion_id  = %s
                    """,
                    (summary_text, self.suggestion_id),
                )

        except Exception as exc:
            logger.warning(
                "Suggestion summary update failed for %s: %s",
                self.suggestion_id, exc,
            )