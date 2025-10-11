// src/auth.js
import express from "express";
import session from "express-session";
import bcrypt from "bcrypt";
import * as oidc from "openid-client";
import dotenv from "dotenv";

dotenv.config();

export async function mountAuth(app, prisma) {
  const AUTH_MODE = process.env.AUTH_MODE || "LOCAL";

  // --- session setup ---
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "dev-secret",
      resave: false,
      saveUninitialized: false,
    })
  );

  // --- expose current user ---
  app.use(async (req, res, next) => {
    if (req.session?.userId) {
      req.currentUser = await prisma.user.findUnique({ where: { id: req.session.userId } });
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
    console.log("LOCAL mode active; OIDC disabled.");

    app.get("/login", (req, res) => {
      res.render("login", { title: "Login · openSUSE Kudos", error: null });
    });

    // Handle login submission
    app.post("/login", express.urlencoded({ extended: true }), async (req, res) => {
      const { username, password } = req.body;
      console.log("🧩 Login attempt:", username);

      const user = await prisma.user.findUnique({ where: { username } });
      if (!user) {
        console.log("❌ User not found:", username);
        return res.status(401).render("login", {
          title: "Login · openSUSE Kudos",
          error: "Invalid username or password",
        });
      }

      try {
        if (!user.passwordHash) {
          if (password !== "opensuse") {
            return res.status(401).send("Invalid username or password");
          }
        } else {
          const match = await bcrypt.compare(password, user.passwordHash);
          if (!match) {
            return res.status(401).send("Invalid username or password");
          }
        }

        req.session.userId = user.id;
        console.log("✅ Login success for:", user.username);
        res.redirect("/");
      } catch (err) {
        console.error("💥 Error during login:", err);
        res.status(500).send("Internal login error");
      }
    });

    // Logout
    app.get("/logout", (req, res) => {
      req.session.destroy(() => res.redirect("/"));
    });

    return; // Skip OIDC setup completely
  }

  // ================================================================
  // OIDC AUTH MODE (openid-client v7+)
  // ================================================================
  console.log("OIDC mode active; connecting to", process.env.OIDC_ISSUER_URL);
  const issuerUrl = new URL(process.env.OIDC_ISSUER_URL || "https://id.opensuse.org/openid");

  // Discover configuration from the issuer
  const config = await oidc.discovery(
    issuerUrl,
    process.env.OIDC_CLIENT_ID,
    process.env.OIDC_CLIENT_SECRET
  );

  console.log("✅ OIDC discovery successful:", config.serverMetadata().issuer);

  // Login route (redirect user to provider)
  app.get("/login", async (req, res) => {
    const code_verifier = oidc.randomPKCECodeVerifier();
    const code_challenge = await oidc.calculatePKCECodeChallenge(code_verifier);
    const state = oidc.randomState();

    req.session.code_verifier = code_verifier;
    req.session.state = state;

    const redirect_uri = process.env.OIDC_REDIRECT_URI;

    const authorizationUrl = oidc.buildAuthorizationUrl(config, {
      redirect_uri,
      scope: "openid profile email",
      code_challenge,
      code_challenge_method: "S256",
      state,
    });

    console.log("🔗 Redirecting to:", authorizationUrl.href);
    res.redirect(authorizationUrl.href);
  });

  // Callback handler
  app.get("/auth/callback", async (req, res, next) => {
    try {
      const currentUrl = new URL(req.originalUrl, `${req.protocol}://${req.get("host")}`);

      const tokens = await oidc.authorizationCodeGrant(config, currentUrl, {
        pkceCodeVerifier: req.session.code_verifier,
        expectedState: req.session.state,
      });

      console.log("✅ Tokens received:", Object.keys(tokens));

      // Fetch userinfo if supported
      let userinfo = {};
      const userinfoEndpoint = config.serverMetadata().userinfo_endpoint;
      if (userinfoEndpoint) {
        const resp = await oidc.fetchProtectedResource(
          config,
          tokens.access_token,
          new URL(userinfoEndpoint),
          "GET"
        );
        userinfo = await resp.json();
        console.log("👤 UserInfo:", userinfo);
      }

      // Normalize username
      const username =
        userinfo.preferred_username ||
        (userinfo.email ? userinfo.email.split("@")[0] : null) ||
        `user_${Math.random().toString(36).slice(2, 8)}`;

      const user = await prisma.user.upsert({
        where: { username },
        update: { email: userinfo.email || null },
        create: { username, email: userinfo.email || null, role: "USER" },
      });

      req.session.userId = user.id;
      res.redirect("/");
    } catch (e) {
      console.error("💥 OIDC callback error:", e);
      next(e);
    }
  });

  app.get("/logout", (req, res) => {
    req.session.destroy(() => res.redirect("/"));
  });
}
