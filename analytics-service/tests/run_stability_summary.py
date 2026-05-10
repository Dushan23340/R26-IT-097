"""Run StabilityAnalyzer on all students and print a summary."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services.stability_analyzer import StabilityAnalyzer, compute_class_statistics
from config.database import get_cursor


def main():
    with get_cursor() as cur:
        cur.execute("SELECT student_id FROM student_profiles ORDER BY student_id")
        ids = [r[0] for r in cur.fetchall()]

    stats = compute_class_statistics(ids)
    ms = stats["class_mean_sd"]
    ss = stats["class_sd_of_sds"]

    print(f"Class mean SD: {ms:.2f}")
    print(f"Class SD of SDs: {ss:.2f}")
    print(f"Valid students: {stats['num_valid']}")
    print()
    print(f"{'Student':<12} {'Sessions':>8} {'Variance':>10} {'SD':>8} {'CV%':>8} {'At-Risk':>8}  Interpretation")
    print("-" * 95)

    risk_count = 0
    for sid in ids:
        a = StabilityAnalyzer(sid)
        r = a.get_analysis()
        sd = r["sd"]
        cv = r["cv"]
        var = r["variance"]

        flagged = False
        ar = ""
        if sd is not None:
            flagged = StabilityAnalyzer.flag_at_risk(sd, ms, ss)
            ar = "YES" if flagged else "no"
            if flagged:
                risk_count += 1

        cv_s = f"{cv:.1f}" if cv is not None else "N/A"
        var_s = f"{var:.1f}" if var is not None else "N/A"
        sd_s = f"{sd:.1f}" if sd is not None else "N/A"
        interp = r["interpretation"][:50]

        print(f"{sid:<12} {r['num_sessions']:>8} {var_s:>10} {sd_s:>8} {cv_s:>8} {ar:>8}  {interp}")

    pct = (risk_count / stats["num_valid"]) * 100 if stats["num_valid"] > 0 else 0
    print()
    print(f"At-risk: {risk_count}/{stats['num_valid']} ({pct:.0f}%)")


if __name__ == "__main__":
    main()