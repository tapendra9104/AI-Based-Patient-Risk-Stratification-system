from __future__ import annotations

from collections import Counter
from typing import Any, Sequence

from ..models import PatientAssessment
from ..time_utils import as_utc_isoformat


def _risk_distribution(records: Sequence[PatientAssessment]) -> dict[str, int]:
    counts = Counter(record.risk_level for record in records)
    return {
        "LOW": int(counts.get("LOW", 0)),
        "MEDIUM": int(counts.get("MEDIUM", 0)),
        "HIGH": int(counts.get("HIGH", 0)),
    }


def _safe_average(values: list[float]) -> float:
    if not values:
        return 0.0
    return round(sum(values) / len(values), 4)


def build_operational_summary(records: Sequence[PatientAssessment]) -> dict[str, Any]:
    distribution = _risk_distribution(records)
    scores = [float(record.risk_score) for record in records]
    highest = max(records, key=lambda record: float(record.risk_score), default=None)
    latest = records[0] if records else None
    high_risk_records = sorted(
        (record for record in records if record.risk_level == "HIGH"),
        key=lambda record: (float(record.risk_score), record.created_at),
        reverse=True,
    )

    total = len(records)
    high_risk_count = distribution["HIGH"]

    return {
        "assessment_count": total,
        "unique_patients": len({record.patient_id for record in records}),
        "average_risk_score": _safe_average(scores),
        "risk_distribution": distribution,
        "high_risk_count": high_risk_count,
        "high_risk_rate": round((high_risk_count / total), 4) if total else 0.0,
        "icu_likely_count": sum(1 for record in records if record.icu_within_24h),
        "alerts_sent_count": sum(1 for record in records if record.alert_sent),
        "latest_assessed_at": as_utc_isoformat(latest.created_at) if latest else None,
        "highest_risk_patient": (
            {
                "patient_id": highest.patient_id,
                "risk_score": round(float(highest.risk_score), 4),
                "risk_level": highest.risk_level,
                "created_at": as_utc_isoformat(highest.created_at),
            }
            if highest
            else None
        ),
        "recent_high_risk": [
            {
                "patient_id": record.patient_id,
                "risk_score": round(float(record.risk_score), 4),
                "created_at": as_utc_isoformat(record.created_at),
                "icu_within_24h": record.icu_within_24h,
            }
            for record in high_risk_records[:5]
        ],
    }


def build_patient_timeline(
    patient_id: str,
    records: Sequence[PatientAssessment],
) -> dict[str, Any]:
    ordered_records = sorted(records, key=lambda record: record.created_at)
    distribution = _risk_distribution(ordered_records)

    items: list[dict[str, Any]] = []
    previous_score: float | None = None
    for record in ordered_records:
        score = round(float(record.risk_score), 4)
        delta = None if previous_score is None else round(score - previous_score, 4)
        direction = "baseline"
        if delta is not None:
            if delta > 0.03:
                direction = "rising"
            elif delta < -0.03:
                direction = "falling"
            else:
                direction = "stable"

        items.append(
            {
                "assessment_id": record.id,
                "created_at": as_utc_isoformat(record.created_at),
                "risk_score": score,
                "risk_level": record.risk_level,
                "icu_within_24h": record.icu_within_24h,
                "alert_sent": record.alert_sent,
                "delta_from_previous": delta,
                "trend_direction": direction,
            }
        )
        previous_score = score

    latest = ordered_records[-1] if ordered_records else None
    previous = ordered_records[-2] if len(ordered_records) >= 2 else None

    consecutive_high = 0
    for record in reversed(ordered_records):
        if record.risk_level != "HIGH":
            break
        consecutive_high += 1

    score_delta = None
    trend_direction = "baseline"
    if latest and previous:
        score_delta = round(float(latest.risk_score) - float(previous.risk_score), 4)
        if score_delta > 0.03:
            trend_direction = "rising"
        elif score_delta < -0.03:
            trend_direction = "falling"
        else:
            trend_direction = "stable"

    return {
        "patient_id": patient_id,
        "assessment_count": len(ordered_records),
        "average_risk_score": _safe_average([float(record.risk_score) for record in ordered_records]),
        "risk_distribution": distribution,
        "latest_assessment": (
            {
                "assessment_id": latest.id,
                "created_at": as_utc_isoformat(latest.created_at),
                "risk_score": round(float(latest.risk_score), 4),
                "risk_level": latest.risk_level,
                "icu_within_24h": latest.icu_within_24h,
                "alert_sent": latest.alert_sent,
            }
            if latest
            else None
        ),
        "trajectory": {
            "direction": trend_direction,
            "delta_from_previous": score_delta,
            "consecutive_high_risk": consecutive_high,
            "requires_attention": bool(
                latest and (latest.risk_level == "HIGH" or latest.icu_within_24h)
            ),
        },
        "items": items,
    }
