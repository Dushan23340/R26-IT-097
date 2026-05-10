"""Generate emotion correlation scatter plots for 5 students."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services.emotion_correlator import EmotionCorrelationAnalyzer
from config.database import get_cursor


def main():
    out_dir = Path(__file__).resolve().parent / "output"
    out_dir.mkdir(parents=True, exist_ok=True)

    with get_cursor() as cur:
        cur.execute("SELECT student_id FROM student_profiles ORDER BY student_id LIMIT 5")
        ids = [r[0] for r in cur.fetchall()]

    emotions_to_plot = ["happy", "bored", "confused", "angry"]

    for sid in ids:
        analyzer = EmotionCorrelationAnalyzer(sid)
        for emotion in emotions_to_plot:
            result = analyzer.correlate_emotion_with_lo(emotion)
            r = result["r"] if result["r"] is not None else 0.0
            print(f"{sid} {emotion}: r={r:+.3f} ({result['direction']})")

            path = analyzer.generate_visualization(
                emotion, str(out_dir / f"emotion_{sid}_{emotion}.png")
            )
            if path:
                print(f"  📊 Saved: {path}")

    print(f"\nAll plots saved to {out_dir}")


if __name__ == "__main__":
    main()
