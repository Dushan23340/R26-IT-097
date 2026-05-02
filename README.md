# AI Adaptive Learning Platform

Monorepo: **Vite + React (JavaScript / JSX)** in `frontend/`, **Express + MongoDB (JavaScript)** in `backend/`.

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

## Run locally

From the repository root (runs API + UI together):

```bash
npm run dev
```

- Frontend: [http://localhost:3000](http://localhost:3000)
- API: [http://localhost:3001/api](http://localhost:3001/api)  
- Health: [http://localhost:3001/api/health](http://localhost:3001/api/health)

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
