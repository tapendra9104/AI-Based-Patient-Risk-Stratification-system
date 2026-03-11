from __future__ import annotations

from typing import Any

from .doctor_directory import build_doctor_recommendation


SEVERITY_ORDER = {"watch": 1, "moderate": 2, "severe": 3}


def _flag(
    label: str,
    feature: str,
    value: float,
    severity: str,
    reason: str,
) -> dict[str, Any]:
    return {
        "label": label,
        "feature": feature,
        "value": round(float(value), 3),
        "severity": severity,
        "reason": reason,
    }


def _dedupe(values: list[str]) -> list[str]:
    seen: set[str] = set()
    deduped: list[str] = []
    for value in values:
        normalized = value.strip()
        if not normalized or normalized in seen:
            continue
        deduped.append(normalized)
        seen.add(normalized)
    return deduped


def _priority_profile(
    risk_level: str,
    *,
    icu_within_24h: bool,
    severe_count: int,
    moderate_count: int,
) -> dict[str, Any]:
    if icu_within_24h or severe_count >= 2 or (risk_level == "HIGH" and severe_count >= 1):
        return {
            "priority": "Immediate",
            "target_response_minutes": 15,
            "recommended_unit": "ICU / rapid response review",
            "observation_frequency_minutes": 15,
        }
    if risk_level == "HIGH" or severe_count == 1 or moderate_count >= 3:
        return {
            "priority": "Urgent",
            "target_response_minutes": 30,
            "recommended_unit": "Step-down / telemetry",
            "observation_frequency_minutes": 30,
        }
    if risk_level == "MEDIUM" or moderate_count >= 1:
        return {
            "priority": "Priority",
            "target_response_minutes": 120,
            "recommended_unit": "Monitored ward bed",
            "observation_frequency_minutes": 120,
        }
    return {
        "priority": "Routine",
        "target_response_minutes": 360,
        "recommended_unit": "Routine ward follow-up",
        "observation_frequency_minutes": 240,
    }


def build_clinical_guidance(
    features: dict[str, float],
    prediction: dict[str, Any],
) -> dict[str, Any]:
    abnormal_findings: list[dict[str, Any]] = []

    oxygen_level = float(features["oxygen_level"])
    if oxygen_level <= 88:
        abnormal_findings.append(
            _flag(
                "Critical hypoxemia",
                "oxygen_level",
                oxygen_level,
                "severe",
                "Oxygen saturation is in a range commonly associated with immediate escalation.",
            )
        )
    elif oxygen_level <= 92:
        abnormal_findings.append(
            _flag(
                "Low oxygen reserve",
                "oxygen_level",
                oxygen_level,
                "moderate",
                "Reduced oxygen saturation may indicate respiratory compromise.",
            )
        )

    systolic_bp = float(features["systolic_bp"])
    if systolic_bp >= 180:
        abnormal_findings.append(
            _flag(
                "Severely elevated blood pressure",
                "systolic_bp",
                systolic_bp,
                "severe",
                "Marked hypertension increases the chance of acute cardiovascular events.",
            )
        )
    elif systolic_bp >= 160:
        abnormal_findings.append(
            _flag(
                "Elevated systolic pressure",
                "systolic_bp",
                systolic_bp,
                "moderate",
                "This blood pressure reading merits prompt reassessment and medication review.",
            )
        )
    elif systolic_bp <= 90:
        abnormal_findings.append(
            _flag(
                "Low systolic pressure",
                "systolic_bp",
                systolic_bp,
                "severe",
                "Hypotension can signal shock or poor perfusion.",
            )
        )

    heart_rate = float(features["heart_rate"])
    if heart_rate >= 130:
        abnormal_findings.append(
            _flag(
                "Severe tachycardia",
                "heart_rate",
                heart_rate,
                "severe",
                "Persistent heart rate in this range suggests significant physiologic stress.",
            )
        )
    elif heart_rate >= 110:
        abnormal_findings.append(
            _flag(
                "Tachycardia",
                "heart_rate",
                heart_rate,
                "moderate",
                "This rate is above normal and may reflect infection, dehydration, or cardiac stress.",
            )
        )
    elif heart_rate <= 45:
        abnormal_findings.append(
            _flag(
                "Bradycardia",
                "heart_rate",
                heart_rate,
                "severe",
                "Low heart rate with symptoms can require urgent evaluation.",
            )
        )

    respiratory_rate = float(features["respiratory_rate"])
    if respiratory_rate >= 30:
        abnormal_findings.append(
            _flag(
                "Marked tachypnea",
                "respiratory_rate",
                respiratory_rate,
                "severe",
                "Very high respiratory rate is concerning for respiratory distress.",
            )
        )
    elif respiratory_rate >= 22:
        abnormal_findings.append(
            _flag(
                "Elevated respiratory rate",
                "respiratory_rate",
                respiratory_rate,
                "moderate",
                "Fast breathing can indicate infection, hypoxia, or metabolic stress.",
            )
        )

    temperature = float(features["temperature"])
    if temperature >= 39.0 or temperature <= 35.0:
        abnormal_findings.append(
            _flag(
                "Temperature instability",
                "temperature",
                temperature,
                "severe",
                "Extreme temperature values increase suspicion for severe infection or systemic illness.",
            )
        )
    elif temperature >= 38.0:
        abnormal_findings.append(
            _flag(
                "Fever pattern",
                "temperature",
                temperature,
                "moderate",
                "Fever raises concern for infection or inflammatory response.",
            )
        )

    lactate = float(features["lactate"])
    if lactate >= 4.0:
        abnormal_findings.append(
            _flag(
                "Critical lactate elevation",
                "lactate",
                lactate,
                "severe",
                "Marked lactate elevation suggests hypoperfusion and possible shock.",
            )
        )
    elif lactate >= 2.0:
        abnormal_findings.append(
            _flag(
                "Elevated lactate",
                "lactate",
                lactate,
                "moderate",
                "This lactate level may indicate early tissue hypoperfusion.",
            )
        )

    sepsis_indicator = float(features["sepsis_indicator"])
    if sepsis_indicator >= 0.8:
        abnormal_findings.append(
            _flag(
                "High sepsis signal",
                "sepsis_indicator",
                sepsis_indicator,
                "severe",
                "The sepsis indicator is strongly elevated and should trigger protocol review.",
            )
        )
    elif sepsis_indicator >= 0.6:
        abnormal_findings.append(
            _flag(
                "Moderate sepsis signal",
                "sepsis_indicator",
                sepsis_indicator,
                "moderate",
                "This score suggests meaningful infection-related deterioration risk.",
            )
        )

    stress_level = float(features["stress_level"])
    if stress_level >= 8.5:
        abnormal_findings.append(
            _flag(
                "Extreme stress burden",
                "stress_level",
                stress_level,
                "moderate",
                "Marked physiologic or emotional stress can worsen instability and monitoring needs.",
            )
        )
    elif stress_level >= 6.5:
        abnormal_findings.append(
            _flag(
                "Elevated stress burden",
                "stress_level",
                stress_level,
                "watch",
                "Stress level is above baseline and may contribute to clinical deterioration.",
            )
        )

    cholesterol = float(features["cholesterol"])
    if cholesterol >= 240:
        abnormal_findings.append(
            _flag(
                "Elevated cholesterol burden",
                "cholesterol",
                cholesterol,
                "watch",
                "This adds chronic cardiovascular risk even if not acutely destabilizing.",
            )
        )

    if float(features["age"]) >= 75:
        abnormal_findings.append(
            _flag(
                "Advanced age risk",
                "age",
                features["age"],
                "watch",
                "Older patients often decompensate faster and benefit from closer monitoring.",
            )
        )

    if float(features["diabetes"]) >= 1.0:
        abnormal_findings.append(
            _flag(
                "Diabetes comorbidity",
                "diabetes",
                features["diabetes"],
                "watch",
                "Diabetes increases complication risk and can blunt early clinical warning signs.",
            )
        )

    if float(features["prior_heart_disease"]) >= 1.0:
        abnormal_findings.append(
            _flag(
                "Cardiovascular history",
                "prior_heart_disease",
                features["prior_heart_disease"],
                "watch",
                "Prior cardiac disease raises baseline risk for acute deterioration.",
            )
        )

    if float(features["chronic_kidney_disease"]) >= 1.0:
        abnormal_findings.append(
            _flag(
                "Renal comorbidity",
                "chronic_kidney_disease",
                features["chronic_kidney_disease"],
                "watch",
                "Kidney disease increases medication and perfusion sensitivity.",
            )
        )

    abnormal_findings.sort(
        key=lambda item: (
            SEVERITY_ORDER.get(str(item["severity"]), 0),
            abs(float(item["value"])),
        ),
        reverse=True,
    )
    abnormal_findings = abnormal_findings[:6]

    severe_count = sum(1 for item in abnormal_findings if item["severity"] == "severe")
    moderate_count = sum(1 for item in abnormal_findings if item["severity"] == "moderate")
    triage = _priority_profile(
        str(prediction["risk_level"]),
        icu_within_24h=bool(prediction["icu_within_24h"]),
        severe_count=severe_count,
        moderate_count=moderate_count,
    )
    doctor_recommendation = build_doctor_recommendation(
        features,
        prediction,
        triage,
        abnormal_findings,
    )

    recommended_actions: list[str] = []
    if triage["priority"] == "Immediate":
        recommended_actions.append(
            "Notify the attending clinician or rapid response team immediately."
        )
    elif triage["priority"] == "Urgent":
        recommended_actions.append(
            "Escalate to a senior clinician review on the current shift."
        )
    elif triage["priority"] == "Priority":
        recommended_actions.append(
            "Repeat vitals and reassess the patient within the next observation cycle."
        )
    else:
        recommended_actions.append(
            "Continue standard ward monitoring and document interval reassessment."
        )

    if oxygen_level <= 92:
        recommended_actions.append(
            "Provide supplemental oxygen and continuous pulse oximetry while reassessing airway and breathing."
        )
    if sepsis_indicator >= 0.6 or lactate >= 2.0:
        recommended_actions.append(
            "Start a sepsis-focused review with repeat lactate, infection workup, and protocol-based treatment checks."
        )
    if systolic_bp >= 160 or heart_rate >= 110 or prediction["predicted_conditions"]["heart_disease_risk"] >= 0.65:
        recommended_actions.append(
            "Review cardiovascular status, obtain ECG if indicated, and assess medication or fluid strategy."
        )
    if prediction["predicted_conditions"]["stroke_risk"] >= 0.6:
        recommended_actions.append(
            "Screen for focal neurologic deficits and escalate for urgent neuro evaluation if symptoms are present."
        )
    if float(features["diabetes"]) >= 1.0 or float(features["chronic_kidney_disease"]) >= 1.0:
        recommended_actions.append(
            "Review chronic disease medications, renal dosing, and metabolic monitoring requirements."
        )
    if stress_level >= 7.0:
        recommended_actions.append(
            "Assess pain, anxiety, agitation, or environmental stressors and reduce avoidable triggers."
        )

    best_doctor = doctor_recommendation["best_match"]
    if doctor_recommendation["contact_recommended"]:
        recommended_actions.insert(
            1,
            (
                f"Contact {best_doctor['name']} ({best_doctor['specialization']}) at "
                f"{best_doctor['phone']} or {best_doctor['email']} for immediate clinical review."
            ),
        )
    else:
        recommended_actions.append(
            (
                f"If specialist review is needed, start with {best_doctor['name']} "
                f"({best_doctor['specialization']}) at {best_doctor['phone']}."
            ),
        )

    recommended_actions = _dedupe(recommended_actions)[:6]

    clinical_summary = (
        f"{triage['priority']} priority case with {prediction['risk_level'].lower()} modeled risk"
        f" and {len(abnormal_findings)} notable findings. Best doctor contact: "
        f"{best_doctor['name']} ({best_doctor['specialization']})."
    )

    return {
        "triage": triage,
        "abnormal_findings": abnormal_findings,
        "recommended_actions": recommended_actions,
        "clinical_summary": clinical_summary,
        "doctor_recommendation": doctor_recommendation,
    }
