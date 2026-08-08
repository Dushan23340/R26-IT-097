"""Standalone in-process predict() timing for model/best_custom_cnn_v4.keras,
mirroring benchmark_inference.py's methodology (warmup exclusion, same
sample images) WITHOUT touching the live-serving model
(fused_emotion_model.py hardcodes model/best_fused_model.h5 - currently
v3) - lets v3 vs v4 speed be compared without swapping production.

Only times the predict step itself (face detection/tracking are
architecture-independent - the same for both models, already measured in
benchmark_inference.py's IN-PROCESS breakdown for v3: detect_ms=1.12,
track_ms=0.05), so this is directly comparable to v3's predict_ms=39.88.
"""

from __future__ import annotations

import statistics
import sys
import time
from pathlib import Path

import cv2
import numpy as np
import tensorflow as tf

SERVICE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SERVICE_DIR / "src"))
from emotion_service.ml.occlusion import apply_region_weighting  # noqa: E402

IMG_SIZE = 48
NUM_SAMPLES = 60
WARMUP = 5


def macro_f1(y_true, y_pred):  # unused at inference, only needed to satisfy custom_objects
    return 0.0


def _collect_sample_images(n: int) -> list[np.ndarray]:
    dataset_dir = SERVICE_DIR / "dataset" / "final_dataset"
    paths = sorted(dataset_dir.glob("*/*.jpg"))[: n * 3]
    images = []
    for p in paths:
        img = cv2.imread(str(p))
        if img is not None:
            images.append(img)
        if len(images) >= n:
            break
    return images


def _preprocess(face_bgr: np.ndarray) -> np.ndarray:
    rgb = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2RGB)
    resized = cv2.resize(rgb, (IMG_SIZE, IMG_SIZE), interpolation=cv2.INTER_CUBIC)
    return apply_region_weighting(resized.astype("float32"))


def main() -> None:
    print("Loading model/best_custom_cnn_v4.keras")
    model = tf.keras.models.load_model(
        "model/best_custom_cnn_v4.keras", custom_objects={"macro_f1": macro_f1}
    )

    images = _collect_sample_images(NUM_SAMPLES)
    print(f"Loaded {len(images)} real sample frames")

    # Real cached MediaPipe feature vectors (56-dim) - shape matters for
    # timing (concat + dense layers), values don't, so a handful of real
    # ones reused/cycled is fine.
    data = np.load("dataset/facial_features_v3.npz", allow_pickle=True)
    feature_pool = data["features"][:NUM_SAMPLES].astype("float32")

    latencies_ms = []
    for i, img in enumerate(images):
        image_tensor = np.expand_dims(_preprocess(img), axis=0)
        feature_vector = np.expand_dims(feature_pool[i % len(feature_pool)], axis=0)

        start = time.perf_counter()
        model.predict([image_tensor, feature_vector], verbose=0)
        elapsed_ms = (time.perf_counter() - start) * 1000

        if i >= WARMUP:
            latencies_ms.append(elapsed_ms)

    mean_ms = statistics.mean(latencies_ms)
    median_ms = statistics.median(latencies_ms)
    fps = 1000 / mean_ms

    print(f"\nn={len(latencies_ms)}  mean={mean_ms:.2f}ms  median={median_ms:.2f}ms")
    print(f"achievable FPS (predict step only): {fps:.2f}")
    print("(add v3's detect_ms=1.12 + track_ms=0.05 for a full-pipeline comparison)")


if __name__ == "__main__":
    main()
