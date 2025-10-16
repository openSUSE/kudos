// Copyright © 2025–present Lubos Kocman, LCP (Jay Michalska),
// and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0

import express from "express";
import { eventBus } from "./now.js";
import { customAlphabet } from "nanoid";

const nanoid = customAlphabet(
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
  8
);

export function mountKudosRoutes(app, prisma) {
  const router = express.Router();

  // ================================================================
  // GET /api/kudos — List kudos with pagination and filters
  // ================================================================
  router.get("/", async (req, res) => {
    const page = parseInt(req.query.page || "1");
    const limit = parseInt(req.query.limit || "50");
    const skip = (page - 1) * limit;

    const { category, from, to } = req.query;
    const filters = {};

    try {
      if (category) {
        const cat = await prisma.kudosCategory.findUnique({ where: { code: category } });
        if (cat) filters.categoryId = cat.id;
      }

      if (from) {
        const u = await prisma.user.findUnique({ where: { username: from } });
        if (u) filters.fromUserId = u.id;
      }

      if (to) {
        const u = await prisma.user.findUnique({ where: { username: to } });
        if (u) filters.recipients = { some: { userId: u.id } };
      }

      const [items, total] = await Promise.all([
        prisma.kudos.findMany({
          where: filters,
          include: {
            fromUser: { select: { username: true, avatarUrl: true } },
            category: true,
            recipients: {
              include: { user: { select: { username: true, avatarUrl: true } } },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.kudos.count({ where: filters }),
      ]);

      res.json({
        page,
        total,
        pages: Math.ceil(total / limit),
        kudos: items,
      });
    } catch (err) {
      console.error("💥 Kudos API error:", err);
      res.status(500).json({ error: "Failed to fetch kudos" });
    }
  });

  // ================================================================
  // GET /api/kudos/categories — List available kudos categories
  // ================================================================
  router.get("/categories", async (req, res) => {
    try {
      const categories = await prisma.kudosCategory.findMany({
        orderBy: { label: "asc" },
        select: {
          id: true,
          code: true,
          label: true,
          icon: true,
          defaultMsg: true,
        },
      });
      res.json(categories);
    } catch (err) {
      console.error("💥 Failed to load kudos categories:", err);
      res.status(500).json({ error: "Failed to load categories" });
    }
  });

  // ================================================================
  // GET /api/kudos/:slug — Fetch a single kudo by slug
  // ================================================================
  router.get("/:slug", async (req, res) => {
    try {
      const kudo = await prisma.kudos.findUnique({
        where: { slug: req.params.slug },
        include: {
          fromUser: { select: { username: true, avatarUrl: true } },
          recipients: {
            include: { user: { select: { username: true, avatarUrl: true } } },
          },
          category: true,
        },
      });

      if (!kudo) return res.status(404).json({ error: "Kudo not found" });
      res.json(kudo);
    } catch (err) {
      console.error("💥 Failed to fetch kudo:", err);
      res.status(500).json({ error: "Failed to fetch kudo" });
    }
  });


  // ================================================================
  // GET /api/kudos/user/:username — List kudos received by a user
  // ================================================================
  router.get("/user/:username", async (req, res) => {
    try {
      const { username } = req.params;
      const user = await prisma.user.findUnique({ where: { username } });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const kudos = await prisma.kudos.findMany({
        where: {
          recipients: {
            some: { userId: user.id },
          },
        },
        include: {
          fromUser: { select: { username: true, avatarUrl: true } },
          recipients: {
            include: { user: { select: { username: true, avatarUrl: true } } },
          },
          category: true,
        },
        orderBy: { createdAt: "desc" },
      });

      res.json(kudos);
    } catch (err) {
      console.error("💥 Failed to fetch user kudos:", err);
      res.status(500).json({ error: "Failed to fetch user kudos" });
    }
  });


  // ================================================================
  // GET /api/kudos/stats — Global Kudos Summary
  // ================================================================
  router.get("/stats", async (req, res) => {
    try {
      const [kudosCount, uniqueSenders, uniqueReceivers] = await Promise.all([
        prisma.kudos.count(),
        prisma.kudos.groupBy({
          by: ["fromUserId"],
          _count: true,
        }),
        prisma.kudosRecipient.groupBy({
          by: ["userId"],
          _count: true,
        }),
      ]);

      res.json({
        kudosCount,
        uniqueSenders: uniqueSenders.length,
        uniqueReceivers: uniqueReceivers.length,
      });
    } catch (err) {
      console.error("💥 Failed to compute kudos stats:", err);
      res.status(500).json({ error: "Failed to compute kudos stats" });
    }
  });



// ================================================================
// POST /api/kudos — Give kudos to another user
// ================================================================
router.post("/", express.json(), async (req, res) => {
  try {
    const sender = req.currentUser;
    if (!sender) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { to, category, message } = req.body;
    if (!to || !category) {
      return res.status(400).json({ error: "Missing recipient or category" });
    }

    const toUser = await prisma.user.findUnique({ where: { username: to } });
    if (!toUser) {
      return res.status(404).json({ error: "Recipient not found" });
    }

    // 🧩 General safety: prevent self-kudos
    if (toUser.id === sender.id) {
      return res.status(400).json({ error: "You cannot send kudos to yourself." });
    }

    const cat = await prisma.kudosCategory.findUnique({ where: { code: category } });
    if (!cat) {
      return res.status(404).json({ error: "Invalid category" });
    }

    const newKudo = await prisma.kudos.create({
      data: {
        slug: nanoid(),
        fromUserId: sender.id,
        categoryId: cat.id,
        message,
        picture: cat.icon,
        recipients: { create: [{ userId: toUser.id }] },
      },
      include: {
        fromUser: true,
        recipients: { include: { user: true } },
        category: true,
      },
    });

    // 🔔 Emit to live /api/now stream
    eventBus.emit("update", {
      type: "kudos",
      data: {
        from: newKudo.fromUser.username,
        to: newKudo.recipients[0].user.username,
        category: cat.label,
        message,
        createdAt: newKudo.createdAt,
      },
    });

    // 💌 Notify the recipient (only if not self-kudos)
    await prisma.notification.create({
      data: {
        userId: toUser.id,
        message: `💚 You received kudos from ${sender.username}!`,
        type: "info",
      },
    });

    res.status(201).json(newKudo);
  } catch (err) {
    console.error("💥 Error creating kudos:", err);
    res.status(500).json({ error: "Failed to create kudos" });
  }
});



  // Mount the router
  app.use("/api/kudos", router);
}
