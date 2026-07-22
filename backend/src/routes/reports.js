// Copyright © 2025–present Lubos Kocman and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0

import express from "express";
import { adminOrBotAuth } from "../middleware/adminOrBotAuth.js";
import { sanitizeUser } from "../utils/user.js";

function parseInteger(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function getPreviousMonthUtc() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const monthIndex = now.getUTCMonth();

  if (monthIndex === 0) {
    return { year: year - 1, month: 12 };
  }

  return { year, month: monthIndex };
}

function resolveMonthWindow(yearParam, monthParam) {
  const fallback = getPreviousMonthUtc();
  const year = parseInteger(yearParam) ?? fallback.year;
  const month = parseInteger(monthParam) ?? fallback.month;

  if (year < 2000 || year > 2100) {
    return { error: "Invalid year. Use a value between 2000 and 2100." };
  }

  if (month < 1 || month > 12) {
    return { error: "Invalid month. Use a value between 1 and 12." };
  }

  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0));

  return {
    year,
    month,
    start,
    end,
    label: `${year}-${String(month).padStart(2, "0")}`,
  };
}

function toMonthEndIso(end) {
  return new Date(end.getTime() - 1).toISOString();
}

function getPublicBaseUrl() {
  return (
    process.env.BASE_URL ||
    process.env.VITE_DEV_SERVER ||
    process.env.FRONTEND_ORIGIN ||
    "http://localhost:5173"
  );
}

function buildAbsoluteUrl(base, path) {
  const normalizedBase = String(base || "").replace(/\/$/, "");
  const normalizedPath = String(path || "").startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

export function mountReportsRoutes(app, prisma) {
  const router = express.Router();
  const checkAdminOrBot = adminOrBotAuth(prisma);

  // GET /api/reports/monthly?year=2026&month=7
  // Returns a mailing-list-friendly digest for one calendar month.
  router.get("/monthly", checkAdminOrBot, async (req, res) => {
    const window = resolveMonthWindow(req.query.year, req.query.month);
    if (window.error) {
      return res.status(400).json({ error: window.error });
    }
    const baseUrl = getPublicBaseUrl();

    try {
      const [kudosRows, badgeRows] = await Promise.all([
        prisma.kudos.findMany({
          where: {
            createdAt: {
              gte: window.start,
              lt: window.end,
            },
          },
          include: {
            fromUser: true,
            recipients: { include: { user: true } },
            category: {
              select: {
                code: true,
                label: true,
                icon: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        }),
        prisma.userBadge.findMany({
          where: {
            grantedAt: {
              gte: window.start,
              lt: window.end,
            },
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
          orderBy: { grantedAt: "asc" },
        }),
      ]);

      const kudos = kudosRows.map((row) => ({
        id: row.id,
        slug: row.slug,
        permalink: buildAbsoluteUrl(baseUrl, `/kudo/${row.slug}`),
        createdAt: row.createdAt,
        fromUser: sanitizeUser(row.fromUser),
        recipients: row.recipients.map((recipient) => sanitizeUser(recipient.user)),
        category: row.category,
        message: row.message || "",
      }));

      // Flatten recognitions so team kudos become one row per recipient.
      const recognitions = kudos.flatMap((row) => {
        const recipientUsernames = row.recipients.map((recipient) => recipient.username);
        return row.recipients.map((recipient) => ({
          kudosId: row.id,
          kudosSlug: row.slug,
          permalink: row.permalink,
          createdAt: row.createdAt,
          fromUser: row.fromUser,
          toUser: recipient,
          category: row.category,
          message: row.message,
          isGroupRecognition: row.recipients.length > 1,
          recipientCount: row.recipients.length,
          recipientUsernames,
        }));
      });

      const badges = badgeRows.map((row) => ({
        grantedAt: row.grantedAt,
        user: sanitizeUser(row.user),
        badge: {
          ...row.badge,
          permalink: buildAbsoluteUrl(baseUrl, `/badge/${row.badge.slug}`),
        },
      }));

      const recognizedByUser = new Map();
      for (const row of kudos) {
        for (const recipient of row.recipients) {
          const key = recipient.username;
          if (!recognizedByUser.has(key)) {
            recognizedByUser.set(key, {
              user: recipient,
              recognitions: 0,
              categories: {},
            });
          }

          const entry = recognizedByUser.get(key);
          entry.recognitions += 1;
          const categoryKey = row.category?.code || "uncategorized";
          entry.categories[categoryKey] = (entry.categories[categoryKey] || 0) + 1;
        }
      }

      const recognizedUsers = Array.from(recognizedByUser.values())
        .map((entry) => ({
          user: entry.user,
          recognitions: entry.recognitions,
          categories: entry.categories,
        }))
        .sort((a, b) => b.recognitions - a.recognitions || a.user.username.localeCompare(b.user.username));

      const badgeRecipientsByUser = new Map();
      for (const row of badges) {
        const key = row.user.username;
        if (!badgeRecipientsByUser.has(key)) {
          badgeRecipientsByUser.set(key, {
            user: row.user,
            badgeCount: 0,
            badges: [],
          });
        }

        const entry = badgeRecipientsByUser.get(key);
        entry.badgeCount += 1;
        entry.badges.push({
          slug: row.badge.slug,
          title: row.badge.title,
          grantedAt: row.grantedAt,
          permalink: buildAbsoluteUrl(baseUrl, `/badge/${row.badge.slug}`),
        });
      }

      const badgeRecipients = Array.from(badgeRecipientsByUser.values())
        .sort((a, b) => b.badgeCount - a.badgeCount || a.user.username.localeCompare(b.user.username));

      const totalRecognitions = kudos.reduce((count, row) => count + row.recipients.length, 0);

      res.json({
        period: {
          year: window.year,
          month: window.month,
          label: window.label,
          start: window.start.toISOString(),
          end: toMonthEndIso(window.end),
        },
        totals: {
          kudos: kudos.length,
          recognitions: totalRecognitions,
          badges: badges.length,
          recognizedUsers: recognizedUsers.length,
          badgeRecipients: badgeRecipients.length,
        },
        recognizedUsers,
        badgeRecipients,
        recognitions,
        kudos,
        badges,
      });
    } catch (err) {
      console.error("Failed to build monthly report:", err);
      res.status(500).json({ error: "Failed to build monthly report" });
    }
  });

  app.use("/api/reports", router);
}
