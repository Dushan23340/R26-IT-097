"""
Test script for TrendAnalyzer — runs analysis on 5 students.

Usage:
    cd analytics-service
    python -m tests.test_trend_analyzer
"""

import json
import logging
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

# Load root .env for ANALYTICS_DB_* variables
_project_root = Path(__file__).resolve().parents[2]
load_dotenv(_project_root / ".env")

# Ensure analytics-service root is on sys.path
_sys_path = str(Path(__file__).resolve().parents[1])
if _sys_path not in sys.path:
    sys.path.insert(0, _sys_path)

from config.database import get_cursor, test_connection
from services.trend_analyzer import TrendAnalyzer

# Configure readable console logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# Output directory for PNGs
OUTPUT_DIR = Path(__file__).resolve().parent / "output"


def fetch_student_ids(limit: int = 5) -> list[str]:
    """Fetch the first *limit* student IDs from the database."""
    with get_cursor() as cur:
        cur.execute(
            "SELECT student_id FROM student_profiles ORDER BY student_id LIMIT %s",
            (limit,),
        )
        return [row[0] for row in cur.fetchall()]


def main() -> None:
    print("=" * 60)
    print("  TrendAnalyzer — Test on 5 Students")
    print("=" * 60)

    # 1. Verify database connectivity
    print("\n1. Testing database connection …")
    if not test_connection():
        print("   ❌ Database unreachable — aborting.")
        return
    print("   ✅ Database connection OK")

    # 2. Fetch student IDs
    print("\n2. Fetching student IDs …")
    student_ids = fetch_student_ids(limit=5)
    if not student_ids:
        print("   ❌ No students found — run the data generator first.")
        return
    print(f"   ✅ Found {len(student_ids)} students: {student_ids}")

    # 3. Run TrendAnalyzer on each student
    print("\n3. Running trend analysis …")
    results = []

    for sid in student_ids:
        print(f"\n   --- {sid} ---")
        try:
            analyzer = TrendAnalyzer(student_id=sid)
            summary = analyzer.get_analysis_summary()

            # Pretty-print key fields
            classification = summary["trend_classification"]
            reg = summary["regression_stats"]
            n_sessions = summary["num_sessions"]

            slope_str = f"{reg['slope']:+.2f}" if reg else "N/A"
            p_str = f"{reg['p_value']:.4f}" if reg else "N/A"
            r2_str = f"{reg['r_squared']:.3f}" if reg else "N/A"

            print(f"   Sessions       : {n_sessions}")
            print(f"   Classification : {classification}")
            print(f"   Slope          : {slope_str} pts/session")
            print(f"   p-value        : {p_str}")
            print(f"   R²             : {r2_str}")
            print(f"   Interpretation : {summary['interpretation'][:120]}…")

            # Generate visualization
            png_path = OUTPUT_DIR / f"trend_{sid}.png"
            saved = analyzer.generate_visualization(
                str(png_path),
                session_numbers=None,
                avg_scores=None,
                regression_results=reg or None,
            )
            if saved:
                print(f"   📊 PNG saved    : {saved}")
            else:
                print(f"   ⚠️  Visualization skipped (insufficient data)")

            results.append(summary)

        except Exception as exc:
            print(f"   ❌ Error analysing {sid}: {exc}")
            logger.exception("TrendAnalyzer failed for %s", sid)

    # 4. Summary table
    print("\n" + "=" * 60)
    print("  Summary Table")
    print("=" * 60)
    header = f"{'Student':<12} {'Sessions':>8} {'Slope':>8} {'p-value':>10} {'R²':>8} {'Trend':<12}"
    print(header)
    print("-" * len(header))

    for r in results:
        reg = r["regression_stats"]
        slope = f"{reg['slope']:+.2f}" if reg else "N/A"
        p = f"{reg['p_value']:.4f}" if reg else "N/A"
        r2 = f"{reg['r_squared']:.3f}" if reg else "N/A"
        print(
            f"{r['student_id']:<12} "
            f"{r['num_sessions']:>8} "
            f"{slope:>8} "
            f"{p:>10} "
            f"{r2:>8} "
            f"{r['trend_classification']:<12}"
        )

    # 5. Verify classifications make sense
    print("\n" + "=" * 60)
    print("  Classification Sanity Check")
    print("=" * 60)
    for r in results:
        reg = r["regression_stats"]
        if not reg:
            continue
        slope = reg["slope"]
        p_val = reg["p_value"]
        cls = r["trend_classification"]

        # Validate that classification matches the rules
        expected = "unstable"
        if abs(slope) <= 0.5:
            expected = "stable"
        elif slope > 0.5 and p_val < 0.05:
            expected = "improving"
        elif slope < -0.5 and p_val < 0.05:
            expected = "declining"

        ok = "✅" if cls == expected else "❌ MISMATCH"
        print(f"   {r['student_id']}: {cls} (expected {expected}) {ok}")

    # 6. Check PNG files exist
    print("\n" + "=" * 60)
    print("  PNG File Verification")
    print("=" * 60)
    for r in results:
        sid = r["student_id"]
        png = OUTPUT_DIR / f"trend_{sid}.png"
        if png.exists():
            size_kb = png.stat().st_size / 1024
            print(f"   ✅ {png.name} ({size_kb:.1f} KB)")
        else:
            print(f"   ❌ {png.name} — NOT FOUND")

    print("\n✅ Test complete.")


if __name__ == "__main__":
    main()
