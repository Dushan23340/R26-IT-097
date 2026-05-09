import cv2
import os
from tqdm import tqdm

INPUT_DIR = "dataset/daisee_frames"
OUTPUT_DIR = "dataset/daisee_faces"

os.makedirs(OUTPUT_DIR, exist_ok=True)

face_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades +
    "haarcascade_frontalface_default.xml"
)

IMG_SIZE = 224

for label in os.listdir(INPUT_DIR):

    label_path = os.path.join(INPUT_DIR, label)

    if not os.path.isdir(label_path):
        continue

    save_path = os.path.join(OUTPUT_DIR, label)

    os.makedirs(save_path, exist_ok=True)

    for img_name in tqdm(os.listdir(label_path),
                         desc=f"Processing {label}"):

        img_path = os.path.join(label_path, img_name)

        img = cv2.imread(img_path)

        if img is None:
            continue

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        faces = face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(50, 50)
        )

        for i, (x, y, w, h) in enumerate(faces):

            face = img[y:y+h, x:x+w]

            face = cv2.resize(face, (IMG_SIZE, IMG_SIZE))

            save_name = f"{os.path.splitext(img_name)[0]}_{i}.jpg"

            cv2.imwrite(
                os.path.join(save_path, save_name),
                face
            )

print("Face extraction complete")