// backend/src/routes/auth.js
// Copyright © 2025–present Lubos Kocman and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0

import express from "express";
import bcrypt from "bcryptjs";
import { Issuer, generators } from "openid-client";
import { isAdminUser } from "../utils/user.js";

/**
 * Mounts authentication routes (LOCAL or OIDC) on the Express app.
 */
export async function mountAuth(app, prisma) {
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

  // Helper to generate frontend redirect base URL
  function getFrontendBase() {
    return process.env.NODE_ENV === "production"
      ? "/"                                 // production: same host
      : process.env.VITE_DEV_SERVER || "http://localhost:5173";  // dev
  }

  // ================================================================
  // OIDC AUTH MODE
  // ================================================================
  console.log("🔐 Using OIDC authentication mode");
  console.log("🌍 Discovering issuer:", process.env.OIDC_ISSUER_URL);
  
  let oidcClient = null;
  
  /**
   * Attempts to discover the OIDC provider and initialize the client.
   * Schedules retries with exponential backoff on failure.
   */
  async function initializeOidcClient(retryCount = 0) {
    try {
      const issuer = await Issuer.discover(process.env.OIDC_ISSUER_URL);
      oidcClient = new issuer.Client({
        client_id: process.env.OIDC_CLIENT_ID,
        client_secret: process.env.OIDC_CLIENT_SECRET,
        redirect_uris: [process.env.OIDC_REDIRECT_URI],
        response_types: ["code"],
      });
      console.log("✅ OIDC provider discovered and client initialized:", issuer.issuer);
    } catch (err) {
      const maxRetries = 5;
      const backoffDelay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s, ...
      console.error(`💥 OIDC discovery failed (attempt ${retryCount + 1}):`, err.message);
      
      if (retryCount < maxRetries) {
        console.log(`🔁 Retrying OIDC discovery in ${backoffDelay / 1000}s...`);
        setTimeout(() => initializeOidcClient(retryCount + 1), backoffDelay);
      } else {
        console.error("🚫 Max retries reached. OIDC client could not be initialized.");
      }
    }
  }
  
  // Start the initial discovery process without blocking the app startup.
  initializeOidcClient();

  // --- OIDC login --------------------------------------------------
  app.get("/api/login", async (req, res) => {
    try {
      if (!oidcClient) {
        return res.status(503).send("OIDC provider is currently unavailable. Please try again later.");
      }

      const code_verifier = generators.codeVerifier();
      const code_challenge = generators.codeChallenge(code_verifier);
      const state = generators.state();

      req.session.code_verifier = code_verifier;
      req.session.state = state;

      const authorizationUrl = oidcClient.authorizationUrl({
        scope: process.env.OIDC_SCOPES || "openid profile email",
        code_challenge,
        code_challenge_method: "S256",
        state,
      });

      console.log("🔗 Redirecting OIDC login to:", authorizationUrl);
      res.redirect(authorizationUrl);
    } catch (e) {
      console.error("💥 OIDC /api/login failed:", e);
      res.status(500).send("OIDC initialization error.");
    }
  });

  // --- OIDC callback ------------------------------------------------
  app.get("/auth/callback", async (req, res, next) => {
    try {
      if (!oidcClient) {
        return res.status(503).send("OIDC provider is currently unavailable. Cannot process callback.");
      }

      const params = oidcClient.callbackParams(req);

      const tokenSet = await oidcClient.callback(
        process.env.OIDC_REDIRECT_URI,
        params,
        {
          code_verifier: req.session.code_verifier,
          state: req.session.state,
        }
      );

      req.session.id_token = tokenSet.id_token;

      const userinfo = await oidcClient.userinfo(tokenSet.access_token);
      console.log("👤 UserInfo:", userinfo);

      const username =
        userinfo.preferred_username ||
        (userinfo.email
          ? userinfo.email.split("@")[0]
          : `user_${Math.random().toString(36).slice(2, 8)}`);

      let user = await prisma.user.findUnique({ where: { username } });

      if (!user) {
        const isAdmin = isAdminUser(username) || isAdminUser(userinfo.email);
        user = await prisma.user.create({
          data: {
            username,
            email: userinfo.email || null,
            role: isAdmin ? "ADMIN" : "USER",
          },
        });
        if (isAdmin) console.log(`👑 Created ADMIN user: ${username}`);
      } else {
        await prisma.user.update({
          where: { id: user.id },
          data: { email: userinfo.email || user.email },
        });
      }

      req.session.userId = user.id;

      req.session.save(() => {
        const frontendBase = getFrontendBase();
        console.log(`🏁 OIDC login → Redirecting to ${frontendBase}/user/${user.username}`);

        res.redirect(`${frontendBase}/user/${user.username}`);
      });
    } catch (e) {
      console.error("💥 OIDC callback error:", e);
      next(e);
    }
  });

  // --- OIDC logout -------------------------------------------------
  app.post("/api/logout", express.json(), async (req, res) => {
    try {
      const idToken = req.session.id_token;
      const { post_logout_redirect_uri } = req.body;

      // If OIDC client is available, generate the OIDC logout URL.
      if (oidcClient && idToken) {
        const oidcLogoutUrl = oidcClient.endSessionUrl({
          id_token_hint: idToken,
          post_logout_redirect_uri: post_logout_redirect_uri || getFrontendBase(),
        });
        // Destroy session and respond with the OIDC redirect URL
        return req.session.destroy(() => {
          console.log(`👋 OIDC logout initiated, redirecting to provider.`);
          res.json({ redirect: oidcLogoutUrl });
        });
      }

      // Fallback: If no OIDC client or token, just destroy the local session.
      req.session.destroy(() => {
        console.log(`👋 Local session destroyed (OIDC provider unavailable or no token).`);
        res.json({ redirect: post_logout_redirect_uri || getFrontendBase() });
      });
    } catch (err) {
      console.error("💥 Logout failed:", err);
      req.session.destroy(() => res.json({ redirect: "/" }));
    }
  });

  // --- Who am I ----------------------------------------------------
  app.get("/api/whoami", async (req, res) => {
    if (!req.session.userId) {
      return res.json({ authenticated: false });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.session.userId },
      select: { id: true, username: true, role: true, avatarUrl: true },
    });

    if (!user) return res.json({ authenticated: false });

    res.json({ authenticated: true, ...user });
  });
}
