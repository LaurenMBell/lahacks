# Luma / WebMedica Chrome Extension

Chrome sidepanel extension for article analysis with a women-focused health lens, plus backend-powered auth and onboarding.

## Project Structure

- `src/sidepanel/` - React sidepanel UI (`LumaSidePanel.jsx`)
- `public/manifest.json` - Chrome Extension Manifest V3
- `dist/` - built extension assets (load this folder in Chrome)
- `server/` - Express API, Prisma schema, auth, onboarding, and summarize routes

## Features

- Email/password signup and login
- Email verification flow (`/auth/verify`)
- JWT auth for protected routes
- Onboarding survey persisted to Postgres via Prisma
- "Analyze this study" endpoint using Gemma-compatible chat completions API

## Tech Stack

- Frontend: React + Vite
- Extension: Chrome Extension Manifest V3
- Backend: Express + Zod
- DB: PostgreSQL + Prisma
- AI: Gemma (via local Ollama-compatible API)
- Email: Resend (optional in local/dev flows)

## Prerequisites

- Node.js 18+ (22 recommended)
- npm
- Chrome
- PostgreSQL database (Supabase supported)
- Optional: Ollama/Gemma for local analysis

## 1) Frontend Setup (extension)

From repo root:

```bash
npm install
```

Create root `.env`:

```env
VITE_API_BASE_URL=http://localhost:3001
VITE_API_TIMEOUT_MS=120000
```

Build extension:

```bash
npm run build
```

Load in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the repo `dist/` folder

## 2) Backend Setup

```bash
cd server
npm install
cp .env.example .env
```

Update `server/.env` values for your environment.

### Required backend env vars

From `server/.env.example`:

```env
PORT=3001
APP_BASE_URL=https://api.example.com
CLIENT_APP_URL=chrome-extension://YOUR_EXTENSION_ID
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/defaultdb?schema=public
DIRECT_URL=postgresql://USER:PASSWORD@HOST:PORT/defaultdb?schema=public
JWT_SECRET=replace-with-a-long-random-secret
RESEND_API_KEY=re_xxxxxxxxx
EMAIL_FROM=hello@yourdomain.com
GEMMA_API_URL=http://localhost:11434/v1/chat/completions
GEMMA_API_KEY=
GEMMA_MODEL=gemma:2b
ANALYSIS_TIMEOUT_MS=30000
```

### Prisma

```bash
npx prisma generate
npx prisma migrate deploy
```

Run backend:

```bash
npm run dev
```

Health check:

```bash
curl http://localhost:3001/health
```

## 3) Run Gemma Locally (optional, for analysis)

If you want local AI analysis:

```bash
ollama serve
ollama pull gemma:2b
curl http://127.0.0.1:11434/v1/models
```

Make sure `GEMMA_API_URL` and `GEMMA_MODEL` in `server/.env` match your setup.

## API Overview

- `GET /health`
- `POST /auth/signup`
- `GET /auth/verify?token=...`
- `POST /auth/login`
- `GET /profile/me` (Bearer token required)
- `POST /profile/onboarding` (Bearer token required)
- `POST /summarize-article`

## Common Troubleshooting

- **`Cannot POST /auth/login`**
  - Ensure backend is running from `server/src/index.js` (`npm run dev` in `server/`).
- **`Failed to fetch` in extension**
  - Check root `.env` `VITE_API_BASE_URL` matches backend port.
  - Verify backend health with `curl http://localhost:3001/health`.
- **`EADDRINUSE` on backend start**
  - Another process is using the port. Stop the old process or change `PORT`.
- **Prisma connection/pool errors**
  - Re-check `DATABASE_URL`/`DIRECT_URL` format and pooler settings.
- **Build errors with `Unexpected "<<"`**
  - Resolve leftover git conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`) in source files.

## Notes

- Local `.env` files are intentionally git-ignored; commit only `.env.example`.
- Rebuild extension (`npm run build`) after frontend code changes, then reload in Chrome.
