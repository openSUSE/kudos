# 💚 openSUSE Kudos Recognition Platform

![kudos-live](https://github.com/user-attachments/assets/f24ff997-2104-494e-81cd-3dd4497a9733)

<img width="1168" height="583" alt="image" src="https://github.com/user-attachments/assets/74baa242-dac9-41cb-b66d-1f6c33949161" />


**openSUSE Kudos** is a lightweight web application that allows contributors to recognize each other through positive feedback.

It provides:
- 💬 Kudos messages  
- 🏅 Badges  
- 📈 Activity feed  
- 🤖 Optional Slack & Matrix bots  

Originally developed during SUSE Hackweek 25.

This repository contains:
- **Backend:** Express + Prisma  
- **Frontend:** Vue + Vite  

---

## 🌐 Public Instance

A public instance is available:  
👉 https://kudos.opensuse.org  

💬 Matrix room (bot + community):  
👉 https://matrix.to/#/#chat:opensuse.org

---

## 🚀 Deployment (openSUSE)

Kudos is packaged and deployed within openSUSE infrastructure:

- Source: https://src.opensuse.org/kudos  
- Build project: https://build.opensuse.org/project/show/openSUSE:infrastructure:kudos  
- Installed via:
  ```bash
  zypper in kudos kudos-badges kudos-bots
  ```

- Bots source (Gitea, no source archives):
  https://src.opensuse.org/kudos/kudos-bots  

- Configuration:
  https://github.com/openSUSE/heroes-salt  

- Runs as systemd services (including bots)

---

### 🗄️ Database (Prisma & Seeding)

When updating schema or refreshing predefined data (e.g. badges, categories):

#### Apply schema changes (development)

```bash
npx prisma db push
```

#### Seed production data (categories + badges)

```bash
export DATABASE_URL="file:/var/lib/kudos/kudos.db"
node backend/prisma/seed-prod.js
```

Example output:

```
🌱 Running production seed (categories + badges only)…
🌿 Categories initialized (8).
🏅 Badges initialized (43).
┌────────────┬────────┐
│ (index)    │ Values │
├────────────┼────────┤
│ categories │ 8      │
│ badges     │ 43     │
└────────────┴────────┘
🌳 Production seed complete.
```

> ⚠️ `db push` is intended for development. For production, ensure schema changes are applied carefully and data is backed up.

---

## 🏅 Badges & Bots

Badge artwork is maintained in a separate repository:  
👉 https://github.com/openSUSE/kudos-badges  

This project does **not** bundle badge assets directly.  
Ensure badges are available in your deployment environment.

The bots (Slack & Matrix) are developed and packaged separately:  
👉 https://src.opensuse.org/kudos/kudos-bots  

---

## 🧰 Development Setup

The recommended way to develop Kudos is inside a **Distrobox container based on openSUSE Leap 16.0**.

### 1. Create and enter environment

```bash
distrobox create -n kudos -i registry.opensuse.org/opensuse/leap:16.0
distrobox enter kudos
```

Install dependencies:

```bash
zypper install jq npm22 git mkcert
```

---

### 2. Clone and bootstrap

```bash
git clone https://github.com/openSUSE/kudos.git
cd kudos
./runme-clean.sh
```

This will:
- install all dependencies  
- initialize the SQLite database  
- create demo users  
- build and start the full stack  

---

### 3. Re-run without reset

```bash
./runme-dirty.sh
```

---

## 🔐 Authentication (OIDC)

The app requires OpenID Connect.

For development:

```bash
cp .env.dev .env
```

This uses:
👉 https://demo.duendesoftware.com  

Test accounts:
- `bob / bob`  
- `alice / alice`

---

## ▶️ Running the App

After running `runme-clean.sh`, the full stack is already running.

If needed, you can run services manually:

Frontend (Vite, port 5173):
```bash
npm run frontend
```

Backend (Express, port 3000):
```bash
npm run backend
```

Open:
👉 https://localhost:5173  

---

## 🌐 Production Setup

Single-server deployment.

### Build

```bash
npm install
npm run build:backend
npm run build:frontend
npm prune --omit=dev
```

Build output:
```
backend/public
```

---

### Run

```bash
node backend/src/app.js
```

- Application runs on: https://localhost:3000  
- Backend serves the compiled frontend  
- One systemd service is sufficient  

---

## 🔐 HTTPS (Development)

Self-signed certificates are stored in:

```
certs/localhost.pem
certs/localhost-key.pem
```

You may need to trust the certificate in your browser.

---

## 🌍 Localization

Available in multiple languages:

🇸🇦 🇨🇿 🐉 🇩🇪 🇬🇷 🇬🇧 🇪🇸 🇫🇷 🇮🇳 🇭🇺 🇮🇩 🇮🇹 🇯🇵 🇰🇷 🇳🇱 🇵🇱 🇧🇷 🇵🇹 🇷🇴 🇷🇺 🇸🇰 🇸🇪 🇹🇷 🇺🇦 🇻🇳 🇨🇳 🇹🇼

Want to contribute?  
👉 https://github.com/openSUSE/kudos/blob/main/frontend/src/locales/CONTRIBUTING.md  

---

## 🧩 Technologies

- Vue 3 + Vite  
- Node.js (Express)  
- Prisma ORM  
- SQLite (development)  
- Slack & Matrix integrations  
- Weblate  
- LLM integrations (Gemini, GPT-5.1)

---

## 🪪 License

- Code: Apache 2.0  
- Badge artwork: CC BY-SA 4.0  

© 2025 Lubos Kocman and openSUSE contributors  
💚 Geekos deserve recognition too!
