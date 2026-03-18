from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from auth import create_access_token, get_password_hash, verify_password
from database import get_db
from models import User
from schemas import Token, UserCreate, UserLogin, UserOut


router = APIRouter(tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register_user(payload: UserCreate, db: Session = Depends(get_db)):
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
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
def login_user(payload: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.strip().lower()).first()
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    access_token = create_access_token({"sub": str(user.id), "email": user.email})
    return Token(access_token=access_token, user=user)
