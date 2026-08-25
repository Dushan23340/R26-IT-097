"""Correctness tests for intervention outcome classification - the only
pure, DB-free part of intervention_service.py (create_intervention_outcome/
try_resolve_pending/list_interventions/effectiveness_summary all need a
live Postgres connection and are exercised via the live curl round-trip
instead, same as this service's DB-touching functions generally are)."""

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from services.intervention_service import IMPROVEMENT_THRESHOLD, classify_outcome


class ClassifyOutcomeTests(unittest.TestCase):
    def test_clear_improvement(self):
        self.assertEqual(classify_outcome(pre_score=50.0, post_score=80.0), "improved")

    def test_clear_decline(self):
        self.assertEqual(classify_outcome(pre_score=80.0, post_score=50.0), "declined")

    def test_no_significant_change_within_threshold(self):
        self.assertEqual(classify_outcome(pre_score=70.0, post_score=72.0), "no_significant_change")
        self.assertEqual(classify_outcome(pre_score=70.0, post_score=68.0), "no_significant_change")

    def test_exact_boundary_is_not_significant(self):
        # delta == threshold exactly should NOT count as improved/declined
        # (classify_outcome uses strict > / <), matching "no_significant_change"
        # as the conservative default at the boundary.
        self.assertEqual(
            classify_outcome(pre_score=70.0, post_score=70.0 + IMPROVEMENT_THRESHOLD), "no_significant_change"
        )
        self.assertEqual(
            classify_outcome(pre_score=70.0, post_score=70.0 - IMPROVEMENT_THRESHOLD), "no_significant_change"
        )

    def test_just_past_boundary_counts(self):
        self.assertEqual(
            classify_outcome(pre_score=70.0, post_score=70.0 + IMPROVEMENT_THRESHOLD + 0.01), "improved"
        )
        self.assertEqual(
            classify_outcome(pre_score=70.0, post_score=70.0 - IMPROVEMENT_THRESHOLD - 0.01), "declined"
        )

    def test_zero_pre_score_handled_safely(self):
        # No division involved in classify_outcome (unlike a percentage-
        # improvement calc), so a zero pre_score is not a special case -
        # just a very large absolute improvement.
        self.assertEqual(classify_outcome(pre_score=0.0, post_score=20.0), "improved")


if __name__ == "__main__":
    unittest.main()
