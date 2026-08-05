// Copyright © 2025–present Lubos Kocman and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0

import express from "express";
import crypto from "crypto";
import { botAuth } from "../middleware/botAuth.js";

export function mountBotRoutes(app, prisma) {
  const router = express.Router();

  // ==========================================================
  // 👤 POST /api/bot/users — create a user (USER or MEMBER role only)
  // Only bots with canCreateUsers=true may use this endpoint.
  // ==========================================================
  router.post("/users", botAuth(prisma), async (req, res) => {
    if (!req.botUser.canCreateUsers) {
      return res.status(403).json({ error: "This bot does not have user creation privileges" });
    }

    const { username, email, fullName, givenName, familyName, role } = req.body;

    if (!username) {
      return res.status(400).json({ error: "Missing username" });
    }

    const allowedRoles = ["USER", "MEMBER"];
    const assignedRole = role && allowedRoles.includes(role) ? role : "USER";

    try {
      const user = await prisma.user.create({
        data: { username, email, fullName, givenName, familyName, role: assignedRole },
      });

      console.log(`🤖 Bot ${req.botUser.username} created user '${username}' with role ${assignedRole}`);
      res.status(201).json({ success: true, user: { id: user.id, username: user.username, role: user.role } });
    } catch (err) {
      if (err.code === "P2002") {
        return res.status(409).json({ error: "Username already exists" });
      }
      console.error("💥 Bot failed to create user:", err);
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  // ==========================================================
  // 🏅 POST /api/bot/grant-badge — grant a badge to a user
  // Supports autoCreate:true to create the user if they don't exist yet.
  // ==========================================================
  router.post("/grant-badge", botAuth(prisma), async (req, res) => {
    const { username, badgeCode, autoCreate, email, fullName, givenName, familyName, role } = req.body;
    if (!username || !badgeCode)
      return res.status(400).json({ error: "Missing username or badgeCode" });

    let user = await prisma.user.findUnique({ where: { username } });

    if (!user) {
      if (!autoCreate) {
        return res.status(404).json({ error: "User not found" });
      }

      if (!req.botUser.canCreateUsers) {
        return res.status(403).json({ error: "This bot does not have user creation privileges" });
      }

      const allowedRoles = ["USER", "MEMBER"];
      const assignedRole = role && allowedRoles.includes(role) ? role : "USER";

      try {
        user = await prisma.user.create({
          data: { username, email, fullName, givenName, familyName, role: assignedRole },
        });
        console.log(`🤖 Bot ${req.botUser.username} auto-created user '${username}' with role ${assignedRole}`);
      } catch (err) {
        if (err.code === "P2002") {
          // Race condition: user was created between the findUnique and create
          user = await prisma.user.findUnique({ where: { username } });
        } else {
          console.error("💥 Bot failed to auto-create user:", err);
          return res.status(500).json({ error: "Failed to auto-create user" });
        }
      }
    }

    const badge = await prisma.badge.findUnique({ where: { slug: badgeCode } });
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