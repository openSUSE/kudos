// Copyright © 2025–present Lubos Kocman and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0

import express from "express";
import { sanitizeUser } from "../utils/user.js";

export function mountUserProfileRoutes(app, prisma) {
  const router = express.Router();

  // 👤 Get detailed user profile + stats
  router.get("/:username", async (req, res) => {
    try {
      const { username } = req.params;

      const userWithSecrets = await prisma.user.findUnique({
        where: { username },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          avatarUrl: true,
          createdAt: true,
          emailNotificationsEnabled: true,
          matrixHandle: true,
          slackHandle: true,
          githubHandle: true,
          giteaHandle: true,
        },
      });

      if (!userWithSecrets) {
        return res.status(404).json({ error: "User not found" });
      }

      const isOwner = req.currentUser && req.currentUser.username === userWithSecrets.username;

      let finalUser;
      if (isOwner) {
        finalUser = userWithSecrets;
      } else {
        finalUser = sanitizeUser(userWithSecrets);
      }

      const [receivedKudos, givenKudos, earnedBadges] = await Promise.all([
        prisma.kudosRecipient.count({ where: { userId: userWithSecrets.id } }),
        prisma.kudos.count({ where: { fromUserId: userWithSecrets.id } }),
        prisma.userBadge.count({ where: { userId: userWithSecrets.id } }),
      ]);

      const recentBadges = await prisma.userBadge.findMany({
        where: {
          userId: userWithSecrets.id,
          grantedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
        include: { badge: true },
        orderBy: { grantedAt: "desc" },
        take: 10,
      });

      const recentKudos = await prisma.kudosRecipient.findMany({
        where: { userId: userWithSecrets.id },
        include: {
          kudos: { include: { fromUser: true, category: true } },
        },
        orderBy: { kudos: { createdAt: "desc" } },
        take: 10,
      });

      const profile = {
        user: finalUser,
        stats: { receivedKudos, givenKudos, earnedBadges },
        recentBadges: recentBadges.map((b) => ({ ...b.badge, grantedAt: b.grantedAt })),
        recentKudos: recentKudos.map((r) => ({
          id: r.kudos.id,
          slug: r.kudos.slug,
          message: r.kudos.message,
          category: r.kudos.category,
          fromUser: sanitizeUser(r.kudos.fromUser),
          createdAt: r.kudos.createdAt,
        })),
      };

      res.json(profile);
    } catch (err) {
      console.error("💥 Failed to fetch user profile:", err);
      res.status(500).json({ error: "Failed to fetch user profile" });
    }
  });

  // ✍️ Update user preferences
  router.put("/:username", async (req, res) => {
    try {
      const { username } = req.params;

      // User can only update their own profile
      if (!req.currentUser || req.currentUser.username !== username) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const {
        emailNotificationsEnabled,
        matrixHandle,
        slackHandle,
        githubHandle,
        giteaHandle,
      } = req.body;

      const updatedUser = await prisma.user.update({
        where: { username },
        data: {
          emailNotificationsEnabled,
          matrixHandle,
          slackHandle,
          githubHandle,
          giteaHandle,
        },
      });

      res.json(sanitizeUser(updatedUser));
    } catch (err) {
      console.error("💥 Failed to update user profile:", err);
      res.status(500).json({ error: "Failed to update user profile" });
    }
  });

  app.use("/api/profile", router);
}
