from __future__ import annotations

from pathlib import Path
from threading import Lock
from typing import Mapping

import joblib
import numpy as np

from .preprocessing import FEATURE_ORDER
from .training import train_and_save_model

_MODEL_CACHE: dict | None = None
_CACHE_PATH: Path | None = None
_CACHE_LOCK = Lock()


def _clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return float(max(low, min(high, value)))


def _get_cfg(config: Mapping[str, object], key: str, default: object) -> object:
    return config.get(key, default)


def _force_serial_classifier_execution(artifact: dict) -> dict:
    model = artifact.get("model")
    classifier = getattr(model, "named_steps", {}).get("classifier")
    if classifier is not None and hasattr(classifier, "n_jobs"):
        classifier.n_jobs = 1
    return artifact


def _artifact_requires_refresh(artifact: dict) -> bool:
    artifact_features = list(artifact.get("feature_order", []))
    return artifact_features != FEATURE_ORDER


def load_artifact(config: Mapping[str, object]) -> dict:
    global _MODEL_CACHE, _CACHE_PATH

    model_path = Path(str(_get_cfg(config, "MODEL_PATH", "risk_model.joblib")))
    app_env = str(_get_cfg(config, "APP_ENV", "development")).strip().lower()
    random_state = int(_get_cfg(config, "MODEL_RANDOM_STATE", 42))
    low_threshold = float(_get_cfg(config, "RISK_LOW_THRESHOLD", 0.35))
    high_threshold = float(_get_cfg(config, "RISK_HIGH_THRESHOLD", 0.70))
    dataset_size = int(_get_cfg(config, "SYNTHETIC_DATASET_SIZE", 6000))

    with _CACHE_LOCK:
        if _MODEL_CACHE is not None and _CACHE_PATH == model_path:
            return _MODEL_CACHE

        if not model_path.exists():
            if app_env == "production":
                raise FileNotFoundError("Configured production model artifact was not found")
            train_and_save_model(
                model_path=model_path,
                random_state=random_state,
                low_threshold=low_threshold,
                high_threshold=high_threshold,
                dataset_size=dataset_size,
            )

        artifact = _force_serial_classifier_execution(joblib.load(model_path))
        if _artifact_requires_refresh(artifact):
            if app_env == "production":
                raise RuntimeError("Configured model artifact uses an outdated feature schema")
            artifact = train_and_save_model(
                model_path=model_path,
                random_state=random_state,
                low_threshold=low_threshold,
                high_threshold=high_threshold,
                dataset_size=dataset_size,
            )
            artifact = _force_serial_classifier_execution(artifact)
        _MODEL_CACHE = artifact
        _CACHE_PATH = model_path
        return artifact


def classify_risk(score: float, thresholds: dict[str, float]) -> str:
    if score < thresholds["low"]:
        return "LOW"
    if score < thresholds["high"]:
        return "MEDIUM"
    return "HIGH"


def _predict_conditions(features: dict[str, float], risk_score: float) -> dict[str, float]:
    heart_disease = _clamp(
        0.35 * risk_score
        + 0.20 * (features["prior_heart_disease"])
        + 0.15 * (features["cholesterol"] / 300)
        + 0.20 * (features["systolic_bp"] / 180)
        + 0.08 * (features["stress_level"] / 10)
        + 0.10 * (1 - features["oxygen_level"] / 100)
    )
    stroke = _clamp(
        0.30 * risk_score
        + 0.20 * (features["age"] / 90)
        + 0.20 * (features["systolic_bp"] / 190)
        + 0.05 * (features["stress_level"] / 10)
        + 0.10 * features["smoker"]
    )
    sepsis = _clamp(
        0.30 * risk_score
        + 0.40 * features["sepsis_indicator"]
        + 0.15 * max(0.0, (features["temperature"] - 37.0) / 4)
        + 0.15 * max(0.0, (features["lactate"] - 1.5) / 5)
        + 0.05 * (features["stress_level"] / 10)
    )
    diabetic_complication = _clamp(
        0.30 * risk_score
        + 0.30 * features["diabetes"]
        + 0.20 * (features["chronic_kidney_disease"])
        + 0.20 * (features["cholesterol"] / 320)
    )

    return {
        "heart_disease_risk": round(heart_disease, 4),
        "stroke_risk": round(stroke, 4),
        "sepsis_risk": round(sepsis, 4),
        "diabetes_complication_risk": round(diabetic_complication, 4),
    }


def _predict_icu_need(features: dict[str, float], risk_score: float) -> bool:
    return bool(
        risk_score >= 0.78
        or features["oxygen_level"] <= 88
        or features["sepsis_indicator"] >= 0.75
        or features["stress_level"] >= 9.5
        or (features["heart_rate"] >= 130 and features["systolic_bp"] >= 170)
    )


def predict_patient_risk(features: dict[str, float], config: Mapping[str, object]) -> dict:
    artifact = load_artifact(config)
    model = artifact["model"]
    feature_order = artifact["feature_order"]
    thresholds = artifact["thresholds"]

    feature_vector = np.array([[features[name] for name in feature_order]], dtype=float)
    risk_score = float(model.predict_proba(feature_vector)[0][1])
    risk_level = classify_risk(risk_score, thresholds)

    return {
        "risk_score": round(risk_score, 4),
        "risk_level": risk_level,
        "predicted_conditions": _predict_conditions(features, risk_score),
        "icu_within_24h": _predict_icu_need(features, risk_score),
        "artifact": artifact,
    }
