from sqlalchemy import JSON, Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text, func, text
from sqlalchemy.orm import relationship

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False, index=True)
    hashed_password = Column(Text, nullable=False)
    avatar_url = Column(Text, nullable=True)
    email_verified = Column(Boolean, nullable=False, default=False, server_default=text("false"))
    email_verification_otp_hash = Column(Text, nullable=True)
    email_verification_expires_at = Column(DateTime(timezone=True), nullable=True)
    email_verification_sent_at = Column(DateTime(timezone=True), nullable=True)
    is_approved = Column(Boolean, nullable=False, default=False, server_default=text("false"))
    is_admin = Column(Boolean, nullable=False, default=False, server_default=text("false"))
    email_notifications_enabled = Column(Boolean, nullable=False, default=True, server_default=text("true"))
    digest_min_unread_count = Column(Integer, nullable=False, default=1, server_default=text("1"))
    last_read_message_id = Column(Integer, nullable=True)
    last_active_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_digest_sent_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    messages = relationship("Message", back_populates="sender", cascade="all, delete-orphan")


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    content = Column(Text, nullable=True)
    file_url = Column(Text, nullable=True)
    file_type = Column(String(20), nullable=True)
    is_toxic = Column(Boolean, nullable=False, default=False, server_default=text("false"))
    toxic_labels = Column(JSON, nullable=True)
    toxicity_confidence = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), nullable=True, onupdate=func.now())
    is_deleted = Column(Boolean, nullable=False, default=False, server_default=text("false"))

    sender = relationship("User", back_populates="messages")
