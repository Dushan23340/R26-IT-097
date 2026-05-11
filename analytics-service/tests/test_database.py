"""
Pytest suite for config/database.py.

Test cases:
  - Connection pool creation and singleton behavior
  - Cursor context manager yields a working cursor
  - Queries return expected data shape
  - Transaction rollback on error
  - test_connection helper

Run:
    cd analytics-service
    python -m pytest tests/test_database.py -v
"""

import sys
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

# Ensure analytics-service root is on sys.path
_sys_path = str(Path(__file__).resolve().parents[1])
if _sys_path not in sys.path:
    sys.path.insert(0, _sys_path)

import config.database as db_module
from config.database import (
    get_pool,
    get_cursor,
    test_connection as _db_test_connection,
    _init_pool,
    _CursorContext,
)


# ==================================================================
# Pool tests
# ==================================================================

class TestConnectionPool:
    """Test connection pool lifecycle."""

    def test_pool_singleton(self):
        """Multiple calls to get_pool return the same pool object."""
        # Reset module-level pool for this test
        with patch.object(db_module, "_pool", None):
            with patch("config.database.SimpleConnectionPool") as MockPool:
                mock_instance = MagicMock()
                MockPool.return_value = mock_instance

                pool1 = get_pool()
                pool2 = get_pool()

                assert pool1 is pool2
                MockPool.assert_called_once()

    def test_init_pool_retry_on_operational_error(self):
        """_init_pool retries on OperationalError before giving up."""
        with patch.object(db_module, "_pool", None):
            with patch("config.database.SimpleConnectionPool") as MockPool:
                from psycopg2 import OperationalError

                MockPool.side_effect = OperationalError("connection refused")

                with pytest.raises(OperationalError):
                    _init_pool()

                assert MockPool.call_count == db_module.MAX_RETRIES


# ==================================================================
# Cursor context manager tests
# ==================================================================

class TestCursorContext:
    """Test _CursorContext commit / rollback behaviour."""

    def test_successful_transaction_commits(self):
        """No exception => commit is called, rollback is not."""
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_pool = MagicMock()
        mock_pool.getconn.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cur

        with patch("config.database.get_pool", return_value=mock_pool):
            with get_cursor() as cur:
                cur.execute("SELECT 1")

        mock_pool.getconn.assert_called_once()
        mock_conn.commit.assert_called_once()
        mock_conn.rollback.assert_not_called()
        mock_cur.close.assert_called_once()
        mock_pool.putconn.assert_called_once_with(mock_conn)

    def test_failed_transaction_rolls_back(self):
        """Exception inside context => rollback is called, commit is not."""
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_pool = MagicMock()
        mock_pool.getconn.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cur

        with patch("config.database.get_pool", return_value=mock_pool):
            with pytest.raises(ValueError, match="boom"):
                with get_cursor() as cur:
                    cur.execute("SELECT 1")
                    raise ValueError("boom")

        mock_conn.rollback.assert_called_once()
        mock_conn.commit.assert_not_called()
        mock_cur.close.assert_called_once()
        mock_pool.putconn.assert_called_once_with(mock_conn)

    def test_cursor_yields_execute_fetchall(self):
        """Cursor can execute queries and fetch results."""
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_cur.fetchall.return_value = [(1,), (2,), (3,)]
        mock_pool = MagicMock()
        mock_pool.getconn.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cur

        with patch("config.database.get_pool", return_value=mock_pool):
            with get_cursor() as cur:
                cur.execute("SELECT id FROM test")
                rows = cur.fetchall()

        assert rows == [(1,), (2,), (3,)]


# ==================================================================
# Database query tests (requires real DB)
# ==================================================================

class TestRealDatabaseQueries:
    """Integration tests against the actual PostgreSQL database."""

    @pytest.mark.skipif(
        not _db_test_connection(),
        reason="PostgreSQL database not available",
    )
    def test_select_one(self):
        """Basic SELECT 1 works."""
        with get_cursor() as cur:
            cur.execute("SELECT 1")
            result = cur.fetchone()
        assert result == (1,)

    @pytest.mark.skipif(
        not _db_test_connection(),
        reason="PostgreSQL database not available",
    )
    def test_student_profiles_has_data(self):
        """student_profiles table contains rows."""
        with get_cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM student_profiles")
            count = cur.fetchone()[0]
        assert count > 0

    @pytest.mark.skipif(
        not _db_test_connection(),
        reason="PostgreSQL database not available",
    )
    def test_learning_sessions_has_data(self):
        """learning_sessions table contains rows."""
        with get_cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM learning_sessions")
            count = cur.fetchone()[0]
        assert count > 0

    @pytest.mark.skipif(
        not _db_test_connection(),
        reason="PostgreSQL database not available",
    )
    def test_lo_achievement_scores_has_data(self):
        """lo_achievement_scores table contains rows."""
        with get_cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM lo_achievement_scores")
            count = cur.fetchone()[0]
        assert count > 0

    @pytest.mark.skipif(
        not _db_test_connection(),
        reason="PostgreSQL database not available",
    )
    def test_student_profile_columns(self):
        """student_profiles has expected columns."""
        with get_cursor() as cur:
            cur.execute(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name = 'student_profiles' ORDER BY ordinal_position"
            )
            columns = [row[0] for row in cur.fetchall()]
        assert "student_id" in columns
        assert "full_name" in columns
        assert "email" in columns

    @pytest.mark.skipif(
        not _db_test_connection(),
        reason="PostgreSQL database not available",
    )
    def test_transaction_isolation_rollback(self):
        """A failed transaction does not persist side effects."""
        with get_cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM student_profiles")
            before = cur.fetchone()[0]

        # Attempt an invalid operation inside a transaction that will roll back
        with pytest.raises(Exception):
            with get_cursor() as cur:
                cur.execute("SELECT 1")
                raise RuntimeError("force rollback")

        with get_cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM student_profiles")
            after = cur.fetchone()[0]

        assert before == after


# ==================================================================
# test_connection helper
# ==================================================================

class TestTestConnection:
    """Test the _db_test_connection() utility."""

    def test_test_connection_mock_success(self):
        """test_connection returns True when SELECT 1 succeeds."""
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_cur.fetchone.return_value = (1,)
        mock_conn.cursor.return_value = mock_cur
        mock_pool = MagicMock()
        mock_pool.getconn.return_value = mock_conn

        with patch("config.database.get_pool", return_value=mock_pool):
            assert _db_test_connection() is True

    def test_test_connection_mock_wrong_result(self):
        """test_connection returns False when SELECT 1 returns unexpected result."""
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_cur.fetchone.return_value = (42,)
        mock_conn.cursor.return_value = mock_cur
        mock_pool = MagicMock()
        mock_pool.getconn.return_value = mock_conn

        with patch("config.database.get_pool", return_value=mock_pool):
            assert _db_test_connection() is False

    def test_test_connection_mock_failure(self):
        """test_connection returns False when database raises OperationalError."""
        from psycopg2 import OperationalError

        mock_pool = MagicMock()
        mock_pool.getconn.side_effect = OperationalError("refused")

        with patch("config.database.get_pool", return_value=mock_pool):
            assert _db_test_connection() is False

    @pytest.mark.skipif(
        not _db_test_connection(),
        reason="PostgreSQL database not available",
    )
    def test_test_connection_real(self):
        """test_connection returns True against the real database."""
        assert _db_test_connection() is True
