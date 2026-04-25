# Luma Backend

This backend is designed for:

- A small Vultr Cloud Compute VM
- Vultr Managed PostgreSQL
- An external email provider such as Resend

## Local development

1. Copy `.env.example` to `.env`
2. Fill in your environment variables
3. Install packages with `npm install`
4. Generate Prisma client with `npm run prisma:generate`
5. Run database migrations with `npx prisma migrate dev --name init`
6. Start the server with `npm run dev`

## API endpoints

- `GET /health`
- `POST /auth/signup`
- `GET /auth/verify?token=...`
- `POST /auth/login`
- `GET /profile/me`
- `POST /profile/onboarding`

## Production deploy outline

1. Create a Managed PostgreSQL database in Vultr
2. Create a small Ubuntu VM in the same Vultr region
3. Point a DNS record such as `api.yourdomain.com` to the VM
4. Install Node.js and your app on the VM
5. Set environment variables
6. Run `npm install`, `npm run prisma:generate`, and `npm run prisma:migrate`
7. Run the server with a process manager or `systemd`
8. Put Nginx in front and issue HTTPS with Let's Encrypt

## Deployment templates

- `deploy/luma-api.service` is a `systemd` unit file for the API
- `deploy/nginx-luma.conf` is an Nginx site config template
