from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

TEST_API_KEYS = {
    "test-admin-key": {
        "actor_id": "admin-user",
        "name": "Admin User",
        "role": "admin",
    },
    "test-clinician-key": {
        "actor_id": "doctor-user",
        "name": "Doctor User",
        "role": "clinician",
    },
    "test-analyst-key": {
        "actor_id": "analyst-user",
        "name": "Analyst User",
        "role": "analyst",
    },
    "test-ingest-key": {
        "actor_id": "integration-user",
        "name": "Integration User",
        "role": "ingest",
    },
}


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("APP_ENV", "testing")
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'test.db'}")
    monkeypatch.setenv("MODEL_PATH", str(tmp_path / "risk_model.joblib"))
    monkeypatch.setenv("SYNTHETIC_DATASET_SIZE", "1200")
    monkeypatch.setenv("BENCHMARK_PATH", str(tmp_path / "benchmark_metrics.json"))
    monkeypatch.setenv(
        "REAL_DATASET_EXPORT_PATH", str(tmp_path / "breast_cancer_dataset.csv")
    )
    monkeypatch.setenv("AUTH_REQUIRED", "true")
    monkeypatch.setenv("API_KEYS_JSON", json.dumps(TEST_API_KEYS))

    from app import create_app

    app = create_app()
    app.config.update(TESTING=True)
    with app.test_client() as flask_client:
        yield flask_client


@pytest.fixture()
def auth_headers():
    def _build(role: str) -> dict[str, str]:
        key_by_role = {
            "admin": "test-admin-key",
            "clinician": "test-clinician-key",
            "analyst": "test-analyst-key",
            "ingest": "test-ingest-key",
        }
        return {"X-API-Key": key_by_role[role]}

    return _build


def test_health_endpoint(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["status"] == "ok"
    assert payload["feature_count"] >= 10


def test_ready_health_endpoint(client):
    response = client.get("/api/health/ready")
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["status"] == "ok"
    assert payload["components"]["database"] == "ok"
    assert payload["components"]["model"] == "ok"


def test_assessment_requires_api_key(client):
    response = client.post("/api/patients/assess", json={"patient_id": "P-1001"})
    assert response.status_code == 401


def test_assessment_endpoint(client, auth_headers):
    payload = {
        "patient_id": "P-1001",
        "age": 64,
        "systolic_bp": 158,
        "diastolic_bp": 96,
        "heart_rate": 110,
        "oxygen_level": 90,
        "cholesterol": 238,
        "respiratory_rate": 23,
        "temperature": 38.1,
        "lactate": 2.7,
        "sepsis_indicator": 0.65,
        "diabetes": True,
        "prior_heart_disease": True,
        "chronic_kidney_disease": False,
        "smoker": True,
    }
    response = client.post(
        "/api/patients/assess",
        json=payload,
        headers=auth_headers("clinician"),
    )
    assert response.status_code == 201

    body = response.get_json()
    assert "risk_score" in body
    assert body["risk_level"] in {"LOW", "MEDIUM", "HIGH"}
    assert isinstance(body["explanation"], list)
    assert "assessment_id" in body


def test_assessment_validation(client, auth_headers):
    response = client.post(
        "/api/patients/assess",
        json={"patient_id": "P-1002"},
        headers=auth_headers("clinician"),
    )
    assert response.status_code == 400


def test_assessment_rejects_invalid_vitals(client, auth_headers):
    payload = {
        "patient_id": "P-1002",
        "age": 64,
        "systolic_bp": 120,
        "diastolic_bp": 130,
        "heart_rate": 80,
        "oxygen_level": 90,
        "cholesterol": 190,
        "respiratory_rate": 20,
        "temperature": 37.0,
        "lactate": 1.5,
        "sepsis_indicator": 0.2,
        "diabetes": False,
        "prior_heart_disease": False,
        "chronic_kidney_disease": False,
        "smoker": False,
    }
    response = client.post(
        "/api/patients/assess",
        json=payload,
        headers=auth_headers("clinician"),
    )
    assert response.status_code == 400


def test_benchmark_endpoint(client, auth_headers):
    response = client.get("/api/metrics/benchmark", headers=auth_headers("analyst"))
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["dataset"]["rows"] > 0
    assert payload["dataset"]["features"] > 0
    assert len(payload["models"]) >= 3


def test_audit_logs_are_admin_only(client, auth_headers):
    payload = {
        "patient_id": "P-2001",
        "age": 59,
        "systolic_bp": 154,
        "diastolic_bp": 92,
        "heart_rate": 102,
        "oxygen_level": 91,
        "cholesterol": 225,
        "respiratory_rate": 22,
        "temperature": 37.9,
        "lactate": 2.4,
        "sepsis_indicator": 0.54,
        "diabetes": True,
        "prior_heart_disease": False,
        "chronic_kidney_disease": False,
        "smoker": False,
    }
    create_response = client.post(
        "/api/patients/assess",
        json=payload,
        headers=auth_headers("clinician"),
    )
    assert create_response.status_code == 201

    forbidden_response = client.get("/api/audit/logs", headers=auth_headers("clinician"))
    assert forbidden_response.status_code == 403

    admin_response = client.get("/api/audit/logs?limit=20", headers=auth_headers("admin"))
    assert admin_response.status_code == 200
    body = admin_response.get_json()
    assert body["count"] >= 1
    assert any(item["action"] == "CREATE_ASSESSMENT" for item in body["items"])
