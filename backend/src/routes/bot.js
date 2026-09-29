// Copyright © 2025–present Lubos Kocman and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0

import express from "express";
import crypto from "crypto";
import { botAuth } from "../middleware/botAuth.js";
import { grantBadge } from "../utils/grantBadge.js";

export function mountBotRoutes(app, prisma) {
  const router = express.Router();

  // ==========================================================
  // 👤 POST /api/bot/users — create a user (always USER; `role` is ignored)
  // Only bots with canCreateUsers=true may use this endpoint.
  // ==========================================================
  router.post("/users", botAuth(prisma), async (req, res) => {
    if (!req.botUser.canCreateUsers) {
      return res.status(403).json({ error: "This bot does not have user creation privileges" });
    }

    const { username, email, fullName, givenName, familyName } = req.body;

    if (!username) {
      return res.status(400).json({ error: "Missing username" });
    }

    // Bots only ever create people. Older bots may still send role: "MEMBER",
    // a role that no longer exists; it never granted anything either.
    const assignedRole = "USER";

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
    const { username, badgeCode, autoCreate, email, fullName, givenName, familyName } = req.body;
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

      const assignedRole = "USER"; // see POST /api/bot/users

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

    const { alreadyGranted, permalink } = await grantBadge(prisma, { user, badge });
    if (alreadyGranted) {
      return res.status(200).json({ message: "Badge already granted", user: username, badge: badgeCode });
    }

    console.log(`🤖 Bot ${req.botUser.username} granted ${badgeCode} to ${username}`);
    res.json({ success: true, user: username, badge: badgeCode, permalink });
  });

  app.use("/api/bot", router);
}