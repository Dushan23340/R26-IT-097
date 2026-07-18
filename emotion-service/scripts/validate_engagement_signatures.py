"""Phase 4 groundwork.

The retrained CNN (Phase 2) only outputs facial expressions (Angry/Happy/
Normal). The student_state engine has to infer Bored/Confused/Frustrated
from those signals instead of matching a raw label directly. Before picking
thresholds, check what the CNN actually predicts on DAiSEE-labeled
Bored/Confused/Frustrated/Engaged face crops (dataset/engagement_eval, held
out in Phase 1) to see whether the assumed facial-expression signature per
engagement state holds up.
"""

from __future__ import annotations

import sys
from collections import Counter
from pathlib import Path

SERVICE_DIR = Path(__file__).resolve().parent.parent
SRC_DIR = SERVICE_DIR / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

import cv2

from emotion_service.ml.emotion_model import predict_emotion_with_confidence

ENGAGEMENT_EVAL_DIR = SERVICE_DIR / "dataset" / "engagement_eval"
SAMPLE_PER_CLASS = 400  # single-frame inference is slow; a sample is enough signal


def sample_files(class_dir: Path, n: int) -> list[Path]:
    files = sorted(p for p in class_dir.iterdir() if p.is_file())
    step = max(1, len(files) // n)
    return files[::step][:n]


def main() -> None:
    for class_dir in sorted(ENGAGEMENT_EVAL_DIR.iterdir()):
        if not class_dir.is_dir():
            continue

        files = sample_files(class_dir, SAMPLE_PER_CLASS)
        raw_counter: Counter[str] = Counter()
        confidences: list[float] = []

        for path in files:
            img = cv2.imread(str(path))
            if img is None:
                continue
            try:
                raw_emotion, confidence = predict_emotion_with_confidence(img)
            except Exception:
                continue
            raw_counter[raw_emotion] += 1
            confidences.append(confidence)

        total = sum(raw_counter.values())
        avg_conf = sum(confidences) / len(confidences) if confidences else 0.0

        print(f"\n{class_dir.name} (n={total}, avg confidence={avg_conf:.3f}):")
        for label, count in raw_counter.most_common():
            print(f"  {label:8s}: {count:4d} ({100 * count / total:.1f}%)")


if __name__ == "__main__":
    main()
