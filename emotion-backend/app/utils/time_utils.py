from datetime import datetime, timezone


def utc_now() -> datetime:
    """Return current UTC datetime."""
    return datetime.now(timezone.utc)


def format_iso(dt: datetime) -> str:
    """Format datetime to ISO 8601 string."""
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
