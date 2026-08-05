// Copyright © 2025–present Lubos Kocman and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0

import express from "express";
import { sanitizeUser } from "../utils/user.js";
import { buildRankGroups } from "../utils/stats.js";

export function mountSummaryRoutes(app, prisma) {
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
      const [totalKudos, totalBadges] = await Promise.all([
        prisma.kudos.count(),
        prisma.userBadge.count(),
      ]);

      const [receivedData, givenData] = await Promise.all([
        prisma.kudosRecipient.findMany({
          where: { kudos: { createdAt: { gte: thirtyDaysAgo } } },
          include: { user: true },
        }),
        prisma.kudos.findMany({
          where: { createdAt: { gte: thirtyDaysAgo } },
          include: { fromUser: true },
        }),
      ]);

      const receivedMap = new Map();
      for (const entry of receivedData) {
        const user = sanitizeUser(entry.user);
        if (!receivedMap.has(user.username)) {
          receivedMap.set(user.username, {
            username: user.username,
            avatarUrl: user.avatarUrl,
            points: 0,
          });
        }
        receivedMap.get(user.username).points += 1;
      }

      const givenMap = new Map();
      for (const entry of givenData) {
        const user = sanitizeUser(entry.fromUser);
        if (!givenMap.has(user.username)) {
          givenMap.set(user.username, {
            username: user.username,
            avatarUrl: user.avatarUrl,
            points: 0,
          });
        }
        givenMap.get(user.username).points += 1;
      }

      res.json({
        totals: {
          kudos: totalKudos,
          badges: totalBadges,
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
        leaderboards: {
          received: buildRankGroups(Array.from(receivedMap.values()), "points", 4),
          given: buildRankGroups(Array.from(givenMap.values()), "points", 4),
        },
      });
    } catch (err) {
      console.error("💥 Pulse API error:", err);
      res.status(500).json({ error: "Failed to fetch pulse data" });
    }
  });

  app.use("/api/summary", router);
}
