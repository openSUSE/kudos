// backend/src/routes/badges.js
// Copyright © 2025–present
// SPDX-License-Identifier: Apache-2.0

import express from "express";
import { eventBus } from "./now.js";
import { adminOrBotAuth } from "../middleware/adminOrBotAuth.js";
import { sanitizeUser } from "../utils/user.js";

function getBaseUrl() {
  return process.env.BASE_URL || process.env.VITE_DEV_SERVER || "http://localhost:3000";
}

function buildBadgeAchievementPermalink(baseUrl, badgeSlug, username) {
  return `${baseUrl}/badge/${badgeSlug}/earned-by/${username}`;
}

function buildBadgeAchievementShareUrl(baseUrl, badgeSlug, username) {
  return `${buildBadgeAchievementPermalink(baseUrl, badgeSlug, username)}/share`;
}

function buildBadgeShareText(displayName, badgeTitle, badgeDescription) {
  const badgeSummary = badgeDescription || badgeTitle;
  return `${displayName} just earned badge in openSUSE Kudos for ${badgeSummary}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function resolveBadgeImage(baseUrl, picture) {
  if (!picture) return `${baseUrl}/opensuse.svg`;
  if (picture.startsWith("http://") || picture.startsWith("https://")) return picture;
  if (picture.startsWith("/")) return `${baseUrl}${picture}`;
  return `${baseUrl}/${picture}`;
}

function renderBadgeAchievementShareHtml({
  baseUrl,
  username,
  displayName,
  badge,
  grantedAt,
  permalink,
  shareUrl,
  shareText,
}) {
  const title = `${displayName} earned ${badge.title}`;
  const description = shareText;
  const image = resolveBadgeImage(baseUrl, badge.picture);
  const encodedShareUrl = encodeURIComponent(shareUrl);
  const encodedShareText = encodeURIComponent(shareText);

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${escapeHtml(title)} · openSUSE Kudos</title>
        <meta name="description" content="${escapeHtml(description)}">
        <meta property="og:title" content="${escapeHtml(title)}">
        <meta property="og:description" content="${escapeHtml(description)}">
        <meta property="og:image" content="${escapeHtml(image)}">
        <meta property="og:type" content="article">
        <meta property="og:url" content="${escapeHtml(shareUrl)}">
        <meta name="twitter:card" content="summary_large_image">
        <meta name="twitter:title" content="${escapeHtml(title)}">
        <meta name="twitter:description" content="${escapeHtml(description)}">
        <meta name="twitter:image" content="${escapeHtml(image)}">
        <link rel="canonical" href="${escapeHtml(shareUrl)}">
        <style>
          :root {
            --plum-bg: #130f1d;
            --plum-panel: #20172f;
            --plum-border: #4a3b66;
            --plum-btn: #2a1f3d;
            --plum-primary: #8f5ad6;
            --text-main: #f7f2ff;
            --text-soft: #dacdee;
            --text-muted: #bda8de;
            --geeko-green: #30ba78;
            --geeko-green-soft: rgba(48, 186, 120, 0.22);
          }
          body {
            margin: 0;
            padding: 24px 16px;
            background: radial-gradient(circle at top right, var(--geeko-green-soft), transparent 35%), var(--plum-bg);
            color: var(--text-main);
            font-family: "Pixel Operator", "Source Sans Pro", sans-serif;
            display: flex;
            justify-content: center;
          }
          main {
            width: min(920px, 100%);
            border: 1px solid var(--plum-border);
            border-radius: 20px;
            background: var(--plum-panel);
            box-shadow: 0 16px 48px rgba(0, 0, 0, 0.38);
            padding: 18px;
          }
          .preview {
            display: grid;
            gap: 16px;
            grid-template-columns: 180px minmax(0, 1fr);
            align-items: center;
          }
          .preview img {
            width: 180px;
            height: 180px;
            object-fit: contain;
            border-radius: 14px;
            border: 1px solid var(--plum-border);
            background: var(--plum-bg);
            box-shadow: 0 0 0 2px var(--geeko-green-soft);
          }
          h1 {
            margin: 0;
            font-size: clamp(1.8rem, 3.2vw, 2.6rem);
            text-shadow: 0 0 14px var(--geeko-green-soft);
          }
          p {
            margin: 0.6rem 0 0;
            color: var(--text-soft);
            line-height: 1.4;
          }
          .actions {
            margin-top: 16px;
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
          }
          .btn {
            border: 1px solid var(--plum-border);
            color: var(--text-main);
            background: var(--plum-btn);
            border-radius: 999px;
            padding: 9px 14px;
            text-decoration: none;
            cursor: pointer;
            font: inherit;
            transition: all 0.18s ease;
          }
          .btn.primary {
            background: linear-gradient(135deg, var(--plum-primary), var(--geeko-green));
            color: #160f24;
            border-color: transparent;
          }
          .btn:hover {
            border-color: var(--geeko-green);
            box-shadow: 0 0 0 2px var(--geeko-green-soft);
            transform: translateY(-1px);
          }
          .links {
            margin-top: 12px;
            color: var(--text-muted);
            word-break: break-all;
            border-top: 1px dashed var(--geeko-green-soft);
            padding-top: 10px;
          }
          .app-links {
            margin-top: 12px;
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
          }
          @media (max-width: 760px) {
            .preview { grid-template-columns: 1fr; }
          }
        </style>
      </head>
      <body>
        <main>
          <div class="preview">
            <img src="${escapeHtml(image)}" alt="${escapeHtml(badge.title)}">
            <div>
              <h1>${escapeHtml(title)}</h1>
              <p>${escapeHtml(description)}</p>
              <p>Badge: ${escapeHtml(badge.title)} · Awarded ${escapeHtml(new Date(grantedAt).toLocaleDateString("en", { dateStyle: "medium" }))}</p>
              <p>User: @${escapeHtml(username)}</p>
            </div>
          </div>
          <div class="actions">
            <button class="btn primary" type="button" data-copy="${escapeHtml(shareUrl)}">Copy share link</button>
            <a class="btn" href="${escapeHtml(permalink)}">Open achievement</a>
            <a class="btn" href="https://www.linkedin.com/sharing/share-offsite/?url=${encodedShareUrl}" target="_blank" rel="noopener">Share on LinkedIn</a>
            <a class="btn" href="https://fosstodon.org/share?text=${encodedShareText}%20${encodedShareUrl}" target="_blank" rel="noopener">Share on Fosstodon</a>
            <a class="btn" href="https://x.com/intent/post?text=${encodedShareText}&url=${encodedShareUrl}" target="_blank" rel="noopener">Share on X</a>
          </div>
          <div class="app-links">
            <a class="btn" href="${escapeHtml(baseUrl)}">Back to app home</a>
            <a class="btn" href="${escapeHtml(`${baseUrl}/badges/recent`)}">Recent badge achievements</a>
            <a class="btn" href="${escapeHtml(`${baseUrl}/badge/${badge.slug}`)}">Badge details</a>
          </div>
          <div class="links">${escapeHtml(shareUrl)}</div>
        </main>
        <script>
          const button = document.querySelector('[data-copy]');
          if (button) {
            button.addEventListener('click', async () => {
              try {
                await navigator.clipboard.writeText(button.dataset.copy || '');
                button.textContent = 'Copied';
              } catch {
                window.prompt('Copy this share link', button.dataset.copy || '');
              }
            });
          }
        </script>
      </body>
    </html>
  `;
}

export function mountBadgesRoutes(app, prisma) {
  const router = express.Router();
  const checkAdminOrBot = adminOrBotAuth(prisma);

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
  // GET /api/badges/achievement/:badgeSlug/:username
  // Single user badge achievement detail for permalink pages
  // ---------------------------------------------------------------
  router.get("/achievement/:badgeSlug/:username", async (req, res) => {
    const { badgeSlug, username } = req.params;

    try {
      const awarded = await prisma.userBadge.findFirst({
        where: {
          user: { username },
          badge: { slug: badgeSlug },
        },
        include: {
          user: true,
          badge: {
            select: {
              slug: true,
              title: true,
              description: true,
              picture: true,
            },
          },
        },
      });

      if (!awarded) {
        return res.status(404).json({ error: "Badge achievement not found" });
      }

      const baseUrl = getBaseUrl();
      const displayName = awarded.user.fullName || awarded.user.username;
      const permalink = buildBadgeAchievementPermalink(baseUrl, awarded.badge.slug, awarded.user.username);
      const shareUrl = buildBadgeAchievementShareUrl(baseUrl, awarded.badge.slug, awarded.user.username);

      res.json({
        badge: awarded.badge,
        user: sanitizeUser(awarded.user),
        grantedAt: awarded.grantedAt,
        permalink,
        shareUrl,
        shareText: buildBadgeShareText(displayName, awarded.badge.title, awarded.badge.description),
      });
    } catch (err) {
      console.error("💥 Error fetching badge achievement:", err);
      res.status(500).json({ error: "Failed to fetch badge achievement" });
    }
  });

  // ---------------------------------------------------------------
  // GET /api/badges/recent-achievements — grouped timeline
  // ---------------------------------------------------------------
  router.get("/recent-achievements", async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit || "20", 10), 100);
    const days = Math.min(parseInt(req.query.days || "30", 10), 365);
    const groupWindowMinutes = Math.max(parseInt(req.query.groupWindowMinutes || "5", 10), 1);
    const groupWindowMs = groupWindowMinutes * 60 * 1000;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    try {
      const rows = await prisma.userBadge.findMany({
        where: { grantedAt: { gte: since } },
        orderBy: { grantedAt: "desc" },
        take: limit * 25,
        include: {
          user: true,
          badge: {
            select: {
              id: true,
              slug: true,
              title: true,
              description: true,
              picture: true,
            },
          },
        },
      });

      const baseUrl = getBaseUrl();
      const groups = new Map();

      for (const row of rows) {
        const bucket = Math.floor(new Date(row.grantedAt).getTime() / groupWindowMs);
        const key = `${row.badge.id}:${bucket}`;

        if (!groups.has(key)) {
          groups.set(key, {
            badge: {
              slug: row.badge.slug,
              title: row.badge.title,
              description: row.badge.description,
              picture: row.badge.picture,
            },
            grantedAt: row.grantedAt,
            awardedCount: 0,
            users: [],
          });
        }

        const group = groups.get(key);
        group.awardedCount += 1;
        group.users.push({
          ...sanitizeUser(row.user),
          grantedAt: row.grantedAt,
          permalink: buildBadgeAchievementPermalink(baseUrl, row.badge.slug, row.user.username),
        });
      }

      const timeline = Array.from(groups.values())
        .map((group) => ({
          ...group,
          users: group.users
            .sort((a, b) => a.username.localeCompare(b.username))
            .slice(0, 100),
        }))
        .sort((a, b) => new Date(b.grantedAt).getTime() - new Date(a.grantedAt).getTime())
        .slice(0, limit);

      res.json({
        timeline,
        meta: {
          days,
          groupWindowMinutes,
          limit,
        },
      });
    } catch (err) {
      console.error("💥 Failed to fetch recent badge achievements:", err);
      res.status(500).json({ error: "Failed to fetch recent badge achievements" });
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

      const baseUrl = getBaseUrl();

      res.json(userBadges.map((ub) => ({
        ...ub.badge,
        grantedAt: ub.grantedAt,
        permalink: buildBadgeAchievementPermalink(baseUrl, ub.badge.slug, user.username),
        shareUrl: buildBadgeAchievementShareUrl(baseUrl, ub.badge.slug, user.username),
      })));
    } catch (err) {
      console.error("💥 Failed to fetch user badges:", err);
      res.status(500).json({ error: "Failed to fetch user badges" });
    }
  });

  // ---------------------------------------------------------------
  // POST /api/badges/grant — Grant badge (admin/bot)
  // ---------------------------------------------------------------
  router.post("/grant", checkAdminOrBot, async (req, res) => {
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
          user: { select: { id: true, username: true, fullName: true, avatarUrl: true } },
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

      const baseUrl = getBaseUrl();

      const permalink = buildBadgeAchievementPermalink(baseUrl, granted.badge.slug, granted.user.username);
      const shareUrl = buildBadgeAchievementShareUrl(baseUrl, granted.badge.slug, granted.user.username);
      const badgePicture = granted.badge.picture.startsWith("http")
        ? granted.badge.picture
        : `${baseUrl}${granted.badge.picture}`;
      const shareText = buildBadgeShareText(
        granted.user.fullName || granted.user.username,
        granted.badge.title,
        granted.badge.description
      );

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
          permalink: shareUrl,
          achievementPermalink: permalink,
          shareUrl,
          shareText,
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
      const baseUrl = getBaseUrl();
      const recent = await prisma.userBadge.findMany({
        where: { grantedAt: { gte: since } },
        take: limit,
        orderBy: { grantedAt: "desc" },
        include: {
          user: true,
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
          user: sanitizeUser(r.user),
          grantedAt: r.grantedAt,
          permalink: buildBadgeAchievementPermalink(baseUrl, r.badge.slug, r.user.username),
        }))
      );
    } catch (err) {
      console.error("💥 Failed to fetch recent badges:", err);
      res.status(500).json({ error: "Failed to fetch recent badges" });
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
        users: badge.userAwards.map((a) => sanitizeUser(a.user)),
      });
    } catch (err) {
      console.error("💥 Error fetching badge:", err);
      res.status(500).json({ error: "Failed to fetch badge" });
    }
  });

  app.get("/badge/:badgeSlug/earned-by/:username/share", async (req, res) => {
    const { badgeSlug, username } = req.params;

    try {
      const awarded = await prisma.userBadge.findFirst({
        where: {
          user: { username },
          badge: { slug: badgeSlug },
        },
        include: {
          user: true,
          badge: {
            select: {
              slug: true,
              title: true,
              description: true,
              picture: true,
            },
          },
        },
      });

      if (!awarded) {
        return res.status(404).send("Badge achievement not found");
      }

      const baseUrl = getBaseUrl();
      const displayName = awarded.user.fullName || awarded.user.username;
      const permalink = buildBadgeAchievementPermalink(baseUrl, awarded.badge.slug, awarded.user.username);
      const shareUrl = buildBadgeAchievementShareUrl(baseUrl, awarded.badge.slug, awarded.user.username);
      const shareText = buildBadgeShareText(displayName, awarded.badge.title, awarded.badge.description);

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=300, s-maxage=600, stale-while-revalidate=86400");
      res.send(renderBadgeAchievementShareHtml({
        baseUrl,
        username: awarded.user.username,
        displayName,
        badge: awarded.badge,
        grantedAt: awarded.grantedAt,
        permalink,
        shareUrl,
        shareText,
      }));
    } catch (err) {
      console.error("💥 Failed to render badge achievement share page:", err);
      res.status(500).send("Error generating badge share preview");
    }
  });

  app.use("/api/badges", router);
}
