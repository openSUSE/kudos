// Copyright © 2025–present Lubos Kocman and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0

import express from "express";
import { eventBus } from "./now.js"; // optional — used to broadcast admin changes

export function mountAdminRoutes(app, prisma) {
  const router = express.Router();

  // 🧩 Middleware: check if user is admin
  router.use(async (req, res, next) => {
    const user = req.currentUser;
    if (!user || (user.role !== "ADMIN" && user.role !== "BOT")) {
      return res.status(403).json({ error: "Admin privileges required" });
    }
    next();
  });

  // ==========================================================
  // 📋 GET /api/admin/overview — quick stats for dashboard
  // ==========================================================
  router.get("/overview", async (req, res) => {
    try {
      const [users, kudos, badges] = await Promise.all([
        prisma.user.count(),
        prisma.kudos.count(),
        prisma.badge.count(),
      ]);
      res.json({ users, kudos, badges });
    } catch (err) {
      console.error("💥 Admin overview failed:", err);
      res.status(500).json({ error: "Failed to load admin overview" });
    }
  });

  // ==========================================================
  // 🏅 GET /api/admin/badges — list all badges
  // ==========================================================
  router.get("/badges", async (req, res) => {
    try {
      const badges = await prisma.badge.findMany({
        orderBy: { createdAt: "desc" },
      });
      res.json(badges);
    } catch (err) {
      console.error("💥 Failed to load badges:", err);
      res.status(500).json({ error: "Failed to load badges" });
    }
  });

  // ==========================================================
  // ➕ POST /api/admin/badges — create new badge
  // ==========================================================
  router.post("/badges", async (req, res) => {
    try {
      const { code, title, description, color, picture, link } = req.body;
      if (!code || !title)
        return res.status(400).json({ error: "Missing code or title" });

      const badge = await prisma.badge.create({
        data: { code, title, description, color, picture, link },
      });

      eventBus?.emit("update", { type: "badge", data: badge });
      res.status(201).json(badge);
    } catch (err) {
      console.error("💥 Failed to create badge:", err);
      res.status(500).json({ error: "Failed to create badge" });
    }
  });

  // ==========================================================
  // ❌ DELETE /api/admin/badges/:code — delete badge
  // ==========================================================
  router.delete("/badges/:code", async (req, res) => {
    try {
      const { code } = req.params;
      await prisma.badge.delete({ where: { code } });
      res.json({ message: `Badge '${code}' deleted.` });
    } catch (err) {
      console.error("💥 Failed to delete badge:", err);
      res.status(500).json({ error: "Failed to delete badge" });
    }
  });

  // ==========================================================
  // 🧹 POST /api/admin/reset-db — reset the entire database
  // ==========================================================
  router.post("/reset-db", async (req, res) => {
    try {
      await prisma.kudosRecipient.deleteMany();
      await prisma.kudos.deleteMany();
      await prisma.userBadge.deleteMany();
      await prisma.badge.deleteMany();
      await prisma.kudosCategory.deleteMany();
      res.json({ message: "Database cleared." });
    } catch (err) {
      console.error("💥 Failed to reset database:", err);
      res.status(500).json({ error: "Database reset failed" });
    }
  });

  // ==========================================================
  // 🔄 POST /api/admin/sync-badges — re-import from seed.js
  // ==========================================================
  router.post("/sync-badges", async (req, res) => {
    try {
      const seed = await import("../../prisma/seed.js");
      await seed.main?.();
      res.json({ message: "Badges re-synced successfully." });
    } catch (err) {
      console.error("💥 Failed to sync badges:", err);
      res.status(500).json({ error: "Failed to sync badges" });
    }
  });

  // Default
  router.get("/", (req, res) => {
    res.json({
      message: "🧭 Admin API ready — available endpoints:",
      endpoints: [
        "GET    /api/admin/overview",
        "GET    /api/admin/badges",
        "POST   /api/admin/badges",
        "DELETE /api/admin/badges/:code",
        "POST   /api/admin/reset-db",
        "POST   /api/admin/sync-badges",
      ],
    });
  });

  app.use("/api/admin", router);
}
