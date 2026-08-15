"""Recovers real DAiSEE frustration clips that the original single-label
extraction (extract_daisee_frames.py -> emotion_service.pipelines.daisee.
extract_frames.get_label) discarded, for two independent reasons:

1. It only ever read TrainLabels.csv - Validation (1,429 clips) and Test
   (1,784 clips) splits were never processed at all.
2. Its label rule is strict single-winner argmax across Boredom/Confusion/
   Frustration/Engagement. DAiSEE's own labels are per-clip 0-3 intensity
   scores on each of those four (not mutually exclusive) axes - a clip
   scored Frustration=2, Engagement=3 is a real, visibly frustrated (if
   also attentive) clip that argmax discards entirely into "engagement",
   which isn't even one of this project's 6 output classes.

Diagnosed via real-pipeline validation (see session notes) that Frustrated
was only 44.8% accurate against the live model, confused with Bored/
Confused - traced to Frustrated having only 1,780 training images against
Bored's 22,368 (12.5x imbalance, already documented in
scripts/build_expression_dataset_v2.py's docstring). Oversampling alone
(train_fused_model_v4.py) only traded Confused's accuracy for Frustrated's
without a net gain - real new data is the actual fix.

Inclusion rule for "this clip shows real, unambiguous frustration":
    Frustration >= 2  AND  Frustration > Boredom  AND  Frustration > Confusion
(Engagement is a different axis - attention, not negative affect - so a
clip tied or losing to Engagement is still included; that's exactly the
engagement-argmax-but-clearly-frustrated case being recovered.) This is
deliberately the SAME strictness as the original argmax rule (which also
implies Frustration > Boredom and > Confusion, by Python's max() tie-
resolution against a boredom-first-inserted dict) - just widened to all
3 splits instead of Train only, plus the engagement-tied clips.

Idempotent: skips any clip whose frames already exist in the output dir
(by filename prefix), so already-extracted Train clips aren't reprocessed.
Extracts into the SAME dataset/daisee_frames/frustration used by the
existing pipeline - extract_daisee_faces.py's face-crop step then needs to
be re-run (whole-directory, already idempotent-by-overwrite) to pick these
up into dataset/daisee_faces/frustration, and dataset/final_dataset/
Frustrated needs the new face crops copied in before retraining.
"""

from __future__ import annotations

import os
from pathlib import Path

import cv2
import pandas as pd
from tqdm import tqdm

DAISEE_ROOT = Path("/Users/dushanchamuditha/Desktop/Y4S1/Research/DataSets/DAiSEE")
SERVICE_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = SERVICE_DIR / "dataset" / "daisee_frames" / "frustration"
FRAME_STRIDE = 15  # matches extract_daisee_frames.py's default

SPLITS = {
    "Train": (DAISEE_ROOT / "Labels" / "TrainLabels.csv", DAISEE_ROOT / "DataSet" / "Train"),
    "Validation": (DAISEE_ROOT / "Labels" / "ValidationLabels.csv", DAISEE_ROOT / "DataSet" / "Validation"),
    "Test": (DAISEE_ROOT / "Labels" / "TestLabels.csv", DAISEE_ROOT / "DataSet" / "Test"),
}


def find_video(file_name: str, video_dir: Path) -> str | None:
    for root, _, files in os.walk(video_dir):
        if file_name in files:
            return os.path.join(root, file_name)
    return None


def already_extracted(video_file: str) -> bool:
    return any(OUTPUT_DIR.glob(f"{video_file}_*.jpg"))


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    target_clips: list[tuple[str, str, Path]] = []
    for split_name, (labels_csv, video_dir) in SPLITS.items():
        df = pd.read_csv(labels_csv)
        df.columns = df.columns.str.strip()
        df["ClipID"] = df["ClipID"].astype(str).str.strip()
        mask = (df["Frustration"] >= 2) & (df["Frustration"] > df["Boredom"]) & (df["Frustration"] > df["Confusion"])
        for clip_id in df[mask]["ClipID"]:
            target_clips.append((split_name, clip_id, video_dir))

    print(f"Target clips across all splits: {len(target_clips)}")

    skipped_existing = 0
    skipped_missing = 0
    processed = 0
    total_frames_saved = 0

    for split_name, video_file, video_dir in tqdm(target_clips, desc="Extracting frustration clips"):
        if already_extracted(video_file):
            skipped_existing += 1
            continue

        video_path = find_video(video_file, video_dir)
        if video_path is None:
            skipped_missing += 1
            continue

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            skipped_missing += 1
            continue

        count = 0
        saved = 0
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            if count % FRAME_STRIDE == 0:
                cv2.imwrite(str(OUTPUT_DIR / f"{video_file}_{saved}.jpg"), frame)
                saved += 1
            count += 1
        cap.release()

        processed += 1
        total_frames_saved += saved

    print("\nDONE")
    print(f"Newly processed clips: {processed}")
    print(f"Frames saved: {total_frames_saved}")
    print(f"Skipped (already extracted): {skipped_existing}")
    print(f"Skipped (video not found): {skipped_missing}")


if __name__ == "__main__":
    main()
