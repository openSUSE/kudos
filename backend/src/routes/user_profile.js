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

      // ────────────────────────────────────────────────
      // 🔍 Fetch base user record
      // ────────────────────────────────────────────────
      const user = await prisma.user.findUnique({
        where: { username },
        select: {
          id: true,
          username: true,
          fullName: true,
          givenName: true,
          familyName: true,
          email: true,
          role: true,
          avatarUrl: true,
          createdAt: true,
        },
      });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // ────────────────────────────────────────────────
      // 📊 Parallel stats lookup
      // ────────────────────────────────────────────────
      const [receivedKudos, givenKudos, earnedBadges] = await Promise.all([
        // Kudos received (via join table)
        prisma.kudosRecipient.count({
          where: { userId: user.id },
        }),

        // Kudos given directly by this user
        prisma.kudos.count({
          where: { fromUserId: user.id },
        }),

        // Badges earned
        prisma.userBadge.count({
          where: { userId: user.id },
        }),
      ]);

      // ────────────────────────────────────────────────
      // 🏅 Fetch recent badges (last 30 days)
      // ────────────────────────────────────────────────
      const recentBadges = await prisma.userBadge.findMany({
        where: {
          userId: user.id,
          grantedAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // last 30 days
          },
        },
        include: { badge: true },
        orderBy: { grantedAt: "desc" },
        take: 10,
      });

      // ────────────────────────────────────────────────
      // 💚 Fetch recent kudos received
      // ────────────────────────────────────────────────
      const recentKudos = await prisma.kudosRecipient.findMany({
        where: { userId: user.id },
        include: {
          kudos: {
            include: {
              fromUser: true,
              category: true,
            },
          },
        },
        orderBy: { kudos: { createdAt: "desc" } },
        take: 10,
      });

      // ────────────────────────────────────────────────
      // 🧹 Clean and return everything
      // ────────────────────────────────────────────────
      const profile = {
        user: sanitizeUser(user),
        stats: {
          receivedKudos,
          givenKudos,
          earnedBadges,
        },
        recentBadges: recentBadges.map((b) => ({
          ...b.badge,
          grantedAt: b.grantedAt,
        })),
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

  app.use("/api/profile", router);
}
