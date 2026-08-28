# LIFEBridge MedTech — Business OS + GST DAS

**Production multi-company Indian GST Business Operating System**

> One architecture · One database · One GST engine · Next.js + Prisma

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Prisma + Hostinger MySQL
- Session auth + RBAC
- Centralized GST tax engine
- Vercel-compatible

## Setup

```bash
cp .env.example .env
# Set DATABASE_URL and AUTH_SECRET

npm install
npx prisma db push
npm run db:seed
npm run dev
```

Default seed login: `admin@lifebridgemedtech.com` / `Admin@12345`

## Deploy (Vercel)

1. Import this repo
2. Env: `DATABASE_URL`, `AUTH_SECRET`, `NEXT_PUBLIC_APP_NAME`
3. Build: `prisma generate && next build`

Never commit real passwords.

© LIFEBridge MedTech Pvt. Ltd.
