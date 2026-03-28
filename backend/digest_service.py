from datetime import datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from models import Message, User
from schemas import DigestPreview


DIGEST_INACTIVITY_HOURS = 24
DIGEST_COOLDOWN_HOURS = 24


def touch_user_activity(user: User, db: Session) -> None:
    user.last_active_at = datetime.now(timezone.utc)
    db.add(user)


def get_unread_count(db: Session, user: User) -> int:
    query = db.query(func.count(Message.id)).filter(
        Message.is_deleted.is_(False),
        Message.sender_id != user.id,
    )

    if user.last_read_message_id:
        query = query.filter(Message.id > user.last_read_message_id)

    return int(query.scalar() or 0)


def build_digest_preview(db: Session, user: User) -> DigestPreview:
    unread_count = get_unread_count(db, user)
    threshold = max(int(user.digest_min_unread_count or 1), 1)
    now = datetime.now(timezone.utc)
    last_active_at = user.last_active_at
    last_digest_sent_at = user.last_digest_sent_at
    hours_since_last_active = None

    if last_active_at is not None:
        if last_active_at.tzinfo is None:
            last_active_at = last_active_at.replace(tzinfo=timezone.utc)
        hours_since_last_active = round((now - last_active_at).total_seconds() / 3600, 2)

    digest_cooldown_elapsed = (
        last_digest_sent_at is None
        or (now - (last_digest_sent_at if last_digest_sent_at.tzinfo else last_digest_sent_at.replace(tzinfo=timezone.utc)))
        >= timedelta(hours=DIGEST_COOLDOWN_HOURS)
    )
    inactive_long_enough = hours_since_last_active is not None and hours_since_last_active >= DIGEST_INACTIVITY_HOURS
    should_send_digest = (
        user.email_notifications_enabled
        and unread_count >= threshold
        and inactive_long_enough
        and digest_cooldown_elapsed
    )

    return DigestPreview(
        email_notifications_enabled=user.email_notifications_enabled,
        digest_min_unread_count=threshold,
        unread_count=unread_count,
        hours_since_last_active=hours_since_last_active,
        last_digest_sent_at=user.last_digest_sent_at,
        should_send_digest=should_send_digest,
    )


def get_digest_candidates(db: Session) -> list[tuple[User, DigestPreview]]:
    candidates: list[tuple[User, DigestPreview]] = []
    users = db.query(User).filter(User.is_approved.is_(True)).all()

    for user in users:
        preview = build_digest_preview(db, user)
        if preview.should_send_digest:
            candidates.append((user, preview))

    return candidates


def mark_digest_sent(user: User, db: Session) -> None:
    user.last_digest_sent_at = datetime.now(timezone.utc)
    db.add(user)


def render_digest_subject(unread_count: int) -> str:
    noun = "message" if unread_count == 1 else "messages"
    return f"You have {unread_count} unread {noun} on Baithak"


def render_digest_html(username: str, unread_count: int, chat_url: str) -> str:
    noun = "message" if unread_count == 1 else "messages"
    return f"""
    <div style=\"font-family:Arial,sans-serif;line-height:1.6;color:#1c1b1f;max-width:560px;margin:0 auto;padding:24px;\">
      <p style=\"margin:0 0 12px;font-size:14px;letter-spacing:0.08em;text-transform:uppercase;color:#8f4f17;\">Baithak</p>
      <h1 style=\"margin:0 0 16px;font-size:28px;line-height:1.1;\">You have {unread_count} unread {noun}</h1>
      <p style=\"margin:0 0 16px;font-size:16px;color:#4b3a2f;\">Hi {username}, your room has been active while you were away.</p>
      <p style=\"margin:0 0 24px;font-size:16px;color:#4b3a2f;\">Open Baithak to catch up on the latest conversation.</p>
      <a href=\"{chat_url}\" style=\"display:inline-block;padding:12px 18px;border-radius:999px;background:#8f4f17;color:#fff8f1;text-decoration:none;font-weight:700;\">Open Baithak</a>
      <p style=\"margin:24px 0 0;font-size:13px;color:#7b6b60;\">You can tune digest thresholds or turn off email reminders from notification settings.</p>
    </div>
    """.strip()


def render_digest_text(username: str, unread_count: int, chat_url: str) -> str:
    noun = "message" if unread_count == 1 else "messages"
    return (
        f"Hi {username},\n\n"
        f"You have {unread_count} unread {noun} on Baithak.\n"
        f"Open the app to catch up: {chat_url}\n\n"
        "If you do not want reminder emails later, you can tune digest thresholds or turn them off from notification settings."
    )
