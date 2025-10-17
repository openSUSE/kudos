# 💚 openSUSE Kudos

![kudos_live](https://github.com/user-attachments/assets/378465ad-efab-47e5-8f55-00142177f3d5)

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

Note: after adding or modifying a badge, the **submodule reference** needs to be updated (“bumped”) in this application to make the changes visible.

---

## 🧰 Setup & Development

Use **Distrobox** for a clean, reproducible environment.  
Then install the required tools:

```bash
zypper in jq npm
```

To clean and prepare the development setup, run:

```bash
./runme-clean.sh
```

> ℹ️ `runme-clean.sh` resets the environment and ensures all dependencies and data are synced.

---

## 🌐 HTTPS on Localhost

Both the **backend (Express)** and **frontend (Vue)** run over **HTTPS** locally to support  
secure cookies and authenticated sessions.

- Backend: <https://localhost:3000>  
- Frontend (Vue): <https://localhost:5173>  

> ⚠️ You may need to accept the self-signed certificate in your browser on first use.

---

## 🧪 Testing Locally

You can easily test peer-to-peer kudos interactions or built-in messaging by running **two browser sessions**:

- Open one session as yourself (logged in).  
- Open another in an **anonymous/private window** as a different user.  

Then send kudos between them to test how it looks and behaves live.  
This is also a good way to verify notification and bot reactions.

---

## 🤖 Bots

Kudos uses several **automation bots** to connect with openSUSE infrastructure and community tools:

- `badger-bot-gitea` – awards badges based on Gitea activity  
- `badger-bot-kudos` – processes peer kudos submissions  
- `badger-bot-manual` – for manual or special-event badge awards  
- `badger-bot-membership` – validates openSUSE membership badges  
- `badger-bot-obs` – interacts with the Open Build Service (OBS)

> ⚠️ **Important:**  
> Always run bots with the `-i` argument to bypass locally signed certificates.  
> Without it, bots will **not print or execute anything**.

Example:
```bash
./badge-bot-kudos -i # update given/send kudos badges for all users
./badger-bot-manual -i -u klocman -b nuke # Give klocman badge for nuking production
```

---

## 🧩 Technologies Used

- Node.js + npm  
- Vue.js frontend  
- Express backend  
- Prisma ORM  
- Distrobox for local development  
- jq for lightweight JSON scripting  
- optipng (`-o7`) for optimizing badge images  

---

## 🪪 License

All code is licensed under the **Apache 2.0** license.  
All artwork (badges) is licensed under **CC BY-SA 4.0**.  

SPDX identifiers:
```
Apache-2.0
CC-BY-SA-4.0
```

© 2025 Lubos Kocman and openSUSE contributors.  
💚 *For Geekos, by Geekos — because appreciation should feel good, not formal.*
