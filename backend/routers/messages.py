from datetime import datetime, timezone
from fastapi import APIRouter, Depends, File, HTTPException, Request, Response, UploadFile, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from auth import get_current_user
from database import get_db
from digest_service import get_unread_count, touch_user_activity
from models import Message, User
from routers.ws import manager, serialize_message
from schemas import MessageOut, MessageReadUpdate, MessageSummary, MessageUpdate
from security import enforce_rate_limit, validate_upload
from upload_service import upload_file_to_storage

router = APIRouter(tags=["messages"])

def get_last_message_id(db: Session) -> int | None:
    return db.query(func.max(Message.id)).filter(Message.is_deleted.is_(False)).scalar()


def build_message_summary(db: Session, user: User) -> MessageSummary:
    return MessageSummary(
        last_read_message_id=user.last_read_message_id,
        last_message_id=get_last_message_id(db),
        unread_count=get_unread_count(db, user),
    )


@router.get("/messages", response_model=list[MessageOut])
def list_messages(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    enforce_rate_limit(request, scope="messages_list", limit=120, window_seconds=60)
    touch_user_activity(current_user, db)
    db.commit()
    return (
        db.query(Message)
        .options(joinedload(Message.sender))
        .filter(Message.is_deleted.is_(False))
        .order_by(Message.created_at.desc())
        .limit(50)
        .all()[::-1]
    )


@router.get("/messages/summary", response_model=MessageSummary)
def get_message_summary(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    enforce_rate_limit(request, scope="messages_summary", limit=180, window_seconds=60)
    touch_user_activity(current_user, db)
    db.commit()
    db.refresh(current_user)
    return build_message_summary(db, current_user)


@router.patch("/messages/read", response_model=MessageSummary)
def mark_messages_read(
    payload: MessageReadUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    enforce_rate_limit(request, scope="messages_read", limit=180, window_seconds=60)
    requested_id = payload.last_read_message_id
    latest_message_id = get_last_message_id(db)

    if latest_message_id is None or requested_id <= 0:
        current_user.last_read_message_id = None
        touch_user_activity(current_user, db)
        db.commit()
        db.refresh(current_user)
        return build_message_summary(db, current_user)

    if requested_id > latest_message_id:
        requested_id = latest_message_id

    if current_user.last_read_message_id is None or requested_id > current_user.last_read_message_id:
        current_user.last_read_message_id = requested_id

    touch_user_activity(current_user, db)
    db.commit()
    db.refresh(current_user)
    return build_message_summary(db, current_user)


@router.patch("/messages/{message_id}", response_model=MessageOut)
async def update_message(
    message_id: int,
    payload: MessageUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    enforce_rate_limit(request, scope="messages_edit", limit=30, window_seconds=60)
    message = db.query(Message).filter(Message.id == message_id).first()
    if message is None or message.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found.")

    if message.sender_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only edit your own messages.",
        )

    message.content = payload.content.strip()
    message.updated_at = datetime.now(timezone.utc)
    touch_user_activity(current_user, db)
    db.commit()
    db.refresh(message)

    stored_message = (
        db.query(Message)
        .options(joinedload(Message.sender))
        .filter(Message.id == message.id)
        .first()
    )
    await manager.broadcast({"type": "message_updated", "message": serialize_message(stored_message)})
    return stored_message


@router.delete("/messages/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_message(
    message_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    enforce_rate_limit(request, scope="messages_delete", limit=30, window_seconds=60)
    message = db.query(Message).filter(Message.id == message_id).first()
    if message is None or message.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found.")

    if message.sender_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own messages.",
        )

    message.is_deleted = True
    message.updated_at = datetime.now(timezone.utc)
    touch_user_activity(current_user, db)
    db.commit()

    await manager.broadcast({"type": "message_deleted", "message_id": message_id})
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/upload")
def upload_attachment(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    enforce_rate_limit(request, scope="upload", limit=20, window_seconds=600)
    validate_upload(file)
    result = upload_file_to_storage(file)
    touch_user_activity(current_user, db)
    db.commit()
    return result
