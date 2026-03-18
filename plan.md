# 💬 ChatApp — 7-Day Build Plan
> A real-time messaging web app for your friend group
> **Stack:** FastAPI + React + PostgreSQL (Neon) + Redis + Cloudinary
> **Deploy:** Vercel (frontend) + Railway (backend)

---

## Current Status Snapshot

Last checked: 2026-03-16

### What exists right now
- `backend/` exists
- Backend starter files exist: `main.py`, `database.py`, `models.py`, `schemas.py`, `auth.py`, `routers/auth_router.py`, `routers/messages.py`
- Backend `.env` exists and includes `DATABASE_URL`, `SECRET_KEY`, `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`
- Python virtual environment exists at `backend/venv`

### What is still missing
- Backend files are still effectively empty
- `backend/requirements.txt` is missing
- `frontend/` does not exist yet
- `README.md` does not exist yet
- No WebSocket router file exists yet

### Best next steps from here
- Finish Day 1 backend implementation before starting frontend
- Create `backend/requirements.txt`
- Implement and test `/register` and `/login`
- Start the frontend only after Swagger auth flow works locally

---

## 🗂️ Project Structure

```
chatapp/
├── backend/
│   ├── main.py
│   ├── database.py
│   ├── models.py
│   ├── schemas.py
│   ├── auth.py
│   ├── .env
│   ├── requirements.txt
│   └── routers/
│       ├── __init__.py
│       ├── auth_router.py
│       ├── messages.py
│       └── ws.py
├── frontend/
│   ├── public/
│   └── src/
│       ├── pages/
│       │   ├── Login.jsx
│       │   ├── Register.jsx
│       │   └── Chat.jsx
│       ├── components/
│       │   ├── MessageBubble.jsx
│       │   ├── ChatInput.jsx
│       │   ├── FileUpload.jsx
│       │   └── Navbar.jsx
│       ├── api/
│       │   └── axios.js
│       ├── App.jsx
│       └── main.jsx
└── README.md
```

---

## 🗄️ Database Schema

```sql
-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Messages table
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER REFERENCES users(id),
    content TEXT,
    file_url TEXT,
    file_type VARCHAR(20),   -- 'image', 'file', or NULL
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## ✅ Day-by-Day Checklist

---

### 📅 Day 1 — Project Setup + Auth Backend

**Goal:** FastAPI running, database connected, register/login working

#### Setup
- [ ] Create `chatapp/` folder with `backend/` and `frontend/` subfolders
- [ ] Create and activate Python virtual environment (`venv\Scripts\activate` on Windows)
- [ ] Install backend dependencies:
  ```
  fastapi uvicorn[standard] sqlalchemy psycopg2-binary python-jose[cryptography]
  passlib[bcrypt] python-multipart python-dotenv alembic
  ```
- [ ] Run `pip freeze > requirements.txt`
- [ ] Create Neon DB project at neon.tech → copy connection string
- [ ] Set up `.env` file with `DATABASE_URL`, `SECRET_KEY`, `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`

#### Code
- [ ] Write `database.py` — SQLAlchemy engine + session
- [ ] Write `models.py` — `User` and `Message` models
- [ ] Write `schemas.py` — Pydantic schemas for request/response
- [ ] Write `auth.py` — password hashing + JWT token creation/verification
- [ ] Write `routers/auth_router.py` — `/register` and `/login` endpoints
- [ ] Write `main.py` — FastAPI app, include routers, create tables on startup

#### Test
- [ ] Run server: `uvicorn main:app --reload`
- [ ] Test `/register` in Thunder Client (VS Code extension)
- [ ] Test `/login` — should return a JWT token
- [ ] Visit `http://127.0.0.1:8000/docs` — Swagger UI should show both endpoints

---

### 📅 Day 2 — Auth Frontend + UI Shell

**Goal:** React app running, login/register pages working, protected routes

#### Setup
- [ ] In `frontend/` folder: `npm create vite@latest . -- --template react`
- [ ] Install frontend dependencies:
  ```
  npm install axios react-router-dom tailwindcss @tailwindcss/vite
  ```
- [ ] Configure Tailwind CSS
- [ ] Set up `.env` in frontend: `VITE_API_URL=http://127.0.0.1:8000`

#### Code
- [ ] Write `api/axios.js` — axios instance with base URL + auth header interceptor
- [ ] Write `pages/Register.jsx` — registration form (username, email, password)
- [ ] Write `pages/Login.jsx` — login form (email, password)
- [ ] Write `pages/Chat.jsx` — empty placeholder page for now
- [ ] Write `App.jsx` — React Router setup with protected route logic
- [ ] Store JWT token in `localStorage` on login
- [ ] Redirect to `/chat` on successful login, redirect to `/login` if not authenticated

#### Test
- [ ] Register a new user via the form → check Neon DB for the new row
- [ ] Login → should redirect to empty Chat page
- [ ] Try accessing `/chat` without login → should redirect to `/login`

---

### 📅 Day 3 — Real-Time Messaging Backend

**Goal:** WebSocket server working, messages saved to DB, multiple clients in sync

#### Setup
- [ ] Install Redis (use Upstash Redis — free cloud Redis at upstash.com)
- [ ] Add `REDIS_URL` to `.env`
- [ ] Install: `pip install redis`

#### Code
- [ ] Write `routers/ws.py` — WebSocket endpoint `/ws/{user_id}`
- [ ] Write WebSocket connection manager (handle connect/disconnect/broadcast)
- [ ] On message received via WebSocket:
  - Save message to PostgreSQL
  - Broadcast to all connected clients via Redis pub/sub
- [ ] Write `routers/messages.py` — `GET /messages` endpoint (fetch last 50 messages on page load)
- [ ] Add both routers to `main.py`

#### Test
- [ ] Open two browser tabs, connect to WebSocket using a simple HTML test file
- [ ] Send a message from one tab → appears in the other tab in real time
- [ ] Check Neon DB — messages should be persisted
- [ ] `GET /messages` should return saved messages

---

### 📅 Day 4 — Chat UI

**Goal:** Full chat interface with real-time send/receive working in React

#### Code
- [ ] Write `components/MessageBubble.jsx` — shows sender name, message text, timestamp
  - Right-aligned bubble for your own messages
  - Left-aligned bubble for others
- [ ] Write `components/ChatInput.jsx` — text input + send button
- [ ] Update `pages/Chat.jsx`:
  - Fetch last 50 messages from `GET /messages` on load
  - Open WebSocket connection on mount, close on unmount
  - Append new messages to state on WebSocket receive
  - Send message via WebSocket on form submit
  - Auto-scroll to bottom on new message
- [ ] Write `components/Navbar.jsx` — shows logged-in username + logout button

#### Test
- [ ] Open app in two browsers (or incognito tabs) with different accounts
- [ ] Send messages back and forth — should appear in real time
- [ ] Refresh page — old messages should load from DB
- [ ] Logout button should clear token and redirect to login

---

### 📅 Day 5 — File & Image Sharing

**Goal:** Users can send images and files in chat

#### Setup
- [ ] Create free account at cloudinary.com
- [ ] Get `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- [ ] Add to `.env`
- [ ] Install: `pip install cloudinary`

#### Backend
- [ ] Write `POST /upload` endpoint in `messages.py`:
  - Accept file via `multipart/form-data`
  - Upload to Cloudinary
  - Return the file URL + file type
- [ ] Update Message model to support `file_url` and `file_type`
- [ ] Update WebSocket broadcast to include file data

#### Frontend
- [ ] Write `components/FileUpload.jsx` — paperclip icon button, file picker
- [ ] On file selected: call `POST /upload` → get URL back → send via WebSocket as a message with `file_url`
- [ ] Update `MessageBubble.jsx`:
  - If `file_type === 'image'` → render `<img>` tag
  - If `file_type === 'file'` → render a download link

#### Test
- [ ] Send an image → should display inline in chat
- [ ] Send a PDF/file → should show as a clickable download link
- [ ] Check Cloudinary dashboard — uploads should appear there

---

### 📅 Day 6 — Polish & UX

**Goal:** Make it feel like a real app, fix bugs, improve UX

#### Features
- [ ] **Typing indicator** — show "X is typing..." when a user is typing
  - Send a `typing` event via WebSocket
  - Show indicator for 2 seconds, then hide
- [ ] **Online status** — show green dot next to users who are connected
- [ ] **Timestamps** — format message timestamps nicely (e.g. "2:34 PM", "Yesterday")
- [ ] **Message seen** — basic "delivered" indicator
- [ ] **Empty state** — show a friendly message when chat is empty
- [ ] **Loading state** — spinner while messages are loading
- [ ] **Error handling** — show toast/alert on send failure or connection drop
- [ ] **Responsive design** — make sure it looks good on mobile screen sizes
- [ ] **Avatar** — show user initials as avatar bubble next to messages

#### Bug Fixes
- [ ] Handle WebSocket reconnection if connection drops
- [ ] Prevent sending empty messages
- [ ] Handle file upload errors gracefully
- [ ] Fix any layout/scroll issues

---

### 📅 Day 7 — Deployment

**Goal:** App live on the internet, shareable with your friend group

#### Backend → Railway
- [ ] Push `backend/` to a GitHub repo
- [ ] Go to railway.app → New Project → Deploy from GitHub
- [ ] Add all `.env` variables in Railway's environment settings
- [ ] Set start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- [ ] Get your Railway backend URL (e.g. `https://chatapp-backend.up.railway.app`)

#### Frontend → Vercel
- [ ] Push `frontend/` to GitHub (same or separate repo)
- [ ] Go to vercel.com → New Project → Import from GitHub
- [ ] Set environment variable: `VITE_API_URL=https://your-railway-url`
- [ ] Deploy → get your Vercel URL (e.g. `https://chatapp.vercel.app`)

#### Final Steps
- [ ] Update CORS in `main.py` to allow your Vercel domain
- [ ] Update WebSocket URL in React from `localhost` to Railway URL
- [ ] Test full flow on production: register → login → send message → send image
- [ ] Share the link with your friends! 🎉

---

## 🔑 Environment Variables Reference

### Backend `.env`
```env
DATABASE_URL=postgresql://...@neon.tech/neondb?sslmode=require
SECRET_KEY=your-generated-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080
REDIS_URL=rediss://...upstash.io:6380
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

### Frontend `.env`
```env
VITE_API_URL=http://127.0.0.1:8000       # local dev
# VITE_API_URL=https://your-railway-url  # production
```

---

## 📦 Dependencies Reference

### Backend (`requirements.txt`)
```
fastapi
uvicorn[standard]
sqlalchemy
psycopg2-binary
python-jose[cryptography]
passlib[bcrypt]
python-multipart
python-dotenv
alembic
redis
cloudinary
```

### Frontend (`package.json`)
```
react
react-dom
react-router-dom
axios
tailwindcss
@tailwindcss/vite
```

---

## 🚀 Quick Commands Reference

```bash
# Start backend
cd backend
venv\Scripts\activate
uvicorn main:app --reload

# Start frontend
cd frontend
npm run dev

# API docs (local)
http://127.0.0.1:8000/docs
```

---

## 🔮 Future Features (v2)
- Multiple chat rooms / group channels
- Direct messages (DMs)
- Message reactions (emoji)
- Message delete / edit
- Push notifications
- User profile page + avatar upload
- Search messages
