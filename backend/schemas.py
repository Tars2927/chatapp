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
    created_at: datetime


class MessageSender(ORMBaseModel):
    id: int
    username: str
    avatar_url: str | None = None


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class MessageOut(ORMBaseModel):
    id: int
    sender_id: int
    content: str | None = None
    file_url: str | None = None
    file_type: str | None = None
    created_at: datetime
    sender: MessageSender


class MessageCreate(BaseModel):
    content: str | None = Field(default=None, max_length=4000)
    file_url: str | None = None
    file_type: str | None = Field(default=None, max_length=20)
