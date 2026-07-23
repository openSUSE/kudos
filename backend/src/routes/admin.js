// Copyright © 2025–present Lubos Kocman and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0

import express from "express";
import crypto from "crypto";
import { eventBus } from "./now.js"; // optional — used to broadcast admin changes

export function mountAdminRoutes(app, prisma) {
  const router = express.Router();

  // 🧩 Middleware: check if user is admin or bot
  router.use(async (req, res, next) => {
    const user = req.currentUser;
    if (!user || (user.role !== "ADMIN" && user.role !== "BOT")) {
      return res.status(403).json({ error: "Admin or bot privileges required" });
    }
    next();
  });

  // 🧩 Middleware: check if user is admin
  const isAdmin = (req, res, next) => {
    const user = req.currentUser;
    if (!user || user.role !== "ADMIN") {
      return res.status(403).json({ error: "Admin privileges required" });
    }
    next();
  };


  // ==========================================================
  // 📋 GET /api/admin/overview — quick stats for dashboard
  // ==========================================================
  router.get("/overview", async (req, res) => {
    try {
      const [users, kudos, badges] = await Promise.all([
        prisma.user.count(),
        prisma.kudos.count(),
        prisma.badge.count(),
      ])
      res.json({ users, kudos, badges })
    } catch (err) {
      console.error("💥 Admin overview failed:", err)
      res.status(500).json({ error: "Failed to load admin overview" })
    }
  })

  // ==========================================================
  // 🏅 GET /api/admin/badges — list all badges (with holder count)
  // ==========================================================
  router.get("/badges", async (req, res) => {
    try {
      const badges = await prisma.badge.findMany({
        orderBy: { title: "asc" },
        include: {
          _count: { select: { userAwards: true } },
        },
      })
      res.json(
        badges.map((b) => ({
          ...b,
          holders: b._count.userAwards,
          _count: undefined,
        }))
      )
    } catch (err) {
      console.error("💥 Failed to load badges:", err)
      res.status(500).json({ error: "Failed to load badges" })
    }
  })

  // ==========================================================
  // ➕ POST /api/admin/badges — create new badge
  // ==========================================================
  router.post("/badges", async (req, res) => {
    try {
      const { slug, title, description, color, picture, link } = req.body
      if (!slug || !title)
        return res.status(400).json({ error: "Missing slug or title" })

      const badge = await prisma.badge.create({
        data: { slug, title, description, color, picture, link },
      })

      eventBus?.emit("update", { type: "badge", data: badge })
      res.status(201).json(badge)
    } catch (err) {
      console.error("💥 Failed to create badge:", err)
      res.status(500).json({ error: "Failed to create badge" })
    }
  })

  // ==========================================================
  // 🪄 POST /api/admin/badges/grant — grant badge to user
  // ==========================================================
  router.post("/badges/grant", async (req, res) => {
    try {
      const { username, badgeSlug } = req.body
      const actor = req.currentUser

      if (!username || !badgeSlug)
        return res
          .status(400)
          .json({ error: "Missing username or badgeSlug" })

      // find both user and badge
      const [user, badge] = await Promise.all([
        prisma.user.findUnique({ where: { username } }),
        prisma.badge.findUnique({ where: { slug: badgeSlug } }),
      ])

      if (!user || !badge)
        return res.status(404).json({ error: "User or badge not found" })

      // check existing ownership
      const existing = await prisma.userBadge.findFirst({
        where: { userId: user.id, badgeId: badge.id },
      })

      if (existing)
        return res.status(200).json({ message: "Badge already granted" })

      // create new link
      const granted = await prisma.userBadge.create({
        data: {
          userId: user.id,
          badgeId: badge.id,
          grantedBy: actor?.username || "system",
        },
      })

      console.log(
        `🏅 ${actor.username} granted badge '${badgeSlug}' to ${username}`
      )

      eventBus?.emit("update", {
        type: "badge-grant",
        data: { username, badgeSlug, grantedBy: actor.username },
      })

      res.json({
        message: `Badge '${badgeSlug}' granted to ${username}`,
        granted,
      })
    } catch (err) {
      console.error("💥 Failed to grant badge:", err)
      res.status(500).json({ error: "Failed to grant badge" })
    }
  })

  // ==========================================================
  // ❌ DELETE /api/admin/badges/:slug — delete badge
  // ==========================================================
  router.delete("/badges/:slug", async (req, res) => {
    try {
      const { slug } = req.params

      // prevent deletion if badge is assigned to users
      const inUse = await prisma.userBadge.count({
        where: { badge: { slug } },
      })
      if (inUse > 0)
        return res.status(400).json({
          error: `Cannot delete — badge '${slug}' is assigned to ${inUse} user(s).`,
        })

      await prisma.badge.delete({ where: { slug } })
      res.json({ message: `Badge '${slug}' deleted.` })
    } catch (err) {
      console.error("💥 Failed to delete badge:", err)
      res.status(500).json({ error: "Failed to delete badge" })
    }
  })

  // ==========================================================
  // 🧹 POST /api/admin/badges/:slug/drop — remove badge from all users
  // ==========================================================
  router.post("/badges/:slug/drop", isAdmin, async (req, res) => {
    try {
      const { slug } = req.params

      const badge = await prisma.badge.findUnique({ where: { slug } })
      if (!badge) {
        return res.status(404).json({ error: "Badge not found" })
      }

      const { count } = await prisma.userBadge.deleteMany({
        where: { badgeId: badge.id },
      })

      console.log(
        `🧹 ${req.currentUser.username} dropped badge '${slug}' from ${count} user(s)`
      )

      eventBus?.emit("update", {
        type: "badge-drop",
        data: { slug, droppedFrom: count },
      })

      res.json({
        message: `Badge '${slug}' removed from ${count} user(s).`,
        count,
      })
    } catch (err) {
      console.error("💥 Failed to drop badge from users:", err)
      res.status(500).json({ error: "Failed to drop badge from users" })
    }
  })

  // ==========================================================
  // ❌ DELETE /api/admin/kudos/:id — delete a single kudo
  // ==========================================================
  router.delete("/kudos/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10)
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid kudo ID" })
      }

      const kudo = await prisma.kudos.findUnique({ where: { id } })
      if (!kudo) {
        return res.status(404).json({ error: "Kudo not found" })
      }

      // Delete recipients first (foreign key constraint)
      await prisma.kudosRecipient.deleteMany({ where: { kudosId: id } })
      await prisma.kudos.delete({ where: { id } })

      console.log(`🗑️ ${req.currentUser.username} deleted kudo #${id}`)

      eventBus?.emit("update", { type: "kudo-deleted", data: { id } })

      res.json({ message: `Kudo #${id} deleted.` })
    } catch (err) {
      console.error("💥 Failed to delete kudo:", err)
      res.status(500).json({ error: "Failed to delete kudo" })
    }
  })

  // ==========================================================
  // 📋 GET /api/admin/kudos — list kudos (paginated, for admin)
  // ==========================================================
  router.get("/kudos", async (req, res) => {
    try {
      const page = parseInt(req.query.page || "1", 10)
      const limit = parseInt(req.query.limit || "50", 10)
      const skip = (page - 1) * limit
      const search = req.query.search || ""

      const where = search
        ? {
            OR: [
              { message: { contains: search } },
              { fromUser: { username: { contains: search } } },
              { recipients: { some: { user: { username: { contains: search } } } } },
            ],
          }
        : {}

      const [items, total] = await Promise.all([
        prisma.kudos.findMany({
          where,
          include: {
            fromUser: { select: { username: true, avatarUrl: true } },
            category: true,
            recipients: {
              include: {
                user: { select: { username: true, avatarUrl: true } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.kudos.count({ where }),
      ])

      res.json({ page, total, pages: Math.ceil(total / limit), kudos: items })
    } catch (err) {
      console.error("💥 Admin kudos list failed:", err)
      res.status(500).json({ error: "Failed to load kudos" })
    }
  })

  // ==========================================================
  // 📋 GET /api/admin/categories — list kudos categories
  // ==========================================================
  router.get("/categories", async (req, res) => {
    try {
      const categories = await prisma.kudosCategory.findMany({
        orderBy: { label: "asc" },
        include: {
          _count: { select: { kudos: true } },
        },
      })
      res.json(
        categories.map((c) => ({
          ...c,
          kudosCount: c._count.kudos,
          _count: undefined,
        }))
      )
    } catch (err) {
      console.error("💥 Failed to load categories:", err)
      res.status(500).json({ error: "Failed to load categories" })
    }
  })

  // ==========================================================
  // ➕ POST /api/admin/categories — create kudos category
  // ==========================================================
  router.post("/categories", isAdmin, async (req, res) => {
    try {
      const { code, label, icon, defaultMsg } = req.body
      if (!code || !label || !icon) {
        return res
          .status(400)
          .json({ error: "Missing code, label, or icon" })
      }

      const category = await prisma.kudosCategory.create({
        data: { code, label, icon, defaultMsg },
      })

      res.status(201).json(category)
    } catch (err) {
      console.error("💥 Failed to create category:", err)
      if (err.code === "P2002") {
        return res.status(409).json({ error: "Category code already exists" })
      }
      res.status(500).json({ error: "Failed to create category" })
    }
  })

  // ==========================================================
  // ❌ DELETE /api/admin/categories/:id — delete kudos category
  // ==========================================================
  router.delete("/categories/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10)
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid category ID" })
      }

      const inUse = await prisma.kudos.count({ where: { categoryId: id } })
      if (inUse > 0) {
        return res.status(400).json({
          error: `Cannot delete — category is used by ${inUse} kudo(s).`,
        })
      }

      await prisma.kudosCategory.delete({ where: { id } })
      res.json({ message: "Category deleted." })
    } catch (err) {
      console.error("💥 Failed to delete category:", err)
      res.status(500).json({ error: "Failed to delete category" })
    }
  })

  // ==========================================================
  // 🧹 POST /api/admin/reset-db — reset the entire database
  // ==========================================================
  router.post("/reset-db", async (req, res) => {
    try {
      await prisma.kudosRecipient.deleteMany()
      await prisma.kudos.deleteMany()
      await prisma.userBadge.deleteMany()
      await prisma.badge.deleteMany()
      await prisma.kudosCategory.deleteMany()
      res.json({ message: "Database cleared." })
    } catch (err) {
      console.error("💥 Failed to reset database:", err)
      res.status(500).json({ error: "Database reset failed" })
    }
  })

  // ==========================================================
  // 🔄 POST /api/admin/sync-badges — re-import from seed.js
  // ==========================================================
  router.post("/sync-badges", async (req, res) => {
    try {
      const seed = await import("../../prisma/seed.js")
      await seed.main?.()
      res.json({ message: "Badges re-synced successfully." })
    } catch (err) {
      console.error("💥 Failed to sync badges:", err)
      res.status(500).json({ error: "Failed to sync badges" })
    }
  })

  // ==========================================================
  // ➕ POST /api/admin/users — create new user
  // ==========================================================
  router.post("/users", isAdmin, async (req, res) => {
    try {
      const { username, email, role } = req.body;
      if (!username || !role) {
        return res.status(400).json({ error: "Missing username or role" });
      }

      const data = {
        username,
        email,
        role,
      };

      if (role === "BOT") {
        data.botSecret = crypto.randomBytes(32).toString("hex");
      }

      const user = await prisma.user.create({ data });

      res.status(201).json(user);
    } catch (err) {
      console.error("💥 Failed to create user:", err);
      if (err.code === 'P2002') {
        return res.status(409).json({ error: "Username already exists" });
      }
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  // ==========================================================
  // ❌ DELETE /api/admin/users/:username — delete user
  // ==========================================================
  router.delete("/users/:username", isAdmin, async (req, res) => {
    try {
      const { username } = req.params;

      const user = await prisma.user.findUnique({ where: { username } });
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Find all kudos sent by the user
      const kudosSent = await prisma.kudos.findMany({
        where: { fromUser: { username } },
        select: { id: true },
      });
      const kudosSentIds = kudosSent.map((k) => k.id);

      // Delete all KudosRecipient records associated with those kudos
      if (kudosSentIds.length > 0) {
        await prisma.kudosRecipient.deleteMany({
          where: { kudosId: { in: kudosSentIds } },
        });
      }

      // Delete all kudos sent by the user
      await prisma.kudos.deleteMany({ where: { fromUser: { username } } });

      // Delete all kudos received by the user
      await prisma.kudosRecipient.deleteMany({ where: { user: { username } } });

      // Delete all badges the user has
      await prisma.userBadge.deleteMany({ where: { user: { username } } });

      // Delete all follow relationships
      await prisma.follow.deleteMany({ where: { follower: { username } } });
      await prisma.follow.deleteMany({ where: { following: { username } } });

      // Finally, delete the user
      await prisma.user.delete({ where: { username } });

      res.json({ message: `User '${username}' deleted.` });
    } catch (err) {
      console.error("💥 Failed to delete user:", err);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // ==========================================================
  // 🎭 PUT /api/admin/users/:username/role — update user role
  // ==========================================================
  router.put("/users/:username/role", isAdmin, async (req, res) => {
    try {
      const { username } = req.params;
      const { role } = req.body;

      if (!role) {
        return res.status(400).json({ error: "Missing role" });
      }

      const user = await prisma.user.update({
        where: { username },
        data: { role },
      });

      res.json({ message: `User '${username}' role updated to ${role}.`, user });
    } catch (err) {
      console.error("💥 Failed to update user role:", err);
      res.status(500).json({ error: "Failed to update user role" });
    }
  });

  // ==========================================================
  // 🔐 GET /api/admin/bots/:username/secret — get bot secret
  // ==========================================================
  router.get("/bots/:username/secret", isAdmin, async (req, res) => {
    try {
      const { username } = req.params;
      const user = await prisma.user.findUnique({ where: { username } });

      if (!user || user.role !== "BOT") {
        return res.status(404).json({ error: "Bot not found" });
      }

      res.json({ secret: user.botSecret });
    } catch (err) {
      console.error(`💥 Failed to get bot secret for ${req.params.username}:`, err);
      res.status(500).json({ error: "Failed to get bot secret" });
    }
  });

  // ==========================================================
  // ♻️ POST /api/admin/bots/:username/secret/rotate — rotate bot secret
  // ==========================================================
  router.post("/bots/:username/secret/rotate", isAdmin, async (req, res) => {
    try {
      const { username } = req.params;
      const newSecret = crypto.randomBytes(32).toString("hex");

      const user = await prisma.user.update({
        where: { username },
        data: { botSecret: newSecret },
      });

      if (!user || user.role !== "BOT") {
        return res.status(404).json({ error: "Bot not found" });
      }

      res.json({ secret: newSecret });
    } catch (err) {
      console.error(`💥 Failed to rotate bot secret for ${req.params.username}:`, err);
      res.status(500).json({ error: "Failed to rotate bot secret" });
    }
  });

  // ==========================================================
  // ✨ POST /api/admin/bots/:username/secret/generate — generate bot secret
  // ==========================================================
  router.post("/bots/:username/secret/generate", isAdmin, async (req, res) => {
    try {
      const { username } = req.params;
      const newSecret = crypto.randomBytes(32).toString("hex");

      const user = await prisma.user.update({
        where: { username },
        data: { botSecret: newSecret },
      });

      if (!user || user.role !== "BOT") {
        return res.status(404).json({ error: "Bot not found" });
      }

      res.json({ secret: newSecret });
    } catch (err) {
      console.error(`💥 Failed to generate bot secret for ${req.params.username}:`, err);
      res.status(500).json({ error: "Failed to generate bot secret" });
    }
  });

  // ==========================================================
  // 🧭 Default route info
  // ==========================================================
  router.get("/", (req, res) => {
    res.json({
      message: "🧭 Admin API ready — available endpoints:",
      endpoints: [
        "GET    /api/admin/overview",
        "GET    /api/admin/badges",
        "POST   /api/admin/badges",
        "POST   /api/admin/badges/grant",
        "POST   /api/admin/badges/:slug/drop",
        "DELETE /api/admin/badges/:slug",
        "GET    /api/admin/kudos",
        "DELETE /api/admin/kudos/:id",
        "GET    /api/admin/categories",
        "POST   /api/admin/categories",
        "DELETE /api/admin/categories/:id",
        "POST   /api/admin/users",
        "DELETE /api/admin/users/:username",
        "PUT    /api/admin/users/:username/role",
        "GET    /api/admin/bots/:username/secret",
        "POST   /api/admin/bots/:username/secret/rotate",
        "POST   /api/admin/bots/:username/secret/generate",
        "POST   /api/admin/reset-db",
        "POST   /api/admin/sync-badges",
      ],
    })
  })

  app.use("/api/admin", router)
}