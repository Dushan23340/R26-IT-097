"""Create the analytics database and apply the schema."""
import psycopg2
from pathlib import Path

DB_HOST = "localhost"
DB_PORT = 5432
DB_USER = "postgres"
DB_PASSWORD = "Ravindu2001"
DB_NAME = "adaptive_learning_analytics"
SCHEMA_FILE = Path(__file__).resolve().parent / "models" / "schema.sql"


def create_database():
    conn = psycopg2.connect(
        host=DB_HOST, port=DB_PORT, user=DB_USER,
        password=DB_PASSWORD, dbname="postgres",
    )
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(f"SELECT 1 FROM pg_database WHERE datname = %s", (DB_NAME,))
    if cur.fetchone():
        print(f"Database '{DB_NAME}' already exists.")
    else:
        cur.execute(f'CREATE DATABASE "{DB_NAME}"')
        print(f"Database '{DB_NAME}' created.")
    cur.close()
    conn.close()


def apply_schema():
    schema_sql = SCHEMA_FILE.read_text()
    conn = psycopg2.connect(
        host=DB_HOST, port=DB_PORT, user=DB_USER,
        password=DB_PASSWORD, dbname=DB_NAME,
    )
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(schema_sql)
    print("Schema applied successfully.")
    cur.close()
    conn.close()


if __name__ == "__main__":
    create_database()
    apply_schema()
