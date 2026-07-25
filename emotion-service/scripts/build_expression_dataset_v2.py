"""Phase 5 groundwork - enrich the facial-expression CNN's training data.

The CNN (Phase 2, see build_expression_dataset.py) only ever targets
Angry/Happy/Normal - Bored/Confused/Frustrated/Engaged are derived
downstream by the student_state heuristic instead (validate_engagement_
signatures.py showed raw expression can't separate those directly, and
training all 6 as one classifier hit a 12.5x class imbalance in
final_dataset - Bored 22,368 vs Frustrated 1,780). That architecture split
is staying as-is.

What FER-2013 alone gave the CNN was small (48x48, greyscale, famously
noisy labels). AffectNet adds far more, higher-resolution, real-world
photos for the same three target classes. This script merges both RAW
sources - not the already-filtered dataset/expression_dataset - into a new
dataset/expression_dataset_v2/{Angry,Happy,Normal}, so the current
production dataset is untouched until the retrained model is evaluated and
proven better.

Raw sources (not part of this repo, downloaded separately):
  ~/Desktop/Y4S1/Research/DataSets/FER 2013/{train,test}/{angry,happy,neutral}
  ~/Desktop/Y4S1/Research/DataSets/AffectNet/{Train,Test}/{anger,happy,neutral}
    (AffectNet's Test split capitalizes Anger/Contempt but not the rest -
    class dirs are matched case-insensitively below.)
"""

from __future__ import annotations

import hashlib
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

SERVICE_DIR = Path(__file__).resolve().parent.parent
OUT_DIR = SERVICE_DIR / "dataset" / "expression_dataset_v2"

FER_DIR = Path.home() / "Desktop" / "Y4S1" / "Research" / "DataSets" / "FER 2013"
AFFECTNET_DIR = Path.home() / "Desktop" / "Y4S1" / "Research" / "DataSets" / "AffectNet"

# target_class -> [(root, split_subdir, source_class_name_lowercase), ...]
SOURCES: dict[str, list[tuple[Path, str, str]]] = {
    "Angry": [
        (FER_DIR, "train", "angry"),
        (FER_DIR, "test", "angry"),
        (AFFECTNET_DIR, "Train", "anger"),
        (AFFECTNET_DIR, "Test", "anger"),
    ],
    "Happy": [
        (FER_DIR, "train", "happy"),
        (FER_DIR, "test", "happy"),
        (AFFECTNET_DIR, "Train", "happy"),
        (AFFECTNET_DIR, "Test", "happy"),
    ],
    "Normal": [
        (FER_DIR, "train", "neutral"),
        (FER_DIR, "test", "neutral"),
        (AFFECTNET_DIR, "Train", "neutral"),
        (AFFECTNET_DIR, "Test", "neutral"),
    ],
}

MIN_STD_DEV = 5.0  # near-blank / solid-color crops


def _resolve_class_dir(split_dir: Path, wanted_lower: str) -> Path | None:
    """Case-insensitive class-folder lookup (AffectNet's Test split
    capitalizes Anger/Contempt but not the rest)."""
    if not split_dir.is_dir():
        return None
    for child in split_dir.iterdir():
        if child.is_dir() and child.name.lower() == wanted_lower:
            return child
    return None


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
    return float(np.std(gray)) < MIN_STD_DEV


def file_hash(path: Path) -> str:
    h = hashlib.md5()
    with open(path, "rb") as f:
        h.update(f.read())
    return h.hexdigest()


def collect_clean_files(src_dir: Path, seen_hashes: set[str]) -> list[Path]:
    files = sorted(
        p for p in src_dir.iterdir()
        if p.is_file() and p.suffix.lower() in {".jpg", ".jpeg", ".png"}
    )
    clean: list[Path] = []
    for path in files:
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


def build() -> dict[str, dict[str, int]]:
    stats: dict[str, dict[str, int]] = {}
    for target_class, sources in SOURCES.items():
        dst = OUT_DIR / target_class
        dst.mkdir(parents=True, exist_ok=True)

        seen_hashes: set[str] = set()
        source_total = 0
        kept_total = 0
        per_source: list[str] = []

        for root, split, source_class in sources:
            split_dir = root / split
            class_dir = _resolve_class_dir(split_dir, source_class)
            if class_dir is None:
                per_source.append(f"{root.name}/{split}/{source_class}: NOT FOUND")
                continue

            files = [p for p in class_dir.iterdir() if p.is_file()]
            source_total += len(files)
            clean = collect_clean_files(class_dir, seen_hashes)
            kept_total += len(clean)
            per_source.append(f"{root.name}/{split}/{source_class}: {len(clean)}/{len(files)} kept")

            prefix = f"{root.name.replace(' ', '')}_{split}"
            for path in clean:
                out_name = f"{prefix}_{path.name}"
                out_path = dst / out_name
                if not out_path.exists():
                    out_path.write_bytes(path.read_bytes())

        stats[target_class] = {
            "source_total": source_total,
            "kept": kept_total,
            "per_source": per_source,
        }
    return stats


def main() -> None:
    print(f"FER-2013 root:  {FER_DIR} (exists={FER_DIR.exists()})")
    print(f"AffectNet root: {AFFECTNET_DIR} (exists={AFFECTNET_DIR.exists()})")
    print(f"Output: {OUT_DIR}\n")

    stats = build()
    for cls, s in stats.items():
        print(f"{cls}: {s['kept']} kept / {s['source_total']} source "
              f"({s['source_total'] - s['kept']} filtered/dup)")
        for line in s["per_source"]:
            print(f"    {line}")
        print()

    print("Done. Next: point train_mobilenetv2.py at "
          "dataset/expression_dataset_v2 (or run train_mobilenetv2_v2.py) "
          "and compare against the current model before swapping it in.")


if __name__ == "__main__":
    main()
