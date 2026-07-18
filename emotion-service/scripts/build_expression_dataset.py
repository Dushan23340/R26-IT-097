"""Phase 1 dataset restructuring.

Splits the previously merged final_dataset into two concept-separated sets:

- dataset/expression_dataset/{Happy,Normal,Angry}
    Facial-expression images only. This becomes the CNN training target.

- dataset/engagement_eval/{Bored,Confused,Frustrated,Engaged}
    DAiSEE-derived cognitive/engagement-state face crops. Not used to train
    the CNN (that was the root cause of Issue 1 - mixing two different
    concepts into one classifier). Kept as a held-out set for evaluating the
    downstream rule-based student_state engine instead.

Both outputs are filtered for corrupt files, near-blank crops, and exact
duplicates before being copied.
"""

from __future__ import annotations

import hashlib
import shutil
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

SERVICE_DIR = Path(__file__).resolve().parent.parent
FINAL_DATASET = SERVICE_DIR / "dataset" / "final_dataset"
DAISEE_FACES = SERVICE_DIR / "dataset" / "daisee_faces"

EXPRESSION_OUT = SERVICE_DIR / "dataset" / "expression_dataset"
ENGAGEMENT_OUT = SERVICE_DIR / "dataset" / "engagement_eval"

EXPRESSION_CLASSES = ["Happy", "Normal", "Angry"]

ENGAGEMENT_SOURCE_MAP = {
    "boredom": "Bored",
    "confusion": "Confused",
    "frustration": "Frustrated",
    "engagement": "Engaged",
}
ENGAGEMENT_CAP_PER_CLASS = 5000  # eval set doesn't need every DAiSEE frame

MIN_STD_DEV = 5.0  # near-blank / solid-color crops


def is_valid_image(path: Path) -> bool:
    try:
        with Image.open(path) as img:
            img.verify()
        return True
    except Exception:
        return False


def is_low_quality(path: Path) -> bool:
    img = cv2.imread(str(path))
    if img is None or img.size == 0:
        return True
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    if float(np.std(gray)) < MIN_STD_DEV:
        return True
    return False


def file_hash(path: Path) -> str:
    h = hashlib.md5()
    with open(path, "rb") as f:
        h.update(f.read())
    return h.hexdigest()


def collect_clean_files(src_dir: Path, cap: int | None = None) -> list[Path]:
    files = sorted(
        p for p in src_dir.iterdir()
        if p.is_file() and p.suffix.lower() in {".jpg", ".jpeg", ".png"}
    )

    seen_hashes: set[str] = set()
    clean: list[Path] = []

    for path in files:
        if cap is not None and len(clean) >= cap:
            break
        if not is_valid_image(path):
            continue
        if is_low_quality(path):
            continue
        h = file_hash(path)
        if h in seen_hashes:
            continue
        seen_hashes.add(h)
        clean.append(path)

    return clean


def build_expression_dataset() -> dict[str, dict[str, int]]:
    stats: dict[str, dict[str, int]] = {}
    for cls in EXPRESSION_CLASSES:
        src = FINAL_DATASET / cls
        dst = EXPRESSION_OUT / cls
        dst.mkdir(parents=True, exist_ok=True)

        total = sum(1 for p in src.iterdir() if p.is_file())
        clean = collect_clean_files(src)

        for path in clean:
            shutil.copy2(path, dst / path.name)

        stats[cls] = {"source_total": total, "kept": len(clean)}

    return stats


def build_engagement_eval() -> dict[str, dict[str, int]]:
    stats: dict[str, dict[str, int]] = {}
    for src_name, out_name in ENGAGEMENT_SOURCE_MAP.items():
        src = DAISEE_FACES / src_name
        dst = ENGAGEMENT_OUT / out_name
        dst.mkdir(parents=True, exist_ok=True)

        total = sum(1 for p in src.iterdir() if p.is_file())
        clean = collect_clean_files(src, cap=ENGAGEMENT_CAP_PER_CLASS)

        for path in clean:
            shutil.copy2(path, dst / path.name)

        stats[out_name] = {"source_total": total, "kept": len(clean)}

    return stats


def main() -> None:
    print("Building expression_dataset (Happy / Normal / Angry) ...")
    expr_stats = build_expression_dataset()
    for cls, s in expr_stats.items():
        print(f"  {cls}: {s['kept']} kept / {s['source_total']} source "
              f"({s['source_total'] - s['kept']} filtered)")

    print("\nBuilding engagement_eval (Bored / Confused / Frustrated / Engaged) ...")
    eng_stats = build_engagement_eval()
    for cls, s in eng_stats.items():
        print(f"  {cls}: {s['kept']} kept / {s['source_total']} source "
              f"(capped at {ENGAGEMENT_CAP_PER_CLASS}, "
              f"{s['source_total'] - s['kept']} filtered/excluded)")

    print("\nDone.")
    print(f"expression_dataset -> {EXPRESSION_OUT}")
    print(f"engagement_eval    -> {ENGAGEMENT_OUT}")


if __name__ == "__main__":
    main()
