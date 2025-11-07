// Copyright © 2025–present Lubos Kocman, LCP (Jay Michalska),
// and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0

import express from "express";
import { eventBus } from "./now.js";
import { customAlphabet } from "nanoid";

import { LRUCache } from "lru-cache";

// on-demand image generation for social media

import satori from "satori";
import { svgToPng } from "../utils/image.js";
import fs from "fs";
import path from "path";

const previewCache = new LRUCache({
  max: 50,
  ttl: 1000 * 60 * 30, // 30 minutes
});

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

    // Compute permalink (for Slack/Matrix etc.)
    const baseUrl =
      process.env.PUBLIC_URL ||
      process.env.VITE_DEV_SERVER ||
      "http://localhost:3000";

    const permalink = `${baseUrl}/kudo/${newKudo.slug}`;

    // Emit msg to live /api/now stream
    eventBus.emit("update", {
      type: "kudos",
      data: {
        from: newKudo.fromUser.username,
        to: newKudo.recipients[0].user.username,
        category: cat.label,
        message,
        createdAt: newKudo.createdAt,
        permalink, // 🔗 added permalink
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

// ================================================================
// GET /api/kudos/:slug/image — On-demand social/print preview image (Satori)
// ================================================================
router.get("/:slug/image", async (req, res) => {
  const { slug } = req.params;

  // 🧠 Check cache
  if (previewCache.has(slug)) {
    res.setHeader("Content-Type", "image/png");
    return res.send(previewCache.get(slug));
  }

  try {
    const kudo = await prisma.kudos.findUnique({
      where: { slug },
      include: {
        fromUser: true,
        recipients: { include: { user: true } },
        category: true,
      },
    });

    if (!kudo) return res.status(404).send("Kudo not found");

    // 🖋 Load Source Sans Pro font
    const fontRegularPath = path.resolve("frontend/public/fonts/SourceSansPro-Regular.ttf");
    const fontBoldPath = path.resolve("frontend/public/fonts/SourceSansPro-Bold.ttf");

    const fonts = [];
    if (fs.existsSync(fontRegularPath)) {
      fonts.push({
        name: "Source Sans Pro",
        data: fs.readFileSync(fontRegularPath),
        weight: 400,
        style: "normal",
      });
    }
    if (fs.existsSync(fontBoldPath)) {
      fonts.push({
        name: "Source Sans Pro",
        data: fs.readFileSync(fontBoldPath),
        weight: 700,
        style: "bold",
      });
    }

    // 🧱 Build SVG layout via Satori
    const svg = await satori(
      {
        type: "div",
        props: {
          style: {
            width: "800px",
            height: "400px",
            background: "#f5f5f5",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            fontFamily: "'Source Sans Pro', sans-serif",
          },
          children: [
            {
              type: "h1",
              props: {
                style: {
                  color: "#0b9444",
                  fontSize: "42px",
                  marginBottom: "16px",
                  fontWeight: "700",
                },
                children: `💚 ${kudo.fromUser.username} → ${kudo.recipients[0].user.username}`,
              },
            },
            {
              type: "p",
              props: {
                style: {
                  fontSize: "24px",
                  marginBottom: "12px",
                  color: "#333",
                  fontWeight: "400",
                },
                children: kudo.message || "(no message)",
              },
            },
            {
              type: "p",
              props: {
                style: { fontSize: "22px", color: "#666", fontWeight: "400" },
                children: `🏅 ${kudo.category.label}`,
              },
            },
            {
              type: "img",
              props: {
                src: kudo.category.icon,
                width: 80,
                height: 80,
                style: { marginTop: "20px" },
              },
            },
          ],
        },
      },
      {
        width: 800,
        height: 400,
        fonts,
      }
    );

    // Convert SVG → PNG
    const png = await svgToPng(svg);
    const buffer = Buffer.from(png);

    // Cache the generated image
    previewCache.set(slug, buffer);

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(buffer);
  } catch (err) {
    console.error("💥 Failed to generate kudos image:", err);
    res.status(500).json({ error: "Failed to generate kudos image" });
  }
});

router.get("/:slug/share", async (req, res) => {
  try {
    const { slug } = req.params;
    const kudo = await prisma.kudos.findUnique({
      where: { slug },
      include: {
        fromUser: { select: { username: true, avatarUrl: true } },
        recipients: {
          include: { user: { select: { username: true, avatarUrl: true } } },
        },
        category: true,
      },
    });

    if (!kudo) return res.status(404).send("Kudo not found");

    const base =
      process.env.PUBLIC_URL ||
      process.env.VITE_DEV_SERVER ||
      "http://localhost:3000";

    const from = kudo.fromUser.username;
    const to = kudo.recipients[0]?.user.username || "someone";
    const description = `${from} sent Geeko Kudos to ${to} — ${kudo.message}`;
    const image = `${base}/api/kudos/${slug}/image`;

    res.send(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <title>${from} sent kudos to ${to}</title>
          <meta property="og:title" content="${from} sent kudos to ${to}">
          <meta property="og:description" content="${description}">
          <meta property="og:image" content="${image}">
          <meta property="og:type" content="article">
          <meta property="og:url" content="${base}/kudo/${slug}">
          <meta name="twitter:card" content="summary_large_image">
          <meta name="twitter:title" content="${from} sent kudos to ${to}">
          <meta name="twitter:description" content="${description}">
          <meta name="twitter:image" content="${image}">
        </head>
        <body>
          <script>window.location.href="${base}/kudo/${slug}";</script>
        </body>
      </html>
    `);
  } catch (err) {
    console.error("💥 Failed to generate share page:", err);
    res.status(500).send("Error generating share preview");
  }
});


  // Mount the router
  app.use("/api/kudos", router);
}
