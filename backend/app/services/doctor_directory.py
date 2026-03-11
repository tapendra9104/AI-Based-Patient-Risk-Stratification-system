from __future__ import annotations

from typing import Any, Sequence


DOCTOR_DIRECTORY: dict[str, dict[str, str]] = {
    "critical_care": {
        "name": "Dr. Maya Chen",
        "specialization": "Critical Care / Intensivist",
        "department": "ICU and Rapid Response",
        "phone": "+1 (555) 210-1101",
        "email": "maya.chen@hospital.demo",
        "availability": "24/7 escalation line",
    },
    "cardiology": {
        "name": "Dr. Arjun Patel",
        "specialization": "Cardiology",
        "department": "Cardiac Services",
        "phone": "+1 (555) 210-1102",
        "email": "arjun.patel@hospital.demo",
        "availability": "On-call daytime consults",
    },
    "pulmonary": {
        "name": "Dr. Sofia Alvarez",
        "specialization": "Pulmonology",
        "department": "Pulmonary and Respiratory Care",
        "phone": "+1 (555) 210-1103",
        "email": "sofia.alvarez@hospital.demo",
        "availability": "Respiratory rapid review",
    },
    "infectious_disease": {
        "name": "Dr. Ethan Brooks",
        "specialization": "Infectious Disease",
        "department": "Infectious Disease and Sepsis Response",
        "phone": "+1 (555) 210-1104",
        "email": "ethan.brooks@hospital.demo",
        "availability": "Sepsis consult line",
    },
    "neurology": {
        "name": "Dr. Leila Hassan",
        "specialization": "Neurology",
        "department": "Stroke and Neurovascular Service",
        "phone": "+1 (555) 210-1105",
        "email": "leila.hassan@hospital.demo",
        "availability": "Stroke escalation service",
    },
    "endocrinology": {
        "name": "Dr. Nina Kapoor",
        "specialization": "Endocrinology",
        "department": "Diabetes and Metabolic Medicine",
        "phone": "+1 (555) 210-1106",
        "email": "nina.kapoor@hospital.demo",
        "availability": "Weekday specialist clinic",
    },
    "nephrology": {
        "name": "Dr. Daniel Kim",
        "specialization": "Nephrology",
        "department": "Renal Medicine",
        "phone": "+1 (555) 210-1107",
        "email": "daniel.kim@hospital.demo",
        "availability": "Renal consult queue",
    },
    "hospital_medicine": {
        "name": "Dr. Olivia Grant",
        "specialization": "Hospital Medicine",
        "department": "General Inpatient Care",
        "phone": "+1 (555) 210-1108",
        "email": "olivia.grant@hospital.demo",
        "availability": "Coordinated ward follow-up",
    },
}

CONDITION_SPECIALTY_MAP = {
    "heart_disease_risk": "cardiology",
    "stroke_risk": "neurology",
    "sepsis_risk": "infectious_disease",
    "diabetes_complication_risk": "endocrinology",
}

CONDITION_LABELS = {
    "heart_disease_risk": "cardiac deterioration",
    "stroke_risk": "stroke risk",
    "sepsis_risk": "sepsis risk",
    "diabetes_complication_risk": "diabetes complication risk",
}


def _doctor_payload(specialty_key: str) -> dict[str, str]:
    return dict(DOCTOR_DIRECTORY[specialty_key])


def _top_condition(predicted_conditions: dict[str, Any]) -> tuple[str, float]:
    if not predicted_conditions:
        return ("", 0.0)
    name, score = max(predicted_conditions.items(), key=lambda item: float(item[1]))
    return str(name), round(float(score), 4)


def _append_reason(bucket: list[str], reason: str) -> None:
    if reason not in bucket:
        bucket.append(reason)


def build_doctor_recommendation(
    features: dict[str, float],
    prediction: dict[str, Any],
    triage: dict[str, Any],
    abnormal_findings: Sequence[dict[str, Any]],
) -> dict[str, Any]:
    scores = {specialty: 0.0 for specialty in DOCTOR_DIRECTORY}
    reasons = {specialty: [] for specialty in DOCTOR_DIRECTORY}
    predicted_conditions = prediction.get("predicted_conditions", {}) or {}

    def add_score(specialty: str, weight: float, reason: str) -> None:
        scores[specialty] += float(weight)
        _append_reason(reasons[specialty], reason)

    risk_level = str(prediction.get("risk_level", "LOW"))
    priority = str(triage.get("priority", "Routine"))
    oxygen_level = float(features.get("oxygen_level", 0.0))
    respiratory_rate = float(features.get("respiratory_rate", 0.0))
    systolic_bp = float(features.get("systolic_bp", 0.0))
    heart_rate = float(features.get("heart_rate", 0.0))
    age = float(features.get("age", 0.0))
    lactate = float(features.get("lactate", 0.0))
    sepsis_indicator = float(features.get("sepsis_indicator", 0.0))

    if risk_level == "HIGH":
        add_score("critical_care", 1.1, "High modeled risk needs urgent senior review.")
    elif risk_level == "MEDIUM":
        add_score("hospital_medicine", 0.3, "Moderate risk benefits from coordinated inpatient review.")

    if bool(prediction.get("icu_within_24h")) or priority == "Immediate":
        add_score("critical_care", 1.6, "Immediate escalation or ICU likelihood favors an intensivist.")
    elif priority == "Urgent":
        add_score("critical_care", 0.6, "Urgent triage benefits from critical care oversight.")

    if oxygen_level <= 92 or respiratory_rate >= 22:
        add_score("pulmonary", 0.9, "Respiratory compromise favors pulmonology input.")

    if (
        float(predicted_conditions.get("heart_disease_risk", 0.0)) >= 0.55
        or systolic_bp >= 160
        or heart_rate >= 110
        or float(features.get("prior_heart_disease", 0.0)) >= 1.0
    ):
        add_score("cardiology", 1.0, "Cardiovascular strain points toward cardiology.")

    if (
        float(predicted_conditions.get("stroke_risk", 0.0)) >= 0.55
        or (age >= 70 and systolic_bp >= 160)
    ):
        add_score("neurology", 0.85, "Neurovascular risk suggests neurologic review.")

    if (
        float(predicted_conditions.get("sepsis_risk", 0.0)) >= 0.55
        or sepsis_indicator >= 0.6
        or lactate >= 2.0
    ):
        add_score("infectious_disease", 1.0, "Sepsis-related findings favor infectious disease review.")

    if (
        float(predicted_conditions.get("diabetes_complication_risk", 0.0)) >= 0.55
        or float(features.get("diabetes", 0.0)) >= 1.0
    ):
        add_score("endocrinology", 0.6, "Diabetes-related risk supports endocrinology review.")

    if float(features.get("chronic_kidney_disease", 0.0)) >= 1.0:
        add_score("nephrology", 0.8, "Renal comorbidity supports nephrology involvement.")

    severe_findings = sum(1 for item in abnormal_findings if item.get("severity") == "severe")
    if severe_findings >= 2:
        add_score("critical_care", 0.9, "Multiple severe findings increase the need for ICU-level review.")

    top_condition, top_condition_score = _top_condition(predicted_conditions)
    mapped_specialty = CONDITION_SPECIALTY_MAP.get(top_condition)
    if mapped_specialty:
        label = CONDITION_LABELS.get(top_condition, top_condition.replace("_", " "))
        add_score(
            mapped_specialty,
            0.8,
            f"Top modeled signal is {label}.",
        )

    if not any(score > 0 for score in scores.values()):
        add_score("hospital_medicine", 0.5, "General inpatient follow-up is the best starting point.")

    ranked_specialties = sorted(
        scores.items(),
        key=lambda item: (item[1], item[0]),
        reverse=True,
    )
    best_specialty = ranked_specialties[0][0]
    backup_specialty = next(
        (
            specialty
            for specialty, score in ranked_specialties[1:]
            if specialty != best_specialty and score > 0
        ),
        "hospital_medicine" if best_specialty != "hospital_medicine" else "critical_care",
    )

    best_match = _doctor_payload(best_specialty)
    backup_match = _doctor_payload(backup_specialty)
    contact_recommended = bool(
        risk_level == "HIGH"
        or priority in {"Immediate", "Urgent"}
        or bool(prediction.get("icu_within_24h"))
    )

    if priority == "Immediate" or bool(prediction.get("icu_within_24h")):
        alert_level = "critical"
        alert_title = "High-risk escalation required"
    elif contact_recommended:
        alert_level = "elevated"
        alert_title = "Specialist contact recommended"
    else:
        alert_level = "watch"
        alert_title = "Specialist follow-up available"

    best_reasons = reasons.get(best_specialty, []) or ["Best overall match for the current risk profile."]
    alert_message = (
        f"Contact {best_match['name']} from {best_match['department']} now."
        if contact_recommended
        else f"Best follow-up match is {best_match['name']} from {best_match['department']}."
    )

    return {
        "contact_recommended": contact_recommended,
        "contact_urgency": priority if contact_recommended else "Routine",
        "best_match": best_match,
        "backup_match": backup_match,
        "reason": best_reasons[0],
        "supporting_reasons": best_reasons[:3],
        "top_condition": {
            "name": CONDITION_LABELS.get(top_condition, top_condition.replace("_", " ") if top_condition else ""),
            "score": top_condition_score,
        },
        "alert": {
            "visible": contact_recommended,
            "level": alert_level,
            "title": alert_title,
            "message": alert_message,
        },
    }
