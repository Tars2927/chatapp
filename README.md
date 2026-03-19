# ChatApp

ChatApp is a full-stack group messaging app built with FastAPI, React, and PostgreSQL.

The project currently includes:

- a FastAPI backend with user registration and login
- JWT-based authentication
- a React frontend with register/login pages
- protected frontend routing for the chat area
- a placeholder chat screen ready for real-time messaging work

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
│       ├── auth_router.py
│       ├── messages.py
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
- User login
- Password hashing
- JWT token generation
- Protected frontend route for `/chat`
- Login redirect after successful registration

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

## API Endpoints

### Auth

- `POST /register`
- `POST /login`

### Messages

- `GET /messages`

## Example Auth Requests

### Register

```json
{
  "username": "demo_user",
  "email": "demo@example.com",
  "password": "password123"
}
```

### Login

```json
{
  "email": "demo@example.com",
  "password": "password123"
}
```

## Current Development Status

Day 1 and Day 2 are largely in place:

- backend auth is working
- frontend auth pages are working
- protected route logic is working
- chat page is still a placeholder

Next major step:

- add WebSocket-based real-time messaging on the backend
- connect the frontend chat page to live messages

## Security Notes

- Do not commit real `.env` files
- Keep `backend/.env` and `frontend/.env` local only
- Rotate credentials immediately if a secret is ever pushed

## Useful Commands

### Run backend

```powershell
cd backend
venv\Scripts\activate
uvicorn main:app --reload
```

### Run frontend

```powershell
cd frontend
npm run dev
```

### Build frontend

```powershell
cd frontend
npm run build
```

## Notes

- The frontend currently builds successfully on this repo.
- Vite may warn if your local Node version is older than its preferred engine range.
