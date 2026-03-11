from __future__ import annotations

from datetime import datetime, timezone


def as_utc_datetime(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None or value.utcoffset() is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def as_utc_isoformat(value: datetime | None) -> str | None:
    normalized = as_utc_datetime(value)
    return normalized.isoformat() if normalized else None
