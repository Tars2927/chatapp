import os
import shutil
from pathlib import Path
from uuid import uuid4

from dotenv import load_dotenv
from fastapi import HTTPException, UploadFile, status

from app_paths import get_uploads_dir, is_desktop_mode


load_dotenv()


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


def save_local_upload(file: UploadFile, *, folder: str | None = None) -> dict:
    uploads_dir = get_uploads_dir()
    cleaned_folder = (folder or "").strip().strip("/\\")
    target_dir = uploads_dir / cleaned_folder if cleaned_folder else uploads_dir
    target_dir.mkdir(parents=True, exist_ok=True)

    extension = Path(file.filename or "").suffix.lower()
    filename = f"{uuid4().hex}{extension}"
    destination = target_dir / filename

    with destination.open("wb") as output:
        shutil.copyfileobj(file.file, output)

    content_type = file.content_type or ""
    file_type = "image" if content_type.startswith("image/") else "file"
    file_path = f"/uploads/{cleaned_folder}/{filename}" if cleaned_folder else f"/uploads/{filename}"

    return {
        "file_url": file_path,
        "file_type": file_type,
        "original_filename": file.filename,
    }


def upload_file_to_storage(
    file: UploadFile,
    *,
    folder: str | None = None,
    require_image: bool = False,
) -> dict:
    content_type = (file.content_type or "").lower()
    if require_image and not content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Avatar uploads must be image files.",
        )

    try:
        if is_desktop_mode():
            return save_local_upload(file, folder=folder)

        cloudinary_uploader = configure_cloudinary()
        cleaned_folder = (folder or "").strip().strip("/\\")
        cloudinary_folder = "/".join(part for part in ["baithak", cleaned_folder] if part)
        result = cloudinary_uploader.upload(
            file.file,
            resource_type="image" if require_image else "auto",
            folder=cloudinary_folder,
            use_filename=True,
            unique_filename=True,
        )

        secure_url = result.get("secure_url")
        if not secure_url:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Upload did not return a file URL.",
            )

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
