import os
import shutil
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, File, HTTPException, Request, Response, UploadFile, status
from sqlalchemy.orm import Session, joinedload

from app_paths import get_uploads_dir, is_desktop_mode
from auth import get_current_user
from database import get_db
from models import Message, User
from routers.ws import manager, serialize_message
from schemas import MessageOut, MessageUpdate
from security import enforce_rate_limit, validate_upload


load_dotenv()

router = APIRouter(tags=["messages"])


def configure_cloudinary():
    try:
        import cloudinary
        import cloudinary.uploader as cloudinary_uploader
    except ModuleNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Cloudinary is not installed on the backend environment.",
        ) from exc

    cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME")
    api_key = os.getenv("CLOUDINARY_API_KEY")
    api_secret = os.getenv("CLOUDINARY_API_SECRET")

    if not cloud_name or not api_key or not api_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Cloudinary environment variables are not configured.",
        )

    cloudinary.config(
        cloud_name=cloud_name,
        api_key=api_key,
        api_secret=api_secret,
        secure=True,
    )

    return cloudinary_uploader


def save_local_upload(file: UploadFile) -> dict:
    uploads_dir = get_uploads_dir()
    extension = Path(file.filename or "").suffix.lower()
    filename = f"{uuid4().hex}{extension}"
    destination = uploads_dir / filename

    with destination.open("wb") as output:
        shutil.copyfileobj(file.file, output)

    content_type = file.content_type or ""
    file_type = "image" if content_type.startswith("image/") else "file"

    return {
        "file_url": f"/uploads/{filename}",
        "file_type": file_type,
        "original_filename": file.filename,
    }


@router.get("/messages", response_model=list[MessageOut])
def list_messages(
    request: Request,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    enforce_rate_limit(request, scope="messages_list", limit=120, window_seconds=60)
    return (
        db.query(Message)
        .options(joinedload(Message.sender))
        .filter(Message.is_deleted.is_(False))
        .order_by(Message.created_at.desc())
        .limit(50)
        .all()[::-1]
    )


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
    db.commit()

    await manager.broadcast({"type": "message_deleted", "message_id": message_id})
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/upload")
def upload_attachment(
    request: Request,
    file: UploadFile = File(...),
    _: User = Depends(get_current_user),
):
    enforce_rate_limit(request, scope="upload", limit=20, window_seconds=600)
    validate_upload(file)

    try:
        if is_desktop_mode():
            return save_local_upload(file)

        cloudinary_uploader = configure_cloudinary()
        result = cloudinary_uploader.upload(
            file.file,
            resource_type="auto",
            folder="baithak",
            use_filename=True,
            unique_filename=True,
        )

        secure_url = result.get("secure_url")
        if not secure_url:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Upload did not return a file URL.",
            )

        content_type = file.content_type or ""
        file_type = "image" if content_type.startswith("image/") else "file"

        return {
            "file_url": secure_url,
            "file_type": file_type,
            "original_filename": file.filename,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Upload failed: {exc}",
        ) from exc
    finally:
        file.file.close()
