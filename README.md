# 🩺 WebMedica

> *Women have been systematically left out of medicine. WebMedica is here to fix that — one article at a time.*

**WebMedica** is an AI-powered Chrome extension that sits beside you while you browse health content, transforming dense medical studies, PubMed abstracts, and health blogs into personalized, women-centered insights in real time. No medical degree required.

For the women already deep in symptom rabbit holes at 2 a.m., decoding whether any of it actually applies to them — this one's for you.

---

## What It Does

After a one-time setup, WebMedica quietly analyzes whatever health content you're reading and surfaces:

- **Plain-language summary** — what the study actually says, with an emphasis on how it affects women
- **"What this means for you"** — key points interpreted through your personal health profile (age, life stage, conditions, medications)
- **Bias check** — flags male-heavy study populations, missing sex breakdowns, or other limitations that reduce applicability to women
- **Follow-up questions** — tailored to both the article and your profile, ready to bring into the exam room

The built-in chatbot stays grounded in your health profile *and* the current page's content. Instead of generic answers, you get:

> *"Given your history of migraines and your current medication, here's what this study suggests you might want to ask your neurologist."*

WebMedica doesn't replace your doctor. It helps you walk into appointments with **better questions, better context, and a clearer sense of what you just read online**.

---

## Project Structure

```
├── src/sidepanel/          # React sidepanel UI (LumaSidePanel.jsx)
├── public/manifest.json    # Chrome Extension Manifest V3
├── dist/                   # Built extension assets (load this in Chrome)
└── server/                 # Express API, Prisma schema, auth, onboarding, summarize routes
```

---

## Features

- Email/password signup and login
- Email verification flow (`/auth/verify`)
- JWT auth for protected routes
- Onboarding health profile survey persisted to Postgres via Prisma
- "Analyze this study" endpoint — structured, women-specific AI output via Gemma
- Bias-aware summaries **by default** (not an afterthought)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite |
| Extension | Chrome Manifest V3 (side panel + content scripts) |
| Backend | Express + Zod |
| Database | PostgreSQL + Prisma (Supabase supported) |
| AI | Gemma via local Ollama-compatible API |
| Email | Resend (optional in local/dev flows) |

---

## Prerequisites

- Node.js 18+ (22 recommended)
- npm
- Chrome
- PostgreSQL database (Supabase supported)
- Optional: Ollama + Gemma for local AI analysis

---

## Setup

### 1. Frontend (Chrome Extension)

From the repo root:

```bash
npm install
```

Create a root `.env`:

```env
VITE_API_BASE_URL=http://localhost:3001
VITE_API_TIMEOUT_MS=120000
```

Build the extension:

```bash
npm run build
```

Load in Chrome:
1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `dist/` folder

---

### 2. Backend

```bash
cd server
npm install
cp .env.example .env
```

Update `server/.env` for your environment. Required variables:

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

Run Prisma migrations:

```bash
npx prisma generate
npx prisma migrate deploy
```

Start the backend:

```bash
npm run dev
```

Verify it's running:

```bash
curl http://localhost:3001/health
```

---

### 3. Run Gemma Locally (optional)

For local, privacy-preserving AI analysis — no data shipped to the cloud:

```bash
ollama serve
ollama pull gemma:2b
curl http://127.0.0.1:11434/v1/models
```

Make sure `GEMMA_API_URL` and `GEMMA_MODEL` in `server/.env` match your setup.

---

## Analysis Pipeline

```
Page or web search
    → Content script (extracts article text)
        → Side panel (+ your health profile)
            → Gemma (structured prompt)
                → Women-specific insights back in the UI
```

AI output is structured JSON with discrete sections: article focus, what it means for women, bias notes, and questions to ask your provider.

---

## API Reference

| Method | Endpoint | Auth |
|---|---|---|
| GET | `/health` | — |
| POST | `/auth/signup` | — |
| GET | `/auth/verify?token=...` | — |
| POST | `/auth/login` | — |
| GET | `/profile/me` | Bearer token |
| POST | `/profile/onboarding` | Bearer token |
| POST | `/summarize-article` | — |

---

## Troubleshooting

**`Cannot POST /auth/login`**
Ensure the backend is running from `server/src/index.js` via `npm run dev` inside `server/`.

**`Failed to fetch` in the extension**
Check that `VITE_API_BASE_URL` in root `.env` matches your backend port. Verify with `curl http://localhost:3001/health`.

**`EADDRINUSE` on backend start**
Another process is using the port. Stop it or update `PORT` in `server/.env`.

**Prisma connection errors**
Double-check `DATABASE_URL` and `DIRECT_URL` format, especially pooler settings for Supabase.

**Build errors with `Unexpected "<<"`**
You have unresolved git conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`) in source files. Find and resolve them before rebuilding.

---

## Notes

- Local `.env` files are intentionally git-ignored. Only commit `.env.example`.
- After any frontend code change, rebuild with `npm run build` and reload the extension in Chrome.

---

## What's Next

- **Research history** — persistent cross-article context so WebMedica draws on everything you've read, not just the current page
- **Language complexity toggle** — switch between everyday language and full medical terminology for exam room conversations
- **Broader demographic support** — expanding beyond women's health while keeping bias-awareness at the core
- **Provider integrations** — securely share summaries and question lists directly with your care team

---

## Built at LA Hacks 2026

By [Lauren Bell](https://github.com/LaurenMBell), [Keira Tan](https://github.com/kxiratan), [Claire Chen](https://github.com/cc13985), and [Naomi Kim](https://github.com/naomi-kimm).

[Devpost](https://devpost.com/software/luma-ai-powered-personalized-health-context) · [GitHub](https://github.com/LaurenMBell/lahacks) · [Figma Deck](https://www.figma.com/slides/fTiQFOa7m4IACoHOxE8Xuk)
