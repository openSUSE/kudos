# Kudos

Cool 8bit style platform providing space for peer to peer kudos and recognition for achievements.

![kudos_live](https://github.com/user-attachments/assets/59332691-d1d2-4313-a7f4-e91c2f691d03)


## Quick start (LOCAL)
```bash
distrobox enter kudos # optional
sudo zypper in npm
npm install
npx prisma migrate dev
npx prisma db seed
npm run dev
```
Open http://localhost:3000
Open http://localhost:5555 # prisma interface for db edits

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

## bot updating stats (experimental)
```bash
export BOT_API_TOKEN=BOT_TOKEN_123
npm run stats-bot
```

LCP colors are documented at the top of `public/css/board.css`. Avatars live in `public/avatars/`.
