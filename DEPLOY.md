# Deploy LIFEBridge Business OS on Vercel

## 1. Repo
https://github.com/samsonjames7725-blip/lifebridge-business-mos

## 2. Vercel
1. Import this repository
2. Environment variables:

```
DATABASE_URL=mysql://u150930084_LBMTDBAI:PASSWORD@MYSQL_HOST:3306/u150930084_LBMTDBAI
AUTH_SECRET=long-random-string-at-least-32-chars
NEXT_PUBLIC_APP_NAME=LIFEBridge MedTech Business OS
```

Password URL-encoding: `@` → `%40`, `#` → `%23`, `$` → `%24`

3. Build command: `prisma generate && next build` (in package.json)
4. Deploy → open `*.vercel.app`

## 3. Database
```bash
npx prisma db push
npm run db:seed
```

Login: `admin@lifebridgemedtech.com` / `Admin@12345`

## 4. Still needed in repo
- Full `prisma/schema.prisma` (if missing, copy from LIFEBridge-Business-OS-v6.tar.gz)
- `prisma/seed.ts`
- Invoice API routes under `src/app/api/invoices`
