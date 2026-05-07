import cv2
import os
import pandas as pd
from tqdm import tqdm

VIDEO_DIR = "/Users/dushanchamuditha/Downloads/DAiSEE/DataSet"
CSV_PATH = "/Users/dushanchamuditha/Downloads/DAiSEE/Labels/TrainLabels.csv"
OUTPUT_DIR = "dataset/daisee_frames"

os.makedirs(OUTPUT_DIR, exist_ok=True)

df = pd.read_csv(CSV_PATH)
df.columns = df.columns.str.strip()

def get_label(row):
    emotions = {
        "boredom": row["Boredom"],
        "confusion": row["Confusion"],
        "frustration": row["Frustration"],
        "engagement": row["Engagement"]
    }
    return max(emotions, key=emotions.get)

def find_video(file_name):
    for root, _, files in os.walk(VIDEO_DIR):
        if file_name in files:
            return os.path.join(root, file_name)
    return None

print("Starting extraction...")

processed = 0

for _, row in tqdm(df.iterrows(), total=len(df)):

    video_file = str(row["ClipID"]).strip()

    video_path = find_video(video_file)

    if video_path is None:
        continue

    cap = cv2.VideoCapture(video_path)

    if not cap.isOpened():
        continue

    label = get_label(row)

    save_dir = os.path.join(OUTPUT_DIR, label)
    os.makedirs(save_dir, exist_ok=True)

    count = 0
    saved = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if count % 15 == 0:
            cv2.imwrite(
                os.path.join(save_dir, f"{video_file}_{saved}.jpg"),
                frame
            )
            saved += 1

        count += 1

    cap.release()
    processed += 1

print("DONE")
print("Processed videos:", processed)