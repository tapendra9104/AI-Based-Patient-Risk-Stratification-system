from __future__ import annotations

from uuid import uuid4

from flask import Flask, g, jsonify, request


class ApiError(Exception):
    def __init__(
        self,
        message: str,
        *,
        status_code: int = 400,
        error_code: str = "bad_request",
        details: dict | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.error_code = error_code
        self.details = details or {}


class AuthError(ApiError):
    def __init__(
        self,
        message: str,
        *,
        status_code: int = 401,
        error_code: str | None = None,
        details: dict | None = None,
    ) -> None:
        resolved_code = error_code or ("forbidden" if status_code == 403 else "unauthorized")
        super().__init__(
            message,
            status_code=status_code,
            error_code=resolved_code,
            details=details,
        )


def register_http_handlers(app: Flask) -> None:
    @app.before_request
    def attach_request_context() -> None:
        incoming_request_id = request.headers.get("X-Request-ID", "").strip()
        g.request_id = incoming_request_id or str(uuid4())

    @app.after_request
    def enrich_response(response):  # type: ignore[no-untyped-def]
        request_id = getattr(g, "request_id", "")
        if request_id:
            response.headers["X-Request-ID"] = request_id
        if request.path.startswith("/api/"):
            response.headers.setdefault("Cache-Control", "no-store")
        return response

    @app.errorhandler(ApiError)
    def handle_api_error(exc: ApiError):  # type: ignore[no-untyped-def]
        payload = {
            "error": exc.message,
            "code": exc.error_code,
            "request_id": getattr(g, "request_id", ""),
        }
        if exc.details:
            payload["details"] = exc.details
        return jsonify(payload), exc.status_code

    @app.errorhandler(404)
    def handle_not_found(_exc):  # type: ignore[no-untyped-def]
        return (
            jsonify(
                {
                    "error": "Route not found",
                    "code": "not_found",
                    "request_id": getattr(g, "request_id", ""),
                }
            ),
            404,
        )

    @app.errorhandler(405)
    def handle_method_not_allowed(_exc):  # type: ignore[no-untyped-def]
        return (
            jsonify(
                {
                    "error": "Method not allowed",
                    "code": "method_not_allowed",
                    "request_id": getattr(g, "request_id", ""),
                }
            ),
            405,
        )

    @app.errorhandler(Exception)
    def handle_unexpected_error(exc: Exception):  # type: ignore[no-untyped-def]
        app.logger.exception(
            "Unhandled API error request_id=%s",
            getattr(g, "request_id", "-"),
            exc_info=exc,
        )
        return (
            jsonify(
                {
                    "error": "Internal server error",
                    "code": "internal_error",
                    "request_id": getattr(g, "request_id", ""),
                }
            ),
            500,
        )
