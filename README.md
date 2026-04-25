# Luma Chrome Extension

React-based Chrome extension scaffold for the Luma side panel.

## Run locally

1. Install dependencies with `npm install`
2. Build the extension with `npm run build`
3. Open `chrome://extensions`
4. Enable Developer Mode
5. Click `Load unpacked`
6. Select the `dist` folder

## Included pieces

- React side panel UI in `src/sidepanel`
- Manifest V3 config in `public/manifest.json`
- Background service worker that opens the side panel from the toolbar icon
- Content script placeholder that stores the current page title and URL for the panel
- Local onboarding flow with signup, demo verification step, and stored health survey
- Backend scaffold in `server/` for Vultr VM + Managed PostgreSQL

## Current onboarding implementation

- Signup form stores name and email in `chrome.storage.local`
- Verification step is a local placeholder only
- Basic medical intro survey stores age range, sex assigned at birth, conditions, medications, and goals in `chrome.storage.local`

## Why real email verification is not complete yet

This extension can store data locally, but it cannot securely provide real email verification by itself.

Real email verification needs:

- A backend or hosted auth provider to send emails
- Signed or stored verification tokens
- A secure way to validate that the person who clicked the email link owns the address
- A persistent database if you want the account and survey data available across devices

Good next options would be Firebase Auth, Supabase Auth, Clerk, or a custom backend.

## Vultr backend scaffold

The repository now includes a backend in `server/` with:

- email/password signup
- email verification tokens
- login with JWT
- onboarding survey storage
- Prisma schema for PostgreSQL

This is the path to use if you want to host your own backend on a small Vultr VM with Vultr Managed PostgreSQL.
