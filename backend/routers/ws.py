from __future__ import annotations

from collections import defaultdict

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, status
from sqlalchemy.orm import joinedload
from fastapi import WebSocketException

from auth import decode_access_token
from database import SessionLocal
from models import Message, User
from schemas import MessageCreate, MessageOut


router = APIRouter(tags=["ws"])


class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: dict[int, set[WebSocket]] = defaultdict(set)

    async def connect(self, user_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections[user_id].add(websocket)

    def disconnect(self, user_id: int, websocket: WebSocket) -> None:
        connections = self.active_connections.get(user_id)
        if not connections:
            return

        connections.discard(websocket)
        if not connections:
            self.active_connections.pop(user_id, None)

    async def broadcast(self, payload: dict) -> None:
        stale_connections: list[tuple[int, WebSocket]] = []

        for user_id, connections in self.active_connections.items():
            for connection in list(connections):
                try:
                    await connection.send_json(payload)
                except RuntimeError:
                    stale_connections.append((user_id, connection))

        for user_id, connection in stale_connections:
            self.disconnect(user_id, connection)


manager = ConnectionManager()


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
        db.add(message)
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
        return user
    finally:
        db.close()


@router.websocket("/ws/{user_id}")
async def websocket_chat(websocket: WebSocket, user_id: int):
    token = websocket.query_params.get("token")
    authenticate_websocket(user_id, token)
    await manager.connect(user_id, websocket)

    try:
        await websocket.send_json(
            {
                "type": "connection_established",
                "user_id": user_id,
            }
        )

        while True:
            payload = await websocket.receive_json()
            message_payload = persist_message(user_id, payload)
            await manager.broadcast({"type": "message", "message": message_payload})
    except WebSocketDisconnect:
        manager.disconnect(user_id, websocket)
    except WebSocketException:
        manager.disconnect(user_id, websocket)
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
