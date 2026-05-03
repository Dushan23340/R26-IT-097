from __future__ import annotations

import sys
import time

import cv2

from utils.face_detection import detect_faces


WINDOW_TITLE = "Face Detection - Emotion Service Step 1"


def main() -> int:
    try:
        webcam = cv2.VideoCapture(0)
    except Exception as exc:
        print(f"Error: unable to initialize webcam: {exc}")
        return 1

    if not webcam.isOpened():
        print("Error: webcam not available. Please connect a camera and try again.")
        return 1

    webcam.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    webcam.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    webcam.set(cv2.CAP_PROP_FPS, 30)

    previous_time = time.time()
    try:
        while True:
            ok, frame = webcam.read()
            if not ok:
                print("Warning: failed to read frame from webcam.")
                break

            faces = detect_faces(frame)

            for (x, y, w, h) in faces:
                cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 255, 0), 2)
                cv2.putText(
                    frame,
                    "Face",
                    (x, max(y - 10, 0)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.6,
                    (0, 255, 0),
                    2,
                    cv2.LINE_AA,
                )

            current_time = time.time()
            delta = max(current_time - previous_time, 1e-6)
            fps = 1.0 / delta
            previous_time = current_time

            cv2.putText(
                frame,
                f"FPS: {fps:.1f}",
                (10, 25),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (255, 255, 0),
                2,
                cv2.LINE_AA,
            )

            cv2.imshow(WINDOW_TITLE, frame)

            if cv2.waitKey(1) & 0xFF == ord("q"):
                break
    except FileNotFoundError as exc:
        print(f"Error: {exc}")
        return 1
    except RuntimeError as exc:
        print(f"Error: {exc}")
        return 1
    finally:
        webcam.release()
        cv2.destroyAllWindows()

    return 0


if __name__ == "__main__":
    sys.exit(main())
