// Copyright © 2025–present Lubos Kocman and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0

import express from "express";
import { getAvatarUrl, sanitizeUser } from "../utils/user.js";

export function mountPulseRoutes(app, prisma) {
  const router = express.Router();

  router.get("/", async (req, res) => {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // 💚 Recent kudos (latest 10)
      const recentKudos = await prisma.kudos.findMany({
        include: {
          fromUser: true,
          recipients: { include: { user: true } },
          category: true,
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      });

      // 🏅 Recent badges (last 30 days)
      const recentBadges = await prisma.userBadge.findMany({
        where: { grantedAt: { gte: thirtyDaysAgo } },
        include: { user: true, badge: true },
        orderBy: { grantedAt: "desc" },
        take: 8,
      });

      // 📊 Stats
      const [totalKudos, totalBadges, totalUsers] = await Promise.all([
        prisma.kudos.count(),
        prisma.userBadge.count(),
        prisma.user.count(),
      ]);

      const [recentKudosCount, recentBadgesCount, recentUsersCount] =
        await Promise.all([
          prisma.kudos.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
          prisma.userBadge.count({ where: { grantedAt: { gte: thirtyDaysAgo } } }),
          prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
        ]);

      // 🧑‍💻 Leaderboard — top 10 by kudos received (30 days)
      const leaderboardData = await prisma.kudosRecipient.findMany({
        where: { kudos: { createdAt: { gte: thirtyDaysAgo } } },
        include: { user: true },
      });

      const leaderboardMap = new Map();
      for (const entry of leaderboardData) {
        const user = sanitizeUser(entry.user);
        if (!leaderboardMap.has(user.username)) {
          leaderboardMap.set(user.username, {
            username: user.username,
            avatarUrl: user.avatarUrl,
            kudosReceived: 0,
          });
        }
        leaderboardMap.get(user.username).kudosReceived++;
      }

      const leaderboard = Array.from(leaderboardMap.values())
        .sort((a, b) => b.kudosReceived - a.kudosReceived)
        .slice(0, 10);

      // 🧾 Response
      res.json({
        stats: {
          recent: [
            { icon: "💚", label: "Kudos", value: recentKudosCount },
            { icon: "🏅", label: "Badges", value: recentBadgesCount },
            { icon: "👥", label: "New Users", value: recentUsersCount },
          ],
          total: [
            { icon: "💚", label: "Kudos", value: totalKudos },
            { icon: "🏅", label: "Badges", value: totalBadges },
            { icon: "👥", label: "Users", value: totalUsers },
          ],
        },
        recentKudos: recentKudos.map((k) => ({
          ...k,
          fromUser: sanitizeUser(k.fromUser),
          recipients: k.recipients.map((r) => ({
            ...r,
            user: sanitizeUser(r.user),
          })),
        })),
        recentBadges: recentBadges.map((b) => ({
          id: b.id,
          slug: b.badge.slug,
          title: b.badge.title,
          picture: b.badge.picture,
          color: b.badge.color,
          user: sanitizeUser(b.user),
        })),
        leaderboard,
      });
    } catch (err) {
      console.error("💥 Pulse API error:", err);
      res.status(500).json({ error: "Failed to fetch pulse data" });
    }
  });

  app.use("/api/pulse", router);
}
