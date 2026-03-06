from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline

from .preprocessing import FEATURE_ORDER


def _logistic(x: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-x))


def generate_synthetic_dataset(
    size: int = 6000, random_state: int = 42
) -> tuple[pd.DataFrame, pd.Series]:
    rng = np.random.default_rng(random_state)

    age = np.clip(rng.normal(52, 17, size), 18, 95)
    systolic_bp = np.clip(rng.normal(128, 22, size), 85, 220)
    diastolic_bp = np.clip(rng.normal(80, 14, size), 50, 130)
    heart_rate = np.clip(rng.normal(84, 18, size), 45, 180)
    oxygen_level = np.clip(rng.normal(95, 3, size), 72, 100)
    cholesterol = np.clip(rng.normal(196, 42, size), 100, 380)
    respiratory_rate = np.clip(rng.normal(18, 5, size), 8, 45)
    temperature = np.clip(rng.normal(36.9, 0.9, size), 34.5, 41.5)
    lactate = np.clip(rng.normal(1.9, 1.2, size), 0.3, 8.5)
    sepsis_indicator = np.clip(rng.beta(2, 6, size), 0.0, 1.0)
    diabetes = rng.binomial(1, 0.27, size)
    prior_heart_disease = rng.binomial(1, 0.20, size)
    chronic_kidney_disease = rng.binomial(1, 0.15, size)
    smoker = rng.binomial(1, 0.31, size)

    linear_signal = (
        0.032 * (age - 50)
        + 0.018 * (systolic_bp - 120)
        + 0.020 * (diastolic_bp - 80)
        + 0.028 * (heart_rate - 80)
        - 0.35 * (oxygen_level - 95)
        + 0.011 * (cholesterol - 185)
        + 0.070 * (respiratory_rate - 16)
        + 1.00 * (temperature - 37.0)
        + 0.70 * (lactate - 1.5)
        + 2.00 * sepsis_indicator
        + 1.20 * diabetes
        + 1.35 * prior_heart_disease
        + 0.95 * chronic_kidney_disease
        + 0.70 * smoker
    )

    risk_prob = np.clip(_logistic((linear_signal - 2.0) / 5.0), 0.01, 0.99)
    outcome = rng.binomial(1, risk_prob, size=size)

    frame = pd.DataFrame(
        {
            "age": age,
            "systolic_bp": systolic_bp,
            "diastolic_bp": diastolic_bp,
            "heart_rate": heart_rate,
            "oxygen_level": oxygen_level,
            "cholesterol": cholesterol,
            "respiratory_rate": respiratory_rate,
            "temperature": temperature,
            "lactate": lactate,
            "sepsis_indicator": sepsis_indicator,
            "diabetes": diabetes.astype(float),
            "prior_heart_disease": prior_heart_disease.astype(float),
            "chronic_kidney_disease": chronic_kidney_disease.astype(float),
            "smoker": smoker.astype(float),
        }
    )
    labels = pd.Series(outcome, name="high_risk_event")
    return frame, labels


def train_and_save_model(
    model_path: str | Path,
    random_state: int = 42,
    low_threshold: float = 0.35,
    high_threshold: float = 0.70,
    dataset_size: int = 6000,
) -> dict:
    model_path = Path(model_path)
    model_path.parent.mkdir(parents=True, exist_ok=True)

    x, y = generate_synthetic_dataset(size=dataset_size, random_state=random_state)
    x_train, x_test, y_train, y_test = train_test_split(
        x, y, test_size=0.2, random_state=random_state, stratify=y
    )

    model = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            (
                "classifier",
                RandomForestClassifier(
                    n_estimators=350,
                    max_depth=10,
                    min_samples_leaf=4,
                    class_weight="balanced",
                    random_state=random_state,
                    n_jobs=-1,
                ),
            ),
        ]
    )
    model.fit(x_train, y_train)

    y_pred = model.predict(x_test)
    y_score = model.predict_proba(x_test)[:, 1]
    metrics = {
        "accuracy": round(float(accuracy_score(y_test, y_pred)), 4),
        "precision": round(float(precision_score(y_test, y_pred, zero_division=0)), 4),
        "recall": round(float(recall_score(y_test, y_pred, zero_division=0)), 4),
        "f1_score": round(float(f1_score(y_test, y_pred, zero_division=0)), 4),
        "roc_auc": round(float(roc_auc_score(y_test, y_score)), 4),
    }

    artifact = {
        "model": model,
        "feature_order": FEATURE_ORDER,
        "thresholds": {"low": float(low_threshold), "high": float(high_threshold)},
        "metrics": metrics,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "dataset_size": dataset_size,
    }
    joblib.dump(artifact, model_path)
    return artifact
