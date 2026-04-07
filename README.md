# Password Strength / Secure Guardian Gate

A full-stack authentication project with:
- React + Vite frontend
- Node.js + Express + PostgreSQL backend
- JWT auth, MFA (TOTP), password rotation rules, account lockout, and admin panel

## Project Structure

- `frontend/` - React application (runs on `http://localhost:8080`)
- `backend/` - Express API server (runs on `http://localhost:4000`)

## Prerequisites

- Node.js 18+
- npm
- PostgreSQL

## Environment Setup

### Backend

1. Go to `backend/`
2. Copy or edit env values in `.env`
3. Ensure PostgreSQL is running and credentials are correct

Main backend env keys include:
- `DATABASE_URL`
- `JWT_SECRET`
- `REFRESH_SECRET`
- `FRONTEND_URL`
- `RECAPTCHA_SECRET`
- `RECAPTCHA_SKIP_VERIFY` (local only)

### Frontend

1. Go to `frontend/`
2. Set values in `.env.local`

Main frontend env keys include:
- `VITE_API_BASE`
- `VITE_RECAPTCHA_SITE_KEY`

## Install Dependencies

```bash
cd backend
npm install

cd ../frontend
npm install
```

## Run the App (Development)

Backend:
```bash
cd backend
npm run dev
```

Frontend:
```bash
cd frontend
npm run dev
```

## Build

Backend:
```bash
cd backend
npm run build
```

Frontend:
```bash
cd frontend
npm run build
```

## Application URLs

- Frontend: `http://localhost:8080`
- API: `http://localhost:4000`
- Dashboard: `http://localhost:8080/dashboard`
- Admin panel: `http://localhost:8080/admin`

> There is no separate admin login page. Login from `/`, then open `/admin` with an admin account.

## Default Admin Behavior

The first registered user is marked as admin by the backend logic.

## Notes

- reCAPTCHA v3 domain should be `localhost` in Google console (no port).
- If secrets are committed, rotate them before production use.
