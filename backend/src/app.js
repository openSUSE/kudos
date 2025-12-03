// backend/app.js
// SPDX-License-Identifier: Apache-2.0

import fs from "fs";
import path from "path";
import https from "https";

import cors from "cors";
import session from "express-session";
import cookieParser from "cookie-parser";
import express from "express";
import { PrismaClient } from "@prisma/client";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

// ----------------------------------------------------------------------
// Environment loading (production + development)
// ----------------------------------------------------------------------

import dotenv from "dotenv";
import fs from "fs";
import path from "path";

// Production default
const systemEnv = "/etc/kudos/kudos.env";

// Development default
const localEnv = path.resolve("./.env");

let envLoaded = false;

// Try system env first
if (fs.existsSync(systemEnv)) {
  dotenv.config({ path: systemEnv });
  console.log(`Loaded environment from ${systemEnv}`);
  envLoaded = true;
}

// If no system env, try local checkout .env
else if (fs.existsSync(localEnv)) {
  dotenv.config({ path: localEnv });
  console.log(`Loaded environment from ${localEnv}`);
  envLoaded = true;
}

if (!envLoaded) {
  console.log("No dotenv file found; relying only on system environment.");
}
// ----------------------------------------------------------------------
// Route imports
// ----------------------------------------------------------------------

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
import { mountFollowRoutes } from "./routes/follow.js";

import { setupActivityPipeline } from "./services/activityPipeline.js";

// ----------------------------------------------------------------------
// App and database init
// ----------------------------------------------------------------------

const app = express();
const prisma = new PrismaClient();

setupActivityPipeline(prisma);

// ----------------------------------------------------------------------
// Origin settings
// ----------------------------------------------------------------------

const FRONTEND_ORIGIN =
  process.env.FRONTEND_ORIGIN ||
  process.env.VITE_DEV_SERVER ||
  "https://localhost:5173";

const BACKEND_ORIGIN =
  process.env.BACKEND_ORIGIN ||
  "https://localhost:3000";

const ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || FRONTEND_ORIGIN)
  .split(",")
  .map((o) => o.trim());

// ----------------------------------------------------------------------
// Async wrapper for top-level await
// ----------------------------------------------------------------------

(async () => {
  // --------------------------------------------------------------------
  // CORS middleware
  // --------------------------------------------------------------------
  app.use(
    cors({
      origin: ALLOWED_ORIGINS,
      credentials: true,
    })
  );

  // --------------------------------------------------------------------
  // Core middleware
  // --------------------------------------------------------------------
  app.use(express.json());
  app.use(cookieParser());

  // --------------------------------------------------------------------
  // Session configuration
  // --------------------------------------------------------------------
  app.set("trust proxy", 1);

  const { default: FileStore } = await import("session-file-store");
  const FileStoreSession = FileStore(session);

  const isLocal =
    FRONTEND_ORIGIN.includes("localhost") ||
    FRONTEND_ORIGIN.includes("127.0.0.1");

  const cookieDomain = !isLocal
    ? new URL(FRONTEND_ORIGIN).hostname
    : undefined;

  const sessionPath =
    process.env.SESSION_STORE_PATH || "/var/lib/kudos/sessions";

  app.use(
    session({
      store: new FileStoreSession({ path: sessionPath, ttl: 86400 }),
      secret: process.env.SESSION_SECRET || "development-secret",
      resave: false,
      saveUninitialized: false,
      name: "connect.sid",
      proxy: true,
      cookie: {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        domain: cookieDomain,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    })
  );

  // --------------------------------------------------------------------
  // Mount API routes
  // --------------------------------------------------------------------
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
  mountFollowRoutes(app, prisma);

  // --------------------------------------------------------------------
  // Serve production frontend
  // --------------------------------------------------------------------
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const publicDir = path.resolve(__dirname, "../public");
  console.log("Serving frontend from:", publicDir);

  app.use(express.static(publicDir));

  // Simple API route index
  app.get("/api", (req, res) => {
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

    res.json({ backend: BACKEND_ORIGIN, routes });
  });

  app.get("/api/health", (req, res) => res.json({ status: "ok" }));

  // --------------------------------------------------------------------
  // SPA fallback
  // --------------------------------------------------------------------
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(publicDir, "index.html"));
  });

  // --------------------------------------------------------------------
  // HTTPS / HTTP startup
  // --------------------------------------------------------------------
  const CERT_KEY = process.env.CERT_KEY_PATH || "/etc/kudos/certs/localhost-key.pem";
  const CERT_CRT = process.env.CERT_CRT_PATH || "/etc/kudos/certs/localhost.pem";

  const hasCerts = fs.existsSync(CERT_KEY) && fs.existsSync(CERT_CRT);
  const port = process.env.PORT || 3000;

  if (hasCerts) {
    const key = fs.readFileSync(CERT_KEY);
    const cert = fs.readFileSync(CERT_CRT);
    https.createServer({ key, cert }, app).listen(port, () => {
      console.log(`HTTPS backend running at ${BACKEND_ORIGIN}`);
    });
  } else {
    console.warn("No HTTPS certificates found; falling back to HTTP.");
    app.listen(port, () => {
      console.log(
        `HTTP backend running at ${BACKEND_ORIGIN.replace("https", "http")}`
      );
    });
  }
})();

