from __future__ import annotations

from datetime import datetime, timezone

from flask import Blueprint, current_app, jsonify, request
from sqlalchemy import text

from .audit import add_audit_event
from .extensions import db
from .http_utils import ApiError
from .models import AuditEvent, PatientAssessment
from .risk import assess_patient
from .security import require_roles
from .services.alerts import send_high_risk_alert
from .services.benchmark import load_or_run_benchmark
from .services.inference import load_artifact

api_bp = Blueprint("api", __name__, url_prefix="/api")


def _health_payload() -> dict:
    artifact = load_artifact(current_app.config)
    return {
        "status": "ok",
        "service": current_app.config["API_TITLE"],
        "version": current_app.config["API_VERSION"],
        "model_trained_at": artifact.get("trained_at"),
        "feature_count": len(artifact.get("feature_order", [])),
    }


@api_bp.get("/health")
def health() -> tuple:
    return jsonify(_health_payload()), 200


@api_bp.get("/health/live")
def live_health() -> tuple:
    return (
        jsonify(
            {
                "status": "ok",
                "service": current_app.config["API_TITLE"],
                "version": current_app.config["API_VERSION"],
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        ),
        200,
    )


@api_bp.get("/health/ready")
def ready_health() -> tuple:
    components = {"database": "ok", "model": "ok"}
    errors: list[str] = []

    try:
        db.session.execute(text("SELECT 1"))
    except Exception as exc:
        components["database"] = "error"
        errors.append(str(exc))

    try:
        payload = _health_payload()
    except Exception as exc:
        components["model"] = "error"
        errors.append(str(exc))
        payload = {
            "status": "degraded",
            "service": current_app.config["API_TITLE"],
            "version": current_app.config["API_VERSION"],
            "model_trained_at": None,
            "feature_count": 0,
        }

    payload["status"] = "ok" if not errors else "degraded"
    payload["components"] = components
    if errors:
        payload["errors"] = errors
    return jsonify(payload), (200 if not errors else 503)


@api_bp.get("/metrics/model")
@require_roles("admin", "analyst", "clinician")
def model_metrics() -> tuple:
    artifact = load_artifact(current_app.config)
    response = {
        "metrics": artifact.get("metrics", {}),
        "trained_at": artifact.get("trained_at"),
        "dataset_size": artifact.get("dataset_size"),
    }
    add_audit_event(
        "VIEW_MODEL_METRICS",
        "model_metrics",
        details={"dataset_size": artifact.get("dataset_size")},
        status_code=200,
    )
    db.session.commit()
    return jsonify(response), 200


@api_bp.get("/metrics/benchmark")
@require_roles("admin", "analyst", "clinician")
def benchmark_metrics() -> tuple:
    refresh_value = str(request.args.get("refresh", "false")).strip().lower()
    force_refresh = refresh_value in {"1", "true", "yes"}
    payload = load_or_run_benchmark(current_app.config, force_refresh=force_refresh)
    add_audit_event(
        "VIEW_BENCHMARK_METRICS",
        "benchmark_metrics",
        details={"force_refresh": force_refresh},
        status_code=200,
    )
    db.session.commit()
    return jsonify(payload), 200


@api_bp.post("/patients/assess")
@require_roles("admin", "clinician", "ingest")
def create_assessment() -> tuple:
    payload = request.get_json(silent=True) or {}
    try:
        result, normalized = assess_patient(payload, current_app.config)
    except ValueError as exc:
        raise ApiError(
            str(exc),
            status_code=400,
            error_code="validation_error",
        ) from exc

    alert_sent = send_high_risk_alert(result, current_app.config)
    result["alert_sent"] = alert_sent

    record = PatientAssessment(
        patient_id=result["patient_id"],
        input_data=normalized["features"],
        risk_score=result["risk_score"],
        risk_level=result["risk_level"],
        predicted_conditions=result["predicted_conditions"],
        icu_within_24h=result["icu_within_24h"],
        explanation=result["explanation"],
        alert_sent=alert_sent,
    )
    db.session.add(record)
    add_audit_event(
        "CREATE_ASSESSMENT",
        "patient_assessment",
        resource_id=result["patient_id"],
        details={
            "risk_level": result["risk_level"],
            "risk_score": result["risk_score"],
            "alert_sent": alert_sent,
        },
        status_code=201,
    )
    db.session.commit()
    result["assessment_id"] = record.id
    result["created_at"] = record.created_at.isoformat()
    return jsonify(result), 201


@api_bp.get("/patients")
@require_roles("admin", "clinician")
def list_assessments() -> tuple:
    requested_limit = request.args.get("limit", default="50")
    max_limit = int(current_app.config.get("MAX_PATIENT_LIST_LIMIT", 200))
    try:
        limit = max(1, min(max_limit, int(requested_limit)))
    except ValueError as exc:
        raise ApiError(
            "Query param 'limit' must be an integer",
            status_code=400,
            error_code="validation_error",
        ) from exc

    patient_id_filter = str(request.args.get("patient_id", "")).strip()
    risk_level_filter = str(request.args.get("risk_level", "")).strip().upper()

    query = PatientAssessment.query
    if patient_id_filter:
        query = query.filter(PatientAssessment.patient_id == patient_id_filter)

    if risk_level_filter:
        if risk_level_filter not in {"LOW", "MEDIUM", "HIGH"}:
            raise ApiError(
                "Query param 'risk_level' must be LOW, MEDIUM, or HIGH",
                status_code=400,
                error_code="validation_error",
            )
        query = query.filter(PatientAssessment.risk_level == risk_level_filter)

    records = query.order_by(PatientAssessment.created_at.desc()).limit(limit).all()
    add_audit_event(
        "LIST_ASSESSMENTS",
        "patient_assessment",
        details={
            "limit": limit,
            "patient_id": patient_id_filter or None,
            "risk_level": risk_level_filter or None,
            "result_count": len(records),
        },
        status_code=200,
    )
    db.session.commit()
    return jsonify({"count": len(records), "items": [record.to_dict() for record in records]}), 200


@api_bp.get("/audit/logs")
@require_roles("admin")
def list_audit_logs() -> tuple:
    requested_limit = request.args.get("limit", default="50")
    max_limit = int(current_app.config.get("MAX_AUDIT_LOG_LIMIT", 200))
    try:
        limit = max(1, min(max_limit, int(requested_limit)))
    except ValueError as exc:
        raise ApiError(
            "Query param 'limit' must be an integer",
            status_code=400,
            error_code="validation_error",
        ) from exc

    events = AuditEvent.query.order_by(AuditEvent.created_at.desc()).limit(limit).all()
    add_audit_event(
        "LIST_AUDIT_EVENTS",
        "audit_event",
        details={"limit": limit, "result_count": len(events)},
        status_code=200,
    )
    db.session.commit()
    return jsonify({"count": len(events), "items": [event.to_dict() for event in events]}), 200
