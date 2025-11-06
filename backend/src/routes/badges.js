// Copyright © 2025–present Lubos Kocman and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0

import express from "express";
import { eventBus } from "./now.js";

export function mountBadgesRoutes(app, prisma) {
  const router = express.Router();

  // List all available badges
  router.get("/", async (req, res) => {
    try {
      const user = req.currentUser; // middleware sets this if logged in

      const badges = await prisma.badge.findMany({
        orderBy: { title: "asc" },
        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
          picture: true,
          link: true,
          createdAt: true,
        },
      });

      // if no user, return everything as locked
      if (!user) {
        return res.json(badges.map((b) => ({ ...b, owned: false })));
      }

      // find owned badges for this user
      const owned = await prisma.userBadge.findMany({
        where: { userId: user.id },
        select: { badgeId: true },
      });
      const ownedSet = new Set(owned.map((b) => b.badgeId));

      // mark owned ones
      const result = badges.map((b) => ({
        ...b,
        owned: ownedSet.has(b.id),
      }));

      res.json(result);
    } catch (err) {
      console.error("💥 Failed to fetch badges:", err);
      res.status(500).json({ error: "Failed to fetch badges" });
    }
  });



  // Single badge detail by slug
  router.get("/:slug", async (req, res) => {
    const { slug } = req.params;
    try {
      const badge = await prisma.badge.findUnique({
        where: { slug },
        include: {
          userAwards: { include: { user: true } },
        },
      });

      if (!badge) return res.status(404).json({ error: "Badge not found" });

      res.json({
        ...badge,
        users: badge.userAwards.map((a) => ({
          username: a.user.username,
          avatarUrl: a.user.avatarUrl,
        })),
      });
    } catch (err) {
      console.error("💥 Error fetching badge:", err);
      res.status(500).json({ error: "Failed to fetch badge" });
    }
  });

  // 🧍‍♀️ List badges earned by a specific user
  router.get("/user/:username", async (req, res) => {
    try {
      const user = await prisma.user.findUnique({
        where: { username: req.params.username },
        select: { id: true, username: true },
      });

      if (!user) return res.status(404).json({ error: "User not found" });

      const userBadges = await prisma.userBadge.findMany({
        where: { userId: user.id },
        include: {
          badge: {
            select: {
              slug: true,
              title: true,
              description: true,
              picture: true,
            },
          },
        },
        orderBy: { grantedAt: "desc" },
      });

      // Return plain array of badges (like kudos does)
      res.json(userBadges.map((ub) => ub.badge));
    } catch (err) {
      console.error("💥 Failed to fetch user badges:", err);
      res.status(500).json({ error: "Failed to fetch user badges" });
    }
  });


  // 🪄 Grant a badge to a user (admin/bot)
  router.post("/grant", async (req, res) => {
    const { username, badgeSlug } = req.body;
    if (!username || !badgeSlug) {
      return res.status(400).json({ error: "Missing username or badgeSlug" });
    }

    try {
      const [user, badge] = await Promise.all([
        prisma.user.findUnique({ where: { username } }),
        prisma.badge.findUnique({ where: { slug: badgeSlug } }),
      ]);

      if (!user || !badge)
        return res.status(404).json({ error: "User or badge not found" });

      const existing = await prisma.userBadge.findFirst({
        where: { userId: user.id, badgeId: badge.id },
      });

      if (existing)
        return res.status(200).json({ message: "Badge already granted" });

      const granted = await prisma.userBadge.create({
        data: { userId: user.id, badgeId: badge.id },
        include: {
          user: { select: { username: true, avatarUrl: true } },
          badge: { select: { title: true, slug: true, picture: true, description: true } },
        },
      });

      // Emit real-time update to /api/now stream
      eventBus.emit("update", {
        type: "badge",
        data: {
          username: granted.user.username,
          avatarUrl: granted.user.avatarUrl,
          badgeSlug: granted.badge.slug,
          badgeTitle: granted.badge.title,
          badgeDescription: granted.badge.description,
          badgePicture: granted.badge.picture,
          grantedAt: granted.grantedAt,
        },
      });

      res.json({ message: "Badge granted successfully", granted });
    } catch (err) {
      console.error("💥 Failed to grant badge:", err);
      res.status(500).json({ error: "Failed to grant badge" });
    }
  });

  // Recently earned badges (last 30 days)
  router.get("/recent", async (req, res) => {
    const limit = parseInt(req.query.limit || "10", 10);
    const since = new Date();
    since.setDate(since.getDate() - 30);

    try {
      const recent = await prisma.userBadge.findMany({
        where: { grantedAt: { gte: since } },
        take: limit,
        orderBy: { grantedAt: "desc" },
        include: {
          user: { select: { username: true, avatarUrl: true } },
          badge: {
            select: {
              slug: true,
              title: true,
              picture: true,
              description: true,
            },
          },
        },
      });

      res.json(
        recent.map((r) => ({
          slug: r.badge.slug,
          title: r.badge.title,
          picture: r.badge.picture,
          description: r.badge.description,
          user: r.user,
          grantedAt: r.grantedAt,
        }))
      );
    } catch (err) {
      console.error("💥 Failed to fetch recent badges:", err);
      res.status(500).json({ error: "Failed to fetch recent badges" });
    }
  });

  app.use("/api/badges", router);
}
