"""One-off migration: upload the existing static/notes/<lesson_id>/<lo>.pdf
files into Object Storage and register them in PostgreSQL's core.resources
table (target production architecture, item 4). Idempotent - re-running
just re-uploads and upserts the same rows.

Run from adaptive-learning/backend/:
    .venv/bin/python scripts/migrate_resources_to_object_storage.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import db as core_db
import object_storage

NOTES_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static", "notes")


def main():
    object_storage.ensure_bucket()

    uploaded = 0
    for lesson_id in sorted(os.listdir(NOTES_DIR)):
        lesson_dir = os.path.join(NOTES_DIR, lesson_id)
        if not os.path.isdir(lesson_dir):
            continue

        for filename in sorted(os.listdir(lesson_dir)):
            if not filename.endswith(".pdf"):
                continue

            bloom_level = filename[:-4]
            local_path = os.path.join(lesson_dir, filename)
            object_key = f"notes/{lesson_id}/{filename}"
            byte_size = os.path.getsize(local_path)

            object_storage.upload_file(local_path, object_key, "application/pdf")
            core_db.execute(
                """
                INSERT INTO core.resources (lesson_id, bloom_level, filename, object_key, content_type, byte_size)
                VALUES (%s, %s, %s, %s, 'application/pdf', %s)
                ON CONFLICT (lesson_id, bloom_level)
                DO UPDATE SET object_key = EXCLUDED.object_key, byte_size = EXCLUDED.byte_size
                """,
                (lesson_id, bloom_level, filename, object_key, byte_size),
            )
            uploaded += 1
            print(f"  {lesson_id}/{filename} -> {object_key} ({byte_size} bytes)")

    print(f"\nDone. {uploaded} resources uploaded and registered in core.resources.")


if __name__ == "__main__":
    main()
