# 💚 openSUSE Kudos

![kudos_live_opensuse](https://github.com/user-attachments/assets/dcaca64d-794e-4187-bf45-5707e03ecb8f)

The **openSUSE Kudos** project brings back a bit of fun to the openSUSE community —  
and gives contributors an easy, friendly way to say **thank you** to each other.  

Because plain emails won’t do — this is about warm, peer-to-peer appreciation  
that everyone can see and celebrate, not just commits or changelogs.  

A way to recognize effort, kindness, and collaboration — from one Geeko to another.

---

## 🏅 Badges

All badge artwork is stored in a separate repository:  
👉 [openSUSE Kudos Badges](https://github.com/openSUSE/kudos-badges)

If you’d like to propose a new badge, please open an issue there:  
🔗 [kudos-badges/issues](https://github.com/openSUSE/kudos-badges/issues)

After adding or modifying a badge, update the **submodule reference** to make the changes visible in this app:

```bash
cd frontend/public/badges
git pull origin main
cd ../../..
git add frontend/public/badges
git commit -m "Update badges submodule"
```

> ℹ️ The badges repository is included as a **Git submodule**, located at  
> `frontend/public/badges/.git`

---

## 🧰 Setup & Development

Use **Distrobox** for a clean, reproducible environment.  
Then install the required tools:

```bash
distrobox enter kudos # optional to keep your system clean
zypper in git jq npm
```

To clean and prepare the development setup, run:

```bash
git clone https://github.com/openSUSE/kudos.git
./runme-clean.sh
```

> ℹ️ `runme-clean.sh` resets the environment and database, and ensures all dependencies and data are synced.

---

### 🪄 First Steps

Once your development environment is ready, try these steps to get familiar with Kudos:

1. **Play with the seed data**  
   The app comes with a few demo users: `klocman`, `heavencp`, `carmeleon`, `knurft` —  
   all using the password **`opensuse`**.  
   You can customize them in `backend/prisma/seed.js` before running `./runme-clean.sh`.

2. **Run two sessions**  
   - Log in as one user in your normal browser window.  
   - Open a private/incognito window and log in as another.  
   - Send kudos between them to test interactions and notifications.

3. **Try the bots**  
   Explore the `bots/` directory and test automation locally:  
   ```bash
   cd bots
   ./badger-bot-kudos -i
   ./badger-bot-manual -i -u klocman -b nuke
   ```
   > Always use the `-i` flag to ignore certificate checks when running locally.

This gives you a hands-on look at how badges are awarded, how data flows, and how bots automate recognition.

---

## 🌐 HTTPS on Localhost

Both the **backend (Express)** and **frontend (Vue)** run over **HTTPS** locally to support  
secure cookies and authenticated sessions.

- Backend: <https://localhost:3000>  
- Frontend (Vue): <https://localhost:5173>  
- Prisma DB admin: <http://localhost:5555>

> ⚠️ You may need to accept the self-signed certificate in your browser on first use.

---

## 🤖 Bots

Kudos uses several **automation bots** (that can be executed in cron or via CI) to connect with openSUSE infrastructure:

- `badger-bot-gitea` – awards badges based on Gitea activity  
- `badger-bot-kudos` – processes peer kudos submissions  
- `badger-bot-manual` – for manual or special-event badge awards  
- `badger-bot-membership` – validates openSUSE membership badges  
- `badger-bot-obs` – interacts with the Open Build Service (OBS)

Example:
```bash
cd bots
./badger-bot-kudos -i
./badger-bot-manual -i -u klocman -b nuke
```

> ⚠️ Always use the `-i` argument locally to bypass self-signed certificate errors.  
> Without it, bots won’t print or execute anything.

### Slack and Matrix bot

<img width="1000" height="463" alt="kudos-slack" src="https://github.com/user-attachments/assets/6d5fd986-cfec-4cae-9b11-e56bf406b86b" />
<img width="1000" height="498" alt="kudos-matrix" src="https://github.com/user-attachments/assets/621a42a5-0e30-4b90-a861-4790db88cd36" />


Probably the most important feature for visibility of recognitions.

The Kudos and Badges system includes optional bots that can post live updates to **Slack** and **Matrix**.

Each bot has its own `.env` configuration file for credentials and server details.
Copy and adjust one of the provided examples:

```bash
# For Slack
cp bots/.env-slack-test bots/.env.slack

# For Matrix
cp bots/.env-matrix-opensuse bots/.env.matrix
```

Then open each `.env.*` file and fill in the required values (tokens, room/channel IDs, etc.).

```bash
cd bots
npm install
```

This installs shared dependencies for all bots.

You can run individual bots directly, or both together via npm scripts:

```bash
npm run start:slack
npm run start:matrix
```

Each bot automatically:
- Loads its respective `.env` file
- Connects to the event stream defined by `STREAM_URL`
- Posts kudos and badge updates to the configured Slack or Matrix channel


---

## 🧩 Technologies Used

- Node.js + npm  
- Vue.js frontend  
- Express backend  
- Prisma ORM  
- Distrobox for local development  
- jq for lightweight JSON scripting  
- optipng (`-o7`) for optimizing badge images
- GPT-5.1 for code assistance
- May contain snippets suggested by Github copilot reviewer during a PullRequest review

---

## 🪪 License

All code is licensed under the **Apache 2.0** license.  
All artwork (badges) is licensed under **CC BY-SA 4.0**.  

The background music sample is 8 Bit Retro Funk - by David Renda from [fesliyanstudios.com](https://www.fesliyanstudios.com/royalty-free-music/downloads-c/8-bit-music/6)

SPDX identifiers:
```
Apache-2.0
CC-BY-SA-4.0
```

© 2025 Lubos Kocman and openSUSE contributors.  
💚 *For Geekos, by Geekos — because appreciation should feel good, not formal.*
Project uses AI generated code. 
