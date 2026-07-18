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

    def test_unrecognized_label_falls_back_to_previous_state(self):
        # The model's label space is angry/happy/normal only.
        state = map_raw_to_student_state("Sad", confidence=0.9, previous_state="Bored")
        self.assertEqual(state, "Bored")

    def test_happy_with_moderate_confidence_maps_to_engaged(self):
        state = map_raw_to_student_state("Happy", confidence=0.47, previous_state="Bored")
        self.assertEqual(state, "Engaged")

    def test_angry_maps_to_frustrated(self):
        state = map_raw_to_student_state("Angry", confidence=0.6, previous_state="Neutral")
        self.assertEqual(state, "Frustrated")

    def test_sustained_flat_expression_becomes_bored(self):
        state = map_raw_to_student_state(
            "Normal",
            confidence=0.7,
            previous_state="Neutral",
            stability_score=0.8,
            transition_rate=0.05,
            current_continuous_duration=30.0,
        )
        self.assertEqual(state, "Bored")

    def test_erratic_flat_expression_becomes_confused(self):
        state = map_raw_to_student_state(
            "Normal",
            confidence=0.6,
            previous_state="Neutral",
            stability_score=0.3,
            transition_rate=0.4,
            current_continuous_duration=5.0,
        )
        self.assertEqual(state, "Confused")

    def test_stable_short_normal_becomes_engaged(self):
        state = map_raw_to_student_state(
            "Normal",
            confidence=0.6,
            previous_state="Neutral",
            stability_score=0.8,
            transition_rate=0.1,
            current_continuous_duration=5.0,
        )
        self.assertEqual(state, "Engaged")


if __name__ == "__main__":
    unittest.main()
