// Copyright © 2025–present Lubos Kocman and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0

import express from "express";
import crypto from "crypto";
import { botAuth } from "../middleware/botAuth.js";

export function mountBotRoutes(app, prisma) {
  const router = express.Router();

  // Bot endpoint to grant badges
  router.post("/grant-badge", botAuth(prisma), async (req, res) => {
    const { username, badgeCode } = req.body;
    if (!username || !badgeCode)
      return res.status(400).json({ error: "Missing username or badgeCode" });

    const user = await prisma.user.findUnique({ where: { username } });
    const badge = await prisma.badge.findUnique({ where: { code: badgeCode } });

    if (!user) return res.status(404).json({ error: "User not found" });
    if (!badge) return res.status(404).json({ error: "Badge not found" });

    await prisma.userBadge.upsert({
      where: { userId_badgeId: { userId: user.id, badgeId: badge.id } },
      update: {},
      create: { userId: user.id, badgeId: badge.id },
    });

    console.log(`🤖 Bot ${req.botUser.username} granted ${badgeCode} to ${username}`);
    res.json({ success: true, user: username, badge: badgeCode });
  });

  app.use("/api/bot", router);
}