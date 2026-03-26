# 💚 openSUSE Kudos Recognition Platform

![kudos-live](https://github.com/user-attachments/assets/f24ff997-2104-494e-81cd-3dd4497a9733)


openSUSE Kudos is a simple web application that allows contributors to give positive feedback to each other.
It provides kudos, badges, a small activity feed, and optional bots for Slack and Matrix.

Developed as part of [SUSE Hackweek 25](https://news.opensuse.org/2025/11/12/hw-project-seeks-to-launch-kudos/)

This repository contains both the backend (Express + Prisma) and the frontend (Vue + Vite).

---

## 🌐 Public instance

Since End of February 2026 you can use our public instance at [kudos.opensuse.org](https://kudos.opensuse.org)

## 🏅 Badges

Badge artwork is stored in a separate repository:

https://github.com/openSUSE/kudos-badges

The badges folder in this project is a Git submodule located at:

```
frontend/public/badges
```

To update badges:

```bash
cd frontend/public/badges
git pull origin main
cd ../../..
git add frontend/public/badges
git commit -m "Update badges"
```

---

## 🧰 Development Setup

A clean development environment can be created using Distrobox:

```
distrobox enter kudos # distrobox is optional
zypper install jq npm22 git mkcert
```

Then clone the repository and prepare the environment:

```
git clone https://github.com/openSUSE/kudos.git
cd kudos
./runme-clean.sh

# and later following to re-run app without recreating db, npm install etc
./runme-dirty.sh # 

```

This installs all dependencies, resets the development SQLite database and prepares default demo users.

**The app only works with OpenID Connect.** There are many freely available OIDC servers that you can use for development.
If you copy dot_env.dev as your .env you'll be using https://demo.duendesoftware.com as development OIDC server. There you can login as either `bob/bob` or `alice/alice`.

### Running the development servers

Frontend (Vite on port 5173):

```
npm run frontend
```

Backend API (Express on port 3000):

```
npm run backend
```

Open the frontend in a browser:

https://localhost:5173

---

## 🌐 Production Setup

The production setup uses a single server.
The frontend is built into static files and served directly by the backend at port 3000.

### Build

```
npm install
npm run build:backend
npm run build:frontend
npm prune --omit=dev
```

This produces static files in:

```
backend/public
```

### Run

```
node backend/src/app.js
```

Production uses:

- https://localhost:3000 as the main entry point
- the backend serves the compiled frontend
- one systemd service is enough

---

## 🔐 HTTPS on Localhost

The backend and frontend use HTTPS in development to allow secure cookies.

Self-signed certificates are stored in:

```
certs/localhost.pem
certs/localhost-key.pem
```

You may need to accept the certificate in your browser.

---

## 🤖 Bots

Matrix and Slack bots live inside https://src.opensuse.org/kudos/kudos-bots
and are running on kudos-prod.infra.opensuse.org

```

---

## Localization

The project is available in multiple languages and dialects, including:

🇸🇦 🇨🇿 🐉 🇩🇪 🇬🇷 🇬🇧 🇪🇸 🇫🇷 🇮🇳 🇭🇺 🇮🇩 🇮🇹 🇯🇵 🇰🇷 🇳🇱 🇵🇱 🇧🇷 🇵🇹 🇷🇴 🇷🇺 🇸🇰 🇸🇪 🇹🇷 🇺🇦 🇻🇳 🇨🇳 🇹🇼

Want to add or improve a translation?  
See [`locales/CONTRIBUTING.md`](https://github.com/openSUSE/kudos/blob/main/frontend/src/locales/CONTRIBUTING.md).

## 🧩 Technologies

- Vue 3 + Vite
- Node.js (Express)
- Prisma ORM
- SQLite (development)
- Slack and Matrix integration (optional)
- Gemini (recently), GPT-5.1
- Weblate
---

## 🪪 License

Code: Apache 2.0
Badge artwork: CC BY-SA 4.0

© 2025 Lubos Kocman and openSUSE contributors.
💚 Geekos deserve being recognized too!
