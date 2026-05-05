# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`ubdac-image` — website for **Ubdac Soft Limited** with user registration/authentication (with photo upload).  
Stack: PostgreSQL 16 · Node.js/Express (ESM) · React 18 + Vite 5 · JWT auth · multer (memoryStorage).  
License: AGPL-3.0.

## Local development

```bash
./dev.sh start          # DB + server + client (auto npm install, auto .env)
./dev.sh stop
./dev.sh restart server # hot-restart a single service
./dev.sh logs           # merged log tail
./dev.sh status
./dev.sh db-reset       # ⚠ wipe DB volume
```

PostgreSQL listens on **5433** (5432 is taken by odoo-vibe). The DB schema is created automatically on server start.

## Production / Kubernetes

Two Docker images:

| Image | Dockerfile | Description |
|-------|-----------|-------------|
| `ubdac-client` | `client/Dockerfile` | nginx 1.27 + React build |
| `ubdac-server` | `server/Dockerfile` | Node 20 + Express API |

```bash
docker build -t ubdac-client ./client
docker build -t ubdac-server ./server
```

**nginx** (`client/nginx.conf`) — template processed by `envsubst` at container start:
- Serves static assets with long-lived cache (Vite generates content-hashed filenames)
- Proxies `/api/` → `${BACKEND_URL}` (default `http://ubdac-server:3001`)
- SPA fallback: all 404s → `index.html`

Pass environment variables to deployments in K8s:

```yaml
# client deployment
env:
  - name: BACKEND_URL
    value: "http://ubdac-server:3001"   # K8s Service name of the backend

# server deployment
env:
  - name: DATABASE_URL
    valueFrom: { secretKeyRef: ... }
  - name: JWT_SECRET
    valueFrom: { secretKeyRef: ... }
  - name: CORS_ORIGIN
    value: "https://ubdac.example.com"  # public frontend domain
```

## Architecture

```
client/src/
  App.jsx              – BrowserRouter + PrivateRoute guard
  pages/
    LoginPage.jsx      – POST /api/auth/login → JWT → localStorage
    RegisterPage.jsx   – POST /api/auth/register (multipart/form-data + photo)
    DashboardPage.jsx  – GET /api/auth/me → profile

server/src/
  index.js             – Express, CORS (CORS_ORIGIN env), mounts authRouter
  db.js                – pg Pool + initDb() (CREATE TABLE IF NOT EXISTS)
  routes/auth.js       – /register, /login, /me, /photo/:id
```

**Auth:** JWT (7d), stored in `localStorage`. `/api/auth/me` requires `Authorization: Bearer <token>`.

**Photos:** stored as `BYTEA + photo_mime` in the `users` table. `GET /api/auth/photo/:id` streams the blob; `/me` returns `photo_url: "/api/auth/photo/<id>"` or `null`.

## Environment variables

### server

| Variable | Dev default | Notes |
|----------|-------------|-------|
| `DATABASE_URL` | `postgresql://ubdac:ubdac_pass@localhost:5433/ubdac` | |
| `JWT_SECRET` | — | **Required** in production |
| `PORT` | `3001` | |
| `CORS_ORIGIN` | `http://localhost:5173` | Public frontend domain in prod |

### client (nginx, K8s env)

| Variable | Default | Notes |
|----------|---------|-------|
| `BACKEND_URL` | `http://ubdac-server:3001` | K8s Service name of the backend |
