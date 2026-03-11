from __future__ import annotations

import re
from typing import Any


FEATURE_ORDER = [
    "age",
    "systolic_bp",
    "diastolic_bp",
    "heart_rate",
    "oxygen_level",
    "cholesterol",
    "respiratory_rate",
    "temperature",
    "lactate",
    "sepsis_indicator",
    "stress_level",
    "diabetes",
    "prior_heart_disease",
    "chronic_kidney_disease",
    "smoker",
]

REQUIRED_FIELDS = {
    "patient_id",
    "age",
    "systolic_bp",
    "diastolic_bp",
    "heart_rate",
    "oxygen_level",
    "cholesterol",
    "respiratory_rate",
    "temperature",
    "lactate",
    "sepsis_indicator",
    "diabetes",
    "prior_heart_disease",
}

OPTIONAL_DEFAULTS = {
    "stress_level": 5.0,
    "chronic_kidney_disease": False,
    "smoker": False,
}

PATIENT_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$")

FIELD_RANGES = {
    "age": (0, 120),
    "systolic_bp": (60, 260),
    "diastolic_bp": (30, 160),
    "heart_rate": (20, 250),
    "oxygen_level": (50, 100),
    "cholesterol": (50, 500),
    "respiratory_rate": (5, 60),
    "temperature": (30, 45),
    "lactate": (0, 20),
    "sepsis_indicator": (0, 1),
    "stress_level": (0, 10),
}


def _as_float(value: Any, field: str) -> float:
    try:
        return float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"Invalid value for '{field}': expected numeric") from exc


def _as_bool(value: Any, field: str) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"yes", "true", "1", "y"}:
            return True
        if normalized in {"no", "false", "0", "n"}:
            return False
    raise ValueError(f"Invalid value for '{field}': expected boolean")


def normalize_patient_payload(payload: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValueError("Request payload must be a JSON object")

    missing = [field for field in REQUIRED_FIELDS if field not in payload]
    if missing:
        missing_list = ", ".join(sorted(missing))
        raise ValueError(f"Missing required fields: {missing_list}")

    patient_id = str(payload.get("patient_id", "")).strip()
    if not patient_id:
        raise ValueError("Field 'patient_id' must be a non-empty string")
    if not PATIENT_ID_PATTERN.fullmatch(patient_id):
        raise ValueError(
            "Field 'patient_id' must be 3-64 characters using letters, numbers, dots, dashes, or underscores"
        )

    raw_features: dict[str, Any] = {}
    for field in FEATURE_ORDER:
        raw_features[field] = payload.get(field, OPTIONAL_DEFAULTS.get(field))

    features = {
        "age": _as_float(raw_features["age"], "age"),
        "systolic_bp": _as_float(raw_features["systolic_bp"], "systolic_bp"),
        "diastolic_bp": _as_float(raw_features["diastolic_bp"], "diastolic_bp"),
        "heart_rate": _as_float(raw_features["heart_rate"], "heart_rate"),
        "oxygen_level": _as_float(raw_features["oxygen_level"], "oxygen_level"),
        "cholesterol": _as_float(raw_features["cholesterol"], "cholesterol"),
        "respiratory_rate": _as_float(raw_features["respiratory_rate"], "respiratory_rate"),
        "temperature": _as_float(raw_features["temperature"], "temperature"),
        "lactate": _as_float(raw_features["lactate"], "lactate"),
        "sepsis_indicator": _as_float(raw_features["sepsis_indicator"], "sepsis_indicator"),
        "stress_level": _as_float(raw_features["stress_level"], "stress_level"),
        "diabetes": float(_as_bool(raw_features["diabetes"], "diabetes")),
        "prior_heart_disease": float(
            _as_bool(raw_features["prior_heart_disease"], "prior_heart_disease")
        ),
        "chronic_kidney_disease": float(
            _as_bool(raw_features["chronic_kidney_disease"], "chronic_kidney_disease")
        ),
        "smoker": float(_as_bool(raw_features["smoker"], "smoker")),
    }

    for field, (lower_bound, upper_bound) in FIELD_RANGES.items():
        if not (lower_bound <= features[field] <= upper_bound):
            raise ValueError(
                f"Field '{field}' must be between {lower_bound} and {upper_bound}"
            )

    if features["diastolic_bp"] > features["systolic_bp"]:
        raise ValueError("Field 'diastolic_bp' cannot be greater than 'systolic_bp'")

    return {"patient_id": patient_id, "features": features}
