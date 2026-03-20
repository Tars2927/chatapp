from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth import get_current_admin
from database import get_db
from models import User
from schemas import PendingUserOut


router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/pending-users", response_model=list[PendingUserOut])
def list_pending_users(
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    return (
        db.query(User)
        .filter(User.is_approved.is_(False))
        .order_by(User.created_at.asc())
        .all()
    )


@router.post("/users/{user_id}/approve", response_model=PendingUserOut)
def approve_user(
    user_id: int,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    user.is_approved = True
    db.commit()
    db.refresh(user)
    return user
