from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, WebSocketException, status
from sqlalchemy.orm import joinedload

from auth import decode_access_token
from database import SessionLocal
from moderation import apply_message_moderation
from models import Message, User
from schemas import MessageCreate, MessageOut
from security import enforce_rate_limit


router = APIRouter(tags=["ws"])


class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: dict[int, set[WebSocket]] = defaultdict(set)
        self.connected_users: dict[int, str] = {}

    async def connect(self, user_id: int, username: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections[user_id].add(websocket)
        self.connected_users[user_id] = username

    def disconnect(self, user_id: int, websocket: WebSocket) -> None:
        connections = self.active_connections.get(user_id)
        if not connections:
            return

        connections.discard(websocket)
        if not connections:
            self.active_connections.pop(user_id, None)
            self.connected_users.pop(user_id, None)

    def online_users_payload(self) -> list[dict]:
        return [
            {"user_id": user_id, "username": username}
            for user_id, username in sorted(self.connected_users.items(), key=lambda item: item[1].lower())
        ]

    async def broadcast(self, payload: dict) -> None:
        stale_connections: list[tuple[int, WebSocket]] = []

        for user_id, connections in list(self.active_connections.items()):
            for connection in list(connections):
                try:
                    await connection.send_json(payload)
                except RuntimeError:
                    stale_connections.append((user_id, connection))

        for user_id, connection in stale_connections:
            self.disconnect(user_id, connection)


manager = ConnectionManager()


def touch_user_activity(user_id: int) -> None:
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if user is None:
            return
        user.last_active_at = datetime.now(timezone.utc)
        db.add(user)
        db.commit()
    finally:
        db.close()


def validate_message_payload(payload: dict) -> MessageCreate:
    if hasattr(MessageCreate, "model_validate"):
        return MessageCreate.model_validate(payload)
    return MessageCreate.parse_obj(payload)


def serialize_message(message: Message) -> dict:
    if hasattr(MessageOut, "model_validate"):
        return MessageOut.model_validate(message).model_dump(mode="json")
    return MessageOut.from_orm(message).dict()


def persist_message(user_id: int, payload: dict) -> dict:
    db = SessionLocal()

    try:
        incoming = validate_message_payload(payload)
        content = incoming.content.strip() if incoming.content else None

        if not content and not incoming.file_url:
            raise WebSocketException(
                code=status.WS_1008_POLICY_VIOLATION,
                reason="Message content or file_url is required.",
            )

        message = Message(
            sender_id=user_id,
            content=content,
            file_url=incoming.file_url,
            file_type=incoming.file_type,
        )
        apply_message_moderation(message, content)
        db.add(message)

        user = db.query(User).filter(User.id == user_id).first()
        if user is not None:
            user.last_active_at = datetime.now(timezone.utc)
            db.add(user)

        db.commit()
        db.refresh(message)

        stored_message = (
            db.query(Message)
            .options(joinedload(Message.sender))
            .filter(Message.id == message.id)
            .first()
        )
        return serialize_message(stored_message)
    finally:
        db.close()


def authenticate_websocket(user_id: int, token: str | None) -> User:
    if not token:
        raise WebSocketException(
            code=status.WS_1008_POLICY_VIOLATION,
            reason="Missing access token.",
        )

    try:
        payload = decode_access_token(token)
    except HTTPException as exc:
        raise WebSocketException(
            code=status.WS_1008_POLICY_VIOLATION,
            reason=exc.detail,
        ) from exc

    token_user_id = payload.get("sub")
    if token_user_id is None or int(token_user_id) != user_id:
        raise WebSocketException(
            code=status.WS_1008_POLICY_VIOLATION,
            reason="Token does not match the requested user.",
        )

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if user is None:
            raise WebSocketException(
                code=status.WS_1008_POLICY_VIOLATION,
                reason="User not found.",
            )
        if not user.is_approved:
            raise WebSocketException(
                code=status.WS_1008_POLICY_VIOLATION,
                reason="Your account is pending approval.",
            )
        user.last_active_at = datetime.now(timezone.utc)
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    finally:
        db.close()


def update_existing_message(user_id: int, payload: dict) -> dict:
    db = SessionLocal()

    try:
        message_id = int(payload.get("message_id", 0))
        message = db.query(Message).filter(Message.id == message_id).first()
        if message is None or message.is_deleted:
            raise WebSocketException(
                code=status.WS_1008_POLICY_VIOLATION,
                reason="Message not found.",
            )

        if message.sender_id != user_id:
            raise WebSocketException(
                code=status.WS_1008_POLICY_VIOLATION,
                reason="You can only edit your own messages.",
            )

        next_content = (payload.get("content") or "").strip()
        if not next_content:
            raise WebSocketException(
                code=status.WS_1008_POLICY_VIOLATION,
                reason="Edited message content cannot be empty.",
            )

        message.content = next_content
        apply_message_moderation(message, next_content)
        message.updated_at = datetime.now(timezone.utc)
        user = db.query(User).filter(User.id == user_id).first()
        if user is not None:
            user.last_active_at = datetime.now(timezone.utc)
            db.add(user)
        db.commit()
        db.refresh(message)

        stored_message = (
            db.query(Message)
            .options(joinedload(Message.sender))
            .filter(Message.id == message.id)
            .first()
        )
        return serialize_message(stored_message)
    finally:
        db.close()


def delete_existing_message(user_id: int, payload: dict) -> int:
    db = SessionLocal()

    try:
        message_id = int(payload.get("message_id", 0))
        message = db.query(Message).filter(Message.id == message_id).first()
        if message is None or message.is_deleted:
            raise WebSocketException(
                code=status.WS_1008_POLICY_VIOLATION,
                reason="Message not found.",
            )

        if message.sender_id != user_id:
            raise WebSocketException(
                code=status.WS_1008_POLICY_VIOLATION,
                reason="You can only delete your own messages.",
            )

        message.is_deleted = True
        message.updated_at = datetime.now(timezone.utc)
        user = db.query(User).filter(User.id == user_id).first()
        if user is not None:
            user.last_active_at = datetime.now(timezone.utc)
            db.add(user)
        db.commit()
        return message.id
    finally:
        db.close()


@router.websocket("/ws/{user_id}")
async def websocket_chat(websocket: WebSocket, user_id: int):
    user = authenticate_websocket(user_id, websocket.query_params.get("token"))
    await manager.connect(user_id, user.username, websocket)
    await manager.broadcast({"type": "presence", "online_users": manager.online_users_payload()})

    try:
        await websocket.send_json(
            {
                "type": "connection_established",
                "user_id": user_id,
            }
        )

        while True:
            payload = await websocket.receive_json()
            event_type = payload.get("type", "message")
            enforce_rate_limit(websocket, scope="ws_events", limit=120, window_seconds=60, subject=str(user.id))

            if event_type == "typing":
                touch_user_activity(user.id)
                await manager.broadcast(
                    {
                        "type": "typing",
                        "user_id": user.id,
                        "username": user.username,
                    }
                )
                continue

            if event_type == "edit_message":
                message_payload = update_existing_message(user.id, payload)
                await manager.broadcast({"type": "message_updated", "message": message_payload})
                continue

            if event_type == "delete_message":
                message_id = delete_existing_message(user.id, payload)
                await manager.broadcast({"type": "message_deleted", "message_id": message_id})
                continue

            message_payload = persist_message(user_id, payload)
            await manager.broadcast({"type": "message", "message": message_payload})
    except WebSocketDisconnect:
        manager.disconnect(user_id, websocket)
        await manager.broadcast({"type": "presence", "online_users": manager.online_users_payload()})
    except WebSocketException:
        manager.disconnect(user_id, websocket)
        await manager.broadcast({"type": "presence", "online_users": manager.online_users_payload()})
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
