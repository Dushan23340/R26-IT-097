"""
PostgreSQL database connection module for the Analytics Service.

Provides connection pooling, context-manager cursor access, retry logic,
and a singleton pool pattern built on psycopg2.

Environment variables:
    ANALYTICS_DB_HOST      – PostgreSQL host           (default: localhost)
    ANALYTICS_DB_PORT      – PostgreSQL port           (default: 5432)
    ANALYTICS_DB_NAME      – Database name             (default: adaptive_learning_analytics)
    ANALYTICS_DB_USER      – Database user             (default: postgres)
    ANALYTICS_DB_PASSWORD  – Database password         (no default; must be set)

Usage:
    from config.database import get_cursor, test_connection

    with get_cursor() as cur:
        cur.execute('SELECT * FROM student_profiles')
        results = cur.fetchall()
"""

import os
import logging
import time
from pathlib import Path

from dotenv import load_dotenv
import psycopg2
from psycopg2 import OperationalError
from psycopg2.pool import SimpleConnectionPool

# Load root .env before reading DB_* variables
_project_root = Path(__file__).resolve().parents[2]
load_dotenv(_project_root / ".env")

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration from environment
# ---------------------------------------------------------------------------
DB_HOST = os.getenv("ANALYTICS_DB_HOST", "localhost")
DB_PORT = os.getenv("ANALYTICS_DB_PORT", "5432")
DB_NAME = os.getenv("ANALYTICS_DB_NAME", "adaptive_learning_analytics")
DB_USER = os.getenv("ANALYTICS_DB_USER", "postgres")
DB_PASSWORD = os.getenv("ANALYTICS_DB_PASSWORD", "")

# Connection-pool sizing
POOL_MIN = 1
POOL_MAX = 10

# Retry behaviour
MAX_RETRIES = 3
RETRY_DELAY_SECONDS = 1

# ---------------------------------------------------------------------------
# Singleton connection pool
# ---------------------------------------------------------------------------
_pool: SimpleConnectionPool | None = None


def _dsn() -> dict:
    """Return the data-source-name dict used by psycopg2 to connect."""
    return {
        "host": DB_HOST,
        "port": int(DB_PORT),
        "dbname": DB_NAME,
        "user": DB_USER,
        "password": DB_PASSWORD,
    }


def _init_pool() -> SimpleConnectionPool:
    """Create the singleton SimpleConnectionPool with retry logic.

    Retries up to MAX_RETRIES times on OperationalError, logging each
    failure and re-raising the last exception when all attempts are
    exhausted.
    """
    global _pool  # noqa: PLW0603

    if _pool is not None:
        return _pool

    dsn = _dsn()
    last_err: OperationalError | None = None

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            _pool = SimpleConnectionPool(
                POOL_MIN,
                POOL_MAX,
                **dsn,
            )
            logger.info(
                "Connection pool created (min=%d, max=%d) for %s@%s:%s/%s",
                POOL_MIN, POOL_MAX,
                DB_USER, DB_HOST, DB_PORT, DB_NAME,
            )
            return _pool
        except OperationalError as exc:
            last_err = exc
            logger.error(
                "Connection attempt %d/%d failed: %s",
                attempt, MAX_RETRIES, exc,
            )
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_DELAY_SECONDS)

    raise last_err  # type: ignore[misc]


def get_pool() -> SimpleConnectionPool:
    """Return the singleton pool, initialising it on first call."""
    return _init_pool()


# ---------------------------------------------------------------------------
# Context manager for cursor operations
# ---------------------------------------------------------------------------
class _CursorContext:
    """Context manager that yields a cursor with auto-commit / rollback.

    On success the transaction is committed; on any exception it is
    rolled back.  The connection is always returned to the pool.
    """

    def __init__(self):
        self._conn = None
        self._cur = None

    # -- enter --
    def __enter__(self):
        self._conn = get_pool().getconn()
        self._cur = self._conn.cursor()
        return self._cur

    # -- exit --
    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is not None:
            # An exception occurred – roll back
            try:
                self._conn.rollback()
            except Exception:  # noqa: BLE001
                logger.warning("Rollback failed", exc_info=True)
            logger.error("Transaction rolled back due to %s: %s", exc_type.__name__, exc_val)
        else:
            # Success – commit
            try:
                self._conn.commit()
            except Exception:  # noqa: BLE001
                logger.error("Commit failed", exc_info=True)

        # Clean up cursor and return connection to pool
        if self._cur is not None:
            self._cur.close()
        if self._conn is not None:
            get_pool().putconn(self._conn)

        # Do not suppress the exception
        return False


def get_cursor() -> _CursorContext:
    """Return a context manager that yields a psycopg2 cursor.

    Example::

        with get_cursor() as cur:
            cur.execute('SELECT * FROM student_profiles')
            results = cur.fetchall()
    """
    return _CursorContext()


# ---------------------------------------------------------------------------
# Connection test helper
# ---------------------------------------------------------------------------
def test_connection() -> bool:
    """Verify the database is reachable.

    Returns True on success, False on failure.
    """
    try:
        with get_cursor() as cur:
            cur.execute("SELECT 1")
            result = cur.fetchone()
            ok = result == (1,)
            if ok:
                logger.info("Database connection test passed.")
            else:
                logger.warning("Database connection test returned unexpected result: %s", result)
            return ok
    except OperationalError as exc:
        logger.error("Database connection test failed: %s", exc)
        return False
    except Exception as exc:  # noqa: BLE001
        logger.error("Unexpected error during connection test: %s", exc)
        return False
