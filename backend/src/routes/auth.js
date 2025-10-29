// backend/src/routes/auth.js
// Copyright © 2025–present Lubos Kocman and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0

import express from "express";
import bcrypt from "bcrypt";
import * as oidc from "openid-client";
import dotenv from "dotenv";
import { isAdminUser } from "../utils/user.js";

dotenv.config();

/**
 * Mounts authentication routes (LOCAL or OIDC) on the Express app.
 */
export async function mountAuth(app, prisma) {
  const AUTH_MODE = process.env.AUTH_MODE || "LOCAL";

  // --- Attach current user from session ---
  app.use(async (req, res, next) => {
    if (req.session?.userId) {
      req.currentUser = await prisma.user.findUnique({
        where: { id: req.session.userId },
      });
      res.locals.currentUser = req.currentUser;
    } else {
      req.currentUser = null;
      res.locals.currentUser = null;
    }
    next();
  });

  // ================================================================
  // LOCAL AUTH MODE
  // ================================================================
  if (AUTH_MODE === "LOCAL") {
    console.log("🔐 Using LOCAL authentication mode");

    // ── HTML form for testing ─────────────────────────────────────
    app.get("/api/login", (req, res) => {
      res.send(`
        <form method="post" action="/api/login">
          <h1>openSUSE Kudos Login</h1>
          <input name="username" placeholder="Username" />
          <input name="password" placeholder="Password" type="password" />
          <button type="submit">Login</button>
        </form>
      `);
    });

    app.post("/api/login", express.urlencoded({ extended: true }), async (req, res) => {
      const { username, password } = req.body;
      console.log("🧩 Login attempt:", username);

      let user = await prisma.user.findUnique({ where: { username } });

      if (!user) {
        // First-time user → determine role once
        const isAdmin = isAdminUser(username);
        user = await prisma.user.create({
          data: {
            username,
            passwordHash: await bcrypt.hash(password, 10),
            role: isAdmin ? "ADMIN" : "USER",
          },
        });
        if (isAdmin) console.log(`👑 Created ADMIN user: ${username}`);
      } else {
        const valid = user.passwordHash
          ? await bcrypt.compare(password, user.passwordHash)
          : password === "opensuse"; // dev fallback

        if (!valid) return res.status(401).json({ error: "Invalid username or password" });
      }

      req.session.userId = user.id;
      req.session.save((err) => {
        if (err) {
          console.error("💥 Session save failed:", err);
          return res.status(500).json({ error: "Session save failed" });
        }
        console.log(`✅ Login success for: ${user.username}`);
        res.redirect("/");
      });
    });

    // ── JSON API endpoints ─────────────────────────────────────────
    app.post("/api/auth/login", express.json(), async (req, res) => {
      const { username, password } = req.body;
      if (!username || !password)
        return res.status(400).json({ error: "Missing username or password" });

      try {
        let user = await prisma.user.findUnique({ where: { username } });

        if (!user) {
          // First login: assign admin if listed
          const isAdmin = isAdminUser(username);
          user = await prisma.user.create({
            data: {
              username,
              passwordHash: await bcrypt.hash(password, 10),
              role: isAdmin ? "ADMIN" : "USER",
            },
          });
          if (isAdmin) console.log(`👑 Created ADMIN user: ${username}`);
        } else {
          const valid = user.passwordHash
            ? await bcrypt.compare(password, user.passwordHash)
            : password === "opensuse";
          if (!valid) return res.status(401).json({ error: "Invalid credentials" });
        }

        req.session.regenerate(async (err) => {
          if (err) return res.status(500).json({ error: "Session error" });
          req.session.userId = user.id;
          req.session.save((err) => {
            if (err) return res.status(500).json({ error: "Session save failed" });
            console.log(`✅ JSON login success for: ${user.username}`);
            res.json({
              id: user.id,
              username: user.username,
              role: user.role,
              avatarUrl: user.avatarUrl,
            });
          });
        });
      } catch (err) {
        console.error("💥 JSON login error:", err);
        res.status(500).json({ error: "Internal login error" });
      }
    });

    app.get("/api/whoami", async (req, res) => {
      if (!req.session.userId) return res.json({ authenticated: false });

      const user = await prisma.user.findUnique({
        where: { id: req.session.userId },
        select: { id: true, username: true, role: true, avatarUrl: true },
      });

      if (!user) return res.json({ authenticated: false });
      res.json({ authenticated: true, ...user });
    });

    return; // stop before OIDC section
  }

  // ================================================================
  // OIDC AUTH MODE
  // ================================================================
  console.log("🔐 Using OIDC authentication mode");
  console.log("🌍 Discovering issuer from:", process.env.OIDC_ISSUER_URL);

  const clientPromise = oidc.Issuer.discover(process.env.OIDC_ISSUER_URL)
    .then((issuer) => {
      console.log("✅ OIDC provider discovered:", issuer.issuer);
      return new issuer.Client({
        client_id: process.env.OIDC_CLIENT_ID,
        client_secret: process.env.OIDC_CLIENT_SECRET,
        redirect_uris: [process.env.OIDC_REDIRECT_URI],
        response_types: ["code"],
      });
    })
    .catch((err) => {
      console.error("💥 OIDC discovery failed:", err);
      throw err;
    });

  // --- Login route -------------------------------------------------
  app.get("/api/login", async (req, res) => {
    try {
      const client = await clientPromise;
      const code_verifier = oidc.generators.codeVerifier();
      const code_challenge = oidc.generators.codeChallenge(code_verifier);
      const state = oidc.generators.state();

      req.session.code_verifier = code_verifier;
      req.session.state = state;

      const authorizationUrl = client.authorizationUrl({
        scope: process.env.OIDC_SCOPES || "openid profile email",
        code_challenge,
        code_challenge_method: "S256",
        state,
      });

      console.log("🔗 Redirecting to:", authorizationUrl);
      res.redirect(authorizationUrl);
    } catch (e) {
      console.error("💥 OIDC /api/login failed:", e);
      res.status(500).send("OIDC initialization error.");
    }
  });

  // --- Callback route ----------------------------------------------
  app.get("/auth/callback", async (req, res, next) => {
    try {
      const client = await clientPromise;
      const params = client.callbackParams(req);
      const tokenSet = await client.callback(
        process.env.OIDC_REDIRECT_URI,
        params,
        {
          code_verifier: req.session.code_verifier,
          state: req.session.state,
        }
      );

      // Required for logout to identify the session to be terminated
      req.session.id_token = tokenSet.id_token;
      const userinfo = await client.userinfo(tokenSet.access_token);
      console.log("👤 UserInfo:", userinfo);

      const username =
        userinfo.preferred_username ||
        (userinfo.email
          ? userinfo.email.split("@")[0]
          : `user_${Math.random().toString(36).slice(2, 8)}`);

      let user = await prisma.user.findUnique({ where: { username } });

      if (!user) {
        // First-time login only → respect ADMIN_USERS
        const isAdmin = isAdminUser(username) || isAdminUser(userinfo.email);
        user = await prisma.user.create({
          data: {
            username,
            email: userinfo.email || null,
            role: isAdmin ? "ADMIN" : "USER",
          },
        });
        if (isAdmin) console.log(`👑 Created ADMIN user: ${username} (OIDC first login)`);
      } else {
        // Existing user → only update email if changed
        await prisma.user.update({
          where: { id: user.id },
          data: { email: userinfo.email || user.email },
        });
      }

      req.session.userId = user.id;
      req.session.save(() => {
        const frontendUrl =
          process.env.NODE_ENV === "production"
            ? "/"
            : process.env.VITE_DEV_SERVER;

        console.log(`🔁 Redirecting to frontend: ${frontendUrl}`);
        res.redirect(frontendUrl);
      });
    } catch (e) {
      console.error("💥 OIDC callback error:", e);
      next(e);
    }
  });

  // --- Unified logout route for both LOCAL and OIDC ---------------
  app.post("/api/auth/logout", async (req, res) => {
    try {
      const client = AUTH_MODE === "OIDC" ? await clientPromise : null;
      const idToken = req.session.id_token;

      let redirectUrl = "/";

      if (client && idToken) {
        redirectUrl = client.endSessionUrl({
          id_token_hint: idToken,
          post_logout_redirect_uri: process.env.OIDC_LOGOUT_REDIRECT_URI || "/",
        });
      }

      req.session.destroy(() => {
        console.log(`👋 Logged out (${AUTH_MODE})`);
        res.json({ redirect: redirectUrl });
      });
    } catch (err) {
      console.error("💥 Logout failed:", err);
      req.session.destroy(() => res.json({ redirect: "/" }));
    }
  });  // ← add this closing parenthesis for app.post()
}       // ← closes mountAuth()
