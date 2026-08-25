"""Fairness alert persistence (FR09: "flag bias indicators exceeding
configurable thresholds"). fairness_service.py computes a real ratio/test
result but has no DB access of its own (same pure-function convention as
statistics_service.py) - this module is the thin persistence layer that
turns a violation into a real, queryable alert instead of a value that
only ever existed inside one API response.
"""

from __future__ import annotations

import json
from typing import Any, Optional

from config.database import get_cursor


def record_disparate_impact_result(result: dict[str, Any]) -> Optional[int]:
    if not result.get("available") or result.get("fair", True):
        return None
    return _insert(
        metric="disparate_impact",
        groups_compared=list(result["proficiency_rates"].keys()),
        metric_values=result["disparate_impact_ratios"],
        threshold={"acceptable_range": result["acceptable_range"], "flagged_groups": result["flagged_groups"]},
    )


def record_variance_calibration_result(result: dict[str, Any]) -> Optional[int]:
    if not result.get("available") or result.get("equal_variance", True):
        return None
    return _insert(
        metric="variance_calibration",
        groups_compared=list(result.get("group_variances", {}).keys()),
        metric_values={"levene_statistic": result["levene_statistic"], "p_value": result["p_value"]},
        threshold={"significance_level": 0.05},
    )


def _insert(metric: str, groups_compared: list[str], metric_values: dict[str, Any], threshold: dict[str, Any]) -> Optional[int]:
    with get_cursor() as cur:
        # Both fairness endpoints (and the frequently-polled class_overview
        # dashboard) recompute their metric on every call - without this
        # check, an ongoing violation would insert a fresh alert row every
        # single poll instead of staying as one open alert until reviewed.
        cur.execute("SELECT 1 FROM fairness_audits WHERE metric = %s AND status = 'open' LIMIT 1", (metric,))
        if cur.fetchone() is not None:
            return None

        cur.execute(
            """
            INSERT INTO fairness_audits (metric, groups_compared, metric_values, threshold)
            VALUES (%s, %s, %s, %s)
            RETURNING id
            """,
            (metric, json.dumps(groups_compared), json.dumps(metric_values, default=str), json.dumps(threshold, default=str)),
        )
        return int(cur.fetchone()[0])


def list_alerts(status: str = "open") -> list[dict[str, Any]]:
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT id, metric, groups_compared, metric_values, threshold, status,
                   reviewed_by, reviewed_at, created_at
            FROM fairness_audits
            WHERE status = %s
            ORDER BY created_at DESC
            """,
            (status,),
        )
        cols = [d.name for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


def resolve_alert(audit_id: int, reviewer: str) -> dict[str, Any]:
    with get_cursor() as cur:
        cur.execute(
            """
            UPDATE fairness_audits
            SET status = 'reviewed', reviewed_by = %s, reviewed_at = CURRENT_TIMESTAMP
            WHERE id = %s
            RETURNING id, metric, groups_compared, metric_values, threshold, status,
                      reviewed_by, reviewed_at, created_at
            """,
            (reviewer, audit_id),
        )
        row = cur.fetchone()
        if row is None:
            raise LookupError(f"No fairness audit with id {audit_id}")
        cols = [d.name for d in cur.description]
        return dict(zip(cols, row))
