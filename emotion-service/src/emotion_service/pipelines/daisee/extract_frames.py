from __future__ import annotations

import os
from pathlib import Path

import cv2
import pandas as pd
from tqdm import tqdm

from emotion_service.config.paths import (
    get_daiisee_labels_csv,
    get_daiisee_output_dir,
    get_daiisee_video_dir,
)


def get_label(row) -> str:
    emotions = {
        "boredom": row["Boredom"],
        "confusion": row["Confusion"],
        "frustration": row["Frustration"],
        "engagement": row["Engagement"],
    }
    return max(emotions, key=emotions.get)


def find_video(file_name: str, video_dir: Path) -> str | None:
    for root, _, files in os.walk(video_dir):
        if file_name in files:
            return os.path.join(root, file_name)
    return None


def extract_daisee_frames(
    *,
    video_dir: Path | None = None,
    labels_csv: Path | None = None,
    output_dir: Path | None = None,
    frame_stride: int = 15,
) -> None:
    """
    Extract labeled frames from DAiSEE videos.

    Default behavior matches your current `extract_daisee_frames.py` script.
    """
    video_dir = video_dir or get_daiisee_video_dir()
    labels_csv = labels_csv or get_daiisee_labels_csv()
    output_dir = output_dir or get_daiisee_output_dir()

    output_dir.mkdir(parents=True, exist_ok=True)

    df = pd.read_csv(labels_csv)
    df.columns = df.columns.str.strip()

    print("Starting extraction...")
    processed = 0

    for _, row in tqdm(df.iterrows(), total=len(df)):
        video_file = str(row["ClipID"]).strip()
        video_path = find_video(video_file, video_dir)
        if video_path is None:
            continue

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            continue

        label = get_label(row)
        save_dir = output_dir / label
        save_dir.mkdir(parents=True, exist_ok=True)

        count = 0
        saved = 0
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            if count % frame_stride == 0:
                cv2.imwrite(str(save_dir / f"{video_file}_{saved}.jpg"), frame)
                saved += 1

            count += 1

        cap.release()
        processed += 1

    print("DONE")
    print("Processed videos:", processed)

