"""Extract MediaPipe blendshape + head-pose features for every image in
dataset/expression_dataset and cache them to a single .npz file.

This feeds the fused model (train_fused_model.py): the CNN branch still
sees the raw face crop, but a second branch sees 56 engineered features -
52 ARKit-style blendshape scores (includes eyeBlinkLeft/Right, brow
movement, jaw/mouth shape, etc.), 3 head-pose angles (pitch/yaw/roll)
derived from the facial transformation matrix, and a landmarks-detected
flag (0 when MediaPipe couldn't find a face in the crop, so the model can
learn to discount the feature branch rather than see misleading zeros).

Extraction is a one-time cost (~4-5ms/image) - re-running training should
reuse the cached .npz rather than re-extracting every time.
"""

from __future__ import annotations

import sys
from pathlib import Path

import cv2
import numpy as np

SERVICE_DIR = Path(__file__).resolve().parent.parent
SRC_DIR = SERVICE_DIR / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

import mediapipe as mp
from mediapipe.tasks.python import BaseOptions, vision

DATASET_DIR = SERVICE_DIR / "dataset" / "expression_dataset"
MODEL_PATH = SERVICE_DIR / "model" / "mediapipe" / "face_landmarker.task"
OUTPUT_PATH = SERVICE_DIR / "dataset" / "facial_features.npz"

CLASSES = sorted(p.name for p in DATASET_DIR.iterdir() if p.is_dir())
NUM_BLENDSHAPES = 52
FEATURE_DIM = NUM_BLENDSHAPES + 3 + 1  # blendshapes + pitch/yaw/roll + detected flag


def _build_landmarker() -> vision.FaceLandmarker:
    options = vision.FaceLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=str(MODEL_PATH)),
        output_face_blendshapes=True,
        output_facial_transformation_matrixes=True,
        num_faces=1,
    )
    return vision.FaceLandmarker.create_from_options(options)


def _rotation_to_euler(matrix: np.ndarray) -> tuple[float, float, float]:
    """Tait-Bryan XYZ angles (pitch, yaw, roll) in radians from a 3x3
    rotation matrix, standard decomposition used for head-pose estimation."""
    r = matrix[:3, :3]
    sy = float(np.sqrt(r[0, 0] ** 2 + r[1, 0] ** 2))
    singular = sy < 1e-6

    if not singular:
        pitch = np.arctan2(r[2, 1], r[2, 2])
        yaw = np.arctan2(-r[2, 0], sy)
        roll = np.arctan2(r[1, 0], r[0, 0])
    else:
        pitch = np.arctan2(-r[1, 2], r[1, 1])
        yaw = np.arctan2(-r[2, 0], sy)
        roll = 0.0

    return float(pitch), float(yaw), float(roll)


def extract_features(landmarker: vision.FaceLandmarker, image: np.ndarray) -> np.ndarray:
    """Returns a fixed FEATURE_DIM vector; all-zero blendshapes/pose with
    detected=0 when no face landmarks are found in the crop."""
    rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
    result = landmarker.detect(mp_image)

    features = np.zeros(FEATURE_DIM, dtype="float32")

    if not result.face_blendshapes or not result.facial_transformation_matrixes:
        return features

    blendshapes = result.face_blendshapes[0]
    for i, category in enumerate(blendshapes[:NUM_BLENDSHAPES]):
        features[i] = category.score

    matrix = np.array(result.facial_transformation_matrixes[0])
    pitch, yaw, roll = _rotation_to_euler(matrix)
    features[NUM_BLENDSHAPES] = pitch
    features[NUM_BLENDSHAPES + 1] = yaw
    features[NUM_BLENDSHAPES + 2] = roll
    features[NUM_BLENDSHAPES + 3] = 1.0  # detected

    return features


def main() -> None:
    landmarker = _build_landmarker()

    paths: list[str] = []
    labels: list[str] = []
    features: list[np.ndarray] = []
    detected_count = 0

    for class_name in CLASSES:
        class_dir = DATASET_DIR / class_name
        files = sorted(p for p in class_dir.iterdir() if p.is_file())
        print(f"{class_name}: {len(files)} images")

        for i, path in enumerate(files):
            image = cv2.imread(str(path))
            if image is None:
                continue

            feature_vector = extract_features(landmarker, image)
            if feature_vector[-1] == 1.0:
                detected_count += 1

            paths.append(str(path.relative_to(SERVICE_DIR)))
            labels.append(class_name)
            features.append(feature_vector)

            if (i + 1) % 2000 == 0:
                print(f"  {i + 1}/{len(files)}")

    features_arr = np.stack(features)
    print(f"\nTotal: {len(paths)} images, landmarks detected in {detected_count} "
          f"({100 * detected_count / len(paths):.1f}%)")

    np.savez(
        OUTPUT_PATH,
        paths=np.array(paths),
        labels=np.array(labels),
        features=features_arr,
    )
    print(f"Saved to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
