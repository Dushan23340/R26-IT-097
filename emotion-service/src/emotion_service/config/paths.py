from __future__ import annotations

import os
from pathlib import Path

# Default locations match your current working setup so behavior stays compatible.
# You can override these via environment variables.

_SERVICE_DIR = Path(__file__).resolve().parents[3]  # emotion-service/

DEFAULT_VIDEO_DIR = "/Users/dushanchamuditha/Downloads/DAiSEE/DataSet"
DEFAULT_LABELS_CSV = "/Users/dushanchamuditha/Downloads/DAiSEE/Labels/TrainLabels.csv"


def _env_path(var_name: str, default: str) -> Path:
    val = os.getenv(var_name)
    if not val:
        return Path(default).expanduser().resolve()
    p = Path(val).expanduser()
    if not p.is_absolute():
        # Allow relative overrides (relative to emotion-service/)
        p = _SERVICE_DIR / p
    return p.resolve()


def get_daiisee_video_dir() -> Path:
    return _env_path("DAISEE_VIDEO_DIR", DEFAULT_VIDEO_DIR)


def get_daiisee_labels_csv() -> Path:
    return _env_path("DAISEE_LABELS_CSV", DEFAULT_LABELS_CSV)


def get_daiisee_output_dir() -> Path:
    # Keep the default output compatible with your current script:
    # emotion-service/dataset/daisee_frames
    val = os.getenv("DAISEE_OUTPUT_DIR")
    if val:
        p = Path(val).expanduser()
        if not p.is_absolute():
            p = _SERVICE_DIR / p
        return p.resolve()

    return (_SERVICE_DIR / "dataset" / "daisee_frames").resolve()

