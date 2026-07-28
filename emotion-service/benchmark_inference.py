"""Real-time performance benchmark for the served emotion-recognition
pipeline, per the proposal's NFR: "process live webcam input at a minimum
throughput of 15 FPS... maximum inference latency below 50ms per frame"
(section 5.3), benchmarked on "Intel Core i3 processor, 4GB RAM, CPU-only"
(section 3.5). No such benchmark existed anywhere in the repo before this.

Honesty note on hardware: this actually runs on whatever machine executes
it (see the printed CPU info below) - there is no i3/4GB machine available
to test on directly. Apple Silicon CPU cores are generally faster than a
laptop-class i3, so a PASS here is not proof the proposal's exact hardware
target is met; a FAIL here, however, would definitely also fail on an i3.
Treat this as "best available real measurement", not a substitute for
testing on the actual target hardware.

Two measurements, both against the exact code path flask_api.py serves:
  1. IN-PROCESS: face detection -> crop -> predict_emotion_with_confidence
     -> tracker.update -> compute_attention_score, timed directly (no
     network/Flask/JSON overhead) - the closest equivalent to "the model's
     own processing speed".
  2. LIVE HTTP: real POST /predict calls against the running service on
     port 5002 (base64 image, JSON parse/serialize, Flask routing, and the
     debug_frame.jpg/debug_face.jpg disk writes currently still present in
     flask_api.py) - the actual latency a real browser session experiences.
"""

from __future__ import annotations

import json
import platform
import statistics
import sys
import time
from pathlib import Path

import cv2
import numpy as np

SERVICE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SERVICE_DIR / "src"))

from emotion_service.ml.emotion_tracker import EmotionTracker  # noqa: E402
from emotion_service.ml.face_detection import detect_faces  # noqa: E402
from emotion_service.ml.fused_emotion_model import predict_emotion_with_confidence  # noqa: E402
from emotion_service.ml.student_state import compute_attention_score  # noqa: E402

DATASET_DIR = SERVICE_DIR / "dataset" / "final_dataset"
NUM_WARMUP = 5
NUM_SAMPLES = 60
FPS_TARGET = 15.0
LATENCY_TARGET_MS = 50.0
RESULTS_PATH = SERVICE_DIR / "model" / "benchmark_results.json"


def _collect_sample_images(n: int) -> list[np.ndarray]:
    """n images spread evenly across all 6 classes, read once up front so
    disk I/O for loading test images doesn't pollute the inference timing."""
    classes = sorted(p.name for p in DATASET_DIR.iterdir() if p.is_dir())
    per_class = max(1, n // len(classes))
    images = []
    for class_name in classes:
        files = sorted((DATASET_DIR / class_name).iterdir())[:per_class]
        for path in files:
            image = cv2.imread(str(path))
            if image is not None:
                images.append(image)
    return images[:n]


def _percentile(values: list[float], p: float) -> float:
    values = sorted(values)
    k = (len(values) - 1) * (p / 100.0)
    f, c = int(k), min(int(k) + 1, len(values) - 1)
    if f == c:
        return values[f]
    return values[f] + (values[c] - values[f]) * (k - f)


def _summarize(label: str, latencies_ms: list[float]) -> dict:
    mean = statistics.mean(latencies_ms)
    fps = 1000.0 / mean if mean > 0 else 0.0
    summary = {
        "label": label,
        "n": len(latencies_ms),
        "mean_ms": round(mean, 2),
        "median_ms": round(statistics.median(latencies_ms), 2),
        "p95_ms": round(_percentile(latencies_ms, 95), 2),
        "max_ms": round(max(latencies_ms), 2),
        "achievable_fps": round(fps, 2),
        "meets_fps_target": fps >= FPS_TARGET,
        "meets_latency_target": statistics.median(latencies_ms) < LATENCY_TARGET_MS,
    }
    print(f"\n{label}")
    print(f"  n={summary['n']}  mean={summary['mean_ms']}ms  median={summary['median_ms']}ms  "
          f"p95={summary['p95_ms']}ms  max={summary['max_ms']}ms")
    print(f"  achievable FPS: {summary['achievable_fps']}  "
          f"({'PASS' if summary['meets_fps_target'] else 'FAIL'} vs >={FPS_TARGET} FPS target)")
    print(f"  median latency: {'PASS' if summary['meets_latency_target'] else 'FAIL'} "
          f"vs <{LATENCY_TARGET_MS}ms target")
    return summary


def benchmark_in_process(images: list[np.ndarray]) -> dict:
    tracker = EmotionTracker()
    stage_totals = {"detect_ms": [], "predict_ms": [], "track_ms": []}
    total_latencies_ms = []

    def _run_once(image: np.ndarray, record: bool) -> float | None:
        t_start = time.perf_counter()

        t0 = time.perf_counter()
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        faces = detect_faces(image, gray_frame=gray)
        t_detect = time.perf_counter() - t0
        if not faces:
            return None
        x, y, w, h = faces[0]
        face_roi = image[y:y + h, x:x + w]
        if face_roi.size == 0:
            return None

        t0 = time.perf_counter()
        raw_emotion, confidence = predict_emotion_with_confidence(face_roi)
        t_predict = time.perf_counter() - t0

        t0 = time.perf_counter()
        tracker.update("benchmark_student", raw_emotion)
        metrics = tracker.get_metrics("benchmark_student")
        compute_attention_score(
            stability_score=metrics["stabilityScore"],
            transition_rate=metrics["transitionRate"],
            emotion_confidence=confidence,
        )
        t_track = time.perf_counter() - t0

        total = time.perf_counter() - t_start
        # Warmup iterations are deliberately excluded here too - they ran
        # through predict_emotion_with_confidence while TF/Keras still had
        # lazy graph-tracing/caching to do, which otherwise inflates the
        # stage breakdown's predict_ms mean past the (correctly warmup-
        # excluded) total latency mean it's supposed to be a component of.
        if record:
            stage_totals["detect_ms"].append(t_detect * 1000)
            stage_totals["predict_ms"].append(t_predict * 1000)
            stage_totals["track_ms"].append(t_track * 1000)
        return total * 1000

    print(f"Warming up ({NUM_WARMUP} iterations - excludes lazy model/graph init from measurement)...")
    for image in images[:NUM_WARMUP]:
        _run_once(image, record=False)

    print(f"Benchmarking in-process pipeline ({len(images)} real sample frames)...")
    for image in images:
        latency = _run_once(image, record=True)
        if latency is not None:
            total_latencies_ms.append(latency)

    summary = _summarize("IN-PROCESS (face detect + predict + track, no network)", total_latencies_ms)
    summary["stage_breakdown_ms"] = {
        stage: round(statistics.mean(values), 2) for stage, values in stage_totals.items() if values
    }
    print(f"  stage breakdown (mean): {summary['stage_breakdown_ms']}")
    return summary


def benchmark_live_http(images: list[np.ndarray], base_url: str = "http://127.0.0.1:5002") -> dict | None:
    import base64
    import urllib.error
    import urllib.request

    try:
        urllib.request.urlopen(f"{base_url}/health", timeout=3)
    except (urllib.error.URLError, ConnectionError):
        print(f"\n{base_url} is not reachable - skipping live HTTP benchmark "
              "(start flask_api.py to include this measurement).")
        return None

    latencies_ms = []

    def _post_once(image: np.ndarray) -> float | None:
        ok, buf = cv2.imencode(".jpg", image)
        if not ok:
            return None
        b64 = base64.b64encode(buf.tobytes()).decode()
        payload = json.dumps({"image": f"data:image/jpeg;base64,{b64}", "studentId": "benchmark_http"}).encode()
        req = urllib.request.Request(f"{base_url}/predict", data=payload, headers={"Content-Type": "application/json"})
        t0 = time.perf_counter()
        try:
            urllib.request.urlopen(req, timeout=15).read()
        except urllib.error.URLError:
            return None
        return (time.perf_counter() - t0) * 1000

    print(f"\nWarming up live HTTP endpoint ({NUM_WARMUP} requests)...")
    for image in images[:NUM_WARMUP]:
        _post_once(image)

    print(f"Benchmarking live POST /predict ({len(images)} real sample frames, includes network/JSON/disk-write overhead)...")
    for image in images:
        latency = _post_once(image)
        if latency is not None:
            latencies_ms.append(latency)

    if not latencies_ms:
        return None
    return _summarize("LIVE HTTP (real POST /predict, as a browser actually experiences it)", latencies_ms)


def main() -> None:
    print(f"Host CPU: {platform.processor() or platform.machine()}  "
          f"(NOT the proposal's target i3/4GB hardware - see module docstring)")
    print(f"Python: {platform.python_version()}  Platform: {platform.platform()}")

    images = _collect_sample_images(NUM_SAMPLES)
    print(f"Loaded {len(images)} real sample frames from {DATASET_DIR.relative_to(SERVICE_DIR)}")

    in_process = benchmark_in_process(images)
    live_http = benchmark_live_http(images)

    results = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "host_cpu": platform.processor() or platform.machine(),
        "host_platform": platform.platform(),
        "note": "Benchmarked on available dev hardware, not the proposal's i3/4GB CPU-only target - see script docstring.",
        "targets": {"fps": FPS_TARGET, "latency_ms": LATENCY_TARGET_MS},
        "in_process": in_process,
        "live_http": live_http,
    }
    RESULTS_PATH.parent.mkdir(exist_ok=True)
    with open(RESULTS_PATH, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    print(f"\nSaved results to {RESULTS_PATH.relative_to(SERVICE_DIR)}")


if __name__ == "__main__":
    main()
