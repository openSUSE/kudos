// backend/src/routes/auth.js
// Copyright © 2025–present Lubos Kocman and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0

import express from "express";
import bcrypt from "bcrypt";
import * as oidc from "openid-client";
import dotenv from "dotenv";

dotenv.config();

/**
 * Mounts authentication routes (LOCAL or OIDC) on the Express app.
 * Supports both HTML-based login and JSON API login (Vue frontend).
 */
export async function mountAuth(app, prisma) {
  const AUTH_MODE = process.env.AUTH_MODE || "LOCAL";

  // --- Middleware to attach current user ---
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

    // ----------------------------------------------------------------
    // 🧩 Legacy HTML login (optional, dev only)
    // ----------------------------------------------------------------
    app.get("/login", (req, res) => {
      res.send(`
        <form method="post" action="/login">
          <h1>openSUSE Kudos Login</h1>
          <input name="username" placeholder="Username" />
          <input name="password" placeholder="Password" type="password" />
          <button type="submit">Login</button>
        </form>
      `);
    });

    app.post("/login", express.urlencoded({ extended: true }), async (req, res) => {
      const { username, password } = req.body;
      console.log("🧩 Login attempt:", username);

      const user = await prisma.user.findUnique({ where: { username } });
      if (!user) return res.status(401).json({ error: "Invalid username or password" });

      try {
        const valid = user.passwordHash
          ? await bcrypt.compare(password, user.passwordHash)
          : password === "opensuse"; // dev fallback

        if (!valid) return res.status(401).json({ error: "Invalid username or password" });

        req.session.userId = user.id;

        req.session.save((err) => {
          if (err) {
            console.error("💥 Session save failed:", err);
            return res.status(500).json({ error: "Session save failed" });
          }

          console.log(`✅ Login success for: ${user.username}`);
          res.redirect("/");
        });
      } catch (err) {
        console.error("💥 Error during login:", err);
        res.status(500).json({ error: "Internal login error" });
      }
    });

    app.get("/logout", (req, res) => {
      req.session.destroy(() => res.redirect("/"));
    });

    // ----------------------------------------------------------------
    // 🧩 JSON API login for Vue frontend
    // ----------------------------------------------------------------
   // 🧩 JSON API login for Vue frontend (clean version)
app.post("/api/auth/login", express.json(), async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: "Missing username or password" });

  try {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const valid = user.passwordHash
      ? await bcrypt.compare(password, user.passwordHash)
      : password === "opensuse";
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    req.session.regenerate(async (err) => {
      if (err) {
        console.error("💥 Session regeneration failed:", err);
        return res.status(500).json({ error: "Session error" });
      }

      req.session.userId = user.id;
      req.session.save((err) => {
        if (err) {
          console.error("💥 Session save failed:", err);
          return res.status(500).json({ error: "Session save failed" });
        }

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


    // ----------------------------------------------------------------
    // 🧩 JSON logout endpoint
    // ----------------------------------------------------------------
    app.post("/api/auth/logout", (req, res) => {
      req.session.destroy(() => res.json({ success: true }));
    });

    // ----------------------------------------------------------------
    // 🧩 JSON whoami endpoint
    // ----------------------------------------------------------------
    app.get("/api/whoami", async (req, res) => {
      if (!req.session.userId) {
        return res.status(200).json({ authenticated: false });
      }

      const user = await prisma.user.findUnique({
        where: { id: req.session.userId },
        select: { id: true, username: true, role: true, avatarUrl: true },
      });

      if (!user) {
        return res.status(200).json({ authenticated: false });
      }

      res.status(200).json({
        authenticated: true,
        ...user,
      });
    });

    return; // stop before OIDC
  }

  // ================================================================
  // OIDC AUTH MODE
  // ================================================================
  console.log("🔐 Using OIDC authentication mode");

  const issuerUrl = new URL(process.env.OIDC_ISSUER_URL);
  const issuer = await oidc.Issuer.discover(issuerUrl.href);
  const client = new issuer.Client({
    client_id: process.env.OIDC_CLIENT_ID,
    client_secret: process.env.OIDC_CLIENT_SECRET,
    redirect_uris: [process.env.OIDC_REDIRECT_URI],
    response_types: ["code"],
  });

  app.get("/login", async (req, res) => {
    const code_verifier = oidc.generators.codeVerifier();
    const code_challenge = oidc.generators.codeChallenge(code_verifier);
    const state = oidc.generators.state();

    req.session.code_verifier = code_verifier;
    req.session.state = state;

    const authorizationUrl = client.authorizationUrl({
      scope: "openid profile email",
      code_challenge,
      code_challenge_method: "S256",
      state,
    });

    console.log("🔗 Redirecting to:", authorizationUrl);
    res.redirect(authorizationUrl);
  });

  app.get("/auth/callback", async (req, res, next) => {
    try {
      const params = client.callbackParams(req);
      const tokenSet = await client.callback(process.env.OIDC_REDIRECT_URI, params, {
        code_verifier: req.session.code_verifier,
        state: req.session.state,
      });

      const userinfo = await client.userinfo(tokenSet.access_token);
      const username =
        userinfo.preferred_username ||
        (userinfo.email ? userinfo.email.split("@")[0] : `user_${Math.random().toString(36).slice(2, 8)}`);

      const user = await prisma.user.upsert({
        where: { username },
        update: { email: userinfo.email || null },
        create: { username, email: userinfo.email || null, role: "USER" },
      });

      req.session.userId = user.id;
      req.session.save(() => res.redirect("/"));
    } catch (e) {
      console.error("💥 OIDC callback error:", e);
      next(e);
    }
  });

  app.get("/logout", (req, res) => {
    req.session.destroy(() => res.redirect("/"));
  });
}
