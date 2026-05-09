from collections import Counter
import time


class EmotionTracker:
    def __init__(self):
        self.emotion_history = []
        self.transition_count = 0
        self.last_emotion = None
        self.start_time = time.time()

    def update(self, emotion):
        current_time = time.time()

        # save emotion with timestamp
        self.emotion_history.append({
            "emotion": emotion,
            "time": current_time
        })

        # count transitions
        if self.last_emotion is not None:
            if emotion != self.last_emotion:
                self.transition_count += 1

        self.last_emotion = emotion

    def get_emotion_duration(self):
        durations = {}

        for i in range(1, len(self.emotion_history)):
            prev = self.emotion_history[i - 1]
            curr = self.emotion_history[i]

            emotion = prev["emotion"]
            delta = curr["time"] - prev["time"]

            durations[emotion] = durations.get(emotion, 0) + delta

        return durations

    def get_transition_rate(self):
        total_time = time.time() - self.start_time

        if total_time == 0:
            return 0

        return self.transition_count / total_time

    def get_stability_score(self):
        if len(self.emotion_history) == 0:
            return 0

        emotions = [x["emotion"] for x in self.emotion_history]

        most_common = Counter(emotions).most_common(1)[0][1]

        return most_common / len(emotions)

    def get_metrics(self):
        return {
            "emotion_duration": self.get_emotion_duration(),
            "transition_rate": self.get_transition_rate(),
            "stability_score": self.get_stability_score()
        }