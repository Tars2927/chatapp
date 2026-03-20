from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from auth import create_access_token, get_password_hash, verify_password
from database import get_db
from models import User
from schemas import Token, UserCreate, UserLogin, UserOut
from security import enforce_rate_limit


router = APIRouter(tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register_user(payload: UserCreate, request: Request, db: Session = Depends(get_db)):
    enforce_rate_limit(request, scope="register", limit=5, window_seconds=600)

    normalized_email = payload.email.strip().lower()
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

    user = User(
        username=normalized_username,
        email=normalized_email,
        hashed_password=get_password_hash(payload.password),
        is_approved=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
def login_user(payload: UserLogin, request: Request, db: Session = Depends(get_db)):
    enforce_rate_limit(
        request,
        scope="login",
        limit=10,
        window_seconds=300,
        subject=payload.email.strip().lower(),
    )

    user = db.query(User).filter(User.email == payload.email.strip().lower()).first()
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if not user.is_approved:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is pending approval. Please wait for an admin to approve it.",
        )

    access_token = create_access_token({"sub": str(user.id), "email": user.email})
    return Token(access_token=access_token, user=user)
