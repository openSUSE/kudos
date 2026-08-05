// backend/src/routes/whoami.js
// Copyright © 2025–present Lubos Kocman and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0

import express from "express";

export function mountWhoamiRoutes(app, prisma) {
  const router = express.Router();

  // 🧍 Return current logged-in user info
  router.get("/", async (req, res) => {
    if (!req.currentUser) {
      return res.status(401).json({ authenticated: false });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.currentUser.id },
      select: {
        id: true,
        username: true,
        fullName: true,
        givenName: true,
        familyName: true,
        email: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
      },
    });

    res.json(user);
  });

  app.use("/api/whoami", router);
}
