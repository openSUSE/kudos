// backend/src/routes/kudos.js
// SPDX-License-Identifier: Apache-2.0

import express from "express";
import { eventBus } from "./now.js";
import { customAlphabet } from "nanoid";
import { LRUCache } from "lru-cache";
import satori from "satori";
import { svgToPng } from "../utils/image.js";
import { sanitizeUser } from "../utils/user.js";
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

const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;

function loadSatoriFonts() {
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

  return fonts;
}

function svgFileToDataUri(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const svg = fs.readFileSync(filePath, "utf8");
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function resolvePublicImageSource(src) {
  if (!src) return null;
  if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("data:")) {
    return src;
  }
  if (src.startsWith("/")) {
    const localPath = path.resolve("frontend/public", src.slice(1));
    if (fs.existsSync(localPath)) {
      const ext = path.extname(localPath).toLowerCase();
      if (ext === ".svg") {
        return svgFileToDataUri(localPath);
      }
      const mime = ext === ".png" ? "image/png" : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : null;
      if (!mime) return null;
      const bytes = fs.readFileSync(localPath);
      return `data:${mime};base64,${bytes.toString("base64")}`;
    }
  }
  return null;
}

function resolveCategoryIconText(src) {
  if (!src) return null;
  const icon = String(src).trim();
  if (!icon) return null;
  if (icon.startsWith("http://") || icon.startsWith("https://") || icon.startsWith("data:") || icon.startsWith("/")) {
    return null;
  }
  return icon.slice(0, 4);
}

function truncateText(text, maxLength = 180) {
  if (!text) return "Keep up the great work.";
  const normalized = String(text).replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
}

async function renderKudoPreviewSvgFallback(kudo) {
  const toUser = kudo.recipients[0]?.user?.username || "someone";
  const categoryLabel = kudo.category?.label || "General";
  const rawCategoryIcon = kudo.category?.icon;
  const categoryIcon = resolvePublicImageSource(rawCategoryIcon);
  const categoryIconText = resolveCategoryIconText(rawCategoryIcon);

  return await satori(
    {
      type: "div",
      props: {
        style: {
          width: `${CARD_WIDTH}px`,
          height: `${CARD_HEIGHT}px`,
          background: "#f5f8f6",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          fontFamily: "'Source Sans Pro', sans-serif",
          padding: "48px",
        },
        children: [
          {
            type: "h1",
            props: {
              style: {
                color: "#0b9444",
                fontSize: "62px",
                margin: 0,
                fontWeight: "700",
              },
              children: `💚 ${kudo.fromUser.username} → ${toUser}`,
            },
          },
          {
            type: "p",
            props: {
              style: {
                fontSize: "40px",
                marginTop: "24px",
                marginBottom: "18px",
                color: "#2a4031",
                fontWeight: "400",
              },
              children: truncateText(kudo.message, 140),
            },
          },
          {
            type: "div",
            props: {
              style: {
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              },
              children: [
                categoryIcon
                  ? {
                      type: "img",
                      props: {
                        src: categoryIcon,
                        width: 64,
                        height: 64,
                      },
                    }
                  : categoryIconText
                    ? {
                        type: "span",
                        props: {
                          style: {
                            fontSize: "46px",
                            lineHeight: 1,
                          },
                          children: categoryIconText,
                        },
                      }
                  : null,
                {
                  type: "span",
                  props: {
                    style: {
                      fontSize: "34px",
                      color: "#365848",
                      fontWeight: "700",
                      marginLeft: categoryIcon || categoryIconText ? "12px" : 0,
                    },
                    children: categoryLabel,
                  },
                },
              ].filter(Boolean),
            },
          },
        ],
      },
    },
    { width: CARD_WIDTH, height: CARD_HEIGHT, fonts: loadSatoriFonts() }
  );
}

async function renderKudoPreviewSvg(kudo) {
  const toUser = kudo.recipients[0]?.user?.username || "someone";
  const categoryLabel = kudo.category?.label || "General";
  const fromUser = kudo.fromUser?.username || "someone";
  const rawCategoryIcon = kudo.category?.icon;
  const categoryIcon = resolvePublicImageSource(rawCategoryIcon);
  const categoryIconText = resolveCategoryIconText(rawCategoryIcon);
  const watermark = svgFileToDataUri(path.resolve("frontend/public/logo-watermark.svg"));
  const logo = resolvePublicImageSource("/logo.svg");
  const message = truncateText(kudo.message);
  const createdAt = new Date(kudo.createdAt).toLocaleDateString("en", { dateStyle: "medium" });

  try {
    return await satori(
      {
        type: "div",
        props: {
          style: {
            width: `${CARD_WIDTH}px`,
            height: `${CARD_HEIGHT}px`,
            background: "#f0f7f2",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "'Source Sans Pro', sans-serif",
            position: "relative",
            overflow: "hidden",
          },
          children: [
            watermark
              ? {
                  type: "img",
                  props: {
                    src: watermark,
                    width: CARD_WIDTH,
                    height: CARD_HEIGHT,
                    style: {
                      position: "absolute",
                      top: 0,
                      left: 0,
                      opacity: 0.075,
                      objectFit: "cover",
                    },
                  },
                }
              : null,
            {
              type: "div",
              props: {
                style: {
                  width: "1080px",
                  minHeight: "540px",
                  background: "#ffffff",
                  border: "7px solid #0b9444",
                  borderRadius: "24px",
                  display: "flex",
                  flexDirection: "column",
                  padding: "36px 44px",
                  justifyContent: "space-between",
                },
                children: [
                  {
                    type: "div",
                    props: {
                      style: {
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        borderBottom: "1px solid #d8ebde",
                        paddingBottom: "18px",
                      },
                      children: [
                        {
                          type: "div",
                          props: {
                            style: { display: "flex", flexDirection: "column" },
                            children: [
                              {
                                type: "span",
                                props: {
                                  style: {
                                    fontSize: "44px",
                                    fontWeight: "700",
                                    color: "#0b9444",
                                    lineHeight: 1.1,
                                  },
                                  children: "openSUSE Kudos",
                                },
                              },
                              {
                                type: "span",
                                props: {
                                  style: { fontSize: "22px", color: "#346646", marginTop: "6px" },
                                  children: "Certificate of Appreciation",
                                },
                              },
                            ],
                          },
                        },
                        logo
                          ? {
                              type: "img",
                              props: {
                                src: logo,
                                width: 118,
                                height: 118,
                                style: { objectFit: "contain" },
                              },
                            }
                          : null,
                      ].filter(Boolean),
                    },
                  },
                  {
                    type: "div",
                    props: {
                      style: {
                        display: "flex",
                        flexDirection: "column",
                        gap: "14px",
                        marginTop: "20px",
                      },
                      children: [
                        {
                          type: "p",
                          props: {
                            style: { fontSize: "29px", color: "#173322", margin: 0 },
                            children: `@${fromUser} sent kudos to @${toUser}`,
                          },
                        },
                        {
                          type: "div",
                          props: {
                            style: {
                              background: "#f7fcf8",
                              border: "1px solid #cde9d5",
                              borderRadius: "14px",
                              padding: "18px 20px",
                              display: "flex",
                            },
                            children: {
                              type: "p",
                              props: {
                                style: {
                                  fontSize: "35px",
                                  color: "#1d3626",
                                  lineHeight: 1.3,
                                  margin: 0,
                                },
                                children: `\"${message}\"`,
                              },
                            },
                          },
                        },
                      ],
                    },
                  },
                  {
                    type: "div",
                    props: {
                      style: {
                        marginTop: "20px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        borderTop: "1px solid #d8ebde",
                        paddingTop: "14px",
                      },
                      children: [
                        {
                          type: "div",
                          props: {
                            style: { display: "flex", alignItems: "center", gap: "10px" },
                            children: [
                              categoryIcon
                                ? {
                                    type: "img",
                                    props: {
                                      src: categoryIcon,
                                      width: 44,
                                      height: 44,
                                      style: { objectFit: "contain" },
                                    },
                                  }
                                : categoryIconText
                                  ? {
                                      type: "span",
                                      props: {
                                        style: { fontSize: "34px", lineHeight: 1 },
                                        children: categoryIconText,
                                      },
                                    }
                                : null,
                              {
                                type: "span",
                                props: {
                                  style: { fontSize: "24px", color: "#1f5131", fontWeight: "700" },
                                  children: categoryLabel,
                                },
                              },
                            ].filter(Boolean),
                          },
                        },
                        {
                          type: "span",
                          props: {
                            style: { fontSize: "20px", color: "#4b6957" },
                            children: `kudos.opensuse.org · ${createdAt}`,
                          },
                        },
                      ],
                    },
                  },
                ],
              },
            },
          ],
        },
      },
      { width: CARD_WIDTH, height: CARD_HEIGHT, fonts: loadSatoriFonts() }
    );
  } catch (err) {
    console.error("⚠️ Rich social card renderer failed, falling back to simplified card:", err?.message || err);
    return await renderKudoPreviewSvgFallback(kudo);
  }
}

export function mountKudosRoutes(app, prisma) {
  const router = express.Router();

  // ---------------------------------------------------------------
  // GET /api/kudos — List kudos with filters
  // ---------------------------------------------------------------
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
            fromUser: true,
            category: true,
            recipients: {
              include: { user: true },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.kudos.count({ where: filters }),
      ]);

      const sanitizedKudos = items.map(kudo => ({
        ...kudo,
        fromUser: sanitizeUser(kudo.fromUser),
        recipients: kudo.recipients.map(r => ({ ...r, user: sanitizeUser(r.user) }))
      }));

      res.json({
        page,
        total,
        pages: Math.ceil(total / limit),
        kudos: sanitizedKudos,
      });
    } catch (err) {
      console.error("💥 Kudos API error:", err);
      res.status(500).json({ error: "Failed to fetch kudos" });
    }
  });

  // ---------------------------------------------------------------
  // GET /api/kudos/categories
  // ---------------------------------------------------------------
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

  // ---------------------------------------------------------------
  // GET /api/kudos/:slug
  // ---------------------------------------------------------------
  router.get("/:slug", async (req, res) => {
    try {
      const kudo = await prisma.kudos.findUnique({
        where: { slug: req.params.slug },
        include: {
          fromUser: true,
          recipients: {
            include: { user: true },
          },
          category: true,
        },
      });

      if (!kudo) return res.status(404).json({ error: "Kudo not found" });

      const sanitizedKudo = {
        ...kudo,
        fromUser: sanitizeUser(kudo.fromUser),
        recipients: kudo.recipients.map(r => ({ ...r, user: sanitizeUser(r.user) }))
      };

      res.json(sanitizedKudo);
    } catch (err) {
      console.error("💥 Failed to fetch kudo:", err);
      res.status(500).json({ error: "Failed to fetch kudo" });
    }
  });

  // ---------------------------------------------------------------
  // GET /api/kudos/user/:username
  // ---------------------------------------------------------------
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
          fromUser: true,
          recipients: {
            include: { user: true },
          },
          category: true,
        },
        orderBy: { createdAt: "desc" },
      });

      const sanitizedKudos = kudos.map(kudo => ({
        ...kudo,
        fromUser: sanitizeUser(kudo.fromUser),
        recipients: kudo.recipients.map(r => ({ ...r, user: sanitizeUser(r.user) }))
      }));

      res.json(sanitizedKudos);
    } catch (err) {
      console.error("💥 Failed to fetch user kudos:", err);
      res.status(500).json({ error: "Failed to fetch user kudos" });
    }
  });

  // ---------------------------------------------------------------
  // GET /api/kudos/stats
  // ---------------------------------------------------------------
  router.get("/stats", async (req, res) => {
    try {
      const [kudosCount, uniqueSenders, uniqueReceivers] = await Promise.all([
        prisma.kudos.count(),
        prisma.kudos.groupBy({ by: ["fromUserId"], _count: true }),
        prisma.kudosRecipient.groupBy({ by: ["userId"], _count: true }),
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

  // ---------------------------------------------------------------
  // POST /api/kudos — Create kudos
  // ---------------------------------------------------------------
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

      const baseUrl =
        process.env.BASE_URL ||
        process.env.VITE_DEV_SERVER ||
        "http://localhost:3000";

      const permalink = `${baseUrl}/kudo/${newKudo.slug}`;
      const shareUrl = `${permalink}/share`;

      // Unified pipeline notification
      eventBus.emit("activity", {
        type: "kudos",
        actorId: sender.id,
        targetUserId: toUser.id,
        payload: {
          from: sender.username,
          to: toUser.username,
          category: cat.label,
          message: message || null,
          permalink,
          shareUrl,
          createdAt: newKudo.createdAt,
        },
      });

      const sanitizedKudo = {
        ...newKudo,
        fromUser: sanitizeUser(newKudo.fromUser),
        recipients: newKudo.recipients.map(r => ({...r, user: sanitizeUser(r.user)}))
      };
      res.status(201).json(sanitizedKudo);
    } catch (err) {
      console.error("💥 Error creating kudos:", err);
      res.status(500).json({ error: "Failed to create kudos" });
    }
  });

  // ---------------------------------------------------------------
  // GET /api/kudos/:slug/image.svg — Social preview (SVG)
  // ---------------------------------------------------------------
  router.get("/:slug/image.svg", async (req, res) => {
    const { slug } = req.params;
    const cacheKey = `svg:${slug}`;

    if (previewCache.has(cacheKey)) {
      res.setHeader("Content-Type", "image/svg+xml");
      return res.send(previewCache.get(cacheKey));
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

      const svg = await renderKudoPreviewSvg(kudo);
      previewCache.set(cacheKey, svg);

      res.setHeader("Content-Type", "image/svg+xml");
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.send(svg);
    } catch (err) {
      console.error("💥 Failed to generate kudos SVG image:", err);
      res.status(500).json({ error: "Failed to generate kudos SVG image" });
    }
  });

  // ---------------------------------------------------------------
  // GET /api/kudos/:slug/image — Social preview
  // ---------------------------------------------------------------
  router.get("/:slug/image", async (req, res) => {
    const { slug } = req.params;
    const cacheKey = `png:${slug}`;

    if (previewCache.has(cacheKey)) {
      res.setHeader("Content-Type", "image/png");
      return res.send(previewCache.get(cacheKey));
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

      const svg = await renderKudoPreviewSvg(kudo);

      const png = await svgToPng(svg);
      const buffer = Buffer.from(png);

      previewCache.set(cacheKey, buffer);

      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.send(buffer);
    } catch (err) {
      console.error("💥 Failed to generate kudos image:", err);
      res.status(500).json({ error: "Failed to generate kudos image" });
    }
  });

  // ---------------------------------------------------------------
  // GET /api/kudos/:slug/share — Social share redirection
  // ---------------------------------------------------------------
  router.get("/:slug/share", async (req, res) => {
    try {
      const { slug } = req.params;
      const kudo = await prisma.kudos.findUnique({
        where: { slug },
        include: {
          fromUser: true,
          recipients: {
            include: { user: true },
          },
          category: true,
        },
      });

      if (!kudo) return res.status(404).send("Kudo not found");

      const base =
        process.env.BASE_URL ||
        process.env.VITE_DEV_SERVER ||
        "http://localhost:3000";

      const from = kudo.fromUser.username;
      const to = kudo.recipients[0]?.user.username || "someone";
      const description = `${from} sent Geeko Kudos to ${to} — ${kudo.message || "Keep up the great work!"}`;
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
            <meta property="og:image:width" content="1200">
            <meta property="og:image:height" content="630">
            <meta property="og:image:type" content="image/png">
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

  app.use("/api/kudos", router);
}
