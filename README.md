# 🎮 Kudos - openSUSE recognition system

**Cool 8-bit style platform** providing space for **peer-to-peer kudos** and recognition for achievements.  
Built for fun, teamwork, and good vibes ✨

![KUDOS live](https://github.com/user-attachments/assets/6fce7e47-03af-49fa-9402-0b89a4a2b199)

---

## 🚀 Quick start (LOCAL auth, no OIDC)

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

## 💚 License & Credits

© 2025 Lubos Kocman & openSUSE contributors — Kudos (Apache 2.0)  
See the [LICENSE](./LICENSE) file for full terms.

Inspired by the **openSUSE community** 🦎  
Prototyped with help from **ChatGPT-5** on a train to the **OpenSSL Conference** and refined before [**Hackweek 25**](https://hackweek.opensuse.org/25/projects/kudos-aka-opensuse-recognition-platform) 🚀
