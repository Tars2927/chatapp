# Baithak v1

Baithak is a full-stack group messaging app built with FastAPI, React, and PostgreSQL.

The project currently includes:

- a FastAPI backend with user registration and login
- JWT-based authentication
- a React frontend with register/login pages
- protected frontend routing for the chat area
- a realtime group chat experience with admin approval and uploads

## Tech Stack

### Backend

- FastAPI
- SQLAlchemy
- PostgreSQL (Neon)
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
│   ├── auth.py
│   ├── database.py
│   ├── main.py
│   ├── models.py
│   ├── requirements.txt
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
└── plan.md
```

## Features Implemented

- User registration
- Admin approval for new accounts
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

Use `frontend/.env.example` as a reference and create `frontend/.env`:

```env
VITE_API_URL=http://127.0.0.1:8000
```

### 3. Start the frontend

```powershell
npm run dev
```

Frontend will run on the Vite dev server, usually:

```text
http://127.0.0.1:5173
```

## Free Deployment

Baithak's current free deployment path is:

- frontend on Vercel
- backend on Render free web service

This split is recommended because the frontend is static and Vercel-friendly, while the backend needs a long-running FastAPI server with WebSocket support.

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

Keep the included `frontend/vercel.json` in place so direct visits and refreshes on routes like `/login`,
`/chat`, and `/admin` rewrite back to `index.html` instead of returning a Vercel 404.

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

## Current Development Status

Baithak now includes moderated access, realtime messaging, uploads, editing, deleting, and emoji support.

## Notes

- The frontend currently builds successfully on this repo.
- Vite may warn if your local Node version is older than its preferred engine range.
