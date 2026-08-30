"""Thin PostgreSQL access for this service's own persistent data (the
"core" schema — see repo root db/migrations/001_core_users_and_resources.sql).
This is the same shared PostgreSQL instance analytics-service and the Node
backend already use — no separate database for this service.
"""

import os
import psycopg2
import psycopg2.extras

_CONN_KWARGS = dict(
    host=os.environ.get("PGHOST", "127.0.0.1"),
    port=int(os.environ.get("PGPORT", 5432)),
    dbname=os.environ.get("PGDATABASE", "adaptive_learning_analytics"),
    user=os.environ.get("PGUSER", "postgres"),
    password=os.environ.get("PGPASSWORD", "postgres"),
)


def get_connection():
    return psycopg2.connect(**_CONN_KWARGS)


def fetch_one(query: str, params: tuple = ()):
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(query, params)
            return cur.fetchone()


def execute(query: str, params: tuple = ()):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
        conn.commit()
