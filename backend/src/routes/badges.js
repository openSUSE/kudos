// backend/src/routes/badges.js
// Copyright © 2025–present
// SPDX-License-Identifier: Apache-2.0

import express from "express";
import { eventBus } from "./now.js";

export function mountBadgesRoutes(app, prisma) {
  const router = express.Router();

  // ---------------------------------------------------------------
  // GET /api/badges — List all badge definitions
  // ---------------------------------------------------------------
  router.get("/", async (req, res) => {
    try {
      const user = req.currentUser;

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

      if (!user) {
        return res.json(badges.map((b) => ({ ...b, owned: false })));
      }

      const owned = await prisma.userBadge.findMany({
        where: { userId: user.id },
        select: { badgeId: true },
      });
      const ownedSet = new Set(owned.map((b) => b.badgeId));

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

  // ---------------------------------------------------------------
  // GET /api/badges/:slug — Single badge detail
  // ---------------------------------------------------------------
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

  // ---------------------------------------------------------------
  // GET /api/badges/user/:username — Badges earned by a user
  // ---------------------------------------------------------------
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

      res.json(userBadges.map((ub) => ub.badge));
    } catch (err) {
      console.error("💥 Failed to fetch user badges:", err);
      res.status(500).json({ error: "Failed to fetch user badges" });
    }
  });

  // ---------------------------------------------------------------
  // POST /api/badges/grant — Grant badge (admin/bot)
  // ---------------------------------------------------------------
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
          badge: {
            select: {
              title: true,
              slug: true,
              picture: true,
              description: true,
            },
          },
        },
      });

      const baseUrl =
        process.env.PUBLIC_URL ||
        process.env.VITE_DEV_SERVER ||
        "http://localhost:3000";

      const permalink = `${baseUrl}/badge/${granted.badge.slug}`;
      const badgePicture = granted.badge.picture.startsWith("http")
        ? granted.badge.picture
        : `${baseUrl}${granted.badge.picture}`;

      // Live update (Matrix/Slack already supported)
      eventBus.emit("update", {
        type: "badge",
        data: {
          username: granted.user.username,
          avatarUrl: granted.user.avatarUrl,
          badgeSlug: granted.badge.slug,
          badgeTitle: granted.badge.title,
          badgeDescription: granted.badge.description,
          badgePicture,
          grantedAt: granted.grantedAt,
          permalink,
        },
      });

      // Notify pipeline (DB + email + followers)
      eventBus.emit("activity", {
        type: "badge",
        actorId: granted.user.id,
        targetUserId: granted.user.id,
        payload: {
          username: granted.user.username,
          badgeSlug: granted.badge.slug,
          badgeTitle: granted.badge.title,
          badgeDescription: granted.badge.description,
          badgePicture,
          grantedAt: granted.grantedAt,
          permalink,
        },
      });

      res.json({ message: "Badge granted successfully", granted });
    } catch (err) {
      console.error("💥 Failed to grant badge:", err);
      res.status(500).json({ error: "Failed to grant badge" });
    }
  });

  // ---------------------------------------------------------------
  // GET /api/badges/recent — Last 30 days
  // ---------------------------------------------------------------
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
