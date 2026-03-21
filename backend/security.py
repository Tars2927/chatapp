import os
import threading
import time
from collections import defaultdict, deque
from pathlib import Path

from fastapi import HTTPException, Request, UploadFile, WebSocket, status

APP_ENV = os.getenv("APP_ENV", "development").strip().lower()
IS_PRODUCTION = APP_ENV == "production"
TRUST_PROXY = os.getenv("TRUST_PROXY", "false").strip().lower() == "true"
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(5 * 1024 * 1024)))
UPLOAD_ALLOWED_EXTENSIONS = {
    extension.strip().lower()
    for extension in os.getenv(
        "UPLOAD_ALLOWED_EXTENSIONS",
        ".jpg,.jpeg,.png,.gif,.webp,.pdf,.txt,.doc,.docx",
    ).split(",")
    if extension.strip()
}
UPLOAD_ALLOWED_MIME_PREFIXES = tuple(
    prefix.strip().lower()
    for prefix in os.getenv(
        "UPLOAD_ALLOWED_MIME_PREFIXES",
        "image/,application/pdf,text/plain,application/msword,"
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ).split(",")
    if prefix.strip()
)

_rate_limit_lock = threading.Lock()
_rate_limit_buckets = defaultdict(deque)

def parse_csv_env(name: str, default: str = "") -> list[str]:
    raw = os.getenv(name, default)
    return [item.strip() for item in raw.split(",") if item.strip()]

def get_allowed_origins() -> list[str]:
    if IS_PRODUCTION:
        return parse_csv_env("CORS_ALLOWED_ORIGINS")
    return parse_csv_env(
        "CORS_ALLOWED_ORIGINS",
        "http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:8000,http://localhost:8000",
    )

def get_allowed_hosts() -> list[str]:
    if IS_PRODUCTION:
        return parse_csv_env("ALLOWED_HOSTS")
    return parse_csv_env("ALLOWED_HOSTS", "127.0.0.1,localhost")

def validate_security_config(secret_key: str) -> None:
    if not secret_key or secret_key.startswith("replace-with"):
        raise RuntimeError("SECRET_KEY must be set to a real value.")

    if len(secret_key) < 32:
        raise RuntimeError("SECRET_KEY must be at least 32 characters long.")

    if IS_PRODUCTION:
        if not get_allowed_origins():
            raise RuntimeError("CORS_ALLOWED_ORIGINS must be set in production.")
        if not get_allowed_hosts():
            raise RuntimeError("ALLOWED_HOSTS must be set in production.")

def get_client_ip(connection: Request | WebSocket) -> str:
    if TRUST_PROXY:
        forwarded = connection.headers.get("x-forwarded-for", "")
        if forwarded:
            return forwarded.split(",")[0].strip()

    client = connection.client
    return client.host if client else "unknown"

def enforce_rate_limit(
    connection: Request | WebSocket,
    *,
    scope: str,
    limit: int,
    window_seconds: int,
    subject: str | None = None,
) -> None:
    now = time.time()
    identity = subject or get_client_ip(connection)
    bucket_key = f"{scope}:{identity}"

    with _rate_limit_lock:
        bucket = _rate_limit_buckets[bucket_key]
        while bucket and now - bucket[0] > window_seconds:
            bucket.popleft()

        if len(bucket) >= limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please try again later.",
            )

        bucket.append(now)

def validate_upload(file: UploadFile) -> None:
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A file is required.",
        )

    extension = Path(file.filename).suffix.lower()
    if extension not in UPLOAD_ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="That file type is not allowed.",
        )

    content_type = (file.content_type or "").lower()
    if not any(
        content_type == prefix or content_type.startswith(prefix)
        for prefix in UPLOAD_ALLOWED_MIME_PREFIXES
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="That upload content type is not allowed.",
        )

    stream = file.file
    current_position = stream.tell()
    stream.seek(0, os.SEEK_END)
    size = stream.tell()
    stream.seek(current_position)

    if size > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)}MB upload limit.",
        )
