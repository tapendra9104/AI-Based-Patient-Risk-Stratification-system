from __future__ import annotations

import json
import sys
from pathlib import Path

import joblib
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


def build_payload(patient_id: str = "P-1001", **overrides) -> dict:
    payload = {
        "patient_id": patient_id,
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
        "stress_level": 7.2,
        "diabetes": True,
        "prior_heart_disease": True,
        "chronic_kidney_disease": False,
        "smoker": True,
    }
    payload.update(overrides)
    return payload


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
    response = client.post(
        "/api/patients/assess",
        json=build_payload(),
        headers=auth_headers("clinician"),
    )
    assert response.status_code == 201

    body = response.get_json()
    assert "risk_score" in body
    assert body["risk_level"] in {"LOW", "MEDIUM", "HIGH"}
    assert isinstance(body["explanation"], list)
    assert isinstance(body["abnormal_findings"], list)
    assert isinstance(body["recommended_actions"], list)
    assert isinstance(body["clinical_summary"], str)
    assert body["triage"]["priority"] in {"Immediate", "Urgent", "Priority", "Routine"}
    assert body["doctor_recommendation"]["best_match"]["name"].startswith("Dr. ")
    assert "specialization" in body["doctor_recommendation"]["best_match"]
    assert "phone" in body["doctor_recommendation"]["best_match"]
    assert body["doctor_recommendation"]["alert"]["visible"] is True
    assert body["doctor_recommendation"]["contact_recommended"] is True
    assert "assessment_id" in body
    assert body["created_at"].endswith("+00:00")


def test_assessment_validation(client, auth_headers):
    response = client.post(
        "/api/patients/assess",
        json={"patient_id": "P-1002"},
        headers=auth_headers("clinician"),
    )
    assert response.status_code == 400


def test_assessment_rejects_invalid_vitals(client, auth_headers):
    response = client.post(
        "/api/patients/assess",
        json=build_payload(
            patient_id="P-1002",
            systolic_bp=120,
            diastolic_bp=130,
            heart_rate=80,
            cholesterol=190,
            respiratory_rate=20,
            temperature=37.0,
            lactate=1.5,
            sepsis_indicator=0.2,
            diabetes=False,
            prior_heart_disease=False,
            smoker=False,
        ),
        headers=auth_headers("clinician"),
    )
    assert response.status_code == 400


def test_assessment_rejects_invalid_stress_level(client, auth_headers):
    response = client.post(
        "/api/patients/assess",
        json=build_payload(patient_id="P-1003", stress_level=11),
        headers=auth_headers("clinician"),
    )
    assert response.status_code == 400


def test_model_metrics_include_feature_importances(client, auth_headers):
    response = client.get("/api/metrics/model?top_n=5", headers=auth_headers("analyst"))
    assert response.status_code == 200
    body = response.get_json()
    assert body["classifier"] == "RandomForestClassifier"
    assert body["feature_count"] >= 10
    assert len(body["feature_importances"]) == 5
    assert set(body["thresholds"]) == {"low", "high"}


def test_loaded_artifact_uses_serial_classifier(client):
    from app.services.inference import load_artifact

    with client.application.app_context():
        artifact = load_artifact(client.application.config)
        classifier = artifact["model"].named_steps["classifier"]
        assert getattr(classifier, "n_jobs", 1) == 1
        assert "stress_level" in artifact["feature_order"]


def test_outdated_model_artifact_is_retrained_with_current_feature_schema(client, tmp_path):
    from app.services.inference import load_artifact
    from app.services.training import train_and_save_model

    model_path = tmp_path / "outdated-risk-model.joblib"
    artifact = train_and_save_model(model_path=model_path, dataset_size=800)
    artifact["feature_order"] = [feature for feature in artifact["feature_order"] if feature != "stress_level"]
    joblib.dump(artifact, model_path)

    config = dict(client.application.config)
    config["MODEL_PATH"] = str(model_path)
    with client.application.app_context():
        refreshed = load_artifact(config)
    assert refreshed["feature_order"][-5] == "stress_level"


def test_batch_assessment_endpoint_supports_partial_success(client, auth_headers):
    response = client.post(
        "/api/patients/assess/batch",
        json={
            "items": [
                build_payload(patient_id="P-5001"),
                {"patient_id": "bad"},
            ]
        },
        headers=auth_headers("ingest"),
    )
    assert response.status_code == 207
    body = response.get_json()
    assert body["requested_count"] == 2
    assert body["created_count"] == 1
    assert body["error_count"] == 1
    assert isinstance(body["items"][0]["assessment_id"], int)
    assert body["items"][0]["patient_id"] == "P-5001"
    assert body["errors"][0]["code"] == "validation_error"


def test_ready_health_endpoint_reports_degraded_model_state(client, monkeypatch):
    import app.routes as routes_module

    def _raise_model_error(_config):
        raise RuntimeError("model unavailable")

    monkeypatch.setattr(routes_module, "load_artifact", _raise_model_error)
    response = client.get("/api/health/ready")
    assert response.status_code == 503
    body = response.get_json()
    assert body["status"] == "degraded"
    assert body["components"]["database"] == "ok"
    assert body["components"]["model"] == "error"


def test_simulation_endpoint_returns_scenarios_without_persisting(client, auth_headers):
    response = client.post(
        "/api/patients/assess/simulate",
        json={
            "baseline": build_payload(patient_id="P-6001"),
            "scenarios": [
                {
                    "label": "Oxygen support",
                    "overrides": {"oxygen_level": 97, "respiratory_rate": 18},
                },
                {
                    "label": "Sepsis escalation",
                    "overrides": {"oxygen_level": 86, "lactate": 4.2, "sepsis_indicator": 0.92},
                },
            ],
        },
        headers=auth_headers("clinician"),
    )
    assert response.status_code == 200
    body = response.get_json()
    assert body["patient_id"] == "P-6001"
    assert body["baseline"]["patient_id"] == "P-6001"
    assert body["baseline"]["doctor_recommendation"]["best_match"]["name"].startswith("Dr. ")
    assert len(body["scenarios"]) == 2
    assert body["scenarios"][0]["risk_score"] <= body["scenarios"][1]["risk_score"]
    assert "doctor_recommendation" in body["scenarios"][0]

    list_response = client.get(
        "/api/patients?patient_id=P-6001",
        headers=auth_headers("clinician"),
    )
    assert list_response.status_code == 200
    assert list_response.get_json()["count"] == 0


def test_patient_summary_endpoint(client, auth_headers):
    response_one = client.post(
        "/api/patients/assess",
        json=build_payload(patient_id="P-3001"),
        headers=auth_headers("clinician"),
    )
    response_two = client.post(
        "/api/patients/assess",
        json=build_payload(
            patient_id="P-3002",
            age=42,
            systolic_bp=124,
            diastolic_bp=78,
            heart_rate=78,
            oxygen_level=97,
            cholesterol=178,
            respiratory_rate=16,
            temperature=36.8,
            lactate=1.2,
            sepsis_indicator=0.12,
            diabetes=False,
            prior_heart_disease=False,
            chronic_kidney_disease=False,
            smoker=False,
        ),
        headers=auth_headers("clinician"),
    )
    assert response_one.status_code == 201
    assert response_two.status_code == 201

    response = client.get("/api/patients/summary?limit=20", headers=auth_headers("analyst"))
    assert response.status_code == 200
    body = response.get_json()
    assert body["assessment_count"] == 2
    assert body["unique_patients"] == 2
    assert sum(body["risk_distribution"].values()) == 2
    assert body["highest_risk_patient"]["patient_id"] in {"P-3001", "P-3002"}
    assert body["window"]["assessment_limit"] == 20


def test_patient_list_supports_offset_pagination(client, auth_headers):
    for index in range(3):
        response = client.post(
            "/api/patients/assess",
            json=build_payload(patient_id=f"P-320{index}"),
            headers=auth_headers("clinician"),
        )
        assert response.status_code == 201

    response = client.get("/api/patients?limit=2&offset=1", headers=auth_headers("analyst"))
    assert response.status_code == 200
    body = response.get_json()
    assert body["count"] == 2
    assert body["total_count"] == 3
    assert body["pagination"]["limit"] == 2
    assert body["pagination"]["offset"] == 1
    assert body["pagination"]["returned"] == 2


def test_patient_export_csv_endpoint(client, auth_headers):
    create_response = client.post(
        "/api/patients/assess",
        json=build_payload(patient_id="P-3501"),
        headers=auth_headers("clinician"),
    )
    assert create_response.status_code == 201

    response = client.get(
        "/api/patients/export.csv?patient_id=P-3501",
        headers=auth_headers("analyst"),
    )
    assert response.status_code == 200
    assert response.headers["Content-Type"].startswith("text/csv")
    body = response.get_data(as_text=True)
    assert "patient_id" in body
    assert "P-3501" in body


def test_patient_timeline_endpoint(client, auth_headers):
    patient_id = "P-4001"
    response_one = client.post(
        "/api/patients/assess",
        json=build_payload(
            patient_id=patient_id,
            systolic_bp=132,
            diastolic_bp=84,
            heart_rate=88,
            oxygen_level=95,
            respiratory_rate=18,
            temperature=37.1,
            lactate=1.6,
            sepsis_indicator=0.25,
            diabetes=False,
            prior_heart_disease=False,
            smoker=False,
        ),
        headers=auth_headers("clinician"),
    )
    response_two = client.post(
        "/api/patients/assess",
        json=build_payload(
            patient_id=patient_id,
            systolic_bp=170,
            diastolic_bp=102,
            heart_rate=126,
            oxygen_level=88,
            respiratory_rate=28,
            temperature=38.8,
            lactate=3.9,
            sepsis_indicator=0.78,
            diabetes=True,
            prior_heart_disease=True,
            smoker=True,
        ),
        headers=auth_headers("clinician"),
    )
    assert response_one.status_code == 201
    assert response_two.status_code == 201

    response = client.get(
        f"/api/patients/{patient_id}/timeline?limit=10",
        headers=auth_headers("clinician"),
    )
    assert response.status_code == 200
    body = response.get_json()
    assert body["patient_id"] == patient_id
    assert body["assessment_count"] == 2
    assert len(body["items"]) == 2
    assert body["items"][0]["trend_direction"] == "baseline"
    assert body["trajectory"]["direction"] in {"rising", "falling", "stable"}
    assert body["latest_assessment"]["assessment_id"] == body["items"][-1]["assessment_id"]
    assert body["latest_assessment"]["created_at"].endswith("+00:00")
    assert all(item["created_at"].endswith("+00:00") for item in body["items"])
    assert body["window"]["assessment_limit"] == 10


def test_benchmark_endpoint(client, auth_headers):
    response = client.get("/api/metrics/benchmark", headers=auth_headers("analyst"))
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["dataset"]["rows"] > 0
    assert payload["dataset"]["features"] > 0
    assert len(payload["models"]) >= 3


def test_audit_logs_are_admin_only(client, auth_headers):
    create_response = client.post(
        "/api/patients/assess",
        json=build_payload(
            patient_id="P-2001",
            age=59,
            systolic_bp=154,
            diastolic_bp=92,
            heart_rate=102,
            oxygen_level=91,
            cholesterol=225,
            respiratory_rate=22,
            temperature=37.9,
            lactate=2.4,
            sepsis_indicator=0.54,
            prior_heart_disease=False,
            smoker=False,
        ),
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
    assert all(item["created_at"].endswith("+00:00") for item in body["items"])

    filtered_response = client.get(
        "/api/audit/logs?action=CREATE_ASSESSMENT&resource_id=P-2001",
        headers=auth_headers("admin"),
    )
    assert filtered_response.status_code == 200
    filtered_body = filtered_response.get_json()
    assert filtered_body["count"] >= 1
    assert all(item["resource_id"] == "P-2001" for item in filtered_body["items"])
