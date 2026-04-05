import os

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app_paths import is_desktop_mode
from auth import create_access_token, get_current_user, get_password_hash, verify_password
from database import get_db
from digest_service import build_digest_preview, touch_user_activity
from models import Message, User
from schemas import (
    DigestPreview,
    EmailVerificationRequest,
    EmailVerificationResendRequest,
    EmailVerificationStatus,
    NotificationPreferencesOut,
    NotificationPreferencesUpdate,
    RegistrationStatus,
    Token,
    UserCreate,
    UserLogin,
    UserOut,
)
from security import enforce_rate_limit, validate_upload
from upload_service import upload_file_to_storage
from verification_service import (
    clear_email_verification_state,
    is_email_verification_otp_expired,
    is_email_verification_required,
    issue_email_verification_otp,
    seconds_until_email_otp_resend,
    verify_email_verification_otp,
)


router = APIRouter(tags=["auth"])


def _normalize_email(value: str) -> str:
    return value.strip().lower()


def _auth_error(code: str, message: str) -> dict:
    return {"code": code, "message": message}


def _registration_status(user: User, *, requires_verification: bool) -> RegistrationStatus:
    return RegistrationStatus(
        email=user.email,
        requires_verification=requires_verification and not user.email_verified,
        pending_approval=not user.is_approved,
    )


@router.post("/register", response_model=RegistrationStatus, status_code=status.HTTP_201_CREATED)
def register_user(payload: UserCreate, request: Request, db: Session = Depends(get_db)):
    enforce_rate_limit(request, scope="register", limit=5, window_seconds=600)

    normalized_email = _normalize_email(payload.email)
    normalized_username = payload.username.strip()

    existing_user = (
        db.query(User)
        .filter(or_(User.email == normalized_email, User.username == normalized_username))
        .first()
    )
    if existing_user:
        conflict_field = "email" if existing_user.email == normalized_email else "username"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A user with that {conflict_field} already exists.",
        )

    existing_user_count = db.query(User).count()
    desktop_mode = is_desktop_mode()
    email_verification_required = is_email_verification_required()
    admin_email = os.getenv("ADMIN_EMAIL", "").strip().lower()
    is_seed_admin = bool(admin_email and normalized_email == admin_email)
    latest_message_id = db.query(func.max(Message.id)).filter(Message.is_deleted.is_(False)).scalar()
    user = User(
        username=normalized_username,
        email=normalized_email,
        hashed_password=get_password_hash(payload.password),
        email_verified=not email_verification_required,
        is_approved=True if desktop_mode or is_seed_admin else False,
        is_admin=True if (desktop_mode and existing_user_count == 0) or is_seed_admin else False,
        last_read_message_id=latest_message_id,
    )
    db.add(user)

    try:
        if email_verification_required:
            issue_email_verification_otp(user)
        db.commit()
    except RuntimeError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    db.refresh(user)
    return _registration_status(user, requires_verification=email_verification_required)


@router.post("/verify-email-otp", response_model=EmailVerificationStatus)
def verify_email_otp(
    payload: EmailVerificationRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    normalized_email = _normalize_email(payload.email)
    otp_code = payload.otp.strip()

    enforce_rate_limit(
        request,
        scope="verify_email_otp",
        limit=10,
        window_seconds=600,
        subject=normalized_email,
    )

    if not otp_code.isdigit() or len(otp_code) != 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Enter the 6-digit verification code from your email.",
        )

    user = db.query(User).filter(User.email == normalized_email).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    if user.email_verified:
        return EmailVerificationStatus(
            email=user.email,
            email_verified=True,
            pending_approval=not user.is_approved,
        )

    if is_email_verification_otp_expired(user):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="That verification code has expired. Request a new one and try again.",
        )

    if not verify_email_verification_otp(user, otp_code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="That verification code is invalid.",
        )

    user.email_verified = True
    clear_email_verification_state(user)
    db.commit()
    db.refresh(user)

    return EmailVerificationStatus(
        email=user.email,
        email_verified=user.email_verified,
        pending_approval=not user.is_approved,
    )


@router.post("/resend-email-otp", response_model=RegistrationStatus)
def resend_email_otp(
    payload: EmailVerificationResendRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    normalized_email = _normalize_email(payload.email)

    enforce_rate_limit(
        request,
        scope="resend_email_otp",
        limit=5,
        window_seconds=600,
        subject=normalized_email,
    )

    user = db.query(User).filter(User.email == normalized_email).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    if user.email_verified:
        return _registration_status(user, requires_verification=False)

    remaining_seconds = seconds_until_email_otp_resend(user)
    if remaining_seconds > 0:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Please wait {remaining_seconds} seconds before requesting another code.",
        )

    try:
        issue_email_verification_otp(user)
        db.commit()
    except RuntimeError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    db.refresh(user)
    return _registration_status(user, requires_verification=True)


@router.post("/login", response_model=Token)
def login_user(payload: UserLogin, request: Request, db: Session = Depends(get_db)):
    normalized_email = _normalize_email(payload.email)

    enforce_rate_limit(
        request,
        scope="login",
        limit=10,
        window_seconds=300,
        subject=normalized_email,
    )

    user = db.query(User).filter(User.email == normalized_email).first()
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if not user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=_auth_error(
                "email_not_verified",
                "Verify your email with the OTP sent to your inbox before logging in.",
            ),
        )

    if not user.is_approved:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=_auth_error(
                "account_pending_approval",
                "Your account is pending approval. Please wait for an admin to approve it.",
            ),
        )

    touch_user_activity(user, db)
    db.commit()
    db.refresh(user)

    access_token = create_access_token({"sub": str(user.id), "email": user.email})
    return Token(access_token=access_token, user=user)


@router.post("/me/avatar", response_model=UserOut)
def upload_avatar(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    enforce_rate_limit(request, scope="avatar_upload", limit=10, window_seconds=600)
    validate_upload(file)

    result = upload_file_to_storage(file, folder="avatars", require_image=True)
    current_user.avatar_url = result["file_url"]
    touch_user_activity(current_user, db)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.delete("/me/avatar", response_model=UserOut)
def clear_avatar(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    enforce_rate_limit(request, scope="avatar_remove", limit=20, window_seconds=600)
    current_user.avatar_url = None
    touch_user_activity(current_user, db)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/me/notifications", response_model=NotificationPreferencesOut)
def get_notification_preferences(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    enforce_rate_limit(request, scope="notification_preferences", limit=120, window_seconds=60)
    db.refresh(current_user)
    return NotificationPreferencesOut(
        email_notifications_enabled=current_user.email_notifications_enabled,
        digest_min_unread_count=current_user.digest_min_unread_count,
        last_active_at=current_user.last_active_at,
        last_digest_sent_at=current_user.last_digest_sent_at,
    )


@router.patch("/me/notifications", response_model=NotificationPreferencesOut)
def update_notification_preferences(
    payload: NotificationPreferencesUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    enforce_rate_limit(request, scope="notification_preferences_update", limit=60, window_seconds=60)
    current_user.email_notifications_enabled = payload.email_notifications_enabled
    current_user.digest_min_unread_count = payload.digest_min_unread_count
    touch_user_activity(current_user, db)
    db.commit()
    db.refresh(current_user)
    return NotificationPreferencesOut(
        email_notifications_enabled=current_user.email_notifications_enabled,
        digest_min_unread_count=current_user.digest_min_unread_count,
        last_active_at=current_user.last_active_at,
        last_digest_sent_at=current_user.last_digest_sent_at,
    )


@router.get("/me/digest-preview", response_model=DigestPreview)
def get_digest_preview(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    enforce_rate_limit(request, scope="digest_preview", limit=120, window_seconds=60)
    db.refresh(current_user)
    return build_digest_preview(db, current_user)
