# 💚 openSUSE Kudos

**🎮 Peer-to-peer recognition system** built with **Vue 3 + Express + Prisma**,  
celebrating teamwork, fun, and community vibes in classic **8-bit style**.

![openSUSE Kudos Live Preview](https://github.com/user-attachments/assets/7ed96a02-eba3-4800-8d84-b70ff07e1517)

---

## 🚀 Quick Start (Local Mode – HTTPS Enabled)

```bash
# Optional: run inside distrobox
distrobox enter kudos

# Install dependencies (includes mkcert for self-signed HTTPS)
sudo zypper in nodejs npm git mkcert

# Clone & launch
git clone https://github.com/lkocman/kudos.git
cd kudos
./runme-clean.sh   # installs deps, generates certs if missing, resets DB, starts backend + frontend
```

### 🧬 Then open:
- **Frontend:** https://localhost:5173  
- **Backend (API Explorer):** https://localhost:3000  
- **Prisma Studio (DB GUI):** http://localhost:5555  

> ⚠️  The first run of `mkcert` installs a local certificate authority and generates  
> `certs/localhost-key.pem` and `certs/localhost.pem`.  
> You may need to trust this CA once; after that, HTTPS works automatically.  
> The backend and Vite dev server share these same certificates.

### 👥 Default test users  
(all with password `opensuse`)

- **klocman**  
- **heavencp**  
- **carmeleon**  
- **knurft**

---

## 🧠 Architecture

| Layer | Technology |
|-------|-------------|
| **Frontend** | Vue 3 + Vite + Pinia + custom CSS |
| **Backend** | Node.js + Express (HTTPS auto/fallback) |
| **Database** | Prisma + SQLite (local) / PostgreSQL (prod) |
| **Auth** | Cookie-based session (`express-session` + SQLite store) |
| **Style** | 8-bit / retro colors by Jay Michalska / LCP |
| **UI Components** | Adwaita-style layout, responsive minimal design |

---

## 🔐 HTTPS & Self-Signed Certificates

The dev environment uses **self-signed certs** so that Secure cookies  
(`SameSite=None; Secure`) work between frontend and backend.

1. Certificates are expected at:
   ```
   certs/localhost-key.pem
   certs/localhost.pem
   ```
2. If missing, `./runme-clean.sh` automatically runs:
   ```bash
   mkcert -install
   mkcert -key-file certs/localhost-key.pem -cert-file certs/localhost.pem localhost
   ```
3. Both **Vite** and the **Express backend** load these same files.  
   If they’re missing and mkcert isn’t installed, the backend gracefully  
   falls back to plain **HTTP**.

> 💡 You can safely ignore browser warnings about “self-signed certificate” on localhost.

---

## 🔏 Concurrent Debugging Setup

Run both servers together:

```bash
npm run dev
```

This uses **concurrently** for hot reloads on both sides with color-coded logs:

- 🟢 **frontend:** Vue + Vite (HTTPS port 5173)
- 🟣 **backend:** Express + Prisma (HTTPS port 3000)

Or start each manually:

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

All `/api/*` requests are automatically proxied from Vite → Express via HTTPS.

---

## 🧱 API Overview

Open https://localhost:3000 for a **live, color-coded API index**.  
It auto-lists all available endpoints and methods.

### Example

```bash
curl -sk https://localhost:3000/api/users --insecure | jq
```

(`--insecure` disables certificate verification for the self-signed cert)

---

### 💚 Kudos API Samples

```bash
curl -sk https://localhost:3000/api/kudos --insecure | jq

curl -X POST https://localhost:3000/api/kudos   -H "Content-Type: application/json"   -d '{
    "to": "heavencp",
    "category": "teamwork",
    "message": "💚 Thanks for helping fix the build issues!"
  }'   --insecure | jq
```

---

## 🛠️ Development Notes

**Backend:**
```bash
cd backend
npm run dev
```

**Frontend:**
```bash
cd frontend
npm run dev
```

**Database:**
```bash
npx prisma studio   # http://localhost:5555
```

---

## 🎨 Theming & Assets

- Themes: `frontend/public/css/themes.css`  
- Icons: `public/icons/` (SVG or PNG, theme-aware)  
- Supports dark/light/dark-red themes  
- CSS-only 8-bit animations (glow, pulse, pixel borders)

---

## 🛠️ Admin Tools

- **Prisma Studio** for DB management  
- **Stats bot** (optional) for automatic kudos/badge updates:

```bash
export BOT_API_TOKEN=BOT_TOKEN_123
npm run stats-bot
```

---

## 💚 License & Credits

© 2025 Lubos Kocman & openSUSE contributors — Apache 2.0  
See [LICENSE](./LICENSE) for details.

Built with love for the **openSUSE community** 🦎  
Prototyped during **Hackweek 25** — refined with **ChatGPT-5** and lots of coffee ☕  
8-bit background music: *Retro Funk* by David Renda — [fesliyanstudios.com](https://www.fesliyanstudios.com/royalty-free-music/downloads-c/8-bit-music/6)
