import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from emotion_service.ml.realtime_pipeline import map_raw_to_student_state


class RealtimePipelineTests(unittest.TestCase):
    def test_low_confidence_predictions_fall_back_to_previous_state(self):
        state = map_raw_to_student_state("Happy", confidence=0.31, previous_state="Confused")
        self.assertEqual(state, "Confused")

    def test_confident_prediction_is_preserved(self):
        state = map_raw_to_student_state("Happy", confidence=0.82, previous_state="Neutral")
        self.assertEqual(state, "Engaged")

    def test_surprise_is_calibrated_as_engaged_in_classroom(self):
        state = map_raw_to_student_state("Surprise", confidence=0.55, previous_state="Neutral")
        self.assertEqual(state, "Engaged")

    def test_happy_with_moderate_confidence_maps_to_engaged(self):
        state = map_raw_to_student_state("Happy", confidence=0.47, previous_state="Bored")
        self.assertEqual(state, "Engaged")


if __name__ == "__main__":
    unittest.main()
