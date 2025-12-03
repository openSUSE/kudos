# 💚 openSUSE Kudos Recognition Platform

![kudos_live_opensuse](https://github.com/user-attachments/assets/dcaca64d-794e-4187-bf45-5707e03ecb8f)

openSUSE Kudos is a simple web application that allows contributors to give positive feedback to each other.
It provides kudos, badges, a small activity feed, and optional bots for Slack and Matrix.

Developed as part of [SUSE Hackweek 25](https://news.opensuse.org/2025/11/12/hw-project-seeks-to-launch-kudos/)

This repository contains both the backend (Express + Prisma) and the frontend (Vue + Vite).

---

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
zypper install jq npm22 git
```

Then clone the repository and prepare the environment:

```
git clone https://github.com/openSUSE/kudos.git
cd kudos
./runme-clean.sh
```

This installs all dependencies, resets the development SQLite database and prepares default demo users.

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

<img width="1000" height="463" alt="kudos-slack" src="https://github.com/user-attachments/assets/6d5fd986-cfec-4cae-9b11-e56bf406b86b" />
<img width="1000" height="498" alt="kudos-matrix" src="https://github.com/user-attachments/assets/621a42a5-0e30-4b90-a861-4790db88cd36" />

The recognition is important but even more important is that people get to see that person was recognized.
We don't really expect users to proactively check kudos. This is when our matrix and slack bots kick in!

The project includes several optional bots in the `bots` directory:

- Slack bot
- Matrix bot
- OBS badge bot
- Gitea activity bot
- Manual badge bot

Each bot uses its own `.env` file. Copy an example and adjust the values:

```
cp bots/.env-slack-test bots/.env.slack
cp bots/.env-matrix-opensuse bots/.env.matrix
```

Install bot dependencies:

```
cd bots
npm install
```

Run a bot:

```
npm run start:slack
npm run start:matrix
# or
node kudos-slack-bot.js
```

---

## 🧩 Technologies

- Vue 3 + Vite
- Node.js (Express)
- Prisma ORM
- SQLite (development)
- Slack and Matrix integration (optional)
- Gemini (recently), GPT-5.1
---

## 🪪 License

Code: Apache 2.0
Badge artwork: CC BY-SA 4.0

© 2025 Lubos Kocman and openSUSE contributors.
💚 Geekos deserve being recognized too!
