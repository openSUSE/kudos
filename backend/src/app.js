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
import { expandEnvironment, normalizeLocalUrl } from "./utils/localOrigins.js";

// ----------------------------------------------------------------------
// Environment loading (production + development)
// ----------------------------------------------------------------------

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
// Match local URLs to the protocol the backend can actually serve. Local HTTPS
// is retained only when both configured certificate files are present.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const defaultCertDir = process.env.NODE_ENV === "production" ? "/etc/kudos/certs" : path.join(repoRoot, "certs");
const CERT_KEY = path.resolve(repoRoot, process.env.CERT_KEY_PATH || path.join(defaultCertDir, "localhost-key.pem"));
const CERT_CRT = path.resolve(repoRoot, process.env.CERT_CRT_PATH || path.join(defaultCertDir, "localhost.pem"));
const hasCertificates = fs.existsSync(CERT_KEY) && fs.existsSync(CERT_CRT);
const normalizeUrl = (value) => normalizeLocalUrl(value, { hasCertificates });
const FRONTEND_ORIGIN = new URL(normalizeUrl(
  process.env.FRONTEND_ORIGIN || process.env.VITE_DEV_SERVER || "http://localhost:5173"
)).origin;
const BACKEND_ORIGIN = new URL(normalizeUrl(
  process.env.BACKEND_ORIGIN || "http://localhost:3000"
)).origin;

process.env.FRONTEND_ORIGIN = FRONTEND_ORIGIN;
process.env.VITE_DEV_SERVER = FRONTEND_ORIGIN;
process.env.BACKEND_ORIGIN = BACKEND_ORIGIN;

const ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || FRONTEND_ORIGIN)
  .split(",")
  .map((origin) => new URL(normalizeUrl(origin.trim())).origin);
process.env.CORS_ALLOWED_ORIGINS = ALLOWED_ORIGINS.join(",");

const originVariables = { BACKEND_ORIGIN, VITE_DEV_SERVER: FRONTEND_ORIGIN };
const configuredRedirect = process.env.OIDC_REDIRECT_URI || "${BACKEND_ORIGIN}/auth/callback";
process.env.OIDC_REDIRECT_URI = normalizeUrl(
  expandEnvironment(configuredRedirect, originVariables)
);
const configuredPostLogin = process.env.OIDC_POST_LOGIN_REDIRECT || "${VITE_DEV_SERVER}/";
process.env.OIDC_POST_LOGIN_REDIRECT = normalizeUrl(
  expandEnvironment(configuredPostLogin, originVariables)
);
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
import { mountBotRoutes } from "./routes/bot.js";
import { mountWhoamiRoutes } from "./routes/whoami.js";
import { mountSummaryRoutes } from "./routes/summary.js";
import { mountNowRoutes } from "./routes/now.js";
import { mountNotificationsRoutes } from "./routes/notifications.js";
import { mountFollowRoutes } from "./routes/follow.js";
import { mountReportsRoutes } from "./routes/reports.js";
import { mountTeamRoutes } from "./routes/teams.js";
import { mountEventRoutes } from "./routes/events.js";

import { setupActivityPipeline } from "./services/activityPipeline.js";
import { syncKudosBadges } from "./services/kudosBadges.js";

// ----------------------------------------------------------------------
// App and database init
// ----------------------------------------------------------------------

const app = express();
const prisma = new PrismaClient();

setupActivityPipeline(prisma);



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
        secure: new URL(FRONTEND_ORIGIN).protocol === "https:",
        sameSite: new URL(FRONTEND_ORIGIN).protocol === "https:" ? "none" : "lax",
        domain: cookieDomain,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    })
  );

  // --------------------------------------------------------------------
  // Mount API routes
  // --------------------------------------------------------------------

  // Express 5 no longer exposes a mounted router's prefix on its layer, so we
  // record the prefixes ourselves while the routes are being attached. This is
  // what the /api and /api/html route indexes below are built from.
  const mountedRouters = [];
  const appUse = app.use.bind(app);
  app.use = (...args) => {
    const [prefix, handler] = args;
    if (typeof prefix === "string" && typeof handler === "function" && handler.stack) {
      mountedRouters.push({ prefix, router: handler });
    }
    return appUse(...args);
  };

  await mountAuth(app, prisma);
  mountStatsRoutes(app, prisma);
  mountUserProfileRoutes(app, prisma);
  mountUserRoutes(app, prisma);
  mountKudosRoutes(app, prisma);
  mountBadgesRoutes(app, prisma);
  mountAdminRoutes(app, prisma);
  mountBotRoutes(app, prisma);
  mountWhoamiRoutes(app, prisma);
  mountSummaryRoutes(app, prisma);
  mountNowRoutes(app, prisma);
  mountNotificationsRoutes(app, prisma);
  mountFollowRoutes(app, prisma);
  mountReportsRoutes(app, prisma);
  mountTeamRoutes(app, prisma);
  mountEventRoutes(app, prisma);

  // --------------------------------------------------------------------
  // Serve production frontend
  // --------------------------------------------------------------------
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const publicDir = path.resolve(__dirname, "../public");
  console.log("Serving frontend from:", publicDir);

  app.use(express.static(publicDir));

  // Collect every mounted route for the API indexes below. Express 5 keeps the
  // root stack on app.router; Express 4 kept it on app._router.
  const collectRoutes = () => {
    const routes = [];

    const addStack = (prefix, stack) => {
      for (const layer of stack || []) {
        // Skip RegExp paths (the SPA catch-all); they are not linkable.
        if (!layer.route || typeof layer.route.path !== "string") continue;
        const methods = Object.keys(layer.route.methods)
          .map((m) => m.toUpperCase())
          .join(", ");
        routes.push({ path: prefix + layer.route.path, methods });
      }
    };

    let rootStack;
    try {
      rootStack = app.router?.stack;
    } catch {
      // Express 4 throws from the deprecated app.router getter.
    }
    addStack("", rootStack || app._router?.stack);

    for (const { prefix, router } of mountedRouters) {
      addStack(prefix, router.stack);
    }

    routes.sort((a, b) => a.path.localeCompare(b.path));
    return routes;
  };

  // Simple API route index
  app.get("/api", (req, res) => {
    res.json({ backend: BACKEND_ORIGIN, routes: collectRoutes() });
  });

  app.get("/api/health", (req, res) => res.json({ status: "ok" }));

  // --------------------------------------------------------------------
  // Additional diagnostic and utility routes
  // --------------------------------------------------------------------


  // Display current session diagnostics
  app.get("/api/debug/session", (req, res) => {
    res.json({
      hasSession: !!req.session,
      sessionID: req.sessionID,
      sessionData: req.session,
    });
  });

  // Slack OAuth redirect confirmation
  app.get("/api/slack/oauth_redirect", (req, res) => {
    res.send(`
      <html>
        <body style="font-family: sans-serif; padding: 2em;">
          <h2>Slack bot installed</h2>
          <p>You can close this tab.</p>
        </body>
      </html>
    `);
  });

  // --------------------------------------------------------------------
  // Pretty HTML API browser (restored)
  // --------------------------------------------------------------------
  app.get("/api/html", (req, res) => {
    const routeList = collectRoutes()
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

      <h1>openSUSE Kudos API Browser</h1>
      <p>Backend: <code>${BACKEND_ORIGIN}</code></p>

      <h2>API Endpoints</h2>
      <ul>${routeList}</ul>

      <footer>Open Source • Express • Prisma</footer>
    `);
  });


  // --------------------------------------------------------------------
  // SPA fallback
  // --------------------------------------------------------------------
  // NOTE: use a RegExp, not "*". Express 5 (path-to-regexp v8) rejects a bare
  // "*" with 'Missing parameter name'; a RegExp works on both Express 4 and 5.
  app.get(/.*/, (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(publicDir, "index.html"));
  });

  // --------------------------------------------------------------------
  // HTTPS / HTTP startup
  // --------------------------------------------------------------------
  // The MEMBER and MODERATOR roles never granted anything; STEWARD replaced
  // MODERATOR. The schema is applied with `prisma db push`, which leaves
  // SQLite rows alone, and the client can't read a role it doesn't know.
  // Remove once no database has either left.
  try {
    const stewards = await prisma.$executeRaw`UPDATE "User" SET "role" = 'STEWARD' WHERE "role" = 'MODERATOR'`;
    const users = await prisma.$executeRaw`UPDATE "User" SET "role" = 'USER' WHERE "role" = 'MEMBER'`;
    if (stewards || users) {
      console.log(`🧭 Roles retired: ${stewards} MODERATOR → STEWARD, ${users} MEMBER → USER`);
    }
  } catch (err) {
    console.error("💥 Failed to move users off retired roles:", err);
  }

  // Pick up badges added in kudos-badges since the last start. A failure here
  // must not keep the site down; the badges already in the database still work.
  try {
    await syncKudosBadges(prisma);
  } catch (err) {
    console.error("💥 kudos-badges sync failed:", err);
  }

  const port = process.env.PORT || 3000;
  const backendUsesHttps = hasCertificates && new URL(BACKEND_ORIGIN).protocol === "https:";

  if (backendUsesHttps) {
    const key = fs.readFileSync(CERT_KEY);
    const cert = fs.readFileSync(CERT_CRT);
    https.createServer({ key, cert }, app).listen(port, () => {
      console.log(`HTTPS backend running at ${BACKEND_ORIGIN}`);
    });
  } else {
    if (new URL(BACKEND_ORIGIN).protocol === "https:") {
      console.warn("HTTPS was configured but its certificate pair is unavailable; serving HTTP.");
    }
    app.listen(port, () => {
      console.log(`HTTP backend listening on port ${port}`);
    });
  }
})();
