from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, func, text
from sqlalchemy.orm import relationship

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False, index=True)
    hashed_password = Column(Text, nullable=False)
    avatar_url = Column(Text, nullable=True)
    is_approved = Column(Boolean, nullable=False, default=False, server_default=text("false"))
    is_admin = Column(Boolean, nullable=False, default=False, server_default=text("false"))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    messages = relationship("Message", back_populates="sender", cascade="all, delete-orphan")


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    content = Column(Text, nullable=True)
    file_url = Column(Text, nullable=True)
    file_type = Column(String(20), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), nullable=True, onupdate=func.now())
    is_deleted = Column(Boolean, nullable=False, default=False, server_default=text("false"))

    sender = relationship("User", back_populates="messages")
