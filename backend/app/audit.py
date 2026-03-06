from __future__ import annotations

from typing import Any

from flask import g, request

from .extensions import db
from .models import AuditEvent
from .security import get_request_actor


def _client_ip() -> str:
    forwarded_for = request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
    return forwarded_for or (request.remote_addr or "unknown")


def add_audit_event(
    action: str,
    resource_type: str,
    *,
    resource_id: str | int | None = None,
    details: dict[str, Any] | None = None,
    status_code: int = 200,
) -> AuditEvent:
    actor = get_request_actor(allow_anonymous=True)
    event = AuditEvent(
        request_id=str(getattr(g, "request_id", "unknown")),
        actor_id=actor["actor_id"],
        actor_role=actor["role"],
        action=action,
        resource_type=resource_type,
        resource_id=str(resource_id) if resource_id is not None else None,
        status_code=int(status_code),
        ip_address=_client_ip(),
        details=details or {},
    )
    db.session.add(event)
    return event
