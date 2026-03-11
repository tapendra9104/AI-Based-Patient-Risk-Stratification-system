# AI-Powered Patient Risk Stratification and Early Warning System

Industry-style starter project for hospital patient triage with:
- Risk scoring (`LOW`, `MEDIUM`, `HIGH`)
- Early warning alerts for high-risk patients
- Explainable AI-style factor breakdown
- Actionable triage guidance with abnormal-vital flags and recommended actions
- Doctor dashboard (web UI)
- Operational summary cards and a live high-risk queue
- Patient-specific risk timeline and trend view
- Batch patient assessment intake
- What-if simulation tool for likely intervention impact
- CSV export, filterable patient views, and richer audit filtering
- Model governance snapshot with thresholds and top feature importances
- Real dataset benchmark (UCI Breast Cancer via scikit-learn)
- Model accuracy graph across CV folds
- Training and inference pipeline
- API key authentication, role-based access, and audit logging
- Liveness/readiness probes and stricter clinical input validation

## 1. Project Architecture

```text
Patient Data Input
      ->
Data Validation and Preprocessing
      ->
ML Model Inference
      ->
Risk Score + Risk Level + Explainability
      ->
Dashboard + Alerting
```

## 2. Tech Stack

- Backend: Python, Flask, SQLAlchemy
- AI/ML: scikit-learn (RandomForest)
- Database: SQLite (default), configurable via `DATABASE_URL`
- Frontend: HTML/CSS/JS + Chart.js
- Containerization: Docker

## 3. Quick Start (Local)

1. Create virtual environment and install dependencies:
```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/Mac:
source .venv/bin/activate
pip install -r requirements.txt
```

2. Train the model:
```bash
python train.py
```

3. Start backend API:
```bash
python run.py
```

4. Open frontend dashboard:
- Open `frontend/index.html` in a browser.
- Default API URL is `http://localhost:5000/api`.
- Default local demo key is `demo-admin-key`.

## 3A. Security and Access

- Roles: `admin`, `clinician`, `analyst`, `ingest`
- Header: `X-API-Key: <your-key>` or `Authorization: Bearer <your-key>`
- Local demo keys are enabled only outside production.
- In production, set `APP_ENV=production` and provide `API_KEYS_JSON`.

### Example `API_KEYS_JSON`

```json
{
  "hospital-admin-key": {
    "actor_id": "admin-console",
    "name": "Hospital Admin",
    "role": "admin"
  },
  "er-clinician-key": {
    "actor_id": "doctor-shift-a",
    "name": "ER Clinician",
    "role": "clinician"
  }
}
```

## 4. Docker

From project root:
```bash
docker compose up --build
```

## 5. API Endpoints

- `GET /api/health`
- `GET /api/health/live`
- `GET /api/health/ready`
- `POST /api/patients/assess`
- `POST /api/patients/assess/batch`
- `POST /api/patients/assess/simulate`
- `GET /api/patients/summary?limit=50`
- `GET /api/patients?limit=50`
- `GET /api/patients/export.csv?limit=50`
- `GET /api/patients/<patient_id>/timeline?limit=12`
- `GET /api/metrics/model`
- `GET /api/metrics/benchmark`
- `GET /api/audit/logs?limit=50`

### Sample `POST /api/patients/assess`

```json
{
  "patient_id": "P-2041",
  "age": 67,
  "systolic_bp": 160,
  "diastolic_bp": 98,
  "heart_rate": 112,
  "oxygen_level": 90,
  "cholesterol": 240,
  "respiratory_rate": 24,
  "temperature": 38.3,
  "lactate": 2.9,
  "sepsis_indicator": 0.7,
  "diabetes": true,
  "prior_heart_disease": true,
  "chronic_kidney_disease": false,
  "smoker": true
}
```

### Sample response highlights

```json
{
  "risk_level": "HIGH",
  "clinical_summary": "Immediate priority case with high modeled risk and notable findings.",
  "triage": {
    "priority": "Immediate",
    "target_response_minutes": 15,
    "recommended_unit": "ICU / rapid response review"
  },
  "abnormal_findings": [
    {
      "label": "Critical hypoxemia",
      "severity": "severe"
    }
  ],
  "recommended_actions": [
    "Notify the attending clinician or rapid response team immediately."
  ]
}
```

### Batch assessment payload

```json
{
  "items": [
    {
      "patient_id": "P-7201",
      "age": 71,
      "systolic_bp": 168,
      "diastolic_bp": 100,
      "heart_rate": 118,
      "oxygen_level": 89,
      "cholesterol": 246,
      "respiratory_rate": 26,
      "temperature": 38.4,
      "lactate": 3.1,
      "sepsis_indicator": 0.74,
      "diabetes": true,
      "prior_heart_disease": true
    }
  ]
}
```

### Simulation payload

```json
{
  "baseline": {
    "patient_id": "P-2041",
    "age": 67,
    "systolic_bp": 160,
    "diastolic_bp": 98,
    "heart_rate": 112,
    "oxygen_level": 90,
    "cholesterol": 240,
    "respiratory_rate": 24,
    "temperature": 38.3,
    "lactate": 2.9,
    "sepsis_indicator": 0.7,
    "diabetes": true,
    "prior_heart_disease": true
  },
  "scenarios": [
    {
      "label": "Oxygen support",
      "overrides": {
        "oxygen_level": 96,
        "respiratory_rate": 18
      }
    }
  ]
}
```

## 6. Project Structure

```text
backend/
  app/
    services/
  tests/
frontend/
docker-compose.yml
README.md
```

## 7. Notes

- Patient triage model currently uses synthetic medical-like feature generation to keep patient-form inference aligned.
- Real dataset benchmarking uses UCI Breast Cancer Wisconsin data through `sklearn.datasets.load_breast_cancer`.
- Benchmark artifact is stored at `backend/models/benchmark_metrics.json`.
- This repository now includes hospital-grade foundations like role-based access, audit logs, and health probes.
- The dashboard now also surfaces operational KPIs and per-patient longitudinal risk movement.
- The current release also includes batch ingest, CSV export, what-if simulation, and model governance views without requiring a schema migration.
- Real hospital deployment still requires migrations, stronger identity management, encryption, monitoring, FHIR/EHR integration, and clinical/regulatory validation.
