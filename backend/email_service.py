import os

from dotenv import load_dotenv


load_dotenv()


def _require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def send_email(to_email: str, subject: str, html: str, text: str, tags: list[dict] | None = None) -> dict:
    try:
        import resend
    except ModuleNotFoundError as exc:
        raise RuntimeError(
            "The resend package is not installed. Add it to the backend environment before sending emails."
        ) from exc

    resend.api_key = _require_env("RESEND_API_KEY")
    from_email = _require_env("RESEND_FROM_EMAIL")
    reply_to = os.getenv("RESEND_REPLY_TO_EMAIL", "").strip()

    params: resend.Emails.SendParams = {
        "from": from_email,
        "to": [to_email],
        "subject": subject,
        "html": html,
        "text": text,
    }

    if reply_to:
        params["reply_to"] = reply_to

    if tags:
        params["tags"] = tags

    return resend.Emails.send(params)
