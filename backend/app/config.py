from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any


def _as_bool(value: str | None, default: bool) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _parse_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def _default_database_url(base_dir: Path) -> str:
    configured = os.getenv("DATABASE_URL")
    if configured:
        return configured
    if os.getenv("VERCEL"):
        return "sqlite:////tmp/patient_risk.db"
    return f"sqlite:///{base_dir / 'patient_risk.db'}"


def _default_api_keys(app_env: str) -> dict[str, dict[str, str]]:
    if app_env == "production":
        return {}

    return {
        "demo-admin-key": {
            "actor_id": "admin-console",
            "name": "Demo Admin",
            "role": "admin",
        },
        "demo-clinician-key": {
            "actor_id": "clinician-console",
            "name": "Demo Clinician",
            "role": "clinician",
        },
        "demo-analyst-key": {
            "actor_id": "quality-analyst",
            "name": "Demo Analyst",
            "role": "analyst",
        },
        "demo-ingest-key": {
            "actor_id": "integration-gateway",
            "name": "Demo Integration",
            "role": "ingest",
        },
    }


def _load_api_keys(app_env: str) -> dict[str, Any]:
    raw_value = os.getenv("API_KEYS_JSON", "").strip()
    if not raw_value:
        return _default_api_keys(app_env)

    try:
        payload = json.loads(raw_value)
    except json.JSONDecodeError as exc:
        raise RuntimeError("API_KEYS_JSON must be valid JSON") from exc

    if not isinstance(payload, dict):
        raise RuntimeError("API_KEYS_JSON must be a JSON object keyed by API key")

    return payload


class Settings:
    @classmethod
    def as_dict(cls) -> dict[str, Any]:
        base_dir = Path(__file__).resolve().parents[1]
        app_env = os.getenv("APP_ENV", "development").strip().lower() or "development"
        allowed_origins = _parse_csv(
            os.getenv(
                "ALLOWED_ORIGINS",
                "http://localhost:5500,http://127.0.0.1:5500",
            )
        )

        return {
            "APP_ENV": app_env,
            "SECRET_KEY": os.getenv("SECRET_KEY", "local-dev-secret-key"),
            "SQLALCHEMY_DATABASE_URI": _default_database_url(base_dir),
            "SQLALCHEMY_TRACK_MODIFICATIONS": False,
            "MODEL_PATH": os.getenv(
                "MODEL_PATH", str(base_dir / "models" / "risk_model.joblib")
            ),
            "MODEL_RANDOM_STATE": int(os.getenv("MODEL_RANDOM_STATE", "42")),
            "SYNTHETIC_DATASET_SIZE": int(os.getenv("SYNTHETIC_DATASET_SIZE", "6000")),
            "BENCHMARK_PATH": os.getenv(
                "BENCHMARK_PATH", str(base_dir / "models" / "benchmark_metrics.json")
            ),
            "REAL_DATASET_EXPORT_PATH": os.getenv(
                "REAL_DATASET_EXPORT_PATH",
                str(base_dir / "data" / "breast_cancer_dataset.csv"),
            ),
            "RISK_LOW_THRESHOLD": float(os.getenv("RISK_LOW_THRESHOLD", "0.35")),
            "RISK_HIGH_THRESHOLD": float(os.getenv("RISK_HIGH_THRESHOLD", "0.70")),
            "ALERT_PROVIDER": os.getenv("ALERT_PROVIDER", "console"),
            "ALERT_TARGET": os.getenv("ALERT_TARGET", "oncall-doctor"),
            "TWILIO_ACCOUNT_SID": os.getenv("TWILIO_ACCOUNT_SID", ""),
            "TWILIO_AUTH_TOKEN": os.getenv("TWILIO_AUTH_TOKEN", ""),
            "TWILIO_WHATSAPP_FROM": os.getenv("TWILIO_WHATSAPP_FROM", ""),
            "TWILIO_WHATSAPP_TO": os.getenv("TWILIO_WHATSAPP_TO", ""),
            "AUTH_REQUIRED": _as_bool(os.getenv("AUTH_REQUIRED"), True),
            "API_KEYS": _load_api_keys(app_env),
            "ALLOWED_ORIGINS": allowed_origins or ["http://127.0.0.1:5500"],
            "MAX_PATIENT_LIST_LIMIT": int(os.getenv("MAX_PATIENT_LIST_LIMIT", "1000")),
            "MAX_AUDIT_LOG_LIMIT": int(os.getenv("MAX_AUDIT_LOG_LIMIT", "200")),
            "MAX_BATCH_ASSESSMENTS": int(os.getenv("MAX_BATCH_ASSESSMENTS", "25")),
            "MAX_SIMULATION_SCENARIOS": int(os.getenv("MAX_SIMULATION_SCENARIOS", "10")),
            "API_TITLE": "AI Patient Risk Stratification API",
            "API_VERSION": "2.2.0",
        }
