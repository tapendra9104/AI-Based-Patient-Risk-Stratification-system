from __future__ import annotations

import csv
from datetime import datetime, timezone
from io import StringIO
from typing import Any

from flask import Blueprint, current_app, jsonify, make_response, request
from sqlalchemy import text

from .audit import add_audit_event
from .extensions import db
from .http_utils import ApiError
from .models import AuditEvent, PatientAssessment
from .risk import assess_patient, simulate_patient_scenarios
from .security import require_roles
from .services.analytics import build_operational_summary, build_patient_timeline
from .services.alerts import send_high_risk_alert
from .services.benchmark import load_or_run_benchmark
from .services.explainability import summarize_feature_importances
from .services.inference import load_artifact
from .services.preprocessing import PATIENT_ID_PATTERN
from .time_utils import as_utc_isoformat

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


def _parse_limit_arg(
    query_name: str,
    *,
    default: int,
    max_limit: int,
) -> int:
    requested_limit = request.args.get(query_name, default=str(default))
    try:
        return max(1, min(max_limit, int(str(requested_limit))))
    except ValueError as exc:
        raise ApiError(
            f"Query param '{query_name}' must be an integer",
            status_code=400,
            error_code="validation_error",
        ) from exc


def _parse_offset_arg(query_name: str = "offset") -> int:
    requested_offset = request.args.get(query_name, default="0")
    try:
        return max(0, int(str(requested_offset)))
    except ValueError as exc:
        raise ApiError(
            f"Query param '{query_name}' must be an integer",
            status_code=400,
            error_code="validation_error",
        ) from exc


def _parse_float_arg(query_name: str) -> float | None:
    raw_value = request.args.get(query_name)
    if raw_value is None or not str(raw_value).strip():
        return None
    try:
        return float(str(raw_value).strip())
    except ValueError as exc:
        raise ApiError(
            f"Query param '{query_name}' must be numeric",
            status_code=400,
            error_code="validation_error",
        ) from exc


def _parse_bool_arg(query_name: str, default: bool | None = None) -> bool | None:
    raw_value = request.args.get(query_name)
    if raw_value is None:
        return default

    normalized = str(raw_value).strip().lower()
    if not normalized:
        return default
    if normalized in {"1", "true", "yes", "y"}:
        return True
    if normalized in {"0", "false", "no", "n"}:
        return False
    raise ApiError(
        f"Query param '{query_name}' must be a boolean",
        status_code=400,
        error_code="validation_error",
    )


def _coerce_body_bool(value: Any, field_name: str, default: bool = False) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"1", "true", "yes", "y"}:
            return True
        if normalized in {"0", "false", "no", "n"}:
            return False
    raise ApiError(
        f"Field '{field_name}' must be a boolean",
        status_code=400,
        error_code="validation_error",
    )


def _resolve_assessment_filters() -> dict[str, Any]:
    patient_id_filter = str(request.args.get("patient_id", "")).strip()
    if patient_id_filter and not PATIENT_ID_PATTERN.fullmatch(patient_id_filter):
        raise ApiError(
            "Query param 'patient_id' is invalid",
            status_code=400,
            error_code="validation_error",
        )

    risk_level_filter = str(request.args.get("risk_level", "")).strip().upper()
    if risk_level_filter and risk_level_filter not in {"LOW", "MEDIUM", "HIGH"}:
        raise ApiError(
            "Query param 'risk_level' must be LOW, MEDIUM, or HIGH",
            status_code=400,
            error_code="validation_error",
        )

    min_risk_score = _parse_float_arg("min_risk_score")
    max_risk_score = _parse_float_arg("max_risk_score")
    if (
        min_risk_score is not None
        and max_risk_score is not None
        and min_risk_score > max_risk_score
    ):
        raise ApiError(
            "Query params 'min_risk_score' cannot be greater than 'max_risk_score'",
            status_code=400,
            error_code="validation_error",
        )

    return {
        "patient_id": patient_id_filter or None,
        "risk_level": risk_level_filter or None,
        "alert_sent": _parse_bool_arg("alert_sent"),
        "icu_within_24h": _parse_bool_arg("icu_within_24h"),
        "min_risk_score": min_risk_score,
        "max_risk_score": max_risk_score,
    }


def _build_assessment_query(filters: dict[str, Any]):
    query = PatientAssessment.query
    if filters["patient_id"]:
        query = query.filter(PatientAssessment.patient_id == filters["patient_id"])
    if filters["risk_level"]:
        query = query.filter(PatientAssessment.risk_level == filters["risk_level"])
    if filters["alert_sent"] is not None:
        query = query.filter(PatientAssessment.alert_sent.is_(filters["alert_sent"]))
    if filters["icu_within_24h"] is not None:
        query = query.filter(
            PatientAssessment.icu_within_24h.is_(filters["icu_within_24h"])
        )
    if filters["min_risk_score"] is not None:
        query = query.filter(PatientAssessment.risk_score >= filters["min_risk_score"])
    if filters["max_risk_score"] is not None:
        query = query.filter(PatientAssessment.risk_score <= filters["max_risk_score"])
    return query


def _perform_assessment(payload: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any], bool]:
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
    return result, normalized, alert_sent


def _store_assessment(
    result: dict[str, Any],
    normalized: dict[str, Any],
    *,
    alert_sent: bool,
    audit_action: str,
) -> PatientAssessment:
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
        audit_action,
        "patient_assessment",
        resource_id=result["patient_id"],
        details={
            "risk_level": result["risk_level"],
            "risk_score": result["risk_score"],
            "alert_sent": alert_sent,
        },
        status_code=201,
    )
    return record


def _best_condition(predicted_conditions: dict[str, Any]) -> tuple[str, float]:
    if not predicted_conditions:
        return ("", 0.0)
    name, score = max(
        predicted_conditions.items(),
        key=lambda item: float(item[1]),
    )
    return str(name), round(float(score), 4)


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
    max_features = max(1, len(artifact.get("feature_order", [])))
    top_n = _parse_limit_arg("top_n", default=max_features, max_limit=max_features)
    response = {
        "metrics": artifact.get("metrics", {}),
        "trained_at": artifact.get("trained_at"),
        "dataset_size": artifact.get("dataset_size"),
        "thresholds": artifact.get("thresholds", {}),
        "feature_count": len(artifact.get("feature_order", [])),
        "classifier": artifact["model"].named_steps["classifier"].__class__.__name__,
        "feature_importances": summarize_feature_importances(artifact, top_n=top_n),
    }
    add_audit_event(
        "VIEW_MODEL_METRICS",
        "model_metrics",
        details={"dataset_size": artifact.get("dataset_size"), "top_n": top_n},
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
    result, normalized, alert_sent = _perform_assessment(payload)
    record = _store_assessment(
        result,
        normalized,
        alert_sent=alert_sent,
        audit_action="CREATE_ASSESSMENT",
    )
    db.session.commit()
    result["assessment_id"] = record.id
    result["created_at"] = as_utc_isoformat(record.created_at)
    return jsonify(result), 201


@api_bp.post("/patients/assess/batch")
@require_roles("admin", "clinician", "ingest")
def create_batch_assessments() -> tuple:
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        raise ApiError(
            "Request payload must be a JSON object",
            status_code=400,
            error_code="validation_error",
        )

    items = payload.get("items", [])
    if not isinstance(items, list) or not items:
        raise ApiError(
            "Field 'items' must be a non-empty array",
            status_code=400,
            error_code="validation_error",
        )

    max_batch_size = int(current_app.config.get("MAX_BATCH_ASSESSMENTS", 25))
    if len(items) > max_batch_size:
        raise ApiError(
            f"Batch size cannot exceed {max_batch_size}",
            status_code=400,
            error_code="validation_error",
        )

    stop_on_error = _coerce_body_bool(payload.get("stop_on_error"), "stop_on_error")
    created_items: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []

    for index, item in enumerate(items):
        try:
            if not isinstance(item, dict):
                raise ApiError(
                    "Each batch item must be an object",
                    status_code=400,
                    error_code="validation_error",
                )

            result, normalized, alert_sent = _perform_assessment(item)
            record = _store_assessment(
                result,
                normalized,
                alert_sent=alert_sent,
                audit_action="CREATE_ASSESSMENT",
            )
            db.session.flush()
            created_items.append(
                {
                    "index": index,
                    "assessment_id": record.id,
                    "patient_id": result["patient_id"],
                    "risk_score": result["risk_score"],
                    "risk_level": result["risk_level"],
                    "alert_sent": alert_sent,
                }
            )
        except ApiError as exc:
            errors.append(
                {
                    "index": index,
                    "patient_id": (
                        str(item.get("patient_id", "")).strip() if isinstance(item, dict) else None
                    ),
                    "error": exc.message,
                    "code": exc.error_code,
                }
            )
            if stop_on_error:
                break

    status_code = 201 if created_items and not errors else (207 if created_items else 400)
    add_audit_event(
        "CREATE_BATCH_ASSESSMENTS",
        "patient_assessment",
        details={
            "requested_count": len(items),
            "created_count": len(created_items),
            "error_count": len(errors),
            "stop_on_error": stop_on_error,
        },
        status_code=status_code,
    )
    db.session.commit()
    return (
        jsonify(
            {
                "requested_count": len(items),
                "created_count": len(created_items),
                "error_count": len(errors),
                "stop_on_error": stop_on_error,
                "items": created_items,
                "errors": errors,
            }
        ),
        status_code,
    )


@api_bp.post("/patients/assess/simulate")
@require_roles("admin", "analyst", "clinician", "ingest")
def simulate_assessment() -> tuple:
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        raise ApiError(
            "Request payload must be a JSON object",
            status_code=400,
            error_code="validation_error",
        )

    baseline = payload.get("baseline")
    scenarios = payload.get("scenarios", [])
    if not isinstance(baseline, dict):
        raise ApiError(
            "Field 'baseline' must be an object",
            status_code=400,
            error_code="validation_error",
        )
    if not isinstance(scenarios, list) or not scenarios:
        raise ApiError(
            "Field 'scenarios' must be a non-empty array",
            status_code=400,
            error_code="validation_error",
        )

    max_scenarios = int(current_app.config.get("MAX_SIMULATION_SCENARIOS", 10))
    if len(scenarios) > max_scenarios:
        raise ApiError(
            f"Scenario count cannot exceed {max_scenarios}",
            status_code=400,
            error_code="validation_error",
        )

    try:
        response = simulate_patient_scenarios(baseline, scenarios, current_app.config)
    except ValueError as exc:
        raise ApiError(
            str(exc),
            status_code=400,
            error_code="validation_error",
        ) from exc

    add_audit_event(
        "SIMULATE_ASSESSMENT",
        "patient_assessment",
        resource_id=response["patient_id"],
        details={
            "scenario_count": len(response["scenarios"]),
            "best_risk_score": response["scenarios"][0]["risk_score"],
        },
        status_code=200,
    )
    db.session.commit()
    return jsonify(response), 200


@api_bp.get("/patients/summary")
@require_roles("admin", "analyst", "clinician")
def patient_summary() -> tuple:
    max_limit = int(current_app.config.get("MAX_PATIENT_LIST_LIMIT", 200))
    limit = _parse_limit_arg("limit", default=100, max_limit=max_limit)
    filters = _resolve_assessment_filters()
    records = _build_assessment_query(filters).order_by(PatientAssessment.created_at.desc()).limit(limit).all()
    payload = build_operational_summary(records)
    payload["window"] = {"assessment_limit": limit}
    payload["applied_filters"] = filters
    add_audit_event(
        "VIEW_PATIENT_SUMMARY",
        "patient_assessment",
        details={"limit": limit, "result_count": len(records), **filters},
        status_code=200,
    )
    db.session.commit()
    return jsonify(payload), 200


@api_bp.get("/patients/<patient_id>/timeline")
@require_roles("admin", "analyst", "clinician")
def patient_timeline(patient_id: str) -> tuple:
    normalized_patient_id = patient_id.strip()
    if not PATIENT_ID_PATTERN.fullmatch(normalized_patient_id):
        raise ApiError(
            "Path param 'patient_id' is invalid",
            status_code=400,
            error_code="validation_error",
        )

    max_limit = int(current_app.config.get("MAX_PATIENT_LIST_LIMIT", 200))
    limit = _parse_limit_arg("limit", default=20, max_limit=max_limit)
    records = (
        PatientAssessment.query.filter(PatientAssessment.patient_id == normalized_patient_id)
        .order_by(PatientAssessment.created_at.desc())
        .limit(limit)
        .all()
    )
    if not records:
        raise ApiError(
            f"No assessments found for patient '{normalized_patient_id}'",
            status_code=404,
            error_code="not_found",
        )

    payload = build_patient_timeline(normalized_patient_id, records)
    payload["window"] = {"assessment_limit": limit}
    add_audit_event(
        "VIEW_PATIENT_TIMELINE",
        "patient_assessment",
        resource_id=normalized_patient_id,
        details={"limit": limit, "result_count": len(records)},
        status_code=200,
    )
    db.session.commit()
    return jsonify(payload), 200


@api_bp.get("/patients")
@require_roles("admin", "analyst", "clinician")
def list_assessments() -> tuple:
    max_limit = int(current_app.config.get("MAX_PATIENT_LIST_LIMIT", 200))
    limit = _parse_limit_arg("limit", default=50, max_limit=max_limit)
    offset = _parse_offset_arg()
    filters = _resolve_assessment_filters()
    query = _build_assessment_query(filters)
    total_count = query.count()
    records = (
        query.order_by(PatientAssessment.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    add_audit_event(
        "LIST_ASSESSMENTS",
        "patient_assessment",
        details={
            "limit": limit,
            "offset": offset,
            **filters,
            "result_count": len(records),
            "total_count": total_count,
        },
        status_code=200,
    )
    db.session.commit()
    return (
        jsonify(
            {
                "count": len(records),
                "total_count": total_count,
                "items": [record.to_dict() for record in records],
                "applied_filters": filters,
                "pagination": {
                    "limit": limit,
                    "offset": offset,
                    "returned": len(records),
                },
            }
        ),
        200,
    )


@api_bp.get("/patients/export.csv")
@require_roles("admin", "analyst", "clinician")
def export_assessments_csv() -> tuple:
    max_limit = int(current_app.config.get("MAX_PATIENT_LIST_LIMIT", 200))
    limit = _parse_limit_arg("limit", default=max_limit, max_limit=max_limit)
    filters = _resolve_assessment_filters()
    records = _build_assessment_query(filters).order_by(PatientAssessment.created_at.desc()).limit(limit).all()

    output = StringIO()
    fieldnames = [
        "assessment_id",
        "created_at",
        "patient_id",
        "risk_score",
        "risk_level",
        "icu_within_24h",
        "alert_sent",
        "top_condition",
        "top_condition_score",
    ]
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    for record in records:
        top_condition, top_condition_score = _best_condition(record.predicted_conditions or {})
        writer.writerow(
            {
                "assessment_id": record.id,
                "created_at": as_utc_isoformat(record.created_at),
                "patient_id": record.patient_id,
                "risk_score": round(float(record.risk_score), 4),
                "risk_level": record.risk_level,
                "icu_within_24h": record.icu_within_24h,
                "alert_sent": record.alert_sent,
                "top_condition": top_condition,
                "top_condition_score": top_condition_score,
            }
        )

    add_audit_event(
        "EXPORT_ASSESSMENTS_CSV",
        "patient_assessment",
        details={"limit": limit, "result_count": len(records), **filters},
        status_code=200,
    )
    db.session.commit()

    response = make_response(output.getvalue())
    response.headers["Content-Type"] = "text/csv; charset=utf-8"
    response.headers["Content-Disposition"] = "attachment; filename=patient_assessments.csv"
    return response, 200


@api_bp.get("/audit/logs")
@require_roles("admin")
def list_audit_logs() -> tuple:
    max_limit = int(current_app.config.get("MAX_AUDIT_LOG_LIMIT", 200))
    limit = _parse_limit_arg("limit", default=50, max_limit=max_limit)

    action_filter = str(request.args.get("action", "")).strip().upper()
    actor_role_filter = str(request.args.get("actor_role", "")).strip().lower()
    resource_type_filter = str(request.args.get("resource_type", "")).strip()
    resource_id_filter = str(request.args.get("resource_id", "")).strip()
    status_code_filter = request.args.get("status_code")

    query = AuditEvent.query
    if action_filter:
        query = query.filter(AuditEvent.action == action_filter)
    if actor_role_filter:
        query = query.filter(AuditEvent.actor_role == actor_role_filter)
    if resource_type_filter:
        query = query.filter(AuditEvent.resource_type == resource_type_filter)
    if resource_id_filter:
        query = query.filter(AuditEvent.resource_id == resource_id_filter)
    if status_code_filter not in (None, ""):
        try:
            query = query.filter(AuditEvent.status_code == int(status_code_filter))
        except ValueError as exc:
            raise ApiError(
                "Query param 'status_code' must be an integer",
                status_code=400,
                error_code="validation_error",
            ) from exc

    events = query.order_by(AuditEvent.created_at.desc()).limit(limit).all()
    add_audit_event(
        "LIST_AUDIT_EVENTS",
        "audit_event",
        details={
            "limit": limit,
            "action": action_filter or None,
            "actor_role": actor_role_filter or None,
            "resource_type": resource_type_filter or None,
            "resource_id": resource_id_filter or None,
            "status_code": int(status_code_filter) if status_code_filter not in (None, "") else None,
            "result_count": len(events),
        },
        status_code=200,
    )
    db.session.commit()
    return jsonify({"count": len(events), "items": [event.to_dict() for event in events]}), 200
