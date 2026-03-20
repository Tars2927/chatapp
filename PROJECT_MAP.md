# Project Map

## Overview

This repository is a full-stack moderated chat application with:

- a FastAPI backend
- a React + Vite frontend
- PostgreSQL-backed users and messages
- JWT authentication
- admin approval for new users
- WebSocket-based realtime chat
- Cloudinary-backed file uploads

The codebase is already beyond the initial scaffold stage. The core auth, moderation, chat, and upload flows are implemented.

## Top-Level Structure

```text
chatapp/
├── backend/
├── frontend/
├── README.md
├── plan.md
└── PROJECT_MAP.md
```

## Backend Map

### Main Entry

- `backend/main.py`

Responsibilities:

- creates the FastAPI app
- configures CORS
- creates database tables on startup
- ensures `users.is_approved` and `users.is_admin` exist
- promotes the configured `ADMIN_EMAIL` user to admin on startup
- mounts all routers

### Auth

- `backend/auth.py`

Responsibilities:

- password hashing and verification
- JWT creation and decoding
- `get_current_user` authentication dependency
- `get_current_admin` admin-only dependency

Notes:

- uses `pbkdf2_sha256` for hashing in this environment
- blocks unapproved users even if they have valid credentials

### Database Layer

- `backend/database.py`
- `backend/models.py`
- `backend/schemas.py`

Responsibilities:

- SQLAlchemy engine/session setup
- `User` and `Message` models
- Pydantic request/response schemas for auth, messages, and admin flows

Current data model highlights:

- `User`
  - `username`
  - `email`
  - `hashed_password`
  - `avatar_url`
  - `is_approved`
  - `is_admin`
  - `created_at`
- `Message`
  - `sender_id`
  - `content`
  - `file_url`
  - `file_type`
  - `created_at`

### Routers

#### Auth Router

- `backend/routers/auth_router.py`

Endpoints:

- `POST /register`
- `POST /login`

Behavior:

- registration creates users as `is_approved=False`
- login succeeds only if credentials are valid and the account is approved

#### Admin Router

- `backend/routers/admin_router.py`

Endpoints:

- `GET /admin/pending-users`
- `POST /admin/users/{user_id}/approve`

Behavior:

- both endpoints require admin authentication
- admins can list and approve pending users

#### Messages Router

- `backend/routers/messages.py`

Endpoints:

- `GET /messages`
- `POST /upload`

Behavior:

- returns recent message history
- uploads attachments to Cloudinary
- upload requires authentication

Important note:

- `GET /messages` is currently publicly readable and should likely require authentication

#### WebSocket Router

- `backend/routers/ws.py`

Endpoint:

- `WS /ws/{user_id}?token=...`

Behavior:

- validates JWT token against requested user
- tracks active connections and online users
- broadcasts presence updates
- broadcasts typing events
- persists messages to the database
- broadcasts newly stored messages to connected clients

## Frontend Map

### Main Entry

- `frontend/src/main.jsx`
- `frontend/src/App.jsx`

Responsibilities:

- boots the React app
- defines route structure
- protects authenticated routes
- protects admin-only routes

Routes currently in use:

- `/login`
- `/register`
- `/chat`
- `/admin`

### API Client

- `frontend/src/api/axios.js`

Responsibilities:

- sets backend base URL from `VITE_API_URL`
- automatically attaches the stored bearer token

### Pages

#### Login Page

- `frontend/src/pages/Login.jsx`

Behavior:

- submits credentials to `/login`
- stores JWT and user object in `localStorage`
- redirects to chat after successful login
- shows pending approval message after registration

#### Register Page

- `frontend/src/pages/Register.jsx`

Behavior:

- creates a new account through `/register`
- redirects to login with a pending approval notice

#### Chat Page

- `frontend/src/pages/Chat.jsx`

Behavior:

- loads message history from `/messages`
- opens the WebSocket connection
- sends messages in realtime
- sends typing events
- tracks online users
- uploads files before sending file messages
- scrolls to the latest message

#### Admin Page

- `frontend/src/pages/Admin.jsx`

Behavior:

- loads pending users from `/admin/pending-users`
- approves users through `/admin/users/{user_id}/approve`
- provides navigation back to chat

### Components

- `frontend/src/components/AuthCard.jsx`
- `frontend/src/components/Navbar.jsx`
- `frontend/src/components/ChatInput.jsx`
- `frontend/src/components/MessageBubble.jsx`
- `frontend/src/components/FileUpload.jsx`

Responsibilities:

- auth layout
- chat header and session controls
- message composer
- message rendering
- upload trigger

## Current User Flow

### Standard User

1. Register a new account.
2. Wait for admin approval.
3. Log in after approval.
4. Enter the chat room.
5. Send text messages and file attachments in realtime.

### Admin User

1. Log in with an approved admin account.
2. Open `/admin`.
3. Review pending users.
4. Approve accounts.
5. Return to chat.

## Verification Snapshot

Live verification confirmed that:

- backend startup works
- register flow works
- pending approval enforcement works
- admin protection works
- admin approval works
- login after approval works
- authenticated uploads work
- WebSocket chat works
- frontend production build works

## Current Gap

The main issue identified during mapping and verification is:

- `GET /messages` is currently accessible without authentication

If the chat room is intended to be protected, this endpoint should be updated to require `get_current_user`.
