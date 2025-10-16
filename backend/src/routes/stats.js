// Copyright © 2025–present Lubos Kocman and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0

import express from "express";

export function mountStatsRoutes(app, prisma) {
  const router = express.Router();

  router.get("/", async (req, res) => {
    try {
      const since = new Date();
      since.setDate(since.getDate() - 30);

      const [
        totalKudos,
        recentKudos,
        totalBadges,
        recentBadges,
        totalUsers,
        recentUsers,
        totalCategories,
      ] = await Promise.all([
        prisma.kudos.count(),
        prisma.kudos.count({ where: { createdAt: { gte: since } } }),
        prisma.userBadge.count(),
        prisma.userBadge.count({ where: { grantedAt: { gte: since } } }),
        prisma.user.count(),
        prisma.user.count({ where: { createdAt: { gte: since } } }),
        prisma.kudosCategory.count(),
      ]);

      res.json({
        recent: [
          { icon: "💚", label: "Kudos (30d)", value: recentKudos },
          { icon: "🏅", label: "Badges (30d)", value: recentBadges },
          { icon: "👥", label: "New Users (30d)", value: recentUsers },
        ],
        total: [
          { icon: "💚", label: "Total Kudos", value: totalKudos },
          { icon: "🏅", label: "Total Badges", value: totalBadges },
          { icon: "👥", label: "Users", value: totalUsers },
          { icon: "🧩", label: "Categories", value: totalCategories },
        ],
      });
    } catch (err) {
      console.error("💥 Stats API error:", err);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  app.use("/api/stats", router);
}
