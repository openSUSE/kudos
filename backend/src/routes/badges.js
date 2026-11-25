// backend/src/routes/badges.js
// Copyright © 2025–present
// SPDX-License-Identifier: Apache-2.0

import express from "express";
import fs from "fs";
import path from "path";
import { adminOrBotAuth } from "../middleware/adminOrBotAuth.js";
import { findUserByNameInsensitive, sanitizeUser } from "../utils/user.js";
import { resolveKudosBadgesDir } from "../services/kudosBadges.js";
import {
  grantBadge,
  getBaseUrl,
  buildBadgeAchievementPermalink,
  buildBadgeAchievementShareUrl,
  buildBadgeShareText,
  buildUserBadgeBoardPermalink,
  buildUserBadgeBoardShareUrl,
  buildUserBadgeBoardSvgUrl,
} from "../utils/grantBadge.js";

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

  try {
    const parsed = new URL(picture, baseUrl);
    if (parsed.pathname.startsWith("/badges/")) {
      parsed.pathname = parsed.pathname.replace("/badges/", "/badges/previews/800/");
    }

    if (picture.startsWith("http://") || picture.startsWith("https://")) {
      return parsed.toString();
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`.startsWith("/")
      ? `${baseUrl}${parsed.pathname}${parsed.search}${parsed.hash}`
      : `${baseUrl}/${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    // Fall back to the original input shape if URL parsing fails.
  }

  const previewPath = picture.startsWith("/badges/")
    ? picture.replace("/badges/", "/badges/previews/800/")
    : picture;
  if (previewPath.startsWith("/")) return `${baseUrl}${previewPath}`;
  return `${baseUrl}/${previewPath}`;
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

function renderBadgeBoardSvg({
  username,
  displayName,
  badges = [],
  baseUrl,
  limit = 20,
}) {
  const safeUsername = escapeHtml(username);
  const safeDisplayName = escapeHtml(displayName || username);
  const totalBadges = badges.length;

  const displayLimit = limit === "all" ? totalBadges : Math.max(1, parseInt(limit, 10) || 20);
  const hasMore = totalBadges > displayLimit;
  const displayedBadges = hasMore ? badges.slice(0, displayLimit - 1) : badges.slice(0, displayLimit);
  const remainingCount = hasMore ? totalBadges - (displayLimit - 1) : 0;

  const totalCards = displayedBadges.length + (hasMore ? 1 : 0);
  const colCount = 5;
  const cardWidth = 142;
  const cardHeight = 118;
  const gap = 14;
  const paddingX = 24;
  const headerHeight = 90;
  const footerHeight = 44;

  const rowCount = totalCards > 0 ? Math.ceil(totalCards / colCount) : 0;
  const gridHeight = rowCount > 0 ? rowCount * cardHeight + (rowCount - 1) * gap : 90;
  const totalWidth = 820;
  const totalHeight = totalCards > 0 ? headerHeight + gridHeight + footerHeight + 20 : 230;

  let badgesDir = null;
  try {
    badgesDir = resolveKudosBadgesDir();
  } catch (err) {
    // ignore
  }

  const truncate = (str, len = 16) => {
    const s = String(str || "");
    return s.length > len ? s.slice(0, len - 1) + "…" : s;
  };

  const cardsSvg = [];

  displayedBadges.forEach((b, idx) => {
    const col = idx % colCount;
    const row = Math.floor(idx / colCount);
    const x = paddingX + col * (cardWidth + gap);
    const y = headerHeight + row * (cardHeight + gap);

    let imgHref = resolveBadgeImage(baseUrl, b.picture);
    if (badgesDir && b.picture) {
      const filename = path.basename(b.picture);
      const previewPath = path.join(badgesDir, "previews/200", filename);
      const mainPath = path.join(badgesDir, filename);
      const targetPath = fs.existsSync(previewPath) ? previewPath : fs.existsSync(mainPath) ? mainPath : null;
      if (targetPath) {
        try {
          const b64 = fs.readFileSync(targetPath).toString("base64");
          imgHref = `data:image/png;base64,${b64}`;
        } catch {
          // fallback to URL
        }
      }
    }

    const badgeTitle = escapeHtml(truncate(b.title || b.slug, 16));
    const fullTitle = escapeHtml(b.title || b.slug);
    const achievementUrl = escapeHtml(buildBadgeAchievementPermalink(baseUrl, b.slug, username));

    cardsSvg.push(`
      <g class="badge-card" transform="translate(${x}, ${y})">
        <a href="${achievementUrl}" target="_blank" rel="noopener">
          <rect width="${cardWidth}" height="${cardHeight}" rx="12" fill="#20172f" stroke="#4a3b66" stroke-width="1.2" class="card-bg"/>
          <image href="${escapeHtml(imgHref)}" x="16" y="8" width="110" height="78" preserveAspectRatio="xMidYMid meet"/>
          <text x="${cardWidth / 2}" y="103" text-anchor="middle" fill="#f7f2ff" font-family="'Pixel Operator', 'Source Sans Pro', monospace, sans-serif" font-size="11" font-weight="600">${badgeTitle}</text>
          <title>${fullTitle}</title>
        </a>
      </g>
    `);
  });

  if (hasMore) {
    const idx = displayedBadges.length;
    const col = idx % colCount;
    const row = Math.floor(idx / colCount);
    const x = paddingX + col * (cardWidth + gap);
    const y = headerHeight + row * (cardHeight + gap);
    const boardUrl = escapeHtml(buildUserBadgeBoardPermalink(baseUrl, username));

    cardsSvg.push(`
      <g class="badge-card more-card" transform="translate(${x}, ${y})">
        <a href="${boardUrl}" target="_blank" rel="noopener">
          <rect width="${cardWidth}" height="${cardHeight}" rx="12" fill="#2a1f3d" stroke="#30ba78" stroke-width="1.2" stroke-dasharray="3 3" class="card-bg"/>
          <text x="${cardWidth / 2}" y="52" text-anchor="middle" fill="#30ba78" font-family="'Pixel Operator', 'Source Sans Pro', monospace, sans-serif" font-size="22" font-weight="bold">+${remainingCount}</text>
          <text x="${cardWidth / 2}" y="74" text-anchor="middle" fill="#dacdee" font-family="'Pixel Operator', 'Source Sans Pro', monospace, sans-serif" font-size="11">more badges</text>
          <text x="${cardWidth / 2}" y="98" text-anchor="middle" fill="#8f5ad6" font-family="'Pixel Operator', 'Source Sans Pro', monospace, sans-serif" font-size="10" font-weight="bold">VIEW ALL →</text>
          <title>View all ${totalBadges} badges on kudos.opensuse.org</title>
        </a>
      </g>
    `);
  }

  const emptyStateSvg = totalBadges === 0 ? `
    <g transform="translate(${paddingX}, ${headerHeight + 20})">
      <rect width="${totalWidth - paddingX * 2}" height="64" rx="10" fill="#20172f" stroke="#4a3b66" stroke-dasharray="4 4"/>
      <text x="${(totalWidth - paddingX * 2) / 2}" y="38" text-anchor="middle" fill="#bda8de" font-family="'Pixel Operator', 'Source Sans Pro', monospace, sans-serif" font-size="14">
        🌱 No badges earned yet on openSUSE Kudos.
      </text>
    </g>
  ` : "";

  const footerY = totalCards > 0 ? headerHeight + gridHeight + 24 : 190;
  const boardUrl = escapeHtml(buildUserBadgeBoardPermalink(baseUrl, username));

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${totalWidth} ${totalHeight}" width="${totalWidth}" height="${totalHeight}">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#181324"/>
      <stop offset="100%" stop-color="#100c19"/>
    </linearGradient>
    <radialGradient id="greenGlow" cx="90%" cy="10%" r="50%">
      <stop offset="0%" stop-color="#30ba78" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#30ba78" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="purpleGlow" cx="10%" cy="90%" r="40%">
      <stop offset="0%" stop-color="#8f5ad6" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#8f5ad6" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- Background -->
  <rect width="${totalWidth}" height="${totalHeight}" rx="16" fill="url(#bgGrad)" stroke="#4a3b66" stroke-width="1.5"/>
  <rect width="${totalWidth}" height="${totalHeight}" rx="16" fill="url(#greenGlow)"/>
  <rect width="${totalWidth}" height="${totalHeight}" rx="16" fill="url(#purpleGlow)"/>

  <!-- Header -->
  <g transform="translate(${paddingX}, 20)">
    <!-- openSUSE Geeko mark -->
    <path d="m30 33c0-0.7-0.6-1.3-1.3-1.3-3.7 0-6.7 3-6.7 6.7 0 3 2.4 5.3 5.3 5.3 2.2 0 4-1.8 4-4 0-1.5-1.2-2.7-2.7-2.7-0.7 0-1.3 0.6-1.3 1.3m9.3-14.7c2.2 0 4-1.8 4-4s-1.8-4-4-4c-2.2 0-4 1.8-4 4s1.8 4 4 4h9.3v-4c0-4.7-3.3-9.3-9.3-9.3h-9.3v5.3c-10.3 0-18.7 8.4-18.7 18.7 0 8.8 7.2 16 16 16 6.6 0 12-5.4 12-12 0-0.7-0.6-1.3-1.3-1.3m-8-17.3c0 4.7 3.3 9.3 9.3 9.3h5.3c0.7 0 1.3-0.6 1.3-1.3" fill="none" stroke="#30ba78" stroke-width="2.6" transform="scale(0.85) translate(0, 0)"/>

    <!-- Title and User -->
    <text x="46" y="24" fill="#f7f2ff" font-family="'Pixel Operator', 'Source Sans Pro', monospace, sans-serif" font-size="18" font-weight="bold">${safeDisplayName}'s Badge Board</text>
    <text x="46" y="44" fill="#bda8de" font-family="'Pixel Operator', 'Source Sans Pro', monospace, sans-serif" font-size="12">@${safeUsername} · openSUSE Kudos Contributor</text>

    <!-- Badges count pill -->
    <g transform="translate(${totalWidth - paddingX * 2 - 130}, 8)">
      <rect width="130" height="32" rx="16" fill="#20172f" stroke="#30ba78" stroke-width="1.2"/>
      <text x="65" y="20" text-anchor="middle" fill="#30ba78" font-family="'Pixel Operator', 'Source Sans Pro', monospace, sans-serif" font-size="13" font-weight="bold">🏅 ${totalBadges} ${totalBadges === 1 ? "Badge" : "Badges"}</text>
    </g>
  </g>

  <!-- Separator -->
  <line x1="${paddingX}" y1="78" x2="${totalWidth - paddingX}" y2="78" stroke="#4a3b66" stroke-width="1" stroke-dasharray="3 3"/>

  <!-- Badges Grid -->
  ${cardsSvg.join("\n")}
  ${emptyStateSvg}

  <!-- Footer -->
  <g transform="translate(${paddingX}, ${footerY})">
    <line x1="0" y1="0" x2="${totalWidth - paddingX * 2}" y2="0" stroke="#3d3056" stroke-width="1" stroke-dasharray="4 4"/>
    <a href="${boardUrl}" target="_blank" rel="noopener">
      <text x="${(totalWidth - paddingX * 2) / 2}" y="20" text-anchor="middle" fill="#bda8de" font-family="'Pixel Operator', 'Source Sans Pro', monospace, sans-serif" font-size="11">
        openSUSE Kudos · <tspan fill="#30ba78">kudos.opensuse.org</tspan> · Contributor Recognition
      </text>
    </a>
  </g>
</svg>`;
}

function renderBadgeBoardShareHtml({
  baseUrl,
  username,
  displayName,
  badgeCount,
  permalink,
  shareUrl,
  svgUrl,
}) {
  const title = `${displayName}'s Badge Board · openSUSE Kudos`;
  const description = `Check out all ${badgeCount} badges earned by ${displayName} (@${username}) on openSUSE Kudos!`;
  const encodedShareUrl = encodeURIComponent(shareUrl);
  const encodedShareText = encodeURIComponent(description);

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${escapeHtml(title)}</title>
        <meta name="description" content="${escapeHtml(description)}">
        <meta property="og:title" content="${escapeHtml(title)}">
        <meta property="og:description" content="${escapeHtml(description)}">
        <meta property="og:image" content="${escapeHtml(svgUrl)}">
        <meta property="og:image:type" content="image/svg+xml">
        <meta property="og:type" content="profile">
        <meta property="og:url" content="${escapeHtml(shareUrl)}">
        <meta name="twitter:card" content="summary_large_image">
        <meta name="twitter:title" content="${escapeHtml(title)}">
        <meta name="twitter:description" content="${escapeHtml(description)}">
        <meta name="twitter:image" content="${escapeHtml(svgUrl)}">
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
            width: min(860px, 100%);
            border: 1px solid var(--plum-border);
            border-radius: 20px;
            background: var(--plum-panel);
            box-shadow: 0 16px 48px rgba(0, 0, 0, 0.38);
            padding: 22px;
          }
          .board-preview {
            width: 100%;
            border-radius: 14px;
            overflow: hidden;
            border: 1px solid var(--plum-border);
            box-shadow: 0 4px 18px rgba(0, 0, 0, 0.25);
            background: #181324;
          }
          .board-preview img {
            width: 100%;
            height: auto;
            display: block;
          }
          h1 {
            margin: 1rem 0 0.25rem;
            font-size: clamp(1.6rem, 2.8vw, 2.2rem);
          }
          p {
            margin: 0.4rem 0 1rem;
            color: var(--text-soft);
          }
          .actions {
            margin-top: 18px;
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
          }
          .btn {
            border: 1px solid var(--plum-border);
            color: var(--text-main);
            background: var(--plum-btn);
            border-radius: 999px;
            padding: 9px 16px;
            text-decoration: none;
            cursor: pointer;
            font: inherit;
            transition: all 0.18s ease;
            font-size: 0.95rem;
          }
          .btn.primary {
            background: linear-gradient(135deg, var(--plum-primary), var(--geeko-green));
            color: #160f24;
            border-color: transparent;
            font-weight: bold;
          }
          .btn:hover {
            border-color: var(--geeko-green);
            box-shadow: 0 0 0 2px var(--geeko-green-soft);
            transform: translateY(-1px);
          }
          .links {
            margin-top: 14px;
            color: var(--text-muted);
            word-break: break-all;
            border-top: 1px dashed var(--geeko-green-soft);
            padding-top: 12px;
            font-size: 0.85rem;
          }
          .app-links {
            margin-top: 12px;
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
          }
        </style>
      </head>
      <body>
        <main>
          <div class="board-preview">
            <img src="${escapeHtml(svgUrl)}" alt="${escapeHtml(title)}" />
          </div>
          <h1>${escapeHtml(title)}</h1>
          <p>${escapeHtml(description)}</p>
          <div class="actions">
            <button class="btn primary" type="button" data-copy="${escapeHtml(shareUrl)}">Copy share link</button>
            <a class="btn" href="${escapeHtml(permalink)}">Open interactive board in Kudos</a>
            <a class="btn" href="https://www.linkedin.com/sharing/share-offsite/?url=${encodedShareUrl}" target="_blank" rel="noopener">Share on LinkedIn</a>
            <a class="btn" href="https://fosstodon.org/share?text=${encodedShareText}%20${encodedShareUrl}" target="_blank" rel="noopener">Share on Fosstodon</a>
            <a class="btn" href="https://x.com/intent/post?text=${encodedShareText}&url=${encodedShareUrl}" target="_blank" rel="noopener">Share on X</a>
          </div>
          <div class="app-links">
            <a class="btn" href="${escapeHtml(baseUrl)}">App home</a>
            <a class="btn" href="${escapeHtml(`${baseUrl}/user/${username}`)}">@${escapeHtml(username)}'s profile</a>
            <a class="btn" href="${escapeHtml(`${baseUrl}/badges`)}">All openSUSE badges</a>
          </div>
          <div class="links">${escapeHtml(shareUrl)}</div>
        </main>
        <script>
          const button = document.querySelector('[data-copy]');
          if (button) {
            button.addEventListener('click', async () => {
              try {
                await navigator.clipboard.writeText(button.dataset.copy || '');
                button.textContent = 'Copied! ✓';
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

      // Retired badges stay on the profiles of people who earned them, but
      // are no longer offered in the badge list.
      const badges = await prisma.badge.findMany({
        where: { retired: false },
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
      const user = await findUserByNameInsensitive(prisma, req.params.username, {
        id: true,
        username: true,
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
  // GET /api/badges/user/:username/board — Badge board data (API)
  // ---------------------------------------------------------------
  router.get("/user/:username/board", async (req, res) => {
    try {
      const user = await findUserByNameInsensitive(prisma, req.params.username, {
        id: true,
        username: true,
        fullName: true,
        avatarUrl: true,
        role: true,
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
              link: true,
            },
          },
        },
        orderBy: { grantedAt: "desc" },
      });

      const baseUrl = getBaseUrl();
      const displayName = user.fullName || user.username;
      const permalink = buildUserBadgeBoardPermalink(baseUrl, user.username);
      const shareUrl = buildUserBadgeBoardShareUrl(baseUrl, user.username);
      const svgUrl = buildUserBadgeBoardSvgUrl(baseUrl, user.username);

      res.json({
        user: sanitizeUser(user),
        badgeCount: userBadges.length,
        badges: userBadges.map((ub) => ({
          ...ub.badge,
          grantedAt: ub.grantedAt,
          permalink: buildBadgeAchievementPermalink(baseUrl, ub.badge.slug, user.username),
          shareUrl: buildBadgeAchievementShareUrl(baseUrl, ub.badge.slug, user.username),
        })),
        permalink,
        shareUrl,
        svgUrl,
        embedMarkdown: `[![${displayName}'s openSUSE Kudos Badge Board](${svgUrl})](${permalink})`,
        embedHtml: `<a href="${permalink}"><img src="${svgUrl}" alt="${displayName}'s openSUSE Kudos Badge Board" /></a>`,
      });
    } catch (err) {
      console.error("💥 Failed to fetch user badge board:", err);
      res.status(500).json({ error: "Failed to fetch user badge board" });
    }
  });

  // ---------------------------------------------------------------
  // GET /api/badges/user/:username/board.svg — Dynamic SVG Badge Board
  // ---------------------------------------------------------------
  async function sendBadgeBoardSvg(req, res) {
    const { username } = req.params;
    try {
      const user = await findUserByNameInsensitive(prisma, username, {
        id: true,
        username: true,
        fullName: true,
        avatarUrl: true,
      });

      if (!user) {
        res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
        return res.status(404).send(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="80"><rect width="400" height="80" rx="8" fill="#20172f"/><text x="200" y="45" fill="#f7f2ff" text-anchor="middle" font-family="sans-serif">User not found</text></svg>`);
      }

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
      const svg = renderBadgeBoardSvg({
        username: user.username,
        displayName: user.fullName || user.username,
        badges: userBadges.map((ub) => ({ ...ub.badge, grantedAt: ub.grantedAt })),
        baseUrl,
        limit: req.query.limit || 20,
      });

      res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=1800, s-maxage=3600, stale-while-revalidate=86400");
      res.send(svg);
    } catch (err) {
      console.error("💥 Failed to render badge board SVG:", err);
      res.status(500).setHeader("Content-Type", "image/svg+xml; charset=utf-8").send(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="80"><rect width="400" height="80" rx="8" fill="#20172f"/><text x="200" y="45" fill="#ff5b45" text-anchor="middle" font-family="sans-serif">Error generating badge board</text></svg>`);
    }
  }

  router.get("/user/:username/board.svg", sendBadgeBoardSvg);
  app.get("/api/badges/user/:username/board.svg", sendBadgeBoardSvg);

  // ---------------------------------------------------------------
  // Social share preview for user's badge board
  // ---------------------------------------------------------------
  async function sendBadgeBoardSharePage(req, res) {
    const { username } = req.params;
    try {
      const user = await findUserByNameInsensitive(prisma, username, {
        id: true,
        username: true,
        fullName: true,
      });

      if (!user) {
        return res.status(404).send("User not found");
      }

      const badgeCount = await prisma.userBadge.count({
        where: { userId: user.id },
      });

      const baseUrl = getBaseUrl();
      const displayName = user.fullName || user.username;
      const permalink = buildUserBadgeBoardPermalink(baseUrl, user.username);
      const shareUrl = buildUserBadgeBoardShareUrl(baseUrl, user.username);
      const svgUrl = buildUserBadgeBoardSvgUrl(baseUrl, user.username);

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=300, s-maxage=600, stale-while-revalidate=86400");
      res.send(renderBadgeBoardShareHtml({
        baseUrl,
        username: user.username,
        displayName,
        badgeCount,
        permalink,
        shareUrl,
        svgUrl,
      }));
    } catch (err) {
      console.error("💥 Failed to render badge board share page:", err);
      res.status(500).send("Error generating badge board preview");
    }
  }

  router.get("/user/:username/board/share", sendBadgeBoardSharePage);
  app.get("/user/:username/board/share", sendBadgeBoardSharePage);

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

      const { alreadyGranted, granted } = await grantBadge(prisma, { user, badge });
      if (alreadyGranted)
        return res.status(200).json({ message: "Badge already granted" });

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
