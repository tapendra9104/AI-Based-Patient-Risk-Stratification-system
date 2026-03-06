from __future__ import annotations

from typing import Mapping

from .services.explainability import summarize_risk_factors
from .services.inference import predict_patient_risk
from .services.preprocessing import normalize_patient_payload


def assess_patient(payload: dict, config: Mapping[str, object]) -> tuple[dict, dict]:
    normalized = normalize_patient_payload(payload)
    prediction = predict_patient_risk(normalized["features"], config)
    explanation = summarize_risk_factors(normalized["features"], prediction["artifact"])

    result = {
        "patient_id": normalized["patient_id"],
        "risk_score": prediction["risk_score"],
        "risk_level": prediction["risk_level"],
        "icu_within_24h": prediction["icu_within_24h"],
        "predicted_conditions": prediction["predicted_conditions"],
        "explanation": explanation,
    }
    return result, normalized
