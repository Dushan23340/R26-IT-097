"""Sync static/notes/<lesson_id>/<lo>.pdf into Object Storage and
PostgreSQL's core.resources table (target production architecture, item
4): uploads every note on disk and upserts its row, then removes rows (and
their objects) for notes no longer on disk - e.g. after the LO quizzes
dropped the analyze/evaluate/create levels. Idempotent - re-running just
re-uploads the same files and finds nothing stale.

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

    on_disk = {
        (lesson_id, filename[:-4])
        for lesson_id in os.listdir(NOTES_DIR) if os.path.isdir(os.path.join(NOTES_DIR, lesson_id))
        for filename in os.listdir(os.path.join(NOTES_DIR, lesson_id)) if filename.endswith(".pdf")
    }
    removed = 0
    for row in core_db.fetch_all("SELECT lesson_id, bloom_level, object_key FROM core.resources"):
        if (row["lesson_id"], row["bloom_level"]) in on_disk:
            continue
        object_storage.delete_object(row["object_key"])
        core_db.execute(
            "DELETE FROM core.resources WHERE lesson_id = %s AND bloom_level = %s",
            (row["lesson_id"], row["bloom_level"]),
        )
        removed += 1
        print(f"  removed stale {row['object_key']}")

    print(f"\nDone. {uploaded} resources uploaded and registered in core.resources, {removed} stale removed.")


if __name__ == "__main__":
    main()
