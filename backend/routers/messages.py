from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from database import get_db
from models import Message
from schemas import MessageOut


router = APIRouter(tags=["messages"])


@router.get("/messages", response_model=list[MessageOut])
def list_messages(db: Session = Depends(get_db)):
    return (
        db.query(Message)
        .options(joinedload(Message.sender))
        .order_by(Message.created_at.desc())
        .limit(50)
        .all()[::-1]
    )
