import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app_paths import get_frontend_dist_dir, get_uploads_dir
from auth import SECRET_KEY
from database import Base, engine
from routers.admin_router import router as admin_router
from routers.auth_router import router as auth_router
from routers.messages import router as messages_router
from routers.ws import router as ws_router
from security import get_allowed_hosts, get_allowed_origins, validate_security_config


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
        response.headers["Cross-Origin-Resource-Policy"] = "cross-origin"
        if request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response


def ensure_user_access_columns() -> None:
    admin_email = os.getenv("ADMIN_EMAIL", "").strip().lower()

    with engine.begin() as connection:
        user_columns = {column["name"] for column in inspect(connection).get_columns("users")}
        message_columns = {column["name"] for column in inspect(connection).get_columns("messages")}

        def add_column_if_missing(table_name: str, column_name: str, definition: str, existing: set[str]) -> None:
            if column_name in existing:
                return
            connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {definition}"))
            existing.add(column_name)

        add_column_if_missing("users", "avatar_url", "avatar_url TEXT", user_columns)
        add_column_if_missing("users", "email_verified", "email_verified BOOLEAN", user_columns)
        add_column_if_missing(
            "users",
            "email_verification_otp_hash",
            "email_verification_otp_hash TEXT",
            user_columns,
        )
        add_column_if_missing(
            "users",
            "email_verification_expires_at",
            "email_verification_expires_at TIMESTAMPTZ",
            user_columns,
        )
        add_column_if_missing(
            "users",
            "email_verification_sent_at",
            "email_verification_sent_at TIMESTAMPTZ",
            user_columns,
        )
        add_column_if_missing("users", "is_approved", "is_approved BOOLEAN", user_columns)
        add_column_if_missing("users", "is_admin", "is_admin BOOLEAN", user_columns)
        add_column_if_missing(
            "users",
            "email_notifications_enabled",
            "email_notifications_enabled BOOLEAN",
            user_columns,
        )
        add_column_if_missing(
            "users",
            "digest_min_unread_count",
            "digest_min_unread_count INTEGER",
            user_columns,
        )
        add_column_if_missing("users", "last_read_message_id", "last_read_message_id INTEGER", user_columns)
        add_column_if_missing("users", "last_active_at", "last_active_at TIMESTAMPTZ", user_columns)
        add_column_if_missing("users", "last_digest_sent_at", "last_digest_sent_at TIMESTAMPTZ", user_columns)
        add_column_if_missing("messages", "updated_at", "updated_at TIMESTAMPTZ", message_columns)
        add_column_if_missing("messages", "is_deleted", "is_deleted BOOLEAN", message_columns)
        connection.execute(text("UPDATE users SET email_verified = TRUE WHERE email_verified IS NULL"))
        connection.execute(text("UPDATE users SET is_approved = TRUE WHERE is_approved IS NULL"))
        connection.execute(text("UPDATE users SET is_admin = FALSE WHERE is_admin IS NULL"))
        connection.execute(text("UPDATE users SET email_notifications_enabled = TRUE WHERE email_notifications_enabled IS NULL"))
        connection.execute(text("UPDATE users SET digest_min_unread_count = 1 WHERE digest_min_unread_count IS NULL OR digest_min_unread_count < 1"))
        connection.execute(text("UPDATE users SET last_active_at = COALESCE(last_active_at, created_at, CURRENT_TIMESTAMP)"))
        connection.execute(text("UPDATE messages SET is_deleted = FALSE WHERE is_deleted IS NULL"))
        if admin_email:
            connection.execute(
                text("UPDATE users SET is_admin = TRUE, is_approved = TRUE WHERE lower(email) = :email"),
                {"email": admin_email},
            )


@asynccontextmanager
async def lifespan(_: FastAPI):
    validate_security_config(SECRET_KEY)
    Base.metadata.create_all(bind=engine)
    ensure_user_access_columns()
    yield


def resolve_frontend_asset(path: str) -> Path | None:
    frontend_dist = get_frontend_dist_dir()
    if not frontend_dist.exists():
        return None

    cleaned = path.strip("/")
    target = (frontend_dist / cleaned).resolve() if cleaned else (frontend_dist / "index.html").resolve()

    try:
        target.relative_to(frontend_dist.resolve())
    except ValueError:
        return None

    if target.is_file():
        return target

    index_file = frontend_dist / "index.html"
    return index_file if index_file.exists() else None


app = FastAPI(title="Baithak Backend", lifespan=lifespan)
allowed_hosts = get_allowed_hosts()
allowed_origins = get_allowed_origins()

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=allowed_hosts if allowed_hosts else ["*"])
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(messages_router)
app.include_router(ws_router)

uploads_dir = get_uploads_dir()
if uploads_dir.exists():
    app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")


@app.get("/health")
def health_check():
    return {"message": "Baithak Backend is running."}


@app.get("/{full_path:path}")
def serve_frontend(full_path: str):
    asset = resolve_frontend_asset(full_path)
    if asset is not None:
        return FileResponse(asset)

    return {"message": "Baithak Backend is running."}
