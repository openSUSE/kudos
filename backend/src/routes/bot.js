// Copyright © 2025–present Lubos Kocman and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0

import express from "express";
import crypto from "crypto";
import { botAuth } from "../middleware/botAuth.js";
import { eventBus } from "./now.js";

function getBaseUrl() {
  return process.env.BASE_URL || process.env.VITE_DEV_SERVER || "http://localhost:3000";
}

function buildBadgeAchievementPermalink(baseUrl, badgeSlug, username) {
  return `${baseUrl}/badge/${badgeSlug}/earned-by/${username}`;
}

function buildBadgeShareText(displayName, badgeTitle, badgeDescription) {
  const badgeSummary = badgeDescription || badgeTitle;
  return `${displayName} just earned badge in openSUSE Kudos for ${badgeSummary}`;
}

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

    const existing = await prisma.userBadge.findFirst({
      where: { userId: user.id, badgeId: badge.id },
    });

    if (existing) {
      return res.status(200).json({ message: "Badge already granted", user: username, badge: badgeCode });
    }

    const granted = await prisma.userBadge.create({
      data: { userId: user.id, badgeId: badge.id },
    });

    const baseUrl = getBaseUrl();
    const permalink = buildBadgeAchievementPermalink(baseUrl, badge.slug, user.username);
    const badgePicture = badge.picture.startsWith("http") ? badge.picture : `${baseUrl}${badge.picture}`;
    const shareText = buildBadgeShareText(user.fullName || user.username, badge.title, badge.description);

    eventBus.emit("activity", {
      type: "badge",
      actorId: user.id,
      targetUserId: user.id,
      payload: {
        username: user.username,
        badgeSlug: badge.slug,
        badgeTitle: badge.title,
        badgeDescription: badge.description,
        badgePicture,
        grantedAt: granted.grantedAt,
        permalink,
        shareText,
      },
    });

    console.log(`🤖 Bot ${req.botUser.username} granted ${badgeCode} to ${username}`);
    res.json({ success: true, user: username, badge: badgeCode, permalink });
  });

  app.use("/api/bot", router);
}