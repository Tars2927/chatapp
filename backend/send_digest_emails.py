import os
from pathlib import Path

from dotenv import load_dotenv

from database import SessionLocal
from digest_service import (
    get_digest_candidates,
    mark_digest_sent,
    render_digest_html,
    render_digest_subject,
    render_digest_text,
)
from email_service import send_email


load_dotenv()


def resolve_chat_url() -> str:
    configured = os.getenv("BAITHAK_CHAT_URL", "").strip()
    if configured:
        return configured.rstrip("/")
    return "http://127.0.0.1:5173/chat"


def run() -> int:
    dry_run = os.getenv("DIGEST_DRY_RUN", "false").strip().lower() in {"1", "true", "yes"}
    chat_url = resolve_chat_url()
    db = SessionLocal()
    sent = 0
    skipped = 0

    try:
        candidates = get_digest_candidates(db)
        print(f"Digest candidates: {len(candidates)}")

        for user, preview in candidates:
            subject = render_digest_subject(preview.unread_count)
            html = render_digest_html(user.username, preview.unread_count, chat_url)
            text = render_digest_text(user.username, preview.unread_count, chat_url)

            if dry_run:
                print(f"[DRY RUN] Would send digest to {user.email} ({preview.unread_count} unread)")
                skipped += 1
                continue

            try:
                response = send_email(
                    to_email=user.email,
                    subject=subject,
                    html=html,
                    text=text,
                    tags=[
                        {"name": "type", "value": "digest"},
                        {"name": "app", "value": "baithak"},
                    ],
                )
                mark_digest_sent(user, db)
                db.commit()
                sent += 1
                print(f"Sent digest to {user.email}: {response}")
            except Exception as exc:
                db.rollback()
                print(f"Failed to send digest to {user.email}: {exc}")

        print(f"Digest run complete. sent={sent} dry_run_skipped={skipped}")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(run())
