import express from "express";
import session from "express-session";
import bcrypt from "bcrypt";
import * as openid from "openid-client";
const { Issuer, generators } = openid;
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

    // Simple HTML login form
    app.get("/login", (req, res) => {
      res.send(`
        <form method="post" action="/login" style="max-width:320px;margin:40px auto;">
          <h2>Local Login</h2>
          <label>Username:</label><br/>
          <input name="username" required autofocus/><br/>
          <label>Password:</label><br/>
          <input type="password" name="password" required/><br/><br/>
          <button type="submit">Login</button>
        </form>
      `);
    });

    // Handle login submission
// Handle login submission (LOCAL MODE)
app.post("/login", express.urlencoded({ extended: true }), async (req, res) => {
  const { username, password } = req.body;

  console.log("🧩 Login attempt:", username);

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    console.log("❌ User not found:", username);
    return res.status(401).send("Invalid username or password");
  }

  console.log("✅ Found user:", user.username, "role:", user.role);
  console.log("🔐 Has passwordHash:", !!user.passwordHash);

  try {
    if (!user.passwordHash) {
      console.log("⚠️ No hash found, fallback to plain-text check");
      if (password !== "opensuse") {
        console.log("❌ Fallback password check failed");
        return res.status(401).send("Invalid username or password");
      }
    } else {
      const match = await bcrypt.compare(password, user.passwordHash);
      console.log("🔍 bcrypt.compare result:", match);
      if (!match) {
        console.log("❌ bcrypt check failed. Stored hash:", user.passwordHash);
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
  // OIDC AUTH MODE
  // ================================================================
  console.log("OIDC mode active; connecting to", process.env.OIDC_ISSUER_URL);
  const issuerUrl = process.env.OIDC_ISSUER_URL || "https://id.opensuse.org";
  const issuer = await Issuer.discover(issuerUrl);
  const client = new issuer.Client({
    client_id: process.env.OIDC_CLIENT_ID,
    client_secret: process.env.OIDC_CLIENT_SECRET,
    redirect_uris: [process.env.OIDC_REDIRECT_URI],
    response_types: ["code"],
  });

  app.get("/login", (req, res) => {
    const code_verifier = generators.codeVerifier();
    const code_challenge = generators.codeChallenge(code_verifier);
    req.session.code_verifier = code_verifier;
    const url = client.authorizationUrl({
      scope: "openid profile email",
      code_challenge,
      code_challenge_method: "S256",
    });
    res.redirect(url);
  });

  app.get("/auth/callback", async (req, res, next) => {
    try {
      const params = client.callbackParams(req);
      const tokenSet = await client.callback(process.env.OIDC_REDIRECT_URI, params, {
        code_verifier: req.session.code_verifier,
      });
      const userinfo = await client.userinfo(tokenSet.access_token);

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
      next(e);
    }
  });

  app.get("/logout", (req, res) => {
    req.session.destroy(() => {
      res.redirect("/");
    });
  });
}
