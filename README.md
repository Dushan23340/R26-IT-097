# AI Adaptive Learning Platform

Monorepo:

- `frontend/`: Vite + React (JavaScript / JSX)
- `backend/`: Express + MongoDB (JavaScript)
- `emotion-service/`: Flask + TensorFlow/Keras emotion inference service

## Prerequisites

- [Node.js](https://nodejs.org/) **20+** (includes `npm`)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (recommended for MongoDB)

## One-time setup

1. **MongoDB (shared default for the team)**

   ```bash
   docker compose up -d
   ```

   This starts MongoDB on `127.0.0.1:27017` with database `test` (see `MONGODB_URI` in `.env`).

2. **Environment**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` if you use Atlas instead of Docker, or need SMTP for email.

3. **Install dependencies**

   ```bash
   npm run install:all
   ```

## Run locally (backend + frontend)

From the repository root (runs API + UI together, without emotion-service):

```bash
npm run dev
```

- Frontend: [http://localhost:3000](http://localhost:3000)
- API: [http://localhost:3001/api](http://localhost:3001/api)  
- Health: [http://localhost:3001/api/health](http://localhost:3001/api/health)

## Real-time Emotion Detection Setup

Use this startup order:

1. **Emotion service**

   ```bash
   cd emotion-service
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   cp .env.example .env
   EMOTION_SERVICE_PORT=5002 python flask_api.py
   ```

   Endpoints:
   - [http://127.0.0.1:5002/](http://127.0.0.1:5002/)
   - [http://127.0.0.1:5002/health](http://127.0.0.1:5002/health)
   - `POST /predict` (base64 image payload)

2. **Frontend**

   ```bash
   cd frontend
   cp .env.example .env
   npm run dev -- --port 3002
   ```

   Default frontend emotion API target:
   - `VITE_EMOTION_API_BASE_URL=http://127.0.0.1:5002`

3. **Backend (optional for emotion-only UI testing)**

   ```bash
   cd backend
   npm run dev
   ```

Stop Mongo when finished:

```bash
docker compose down
```

## MongoDB troubleshooting

| Issue | What to try |
|--------|-------------|
| `ECONNREFUSED` / cannot connect | Run `docker compose up -d` and ensure `MONGODB_URI` matches `.env.example` (`127.0.0.1:27017`). |
| Atlas IP / auth errors | In Atlas: allow your IP (or `0.0.0.0/0` for dev only), verify user/password and URI in `.env`. |
| Wrong database / empty | Put your DB name in the URI before `?`, e.g. `...mongodb.net/test?...`. If the URI has no path, set `MONGODB_DB_NAME=test` (or your DB name). Check Compass: database name must match. |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Frontend + backend concurrently |
| `npm run dev:frontend` | UI only |
| `npm run dev:backend` | API only |
| `npm run build` | Production build (frontend + backend check) |

## Emotion Service Troubleshooting

| Issue | What to try |
|--------|-------------|
| `Port 5002 is in use` | `lsof -nP -iTCP:5002 -sTCP:LISTEN` then `kill <PID>`, or run with a different `EMOTION_SERVICE_PORT`. |
| Webcam denied / not available | Allow camera access in browser site permissions, then reload page. |
| Frontend says AI disconnected | Verify Flask is running and `VITE_EMOTION_API_BASE_URL` matches service port, then restart Vite. |
| `POST /predict` returns `No face detected` | Improve lighting, move face closer/center, avoid backlight. |
| Shape mismatch errors from model | Ensure `emotion-service/src/emotion_service/ml/emotion_model.py` is the updated dynamic-preprocess version and restart Flask. |
