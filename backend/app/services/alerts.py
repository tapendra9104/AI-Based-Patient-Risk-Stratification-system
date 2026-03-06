from __future__ import annotations

from typing import Mapping

import requests


def _build_alert_message(assessment: dict) -> str:
    return (
        f"High Risk Patient Alert\n"
        f"Patient ID: {assessment['patient_id']}\n"
        f"Risk Score: {assessment['risk_score']}\n"
        f"Risk Level: {assessment['risk_level']}\n"
        f"ICU within 24h: {assessment['icu_within_24h']}"
    )


def _send_via_twilio(message: str, config: Mapping[str, object]) -> bool:
    account_sid = str(config.get("TWILIO_ACCOUNT_SID", ""))
    auth_token = str(config.get("TWILIO_AUTH_TOKEN", ""))
    from_number = str(config.get("TWILIO_WHATSAPP_FROM", ""))
    to_number = str(config.get("TWILIO_WHATSAPP_TO", ""))

    if not all([account_sid, auth_token, from_number, to_number]):
        return False

    url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
    payload = {
        "From": f"whatsapp:{from_number}",
        "To": f"whatsapp:{to_number}",
        "Body": message,
    }

    try:
        response = requests.post(
            url,
            data=payload,
            auth=(account_sid, auth_token),
            timeout=10,
        )
    except requests.RequestException:
        return False

    return response.ok


def send_high_risk_alert(assessment: dict, config: Mapping[str, object]) -> bool:
    if assessment["risk_level"] != "HIGH":
        return False

    provider = str(config.get("ALERT_PROVIDER", "console")).lower()
    message = _build_alert_message(assessment)

    if provider == "twilio":
        return _send_via_twilio(message, config)

    target = str(config.get("ALERT_TARGET", "oncall-doctor"))
    print(f"[ALERT -> {target}] {message}")
    return True
