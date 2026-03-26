// backend/src/routes/kudos.js
// SPDX-License-Identifier: Apache-2.0

import express from "express";
import { eventBus } from "./now.js";
import { customAlphabet } from "nanoid";
import { LRUCache } from "lru-cache";
import satori from "satori";
import QRCode from "qrcode";
import fetch from "node-fetch";
import { svgToPng } from "../utils/image.js";
import { sanitizeUser, getAvatarUrl } from "../utils/user.js";
import fs from "fs";
import path from "path";

const previewCache = new LRUCache({
  max: 200,
  ttl: 1000 * 60 * 60 * 24, // 24 hours
});

const nanoid = customAlphabet(
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
  8
);

const CARD_WIDTH = 800;
const CARD_HEIGHT = 630;
const PREVIEW_FONT_STACK = "'Source Sans Pro', 'Noto Color Emoji', sans-serif";
const PREVIEW_CACHE_CONTROL = "public, max-age=86400, stale-while-revalidate=604800";
const SHARE_PAGE_CACHE_CONTROL = "public, max-age=1800, stale-while-revalidate=86400";
const PREVIEW_RENDER_VERSION = "v3";

const SHARE_PAGE_PALETTE = {
  bg: "#2c254a",
  panel: "rgba(55, 45, 90, 0.92)",
  panelAlt: "rgba(70, 57, 109, 0.76)",
  textPrimary: "#e8e8f0",
  textSecondary: "#c3bdd8",
  textMuted: "#a89fbd",
  accent: "#a498ff",
  accentSoft: "rgba(164, 152, 255, 0.18)",
  border: "rgba(164, 152, 255, 0.2)",
  shadow: "rgba(0, 0, 0, 0.38)",
  buttonText: "#161126",
};

// Hardcoded per-theme card image palettes — must stay in sync with ThemeToggle.vue
// (satori renders inline styles; CSS variables are not available inside generated images)
const CARD_IMAGE_PALETTES = {
  opensuse: {
    outerBg: "#0c322c",
    outerTint: "#7dc1ae",
    outerTintOpacity: 0.08,
    cardBg: "rgba(11, 46, 40, 0.56)",
    cardBorder: "#7dc1ae",
    divider: "rgba(125, 193, 174, 0.30)",
    headingColor: "#7dc1ae",
    subheadColor: "#bfe8e1",
    messageBoxBg: "rgba(125, 193, 174, 0.05)",
    messageBoxBorder: "rgba(125, 193, 174, 0.25)",
    messageColor: "#ccedea",
    metaColor: "#a5c7c3",
    footerColor: "#a5c7c3",
    footerDivider: "rgba(125, 193, 174, 0.20)",
    avatarBorder: "#7dc1ae",
    avatarDivider: "rgba(125, 193, 174, 0.65)",
    categoryColor: "#bfe8e1",
    qrBorder: "rgba(125, 193, 174, 0.30)",
    qrDark: "#0f4030",
    qrLight: "#eefaf4",
  },
  dark: {
    outerBg: "#2c254a",
    outerTint: "#a498ff",
    //outerTintOpacity: 0.07,
    outerTintOpacity: 0.2,
    cardBg: "rgba(55, 45, 90, 0.55)",
    cardBorder: "#a498ff",
    divider: "rgba(164, 152, 255, 0.25)",
    headingColor: "#a498ff",
    subheadColor: "#c3bdd8",
    messageBoxBg: "rgba(164, 152, 255, 0.05)",
    messageBoxBorder: "rgba(164, 152, 255, 0.22)",
    messageColor: "#e8e8f0",
    metaColor: "#c3bdd8",
    footerColor: "#a89fbd",
    footerDivider: "rgba(164, 152, 255, 0.18)",
    avatarBorder: "#a498ff",
    avatarDivider: "rgba(164, 152, 255, 0.65)",
    categoryColor: "#c3bdd8",
    qrBorder: "rgba(164, 152, 255, 0.25)",
    qrDark: "#32285c",
    qrLight: "#f4f1ff",
  },
  light: {
    outerBg: "#ecfff8",
    outerTint: "#4d7d86",
    outerTintOpacity: 0.045,
    cardBg: "rgba(255, 255, 255, 0.58)",
    cardBorder: "#4d7d86",
    divider: "rgba(12, 50, 44, 0.12)",
    headingColor: "#4d7d86",
    subheadColor: "#123f38",
    messageBoxBg: "rgba(240, 249, 245, 0.78)",
    messageBoxBorder: "rgba(12, 50, 44, 0.12)",
    messageColor: "#0c322c",
    metaColor: "#123f38",
    footerColor: "#0f4030",
    footerDivider: "rgba(12, 50, 44, 0.12)",
    avatarBorder: "#4d7d86",
    avatarDivider: "rgba(77, 125, 134, 0.65)",
    categoryColor: "#123f38",
    qrBorder: "rgba(12, 50, 44, 0.15)",
    qrDark: "#1c5a53",
    qrLight: "#f3fbf8",
  },
};

function getCardImagePalette(theme) {
  return CARD_IMAGE_PALETTES[theme] || CARD_IMAGE_PALETTES.dark;
}

function loadSatoriFonts() {
  const pixelRegularPath = path.resolve("frontend/public/fonts/PixelOperator.ttf");
  const pixelBoldPath = path.resolve("frontend/public/fonts/PixelOperator-Bold.ttf");
  const fontRegularPath = path.resolve("frontend/public/fonts/SourceSansPro-Regular.ttf");
  const fontBoldPath = path.resolve("frontend/public/fonts/SourceSansPro-Bold.ttf");
  // Cover most of emojis
  const notoColorEmojiPath = path.resolve("frontend/public/fonts/NotoColorEmoji-Regular.ttf");

  const fonts = [];
  if (fs.existsSync(pixelRegularPath)) {
    fonts.push({
      name: "Pixel Operator",
      data: fs.readFileSync(pixelRegularPath),
      weight: 400,
      style: "normal",
    });
  }
  if (fs.existsSync(pixelBoldPath)) {
    fonts.push({
      name: "Pixel Operator",
      data: fs.readFileSync(pixelBoldPath),
      weight: 700,
      style: "bold",
    });
  }
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
  if (fs.existsSync(notoColorEmojiPath)) {  
    fonts.push({
      name: "Noto Color Emoji",
      data: fs.readFileSync(notoColorEmojiPath),
      weight: 400,
      style: "normal",
    });
  }    
  return fonts;
}

function svgFileToDataUri(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const svg = fs.readFileSync(filePath, "utf8");
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function svgFileToTintedDataUri(filePath, color) {
  if (!fs.existsSync(filePath)) return null;
  const svg = fs.readFileSync(filePath, "utf8");
  const sanitized = svg
    .replace(/\sfill="[^"]*"/g, "")
    .replace(/<path\b/g, `<path fill="${color}"`)
    .replace(/<g\b/g, `<g fill="${color}"`);
  return `data:image/svg+xml;utf8,${encodeURIComponent(sanitized)}`;
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
  // Strip emoji icons—Satori doesn't support emoji rendering.
  // Category labels are clear enough without icons.
  return null;
}

function stripEmojis(text) {
  if (!text) return text;
  // Remove emoji characters (surrogate pairs and emoji ranges)
  return String(text)
    .replace(/([\u2700-\u27BF]|[\uD83C-\uDBFF][\uDC00-\uDFFF]|[\u2011-\u206F]|[\u2E00-\u2E7E]|[\u3000-\u303F])/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeKnownEmojis(text) {
  if (!text) return text;

  const replacements = [
    [/🧑‍💻/g, " developer "],
    [/🦸/g, " superhero "],
    [/🛡️/g, " shield "],
    [/⚙️/g, " gear "],
    [/🌈/g, " rainbow "],
    [/💪/g, " strength "],
    [/💬/g, " message "],
    [/💚/g, " green heart "],
    [/�/g, " books "],
    [/�🙌/g, " celebration "],
    [/🎨/g, " art "],
    [/💻/g, " laptop "],
  ];

  let normalized = String(text);
  for (const [pattern, replacement] of replacements) {
    normalized = normalized.replace(pattern, replacement);
  }
  return normalized;
}

const KNOWN_EMOJI_TO_SVG_URL = {
  "🌈": "/twemoji/1f308.svg",
  "💪": "/twemoji/1f4aa.svg",
  "⚙️": "/twemoji/2699.svg",
  "🧑‍💻": "/twemoji/1f9d1-200d-1f4bb.svg",
  "💬": "/twemoji/1f4ac.svg",
  "🦸": "/twemoji/1f9b8.svg",
  "💚": "/twemoji/1f49a.svg",
  "�": "/twemoji/1f4da.svg",
  "🙌": "/twemoji/1f64c.svg",
  "🎨": "/twemoji/1f3a8.svg",
  "💻": "/twemoji/1f4bb.svg",
  "🛡️": "/twemoji/1f6e1.svg",
};

const KNOWN_EMOJI_REGEX = /(🧑‍💻|📚|🦸|🌈|💪|⚙️|💬|💚|🙌|🎨|💻|🛡️)/g;

function buildRichMessageNodes(message, color) {
  const cleanMessage = String(message || "").replace(/\s+/g, " ").trim();
  const pieces = cleanMessage.split(KNOWN_EMOJI_REGEX).filter(Boolean);
  const children = [];

  for (const piece of pieces) {
    const svgUrl = KNOWN_EMOJI_TO_SVG_URL[piece];
    if (svgUrl) {
      const resolvedSvg = resolvePublicImageSource(svgUrl) || svgUrl;
      children.push({
        type: "img",
        props: {
          src: resolvedSvg,
          width: 42,
          height: 42,
          style: {
            objectFit: "contain",
          },
        },
      });
      continue;
    }

    children.push({
      type: "span",
      props: {
        style: { color },
        children: piece,
      },
    });
  }

  if (children.length === 0) {
    return [
      {
        type: "span",
        props: {
          style: { color },
          children: "\u201c\u201d",
        },
      },
    ];
  }

  const firstTextIndex = children.findIndex(node => node?.type === "span");
  const lastTextIndex = [...children].reverse().findIndex(node => node?.type === "span");

  if (firstTextIndex !== -1) {
    children[firstTextIndex].props.children =
      "\u201c" + children[firstTextIndex].props.children;
  }

  if (lastTextIndex !== -1) {
    const actualLastIndex = children.length - 1 - lastTextIndex;
    children[actualLastIndex].props.children =
      children[actualLastIndex].props.children + "\u201d";
  }

  return children;
}

function truncateText(text, maxLength = 180, options = {}) {
  const { normalizeEmoji = true } = options;
  if (!text) return "Keep up the great work.";
  const emojiSafeText = normalizeEmoji ? normalizeKnownEmojis(text) : String(text);
  //const noEmoji = stripEmojis(text);
  //const normalized = String(noEmoji).replace(/\s+/g, " ").trim();
  const normalized = emojiSafeText.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}\u2026`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getBaseUrl() {
  return process.env.BASE_URL || process.env.VITE_DEV_SERVER || "http://localhost:3000";
}

function buildKudoUrls(slug) {
  const base = getBaseUrl();
  return {
    base,
    permalink: `${base}/kudo/${slug}`,
    sharePage: `${base}/kudo/${slug}/share`,
    apiSharePage: `${base}/api/kudos/${slug}/share`,
    image: `${base}/api/kudos/${slug}/image`,
    qr: `${base}/api/kudos/${slug}/qr`,
  };
}

function renderKudoShareHtml(kudo) {
  const from = kudo.fromUser.username;
  const to = kudo.recipients[0]?.user.username || "someone";
  const category = kudo.category?.label || "General";
  const urls = buildKudoUrls(kudo.slug);
  const palette = SHARE_PAGE_PALETTE;
  const shareTitle = `${from} sent kudos to ${to}`;
  const description = `${from} sent Geeko Kudos to ${to} — ${truncateText(kudo.message || "Keep up the great work!", 180)}`;
  const encodedShareUrl = encodeURIComponent(urls.sharePage);
  const mastodonText = encodeURIComponent(`${shareTitle} on openSUSE Kudos`);

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${escapeHtml(shareTitle)} · openSUSE Kudos Recognition platform</title>
        <meta name="description" content="${escapeHtml(description)}">
        <meta property="og:title" content="${escapeHtml(shareTitle)}">
        <meta property="og:description" content="${escapeHtml(description)}">
        <meta property="og:image" content="${escapeHtml(urls.image)}">
        <meta property="og:image:width" content="${CARD_WIDTH}">
        <meta property="og:image:height" content="${CARD_HEIGHT}">
        <meta property="og:image:type" content="image/png">
        <meta property="og:type" content="article">
        <meta property="og:url" content="${escapeHtml(urls.sharePage)}">
        <meta name="twitter:card" content="summary_large_image">
        <meta name="twitter:title" content="${escapeHtml(shareTitle)}">
        <meta name="twitter:description" content="${escapeHtml(description)}">
        <meta name="twitter:image" content="${escapeHtml(urls.image)}">
        <link rel="canonical" href="${escapeHtml(urls.sharePage)}">
        <style>
          @font-face {
            font-family: "Pixel Operator";
            src: url("/fonts/PixelOperator.ttf") format("truetype");
            font-display: swap;
          }

          @font-face {
            font-family: "Source Sans Pro";
            src: url("/fonts/SourceSansPro-Regular.ttf") format("truetype");
            font-display: swap;
          }

          @font-face {
            font-family: "Noto Color Emoji";
            src: url("/fonts/NotoColorEmoji.ttf") format("truetype");
            font-display: swap;
          }
          :root {
            color-scheme: light;
            --share-bg: ${palette.bg};
            --share-panel: ${palette.panel};
            --share-panel-alt: ${palette.panelAlt};
            --share-text: ${palette.textPrimary};
            --share-text-soft: ${palette.textSecondary};
            --share-text-muted: ${palette.textMuted};
            --share-accent: ${palette.accent};
            --share-accent-soft: ${palette.accentSoft};
            --share-line: ${palette.border};
            --share-shadow: ${palette.shadow};
            --share-button-text: ${palette.buttonText};
          }

          * { box-sizing: border-box; }

          body {
            margin: 0;
            min-height: 100vh;
            font-family: "Pixel Operator", "Source Sans Pro", "Noto Color Emoji", sans-serif;
            color: var(--share-text);
            background:
              radial-gradient(circle at top, var(--share-accent-soft), transparent 36%),
              linear-gradient(180deg, color-mix(in srgb, var(--share-bg) 94%, white 6%) 0%, color-mix(in srgb, var(--share-bg) 84%, black 16%) 100%);
            display: flex;
            justify-content: center;
            padding: 28px 16px 40px;
          }

          main {
            width: min(1280px, 100%);
            background: var(--share-panel);
            border: 1px solid var(--share-line);
            border-radius: 24px;
            box-shadow: 0 24px 60px var(--share-shadow);
            padding: 24px;
            backdrop-filter: blur(8px);
          }

          .eyebrow {
            margin: 0;
            color: var(--share-text-soft);
            font-size: 1.1rem;
            letter-spacing: 0.06em;
            text-transform: uppercase;
          }

          h1 {
            margin: 0.35rem 0 0;
            font-size: clamp(2rem, 4vw, 3.5rem);
            line-height: 0.95;
          }

          .summary {
            margin: 0.9rem 0 0;
            font-family: "Source Sans Pro", sans-serif;
            font-size: 1.1rem;
            line-height: 1.5;
            color: var(--share-text-soft);
          }

          .card {
            margin-top: 20px;
            display: grid;
            gap: 18px;
          }

          .preview-scroll {
            display: flex;
            justify-content: center;
            overflow-x: auto;
            padding-bottom: 8px;
            scrollbar-width: thin;
            scrollbar-color: var(--share-accent) transparent;
          }

          .image-frame {
            display: inline-block;
            max-width: none;
            border-radius: 20px;
            overflow: hidden;
            border: 1px solid var(--share-line);
            background: #fff;
            box-shadow: 0 18px 40px var(--share-shadow);
          }

          .image-frame img {
            display: block;
            width: auto;
            height: auto;
          }

          .meta {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            align-items: center;
            justify-content: space-between;
            font-size: 1rem;
          }

          .message {
            margin: 0;
            font-family: "Source Sans Pro", sans-serif;
            font-size: 1.05rem;
            color: var(--share-text-soft);
          }

          .actions {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
          }

          .btn {
            appearance: none;
            border: 1px solid var(--share-line);
            background: var(--share-panel-alt);
            color: var(--share-text);
            padding: 10px 16px;
            border-radius: 999px;
            text-decoration: none;
            cursor: pointer;
            font: inherit;
          }

          .btn.primary {
            background: var(--share-accent);
            border-color: transparent;
            color: var(--share-button-text);
          }

          .btn:hover {
            transform: translateY(-1px);
          }

          .links {
            margin-top: 4px;
            font-family: "Source Sans Pro", sans-serif;
            color: var(--share-text-muted);
            word-break: break-all;
          }

          .hint {
            margin: 0;
            font-family: "Source Sans Pro", sans-serif;
            color: var(--share-text-muted);
          }

          @media (max-width: 720px) {
            body { padding: 16px 12px 28px; }
            main { padding: 18px; border-radius: 18px; }
            .meta { align-items: flex-start; }
          }
        </style>
      </head>
      <body>
        <main>
          <p class="eyebrow">openSUSE Kudos Share</p>
          <h1>${escapeHtml(`@${from} → @${to}`)}</h1>
          <p class="summary">${escapeHtml(category)} · ${escapeHtml(new Date(kudo.createdAt).toLocaleDateString("en", { dateStyle: "medium" }))}</p>
          <div class="card">
            <p class="hint">Preview shown at native width. Scroll horizontally on smaller screens.</p>
            <div class="preview-scroll">
              <a class="image-frame" href="${escapeHtml(urls.image)}" target="_blank" rel="noopener">
                <img src="${escapeHtml(urls.image)}" alt="${escapeHtml(shareTitle)}">
              </a>
            </div>
            <div class="meta">
              <p class="message">${escapeHtml(truncateText(kudo.message || "Keep up the great work!", 260))}</p>
              <div class="actions">
                <button class="btn primary" type="button" data-copy="${escapeHtml(urls.sharePage)}">Copy share link</button>
                <a class="btn" href="${escapeHtml(urls.permalink)}">Open recognition</a>
                <a class="btn" href="${escapeHtml(urls.image)}" target="_blank" rel="noopener">Download image</a>
                <a class="btn" href="https://www.linkedin.com/sharing/share-offsite/?url=${encodedShareUrl}" target="_blank" rel="noopener">Share on LinkedIn</a>
                <a class="btn" href="https://mastodon.social/share?text=${mastodonText}%20${encodedShareUrl}" target="_blank" rel="noopener">Share on Mastodon</a>
                <a class="btn" href="https://x.com/intent/post?url=${encodedShareUrl}&text=${mastodonText}" target="_blank" rel="noopener">Share on X</a>
              </div>
            </div>
            <div class="links">${escapeHtml(urls.sharePage)}</div>
          </div>
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

async function resolveAvatarForCard(user) {
  const url = getAvatarUrl(user);
  if (url.startsWith("/")) return resolvePublicImageSource(url);
  if (url.startsWith("data:")) return url;

  // For remote avatar URLs, fetch and embed as data URI so satori renders reliably.
  if (url.startsWith("http://") || url.startsWith("https://")) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "openSUSE-Kudos-CardRenderer/1.0",
          Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        },
      });
      if (!res.ok) return null;

      const contentType = res.headers.get("content-type") || "";
      const bytes = Buffer.from(await res.arrayBuffer());

      if (contentType.includes("image/svg+xml")) {
        return `data:image/svg+xml;base64,${bytes.toString("base64")}`;
      }
      if (contentType.startsWith("image/")) {
        return `data:${contentType};base64,${bytes.toString("base64")}`;
      }

      // Fallback: some services omit headers, assume PNG.
      return `data:image/png;base64,${bytes.toString("base64")}`;
    } catch (err) {
      console.error("⚠️ Failed to fetch avatar for social card:", err?.message || err);
      return null;
    }
  }

  return null;
}

async function generateQrDataUrl(text, palette = CARD_IMAGE_PALETTES.dark) {
  try {
    return await QRCode.toDataURL(text, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 128,
      color: {
        dark: palette.qrDark,
        light: palette.qrLight,
      },
    });
  } catch (err) {
    console.error("⚠️ Failed to generate QR code:", err?.message || err);
    return null;
  }
}

function buildCategoryBadge(categoryIcon, categoryIconText, categoryLabel, color = "#1f5131") {
  return {
    type: "div",
    props: {
      style: { display: "flex", alignItems: "center" },
      children: [
        categoryIcon
          ? { type: "img", props: { src: categoryIcon, width: 36, height: 36, style: { objectFit: "contain" } } }
          : categoryIconText
            ? { type: "span", props: { style: { fontSize: "28px", lineHeight: 1 }, children: categoryIconText } }
            : null,
        {
          type: "span",
          props: {
            style: { fontSize: "22px", color, fontWeight: "700", marginLeft: categoryIcon || categoryIconText ? "10px" : 0 },
            children: categoryLabel,
          },
        },
      ].filter(Boolean),
    },
  };
}

async function renderKudoOGImage(kudo, theme = {}) {
  if (!kudo) {
    throw new Error("renderKudoOGImage: kudo is null");
  }

  const kudoUrls = buildKudoUrls(kudo.slug);
  const toUser = kudo?.recipients?.[0]?.user?.username || "someone";
  const fromUser = kudo?.fromUser?.username || "someone";
  const category = truncateText(kudo?.category?.label || "General", 36);
  const message = truncateText(kudo?.message || "Sent kudos", 140, { normalizeEmoji: false });

  const mascot =
    resolvePublicImageSource("/gotkudo.svg") ||
    resolvePublicImageSource("/gotkudo.png") ||
    null;

  const openSUSELogo =
    resolvePublicImageSource("/opensuse.svg") ||
    resolvePublicImageSource("/opensuse.png") ||
    null;

  const colors = {
    bgTop: theme.bgTop || "#312956",
    bgBottom: theme.bgBottom || "#21193d",
    cardTop: theme.cardTop || "#3b3163",
    cardBottom: theme.cardBottom || "#2c254a",
    panel: theme.panel || "rgba(255,255,255,0.05)",
    panelBorder: theme.panelBorder || "rgba(255,255,255,0.10)",
    border: theme.border || "rgba(164,152,255,0.35)",
    accent: theme.accent || "#42cd42",         // geeko green
    accentSoft: theme.accentSoft || "#a498ff", // plum purple
    accentBlue: theme.accentBlue || "#00c8ff", // butterfly blue
    accentRed: theme.accentRed || "#ff5b45",   // radish red
    text: theme.text || "#e8e8f0",
    secondary: theme.secondary || "#c3bdd8",
    muted: theme.muted || "#a89fbd",
  };

  const qrCode = await generateQrDataUrl(kudoUrls.permalink, {
    qrDark: theme.qrDark || "#32285c",
    qrLight: "#ffffff",
  });

  return await satori(
    {
      type: "div",
      props: {
        style: {
          width: `${CARD_WIDTH}px`,
          height: `${CARD_HEIGHT}px`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
          fontFamily: PREVIEW_FONT_STACK,
          color: colors.text,
          background: `linear-gradient(180deg, ${colors.bgTop}, ${colors.bgBottom})`,
        },
        children: [
          // simple glow layers - much safer than complex backgroundImage tricks
          {
            type: "div",
            props: {
              style: {
                position: "absolute",
                top: "-80px",
                left: "-60px",
                width: "320px",
                height: "320px",
                borderRadius: "999px",
                background: "rgba(164,152,255,0.12)",
              },
            },
          },
          {
            type: "div",
            props: {
              style: {
                position: "absolute",
                top: "-40px",
                right: "-40px",
                width: "220px",
                height: "220px",
                borderRadius: "999px",
                background: "rgba(0,200,255,0.06)",
              },
            },
          },
          {
            type: "div",
            props: {
              style: {
                position: "absolute",
                bottom: "-70px",
                right: "120px",
                width: "260px",
                height: "260px",
                borderRadius: "999px",
                background: "rgba(66,205,66,0.06)",
              },
            },
          },

          // main card
          {
            type: "div",
            props: {
              style: {
                position: "relative",
                width: "92%",
                height: "84%",
                display: "flex",
                overflow: "hidden",
                borderRadius: "28px",
                border: `1px solid ${colors.border}`,
                background: `linear-gradient(180deg, ${colors.cardTop}, ${colors.cardBottom})`,
              },
              children: [
                // subtle top sheen
                {
                  type: "div",
                  props: {
                    style: {
                      position: "absolute",
                      top: "0",
                      left: "0",
                      right: "0",
                      height: "90px",
                      background: "rgba(255,255,255,0.03)",
                    },
                  },
                },

                // half mascot
                mascot
                  ? {
                      type: "div",
                      props: {
                        style: {
                          position: "absolute",
                          left: "-20px",
                          top: "96px",
                          width: "220px",
                          height: "220px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          opacity: "0.95",
                        },
                        children: {
                          type: "img",
                          props: {
                            src: mascot,
                            width: 220,
                            height: 220,
                            style: {
                              objectFit: "contain",
                            },
                          },
                        },
                      },
                    }
                  : null,

                // content
                {
                  type: "div",
                  props: {
                    style: {
                      position: "relative",
                      zIndex: 2,
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      padding: "42px 48px 34px 48px",
                    },
                    children: [
                      // header
                      {
                        type: "div",
                        props: {
                          style: {
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-start",
                            gap: "8px",
                            paddingLeft: mascot ? "150px" : "0px",
                            minHeight: "116px",
                          },
                          children: [
                            {
                              type: "div",
                              props: {
                                style: {
                                  display: "flex",
                                  flexWrap: "wrap",
                                  alignItems: "center",
                                  gap: "10px",
                                  fontSize: "34px",
                                  fontWeight: "700",
                                  lineHeight: 1.1,
                                },
                                children: [
                                  {
                                    type: "span",
                                    props: {
                                      style: { color: colors.accentRed },
                                      children: `@${toUser}`,
                                    },
                                  },
                                  {
                                    type: "span",
                                    props: {
                                      style: { color: colors.text },
                                      children: "earned kudos",
                                    },
                                  },
                                ],
                              },
                            },
                            {
                              type: "div",
                              props: {
                                style: {
                                  display: "flex",
                                  flexWrap: "wrap",
                                  alignItems: "center",
                                  gap: "8px",
                                  fontSize: "24px",
                                  fontWeight: "600",
                                  lineHeight: 1.15,
                                },
                                children: [
                                  {
                                    type: "span",
                                    props: {
                                      style: { color: colors.secondary },
                                      children: "from",
                                    },
                                  },
                                  {
                                    type: "span",
                                    props: {
                                      style: { color: colors.accentSoft },
                                      children: `@${fromUser}`,
                                    },
                                  },
                                                                    {
                                    type: "span",
                                    props: {
                                      style: { color: colors.secondary },
                                      children: "and now you know it too!",
                                    },
                                  },
                                ],
                              },
                            },
                          ],
                        },
                      },

                      // message
                      {
                        type: "div",
                        props: {
                          style: {
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "center",
                            flexGrow: "1",
                            marginTop: "10px",
                            marginBottom: "18px",
                          },
                          children: {
                            type: "div",
                            props: {
                              style: {
                                width: "100%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                textAlign: "center",
                                padding: "34px 38px",
                                borderRadius: "18px",
                                background: colors.panel,
                                border: `1px solid ${colors.panelBorder}`,
                              },
                              children: {
                                type: "div",
                                props: {
                                  style: {
                                    display: "flex",
                                    flexWrap: "wrap",
                                    justifyContent: "center",
                                    alignItems: "baseline",
                                    gap: "0px",
                                    textAlign: "center",
                                    textShadow: "0 2px 0 rgba(0,0,0,0.4)",
                                    fontSize: "46px",
                                    lineHeight: 1.2,
                                    fontWeight: "600",
                                    color: colors.text,
                                  },
                                  children: buildRichMessageNodes(message, colors.text),
                                },
                              },
                            },
                          },
                        },
                      },

                      // footer
                      {
                        type: "div",
                        props: {
                          style: {
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: "20px",
                            paddingTop: "16px",
                            borderTop: "1px solid rgba(255,255,255,0.08)",
                          },
                          children: [
                            {
                              type: "div",
                              props: {
                                style: {
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "10px",
                                  fontSize: "18px",
                                  fontWeight: "600",
                                  color: colors.muted,
                                  flex: 1,
                                },
                                children: [
                                  {
                                    type: "span",
                                    props: {
                                      children: category,
                                    },
                                  },
                                ],
                              },
                            },
                            qrCode
                              ? {
                                  type: "div",
                                  props: {
                                    style: {
                                      display: "flex",
                                      flexDirection: "column",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      gap: "0px",
                                      flex: 1,
                                    },
                                    children: [
                                      {
                                        type: "div",
                                        props: {
                                          style: {
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            width: "70px",
                                            height: "70px",
                                            padding: "7px",
                                            borderRadius: "12px",
                                            background: "#ffffff",
                                            boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
                                          },
                                          children: {
                                            type: "img",
                                            props: {
                                              src: qrCode,
                                              width: 56,
                                              height: 56,
                                              style: {
                                                objectFit: "contain",
                                              },
                                            },
                                          },
                                        },
                                      },
                                    ],
                                  },
                                }
                              : {
                                  type: "div",
                                  props: {
                                    style: {
                                      flex: 1,
                                    },
                                  },
                                },
                            {
                              type: "div",
                              props: {
                                style: {
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "flex-end",
                                  gap: "0px",
                                  flex: 1,
                                },
                                children: [
                                  {
                                    type: "div",
                                    props: {
                                      style: {
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "2px",
                                      },
                                      children: [
                                        openSUSELogo
                                          ? {
                                              type: "img",
                                              props: {
                                                src: openSUSELogo,
                                                width: 50,
                                                height: 50,
                                                style: {
                                                  objectFit: "contain",
                                                },
                                              },
                                            }
                                          : null,
                                        {
                                          type: "div",
                                          props: {
                                            style: {
                                              display: "flex",
                                              flexDirection: "column",
                                              alignItems: "flex-end",
                                              justifyContent: "center",
                                              gap: "1px",
                                            },
                                            children: [
                                              {
                                                type: "span",
                                                props: {
                                                  style: {
                                                    fontSize: "18px",
                                                    fontWeight: "700",
                                                    color: colors.text,
                                                  },
                                                  children: "openSUSE Kudos",
                                                },
                                              },
                                              {
                                                type: "span",
                                                props: {
                                                  style: {
                                                    fontSize: "9px",
                                                    letterSpacing: "0.08em",
                                                    textTransform: "uppercase",
                                                    color: colors.muted,
                                                    opacity: "0.82",
                                                  },
                                                  children: "Recognition Platform",
                                                },
                                              },
                                            ],
                                          },
                                        },
                                      ].filter(Boolean),
                                    },
                                  },
                                ].filter(Boolean),
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              ].filter(Boolean),
            },
          },
        ],
      },
    },
    {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      fonts: loadSatoriFonts(),
    }
  );
}
// Simple fallback card — same output as primary renderer.
async function renderKudoPreviewSvgFallback(kudo, palette = CARD_IMAGE_PALETTES.dark) {
  return await renderKudoOGImage(kudo, palette);
}

async function renderKudoPreviewSvg(kudo, palette = CARD_IMAGE_PALETTES.dark) {
  try {
    return await renderKudoOGImage(kudo, palette);
  } catch (err) {
    console.error("⚠️ Social card renderer failed, falling back to simplified card:", err?.message || err);
    return await renderKudoPreviewSvgFallback(kudo, palette);
  }
}

export function mountKudosRoutes(app, prisma) {
  const router = express.Router();

  async function sendKudoSharePage(req, res) {
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

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", SHARE_PAGE_CACHE_CONTROL);
      res.send(renderKudoShareHtml(kudo));
    } catch (err) {
      console.error("💥 Failed to generate share page:", err);
      res.status(500).send("Error generating share preview");
    }
  }

  app.get("/kudo/:slug/share", sendKudoSharePage);

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
  // GET /api/kudos/:slug/qr — Permalink QR code
  // ---------------------------------------------------------------
  router.get("/:slug/qr", async (req, res) => {
    const { slug } = req.params;
    const palette = getCardImagePalette("dark");
    const cacheKey = `qr:${slug}`;

    if (previewCache.has(cacheKey)) {
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", PREVIEW_CACHE_CONTROL);
      return res.send(previewCache.get(cacheKey));
    }

    try {
      const kudo = await prisma.kudos.findUnique({ where: { slug }, select: { slug: true } });
      if (!kudo) return res.status(404).send("Kudo not found");

      const base = process.env.BASE_URL || process.env.VITE_DEV_SERVER || "http://localhost:3000";
      const permalink = `${base}/kudo/${slug}`;
      const qrPng = await QRCode.toBuffer(permalink, {
        errorCorrectionLevel: "M",
        margin: 1,
        width: 240,
        color: {
          dark: palette.qrDark,
          light: palette.qrLight,
        },
      });

      previewCache.set(cacheKey, qrPng);

      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", PREVIEW_CACHE_CONTROL);
      res.send(qrPng);
    } catch (err) {
      console.error("💥 Failed to generate kudo QR code:", err);
      res.status(500).json({ error: "Failed to generate kudo QR code" });
    }
  });

  // ---------------------------------------------------------------
  // GET /api/kudos/:slug/image.svg — Social preview (SVG)
  // ---------------------------------------------------------------
  router.get("/:slug/image.svg", async (req, res) => {
    const { slug } = req.params;
    const cacheKey = `svg:${PREVIEW_RENDER_VERSION}:${slug}`;

    if (previewCache.has(cacheKey)) {
      res.setHeader("Content-Type", "image/svg+xml");
      res.setHeader("Cache-Control", PREVIEW_CACHE_CONTROL);
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

      const svg = await renderKudoPreviewSvg(kudo, getCardImagePalette("dark"));
      previewCache.set(cacheKey, svg);

      res.setHeader("Content-Type", "image/svg+xml");
      res.setHeader("Cache-Control", PREVIEW_CACHE_CONTROL);
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
    const cacheKey = `png:${PREVIEW_RENDER_VERSION}:${slug}`;

    if (previewCache.has(cacheKey)) {
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", PREVIEW_CACHE_CONTROL);
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

      const svg = await renderKudoPreviewSvg(kudo, getCardImagePalette("dark"));

      const png = await svgToPng(svg);
      const buffer = Buffer.from(png);

      previewCache.set(cacheKey, buffer);

      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", PREVIEW_CACHE_CONTROL);
      res.send(buffer);
    } catch (err) {
      console.error("💥 Failed to generate kudos image:", err);
      res.status(500).json({ error: "Failed to generate kudos image" });
    }
  });

  // ---------------------------------------------------------------
  // GET /api/kudos/:slug/share — Social share preview page alias
  // ---------------------------------------------------------------
  router.get("/:slug/share", sendKudoSharePage);

  app.use("/api/kudos", router);
}
