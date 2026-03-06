from __future__ import annotations


BASELINES = {
    "age": 50.0,
    "systolic_bp": 120.0,
    "diastolic_bp": 80.0,
    "heart_rate": 80.0,
    "oxygen_level": 95.0,
    "cholesterol": 185.0,
    "respiratory_rate": 16.0,
    "temperature": 37.0,
    "lactate": 1.5,
    "sepsis_indicator": 0.2,
    "diabetes": 0.0,
    "prior_heart_disease": 0.0,
    "chronic_kidney_disease": 0.0,
    "smoker": 0.0,
}

SCALES = {
    "age": 18.0,
    "systolic_bp": 30.0,
    "diastolic_bp": 15.0,
    "heart_rate": 20.0,
    "oxygen_level": 4.0,
    "cholesterol": 50.0,
    "respiratory_rate": 6.0,
    "temperature": 1.0,
    "lactate": 1.0,
    "sepsis_indicator": 0.3,
    "diabetes": 1.0,
    "prior_heart_disease": 1.0,
    "chronic_kidney_disease": 1.0,
    "smoker": 1.0,
}

INVERTED_FEATURES = {"oxygen_level"}


def _feature_label(feature_name: str) -> str:
    return feature_name.replace("_", " ").title()


def summarize_risk_factors(
    features: dict[str, float], artifact: dict, top_n: int = 4
) -> list[dict]:
    model = artifact["model"].named_steps["classifier"]
    importances = model.feature_importances_
    feature_order = artifact["feature_order"]

    rows: list[dict] = []
    for feature_name, importance in zip(feature_order, importances):
        raw_value = float(features[feature_name])
        baseline = BASELINES[feature_name]
        scale = SCALES[feature_name]
        normalized_delta = (raw_value - baseline) / scale
        if feature_name in INVERTED_FEATURES:
            normalized_delta *= -1
        impact = float(importance) * normalized_delta

        rows.append(
            {
                "feature": _feature_label(feature_name),
                "value": round(raw_value, 3),
                "impact": round(impact, 4),
            }
        )

    rows.sort(key=lambda item: abs(item["impact"]), reverse=True)
    return rows[:top_n]
