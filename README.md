# Kudos

Retro split‑flap Kudos Hub with openSUSE LCP palette, OIDC login (id.opensuse.org) or LOCAL mode, pixel‑style avatars, achievements, bot awards, permalinks and print views.

## Quick start (LOCAL)
```bash
npm install
npx prisma migrate dev
npx prisma db seed
npm run dev
```
Open http://localhost:3000

## Enable OIDC (production)
Set `.env`:
```
AUTH_MODE=OIDC
OIDC_ISSUER_URL=https://id.opensuse.org
OIDC_CLIENT_ID=your-client-id
OIDC_CLIENT_SECRET=your-client-secret
OIDC_REDIRECT_URI=http://localhost:3000/auth/callback
SESSION_SECRET=change-me
```
Then restart the app and click **Login**.

## Stats bot
```bash
export BOT_API_TOKEN=BOT_TOKEN_123
npm run stats-bot
```

LCP colors are documented at the top of `public/css/board.css`. Avatars live in `public/avatars/`.
