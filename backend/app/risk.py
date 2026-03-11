from __future__ import annotations

from typing import Any, Mapping, Sequence

from .services.clinical_guidance import build_clinical_guidance
from .services.explainability import summarize_risk_factors
from .services.inference import predict_patient_risk
from .services.preprocessing import normalize_patient_payload


def assess_patient(payload: dict, config: Mapping[str, object]) -> tuple[dict, dict]:
    normalized = normalize_patient_payload(payload)
    prediction = predict_patient_risk(normalized["features"], config)
    explanation = summarize_risk_factors(normalized["features"], prediction["artifact"])
    guidance = build_clinical_guidance(normalized["features"], prediction)

    result = {
        "patient_id": normalized["patient_id"],
        "risk_score": prediction["risk_score"],
        "risk_level": prediction["risk_level"],
        "icu_within_24h": prediction["icu_within_24h"],
        "predicted_conditions": prediction["predicted_conditions"],
        "explanation": explanation,
        "triage": guidance["triage"],
        "abnormal_findings": guidance["abnormal_findings"],
        "recommended_actions": guidance["recommended_actions"],
        "clinical_summary": guidance["clinical_summary"],
        "doctor_recommendation": guidance["doctor_recommendation"],
    }
    return result, normalized


def simulate_patient_scenarios(
    baseline_payload: dict[str, Any],
    scenarios: Sequence[dict[str, Any]],
    config: Mapping[str, object],
) -> dict[str, Any]:
    baseline_result, baseline_normalized = assess_patient(dict(baseline_payload), config)
    patient_id = baseline_result["patient_id"]

    simulated_items: list[dict[str, Any]] = []
    for index, scenario in enumerate(scenarios, start=1):
        if not isinstance(scenario, dict):
            raise ValueError(f"Scenario at index {index - 1} must be an object")

        label = str(scenario.get("label", f"Scenario {index}")).strip() or f"Scenario {index}"
        overrides = scenario.get("overrides", {}) or {}
        if not isinstance(overrides, dict):
            raise ValueError(f"Scenario '{label}' must provide 'overrides' as an object")

        scenario_payload = dict(baseline_payload)
        scenario_payload.update(overrides)
        scenario_payload["patient_id"] = patient_id

        result, normalized = assess_patient(scenario_payload, config)
        score_delta = round(float(result["risk_score"]) - float(baseline_result["risk_score"]), 4)
        simulated_items.append(
            {
                "label": label,
                "overrides": normalized["features"],
                "risk_score": result["risk_score"],
                "risk_level": result["risk_level"],
                "icu_within_24h": result["icu_within_24h"],
                "clinical_summary": result["clinical_summary"],
                "triage": result["triage"],
                "doctor_recommendation": result["doctor_recommendation"],
                "score_delta": score_delta,
                "risk_level_changed": result["risk_level"] != baseline_result["risk_level"],
                "improvement": score_delta < 0,
            }
        )

    simulated_items.sort(key=lambda item: float(item["risk_score"]))
    return {
        "patient_id": patient_id,
        "baseline": {
            **baseline_result,
            "input_features": baseline_normalized["features"],
        },
        "scenarios": simulated_items,
    }
