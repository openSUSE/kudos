# 🎮 Kudos

**Cool 8-bit style platform** providing space for **peer-to-peer kudos** and recognition for achievements.  
Built for fun, teamwork, and good vibes ✨

![KUDOS live](https://github.com/user-attachments/assets/6fce7e47-03af-49fa-9402-0b89a4a2b199)

---

## 🚀 Quick start (LOCAL auth)

```bash
# Optional: enter a distrobox container
distrobox enter kudos

# Install dependencies
sudo zypper in npm git

# Clone and launch
git clone https://github.com/lkocman/kudos.git
cd kudos
./runme-clean.sh   # installs npm deps, resets DB, runs app + Prisma admin
```

Then open:

- http://localhost:3000 — main app  
- http://localhost:5555 — Prisma interface (for DB edits)

Default local users (password: `test`):

- **lkocman**
- **hellcp**
- **crameleon**

---

## 🔐 Enable OIDC (production)

Edit `.env`:

```
AUTH_MODE=OIDC
OIDC_ISSUER_URL=https://id.opensuse.org
OIDC_CLIENT_ID=your-client-id
OIDC_CLIENT_SECRET=your-client-secret
OIDC_REDIRECT_URI=http://localhost:3000/auth/callback
SESSION_SECRET=change-me
```

Then restart the app and click **Login**.

---

## 🤖 Bot updating stats (experimental)

```bash
export BOT_API_TOKEN=BOT_TOKEN_123
npm run stats-bot
```

---

## 🎨 Theming & Assets

- **LCP colors** are defined at the top of `public/css/board.css` (Many thanks to Jay!)
- **8-bit vibes** 🎮 ❤️
- Icons: use only layered SVGs for icons pls. [chameleon.svg](https://github.com/lkocman/kudos/blob/main/public/achievements/chameleon.svg)
 (made in Inkscape) can be easily modified for other achievements.
---

## 🧠 Tech Stack

| Layer | Technology |
|-------|-------------|
| Frontend | Node.js + Express + EJS |
| Backend | Prisma + SQLite (local) / PostgreSQL (prod) |
| Auth | OIDC via openSUSE ID + local for testing |
| Style | Custom CSS (8-bit pixel style), color set from Jay Michalska (lcp) |

---

## 💚 Credits

Created by [Lubos Kocman](https://github.com/lkocman)  with help of the openSUSE community 🦎
I did use chatgpt5 to speed up prototyping on a train to the openSSL conferencee and night before.
I intend to continue in the project and have it ready by Hackweek25!
