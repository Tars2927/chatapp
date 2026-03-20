import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

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
        connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_approved BOOLEAN"))
        connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN"))
        connection.execute(text("ALTER TABLE messages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ"))
        connection.execute(text("ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN"))
        connection.execute(text("UPDATE users SET is_approved = TRUE WHERE is_approved IS NULL"))
        connection.execute(text("UPDATE users SET is_admin = FALSE WHERE is_admin IS NULL"))
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


@app.get("/")
def read_root():
    return {"message": "Baithak Backend is running."}
