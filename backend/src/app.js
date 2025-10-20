  // backend/app.js
  // Copyright © 2025–present Lubos Kocman and openSUSE contributors
  // SPDX-License-Identifier: Apache-2.0

  import fs from "fs";
  import path from "path";
  import https from "https";

  import cors from "cors";
  import session from "express-session";
  import cookieParser from "cookie-parser";
  import express from "express";
  import { PrismaClient } from "@prisma/client";
  import dotenv from "dotenv";

  dotenv.config();

  // --- Route imports ---
  import { mountAuth } from "./routes/auth.js";
  import { mountStatsRoutes } from "./routes/stats.js";
  import { mountUserProfileRoutes } from "./routes/user_profile.js";
  import { mountUserRoutes } from "./routes/users.js";
  import { mountKudosRoutes } from "./routes/kudos.js";
  import { mountBadgesRoutes } from "./routes/badges.js";
  import { mountAdminRoutes } from "./routes/admin.js";
  import { mountWhoamiRoutes } from "./routes/whoami.js";
  import { mountSummaryRoutes } from "./routes/summary.js";
  import { mountNowRoutes } from "./routes/now.js";
  import { mountNotificationsRoutes } from "./routes/notifications.js";

  // --- Setup ---
  const app = express();
  const prisma = new PrismaClient();

  const FRONTEND_ORIGIN = process.env.VITE_DEV_SERVER || "https://localhost:5173";
  const isProduction = process.env.NODE_ENV === "production";

  // 🟢 Wrap startup logic in async IIFE
  (async () => {
    // 🧩 1️⃣ CORS
    app.use(
      cors({
        origin: [FRONTEND_ORIGIN],
        credentials: true,
      })
    );

    // 🧩 2️⃣ Core middleware
    app.use(express.json());
    app.use(cookieParser());
    app.use(express.static("public"));

    // 🧩 3️⃣ Persistent SQLite-backed sessions
    app.set("trust proxy", 1);
    
    const { default: FileStore } = await import("session-file-store");
    const FileStoreSession = FileStore(session);

    app.use(
      session({
        store: new FileStoreSession({ path: "./sessions", ttl: 86400 }),
        secret: process.env.SESSION_SECRET || "dev-secret",
        resave: false,
        saveUninitialized: false,
        name: "connect.sid",
        cookie: {
          httpOnly: true,
          secure: true,
          sameSite: "none",
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        },
      })
    );

    // 🧩 4️⃣ Mount routes
    await mountAuth(app, prisma);
    mountStatsRoutes(app, prisma);
    mountUserProfileRoutes(app, prisma);
    mountUserRoutes(app, prisma);
    mountKudosRoutes(app, prisma);
    mountBadgesRoutes(app, prisma);
    mountAdminRoutes(app, prisma);
    mountWhoamiRoutes(app, prisma);
    mountSummaryRoutes(app, prisma);
    mountNowRoutes(app, prisma);
    mountNotificationsRoutes(app, prisma);

    // 🏠 Root info (dark openSUSE plum theme)
    app.get("/", (req, res) => {
      const routes = [];

      app._router.stack.forEach((middleware) => {
        if (middleware.route) {
          const methods = Object.keys(middleware.route.methods)
            .map((m) => m.toUpperCase())
            .join(", ");
          routes.push({ path: middleware.route.path, methods });
        } else if (middleware.name === "router" && middleware.handle.stack) {
          middleware.handle.stack.forEach((handler) => {
            const route = handler.route;
            if (route) {
              const methods = Object.keys(route.methods)
                .map((m) => m.toUpperCase())
                .join(", ");
              routes.push({
                path:
                  (middleware.regexp.source
                    .replace("^\\", "")
                    .replace("\\/?(?=\\/|$)", "")
                    .replace(/\\\//g, "/")
                    .replace(/\$$/, "")) + route.path,
                methods,
              });
            }
          });
        }
      });

      routes.sort((a, b) => a.path.localeCompare(b.path));
      const routeList = routes
        .map(
          (r) => `
            <li>
              <span class="method method-${r.methods.toLowerCase()}">${r.methods}</span>
              <a href="${r.path}">${r.path}</a>
            </li>`
        )
        .join("\n");

      res.send(`
        <style>
          :root {
            --bg-dark: #1a1525;
            --surface-dark: #231b33;
            --border-dark: #352c44;
            --text-primary: #e6e6e6;
            --text-secondary: #a89fb8;
            --plum-purple: #b083f0;
            --geeko-green: #73ba25;
            --butterfly-blue: #1e8feb;
            --error-red: #ff5c5c;
          }
          body {
            font-family: "Inter", system-ui, sans-serif;
            background: var(--bg-dark);
            color: var(--text-primary);
            max-width: 720px;
            margin: 4em auto;
            padding: 0 1.5em;
            line-height: 1.6;
          }
          h1 { color: var(--plum-purple); font-size: 1.9rem; margin-bottom: 0.4rem; }
          h2 { color: var(--geeko-green); margin-top: 2rem; font-weight: 500; }
          p { opacity: 0.85; color: var(--text-secondary); }
          code {
            background: var(--surface-dark);
            color: var(--geeko-green);
            padding: 2px 6px;
            border-radius: 4px;
            font-family: "JetBrains Mono", monospace;
          }
          ul { list-style: none; padding: 0; margin-top: 1rem; }
          li {
            margin: 6px 0;
            padding: 10px 12px;
            border: 1px solid var(--border-dark);
            border-radius: 8px;
            display: flex;
            align-items: center;
            gap: 10px;
            background: var(--surface-dark);
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
            transition: transform 0.15s ease, box-shadow 0.15s ease;
          }
          li:hover { transform: translateY(-1px); box-shadow: 0 3px 6px rgba(0, 0, 0, 0.5); }
          a {
            text-decoration: none;
            color: var(--butterfly-blue);
            font-weight: 500;
            transition: color 0.15s ease;
          }
          a:hover { color: var(--geeko-green); }
          .method {
            display: inline-block;
            min-width: 56px;
            text-align: center;
            padding: 3px 6px;
            border-radius: 6px;
            font-weight: 600;
            color: white;
            font-size: 0.8rem;
            text-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
          }
          .method-get { background: var(--geeko-green); }
          .method-post { background: var(--butterfly-blue); }
          .method-put { background: #e6a700; }
          .method-delete { background: var(--error-red); }
          .method-patch { background: var(--plum-purple); }
          footer {
            margin-top: 3rem;
            text-align: center;
            font-size: 0.85rem;
            color: var(--text-secondary);
          }
          footer a {
            color: var(--plum-purple);
            text-decoration: none;
          }
          footer a:hover { color: var(--geeko-green); }
        </style>

        <h1>💜 openSUSE Kudos Backend</h1>
        <p>Backend running at <code>https://localhost:${process.env.PORT || 3000}</code></p>
        <h2>📡 Available API Endpoints</h2>
        <ul>${routeList}</ul>
        <footer>© 2025 openSUSE Contributors — Built with <a href="https://expressjs.com/">Express</a> + <a href="https://www.prisma.io/">Prisma</a></footer>
      `);
    });

    // 🩵 Health check
    app.get("/api/health", (req, res) => res.json({ status: "ok" }));

    // 🧩 Auth mode info (for frontend auto-detection)
    app.get("/api/auth-mode", (req, res) => {
      res.json({ mode: process.env.AUTH_MODE || "LOCAL" });
    });

    app.get("/api/debug/session", (req, res) => {
      res.json({
        hasSession: !!req.session,
        sessionID: req.sessionID,
        sessionData: req.session,
      });
    });

    // 🔐 HTTPS or HTTP startup
    const CERT_KEY = process.env.CERT_KEY_PATH || path.resolve("certs/localhost-key.pem");
    const CERT_CRT = process.env.CERT_CRT_PATH || path.resolve("certs/localhost.pem");

    const hasCerts = fs.existsSync(CERT_KEY) && fs.existsSync(CERT_CRT);
    const port = process.env.PORT || 3000;

    if (hasCerts) {
      const key = fs.readFileSync(CERT_KEY);
      const cert = fs.readFileSync(CERT_CRT);
      https.createServer({ key, cert }, app).listen(port, () => {
        console.log(`✅ HTTPS backend running at https://localhost:${port}`);
        console.log(`🔒 Using certificates from: ${CERT_KEY} and ${CERT_CRT}`);
      });
    } else {
      console.warn("⚠️ HTTPS certificates not found — falling back to HTTP.");
      app.listen(port, () => {
        console.log(`⚙️ HTTP backend running at http://localhost:${port}`);
      });
    }
  })();
