from __future__ import annotations

import sys
from pathlib import Path

# Make the `emotion_service` package importable when running this file directly:
#   python emotion-service/extract_daisee_frames.py
_SERVICE_DIR = Path(__file__).resolve().parent
_SRC_DIR = _SERVICE_DIR / "src"
if str(_SRC_DIR) not in sys.path:
    sys.path.insert(0, str(_SRC_DIR))

from emotion_service.pipelines.daisee.extract_frames import extract_daisee_frames


def main() -> None:
    # Defaults keep behavior compatible with your previous script.
    extract_daisee_frames()


if __name__ == "__main__":
    main()