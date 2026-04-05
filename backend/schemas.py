from datetime import datetime

from pydantic import BaseModel, Field

try:
    from pydantic import ConfigDict
except ImportError:  # pragma: no cover
    ConfigDict = None


class ORMBaseModel(BaseModel):
    if ConfigDict is not None:
        model_config = ConfigDict(from_attributes=True)
    else:  # pragma: no cover
        class Config:
            orm_mode = True


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: str = Field(..., min_length=5, max_length=100)
    password: str = Field(..., min_length=6, max_length=128)


class UserLogin(BaseModel):
    email: str
    password: str


class UserOut(ORMBaseModel):
    id: int
    username: str
    email: str
    avatar_url: str | None = None
    email_verified: bool
    is_approved: bool
    is_admin: bool
    email_notifications_enabled: bool = True
    digest_min_unread_count: int = 1
    last_read_message_id: int | None = None
    last_active_at: datetime | None = None
    last_digest_sent_at: datetime | None = None
    created_at: datetime


class PendingUserOut(ORMBaseModel):
    id: int
    username: str
    email: str
    email_verified: bool
    is_approved: bool
    created_at: datetime


class MessageSender(ORMBaseModel):
    id: int
    username: str
    avatar_url: str | None = None


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class RegistrationStatus(BaseModel):
    email: str
    requires_verification: bool = False
    pending_approval: bool = True


class EmailVerificationRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=100)
    otp: str = Field(..., min_length=6, max_length=6)


class EmailVerificationResendRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=100)


class EmailVerificationStatus(BaseModel):
    email: str
    email_verified: bool = False
    pending_approval: bool = True


class MessageOut(ORMBaseModel):
    id: int
    sender_id: int
    content: str | None = None
    file_url: str | None = None
    file_type: str | None = None
    created_at: datetime
    updated_at: datetime | None = None
    is_deleted: bool = False
    sender: MessageSender


class MessageCreate(BaseModel):
    content: str | None = Field(default=None, max_length=4000)
    file_url: str | None = None
    file_type: str | None = Field(default=None, max_length=20)


class MessageUpdate(BaseModel):
    content: str = Field(..., min_length=1, max_length=4000)


class MessageReadUpdate(BaseModel):
    last_read_message_id: int = Field(..., ge=0)


class MessageSummary(BaseModel):
    last_read_message_id: int | None = None
    last_message_id: int | None = None
    unread_count: int = 0


class NotificationPreferencesOut(BaseModel):
    email_notifications_enabled: bool = True
    digest_min_unread_count: int = 1
    last_active_at: datetime | None = None
    last_digest_sent_at: datetime | None = None


class NotificationPreferencesUpdate(BaseModel):
    email_notifications_enabled: bool
    digest_min_unread_count: int = Field(..., ge=1, le=999)


class DigestPreview(BaseModel):
    email_notifications_enabled: bool = True
    digest_min_unread_count: int = 1
    unread_count: int = 0
    hours_since_last_active: float | None = None
    last_digest_sent_at: datetime | None = None
    should_send_digest: bool = False
