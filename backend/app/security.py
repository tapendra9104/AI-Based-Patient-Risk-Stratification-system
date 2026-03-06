from __future__ import annotations

from functools import wraps
from typing import Any, Callable, Mapping

from flask import current_app, g, request

from .http_utils import AuthError

DEMO_API_KEYS = {
    "demo-admin-key",
    "demo-clinician-key",
    "demo-analyst-key",
    "demo-ingest-key",
}


def _auth_enabled(config: Mapping[str, Any]) -> bool:
    return bool(config.get("AUTH_REQUIRED", True))


def _normalize_api_keys(config: Mapping[str, Any]) -> dict[str, dict[str, str]]:
    raw_api_keys = config.get("API_KEYS", {}) or {}
    if not isinstance(raw_api_keys, dict):
        return {}

    normalized: dict[str, dict[str, str]] = {}
    for api_key, payload in raw_api_keys.items():
        if not api_key or not isinstance(payload, dict):
            continue

        key = str(api_key).strip()
        if not key:
            continue

        role = str(payload.get("role", "clinician")).strip().lower() or "clinician"
        actor_id = str(payload.get("actor_id", f"{role}-user")).strip() or f"{role}-user"
        name = str(payload.get("name", actor_id)).strip() or actor_id

        normalized[key] = {
            "actor_id": actor_id,
            "name": name,
            "role": role,
        }

    return normalized


def validate_security_config(config: dict[str, Any]) -> None:
    normalized_api_keys = _normalize_api_keys(config)
    config["API_KEYS"] = normalized_api_keys

    app_env = str(config.get("APP_ENV", "development")).strip().lower()
    if app_env != "production":
        return

    if not _auth_enabled(config):
        raise RuntimeError("AUTH_REQUIRED must remain enabled in production")
    if not normalized_api_keys:
        raise RuntimeError("Production deployments must provide API_KEYS_JSON")

    demo_keys = DEMO_API_KEYS.intersection(normalized_api_keys)
    if demo_keys:
        raise RuntimeError("Production deployments cannot use demo API keys")


def _extract_api_key() -> str:
    header_key = request.headers.get("X-API-Key", "").strip()
    if header_key:
        return header_key

    auth_header = request.headers.get("Authorization", "").strip()
    if auth_header.lower().startswith("bearer "):
        return auth_header.split(None, 1)[1].strip()

    return ""


def get_request_actor(
    config: Mapping[str, Any] | None = None,
    *,
    allow_anonymous: bool = False,
) -> dict[str, str]:
    if hasattr(g, "current_actor"):
        return g.current_actor  # type: ignore[return-value]

    resolved_config = config or current_app.config
    if not _auth_enabled(resolved_config):
        actor = {"actor_id": "open-access", "name": "Open Access", "role": "system"}
        g.current_actor = actor
        return actor

    api_key = _extract_api_key()
    if not api_key:
        if allow_anonymous:
            actor = {"actor_id": "anonymous", "name": "Anonymous", "role": "anonymous"}
            g.current_actor = actor
            return actor
        raise AuthError("Missing API key")

    configured_keys = resolved_config.get("API_KEYS", {}) or {}
    actor = configured_keys.get(api_key)
    if not actor:
        raise AuthError("Invalid API key")

    g.current_actor = actor
    return actor


def require_roles(*allowed_roles: str) -> Callable:
    normalized_roles = {role.strip().lower() for role in allowed_roles if role.strip()}

    def decorator(view_func: Callable) -> Callable:
        @wraps(view_func)
        def wrapped(*args, **kwargs):  # type: ignore[no-untyped-def]
            if not _auth_enabled(current_app.config):
                return view_func(*args, **kwargs)

            actor = get_request_actor()
            if normalized_roles and actor["role"] not in normalized_roles:
                raise AuthError(
                    "Insufficient permissions for this action",
                    status_code=403,
                )
            return view_func(*args, **kwargs)

        return wrapped

    return decorator
