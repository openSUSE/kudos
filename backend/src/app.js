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

const app = express();
const prisma = new PrismaClient();

// 🧩 Environment variables
const FRONTEND_ORIGIN = process.env.VITE_DEV_SERVER || "https://localhost:5173";
const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN || "https://localhost:3000";
const ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || FRONTEND_ORIGIN)
  .split(",")
  .map((o) => o.trim());

// 🟢 Main startup
(async () => {
  // 1️⃣ CORS setup
  app.use(
    cors({
      origin: ALLOWED_ORIGINS,
      credentials: true,
    })
  );

  // 2️⃣ Core middleware
  app.use(express.json());
  app.use(cookieParser());
  app.use(express.static("public"));

  // 3️⃣ Sessions (secure + cross-origin)
  app.set("trust proxy", 1);

  const { default: FileStore } = await import("session-file-store");
  const FileStoreSession = FileStore(session);

  const isLocal =
    FRONTEND_ORIGIN.includes("localhost") ||
    FRONTEND_ORIGIN.includes("127.0.0.1");

  const cookieDomain = !isLocal
    ? new URL(FRONTEND_ORIGIN).hostname
    : undefined;

  console.log(
    `🍪 Session cookie domain: ${cookieDomain || "(none — local dev mode)"}`
  );

  app.use(
    session({
      store: new FileStoreSession({ path: "./sessions", ttl: 86400 }),
      secret: process.env.SESSION_SECRET || "dev-secret",
      resave: false,
      saveUninitialized: false,
      name: "connect.sid",
      proxy: true,
      cookie: {
        httpOnly: true,
        secure: true,      // Always HTTPS
        sameSite: "none",  // ✅ Always allow cross-origin (5173 ↔ 3000, OIDC)
        domain: cookieDomain,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    })
  );

  // 4️⃣ Mount all routes
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

  // 🏠 Root endpoint (for quick inspection)
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
        body {
          font-family: system-ui, sans-serif;
          background: #1a1525;
          color: #e6e6e6;
          max-width: 720px;
          margin: 4em auto;
          padding: 0 1.5em;
        }
        h1 { color: #b083f0; }
        a { color: #1e8feb; text-decoration: none; }
        a:hover { color: #73ba25; }
        .method { display: inline-block; min-width: 56px; text-align: center; padding: 3px 6px; border-radius: 6px; color: white; font-size: 0.8rem; }
        .method-get { background: #73ba25; }
        .method-post { background: #1e8feb; }
        .method-put { background: #e6a700; }
        .method-delete { background: #ff5c5c; }
      </style>
      <h1>💜 openSUSE Kudos Backend</h1>
      <p>Backend running at <code>${BACKEND_ORIGIN}</code></p>
      <h2>📡 Available API Endpoints</h2>
      <ul>${routeList}</ul>
      <footer>© 2025 openSUSE Contributors — Express + Prisma</footer>
    `);
  });

  // 🩵 Health check
  app.get("/api/health", (req, res) => res.json({ status: "ok" }));

  // 🧩 Auth mode info
  app.get("/api/auth-mode", (req, res) => {
    res.json({ mode: process.env.AUTH_MODE || "LOCAL" });
  });

  // 🪪 Session debug
  app.get("/api/debug/session", (req, res) => {
    res.json({
      hasSession: !!req.session,
      sessionID: req.sessionID,
      sessionData: req.session,
    });
  });

  // 🔐 HTTPS startup
  const CERT_KEY = process.env.CERT_KEY_PATH || path.resolve("certs/localhost-key.pem");
  const CERT_CRT = process.env.CERT_CRT_PATH || path.resolve("certs/localhost.pem");

  const hasCerts = fs.existsSync(CERT_KEY) && fs.existsSync(CERT_CRT);
  const port = process.env.PORT || 3000;

  if (hasCerts) {
    const key = fs.readFileSync(CERT_KEY);
    const cert = fs.readFileSync(CERT_CRT);
    https.createServer({ key, cert }, app).listen(port, () => {
      console.log(`✅ HTTPS backend running at ${BACKEND_ORIGIN}`);
      console.log(`🔒 Using certificates from: ${CERT_KEY} and ${CERT_CRT}`);
    });
  } else {
    console.warn("⚠️ HTTPS certificates not found — falling back to HTTP.");
    app.listen(port, () => {
      console.log(`⚙️ HTTP backend running at ${BACKEND_ORIGIN.replace("https", "http")}`);
    });
  }
})();
