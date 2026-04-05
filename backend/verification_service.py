import math
import os
import secrets
from datetime import datetime, timedelta, timezone

from app_paths import is_desktop_mode
from auth import get_password_hash, verify_password
from email_service import send_email


EMAIL_OTP_EXPIRE_MINUTES = int(os.getenv("EMAIL_OTP_EXPIRE_MINUTES", "10"))
EMAIL_OTP_RESEND_COOLDOWN_SECONDS = int(os.getenv("EMAIL_OTP_RESEND_COOLDOWN_SECONDS", "60"))
EMAIL_OTP_DELIVERY = os.getenv("EMAIL_OTP_DELIVERY", "").strip().lower()
_TRUE_VALUES = {"1", "true", "yes", "on"}


def _normalize_datetime(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def is_email_verification_required() -> bool:
    configured = os.getenv("EMAIL_OTP_REQUIRED", "").strip().lower()
    if configured:
        return configured in _TRUE_VALUES
    return not is_desktop_mode()


def _is_console_delivery_enabled() -> bool:
    return EMAIL_OTP_DELIVERY == "console"


def is_email_delivery_available() -> bool:
    if _is_console_delivery_enabled():
        return True

    resend_api_key = os.getenv("RESEND_API_KEY", "").strip()
    resend_from_email = os.getenv("RESEND_FROM_EMAIL", "").strip()
    return bool(resend_api_key and resend_from_email)


def ensure_email_delivery_available() -> None:
    if is_email_delivery_available():
        return

    raise RuntimeError(
        "Email OTP delivery is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL, "
        "or use EMAIL_OTP_DELIVERY=console for local development."
    )


def _generate_otp() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def _send_email_otp(to_email: str, otp_code: str) -> None:
    if _is_console_delivery_enabled():
        print(f"[EMAIL OTP] {to_email}: {otp_code}")
        return

    subject = "Your Baithak verification code"
    html = (
        "<div style=\"font-family:Arial,sans-serif;color:#1c1b1f;line-height:1.6;\">"
        "<h2 style=\"margin:0 0 12px;\">Verify your Baithak email</h2>"
        "<p style=\"margin:0 0 16px;\">Use this one-time code to finish setting up your account:</p>"
        f"<p style=\"margin:0 0 16px;font-size:28px;font-weight:700;letter-spacing:0.24em;\">{otp_code}</p>"
        f"<p style=\"margin:0;color:#574335;\">This code expires in {EMAIL_OTP_EXPIRE_MINUTES} minutes.</p>"
        "</div>"
    )
    text = (
        f"Your Baithak verification code is {otp_code}. "
        f"It expires in {EMAIL_OTP_EXPIRE_MINUTES} minutes."
    )

    send_email(
        to_email=to_email,
        subject=subject,
        html=html,
        text=text,
        tags=[{"name": "category", "value": "email-verification"}],
    )


def issue_email_verification_otp(user) -> None:
    ensure_email_delivery_available()

    otp_code = _generate_otp()
    now = datetime.now(timezone.utc)

    user.email_verification_otp_hash = get_password_hash(otp_code)
    user.email_verification_expires_at = now + timedelta(minutes=EMAIL_OTP_EXPIRE_MINUTES)
    user.email_verification_sent_at = now

    _send_email_otp(user.email, otp_code)


def is_email_verification_otp_expired(user) -> bool:
    expires_at = _normalize_datetime(user.email_verification_expires_at)
    if expires_at is None:
        return True
    return expires_at < datetime.now(timezone.utc)


def verify_email_verification_otp(user, otp_code: str) -> bool:
    if not user.email_verification_otp_hash or is_email_verification_otp_expired(user):
        return False
    return verify_password(otp_code, user.email_verification_otp_hash)


def clear_email_verification_state(user) -> None:
    user.email_verification_otp_hash = None
    user.email_verification_expires_at = None
    user.email_verification_sent_at = None


def seconds_until_email_otp_resend(user) -> int:
    sent_at = _normalize_datetime(user.email_verification_sent_at)
    if sent_at is None:
        return 0

    remaining_seconds = (
        sent_at + timedelta(seconds=EMAIL_OTP_RESEND_COOLDOWN_SECONDS) - datetime.now(timezone.utc)
    ).total_seconds()
    return max(0, math.ceil(remaining_seconds))
