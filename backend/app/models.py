from __future__ import annotations

from datetime import datetime, timezone

from .extensions import db


class PatientAssessment(db.Model):
    __tablename__ = "patient_assessments"

    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.String(80), nullable=False, index=True)
    input_data = db.Column(db.JSON, nullable=False)
    risk_score = db.Column(db.Float, nullable=False, index=True)
    risk_level = db.Column(db.String(10), nullable=False, index=True)
    predicted_conditions = db.Column(db.JSON, nullable=False)
    icu_within_24h = db.Column(db.Boolean, nullable=False, default=False)
    explanation = db.Column(db.JSON, nullable=False)
    alert_sent = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "patient_id": self.patient_id,
            "input_data": self.input_data,
            "risk_score": round(float(self.risk_score), 4),
            "risk_level": self.risk_level,
            "predicted_conditions": self.predicted_conditions,
            "icu_within_24h": self.icu_within_24h,
            "explanation": self.explanation,
            "alert_sent": self.alert_sent,
            "created_at": self.created_at.isoformat(),
        }


class AuditEvent(db.Model):
    __tablename__ = "audit_events"

    id = db.Column(db.Integer, primary_key=True)
    request_id = db.Column(db.String(64), nullable=False, index=True)
    actor_id = db.Column(db.String(120), nullable=False, index=True)
    actor_role = db.Column(db.String(40), nullable=False, index=True)
    action = db.Column(db.String(80), nullable=False, index=True)
    resource_type = db.Column(db.String(80), nullable=False, index=True)
    resource_id = db.Column(db.String(120), nullable=True, index=True)
    status_code = db.Column(db.Integer, nullable=False)
    ip_address = db.Column(db.String(64), nullable=False)
    details = db.Column(db.JSON, nullable=False, default=dict)
    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "request_id": self.request_id,
            "actor_id": self.actor_id,
            "actor_role": self.actor_role,
            "action": self.action,
            "resource_type": self.resource_type,
            "resource_id": self.resource_id,
            "status_code": self.status_code,
            "ip_address": self.ip_address,
            "details": self.details,
            "created_at": self.created_at.isoformat(),
        }
