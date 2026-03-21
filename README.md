# Baithak v1

Baithak is a full-stack group messaging app built with FastAPI, React, and PostgreSQL.

The project currently includes:

- a FastAPI backend with user registration and login
- JWT-based authentication
- a React frontend with register/login pages
- protected frontend routing for the chat area
- a realtime group chat experience with admin approval and uploads
- a Windows desktop packaging path that can produce a downloadable `.exe`

## Tech Stack

### Backend

- FastAPI
- SQLAlchemy
- PostgreSQL for hosted deployments
- SQLite fallback for local desktop builds
- `python-jose` for JWT handling
- `passlib` for password hashing

### Frontend

- React
- Vite
- React Router
- Axios
- Tailwind CSS via `@tailwindcss/vite`

## Project Structure

```text
chatapp/
├── backend/
│   ├── app_paths.py
│   ├── auth.py
│   ├── database.py
│   ├── desktop_launcher.py
│   ├── main.py
│   ├── models.py
│   ├── requirements.txt
│   ├── requirements-desktop.txt
│   ├── schemas.py
│   ├── .env.example
│   └── routers/
│       ├── admin_router.py
│       ├── auth_router.py
│       ├── messages.py
│       ├── ws.py
│       └── __init__.py
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── styles.css
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── build-windows.ps1
└── plan.md
```

## Features Implemented

- User registration
- Admin approval for new accounts in hosted mode
- Automatic first-user admin and local approval in desktop mode
- User login
- Password hashing
- JWT token generation
- Protected frontend route for `/chat`
- Admin route for `/admin`
- WebSocket-based realtime messages
- Typing and presence indicators
- File uploads
- Edit and delete for a user's own messages
- Emoji support in the composer
- Frontend served directly by FastAPI for desktop packaging

## Backend Setup

### 1. Create and activate a virtual environment

```powershell
cd backend
python -m venv venv
venv\Scripts\activate
```

### 2. Install dependencies

```powershell
pip install -r requirements.txt
```

### 3. Create your local `.env`

Use `backend/.env.example` as a reference and create `backend/.env` with your own values:

```env
DATABASE_URL=postgresql://USERNAME:PASSWORD@HOST/DATABASE?sslmode=require
SECRET_KEY=replace-with-a-long-random-secret
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080
```

If `DATABASE_URL` is omitted for local desktop use, the backend now falls back to a local SQLite database in `desktop_data/baithak.db` during development, or `%APPDATA%\Baithak\baithak.db` in the packaged `.exe`.

### 4. Start the backend

```powershell
uvicorn main:app --reload
```

Backend will run at:

```text
http://127.0.0.1:8000
```

Swagger docs:

```text
http://127.0.0.1:8000/docs
```

## Frontend Setup

### 1. Install dependencies

```powershell
cd frontend
npm install
```

### 2. Create your local `.env`

Use `frontend/.env.example` as a reference and create `frontend/.env` only if you want the frontend to call a different backend:

```env
VITE_API_URL=http://127.0.0.1:8000
```

If `VITE_API_URL` is not set, the frontend now uses the current browser origin. That makes the same production build work when served by the packaged FastAPI app.

### 3. Start the frontend

```powershell
npm run dev
```

Frontend will run on the Vite dev server, usually:

```text
http://127.0.0.1:5173
```

## Build a Windows `.exe`

You can now package Baithak as a single Windows executable.

GitHub Actions will also build and publish a downloadable Windows release asset on pushes to main, so users can download it from the repo's Releases page once the workflow finishes.

### What the desktop build does

- bundles the built React frontend into the executable
- starts the FastAPI server locally
- opens the app in the default browser
- stores app data under `%APPDATA%\Baithak`
- uses a local SQLite database automatically when `DATABASE_URL` is not provided
- stores uploaded files locally instead of requiring Cloudinary

### Build steps

1. Build the frontend:

```powershell
cd frontend
npm run build
```

2. Run the Windows packaging script from the repo root:

```powershell
.\build-windows.ps1
```

3. The packaged app will be created at:

```text
release\Baithak.exe
```

### Run the packaged app

Double-click `Baithak.exe`. It will start a local server on `127.0.0.1`, pick an open port, and open the chat app in your default browser.

### Desktop mode behavior

- the first registered user becomes admin automatically
- new desktop-mode registrations are approved automatically
- uploads are saved locally and served from the app itself
- app data persists across launches

## Free Deployment

Baithak's current free deployment path is still:

- frontend on Vercel
- backend on Render free web service

This split is recommended for hosted web deployment, while the `.exe` path is recommended for local Windows usage.

### Deploy the Backend on Render

The repo now includes [render.yaml](./render.yaml), which points Render to the `backend/` app and starts it with:

```text
uvicorn main:app --host 0.0.0.0 --port $PORT
```

In Render, create a new Blueprint or Web Service from this repo and set these environment variables:

```env
DATABASE_URL=your-production-postgres-url
SECRET_KEY=your-long-random-secret
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
ADMIN_EMAIL=your-admin-email
APP_ENV=production
CORS_ALLOWED_ORIGINS=https://your-vercel-project.vercel.app
ALLOWED_HOSTS=your-render-backend.onrender.com
TRUST_PROXY=true
MAX_UPLOAD_BYTES=5242880
UPLOAD_ALLOWED_EXTENSIONS=.jpg,.jpeg,.png,.gif,.webp,.pdf,.txt,.doc,.docx
UPLOAD_ALLOWED_MIME_PREFIXES=image/,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document
```

Notes:

- `SECRET_KEY` should be a long random value, at least 32 characters.
- `CORS_ALLOWED_ORIGINS` should contain your real Vercel frontend URL.
- `ALLOWED_HOSTS` should contain your Render hostname.
- The backend must use a PostgreSQL database that is reachable from Render.

### Deploy the Frontend on Vercel

Import the repo into Vercel and set the project root to `frontend/`.

Keep the included `frontend/vercel.json` in place so direct visits and refreshes on routes like `/login`, `/chat`, and `/admin` rewrite back to `index.html` instead of returning a Vercel 404.

Set this environment variable in Vercel:

```env
VITE_API_URL=https://your-render-backend.onrender.com
```

Then deploy. The frontend already derives both HTTP and WebSocket connections from `VITE_API_URL`.

### Suggested Rollout Order

1. Deploy the backend to Render and wait for the first successful boot.
2. Confirm `https://your-render-backend.onrender.com/docs` loads.
3. Deploy the frontend to Vercel with `VITE_API_URL` pointed at the Render backend.
4. Update backend `CORS_ALLOWED_ORIGINS` with the exact Vercel URL if it changed after deployment.
5. Test register, admin approval, login, message send, edit/delete, emoji, and upload in production.

## API Endpoints

### Auth

- `POST /register`
- `POST /login`

### Messages

- `GET /messages`
- `PATCH /messages/{id}`
- `DELETE /messages/{id}`
- `POST /upload`

### Admin

- `GET /admin/pending-users`
- `POST /admin/users/{user_id}/approve`

### WebSocket

- `WS /ws/{user_id}`

## Notes

- The frontend build currently succeeds on this repo.
- Hosted deployments still support the existing Render + Vercel split.
- The Windows packaging script expects `backend\venv\Scripts\python.exe` to exist.

