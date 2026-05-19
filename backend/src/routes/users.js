// backend/src/routes/users.js
// Copyright © 2025–present Lubos Kocman and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0

import express from "express";
import { getAvatarUrl, sanitizeUser } from "../utils/user.js";
import { optionalBotAuth } from "../middleware/botAuth.js";

const SUPPORTED_SOCIAL_NETWORKS = [
  "matrix",
  "mastodon",
  "linkedin",
  "x",
  "telegram",
  "reddit",
  "whatsapp",
  "threads",
];

function buildSocialHandlesPayload(username, rows) {
  const byNetwork = new Map(rows.map((row) => [row.network, row]));

  return SUPPORTED_SOCIAL_NETWORKS.map((network) => {
    const row = byNetwork.get(network);
    const handle = row?.handle?.trim() || null;

    return {
      network,
      handle,
      effectiveHandle: handle || username,
      isDefault: !handle,
      updatedAt: row?.updatedAt || null,
    };
  });
}

export function mountUserRoutes(app, prisma) {
  const router = express.Router();

  // 👥 List all users
  router.get("/", optionalBotAuth(prisma), async (req, res) => {
    try {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          username: true,
          email: true, // internal use only
          role: true,
          avatarUrl: true,
          kudosGiven: true,
        },
      });

      // if authenticated, return full user objects
      if (req.currentUser || req.botUser) {
        return res.json(users.map(u => ({ ...u, avatarUrl: getAvatarUrl(u) })));
      }

      const safeUsers = users.map((u) =>
        sanitizeUser({ ...u, avatarUrl: getAvatarUrl(u) })
      );

      res.json(safeUsers);
    } catch (err) {
      console.error("💥 Failed to list users:", err);
      res.status(500).json({ error: "Failed to list users" });
    }
  });

  router.get("/me/social-handles", async (req, res) => {
    try {
      if (!req.currentUser) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const rows = await prisma.userSocialHandle.findMany({
        where: { userId: req.currentUser.id },
        select: {
          network: true,
          handle: true,
          updatedAt: true,
        },
      });

      res.json({
        username: req.currentUser.username,
        handles: buildSocialHandlesPayload(req.currentUser.username, rows),
      });
    } catch (err) {
      console.error("💥 Failed to fetch current user social handles:", err);
      res.status(500).json({ error: "Failed to fetch social handles" });
    }
  });

  router.put("/me/social-handles/:network", async (req, res) => {
    try {
      if (!req.currentUser) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const network = String(req.params.network || "").toLowerCase();
      const handle = String(req.body?.handle || "").trim();

      if (!SUPPORTED_SOCIAL_NETWORKS.includes(network)) {
        return res.status(400).json({ error: "Unsupported social network" });
      }

      if (!handle) {
        return res.status(400).json({ error: "Handle is required" });
      }

      await prisma.userSocialHandle.upsert({
        where: {
          userId_network: {
            userId: req.currentUser.id,
            network,
          },
        },
        update: { handle },
        create: {
          userId: req.currentUser.id,
          network,
          handle,
        },
      });

      const rows = await prisma.userSocialHandle.findMany({
        where: { userId: req.currentUser.id },
        select: {
          network: true,
          handle: true,
          updatedAt: true,
        },
      });

      res.json({
        success: true,
        username: req.currentUser.username,
        handles: buildSocialHandlesPayload(req.currentUser.username, rows),
      });
    } catch (err) {
      console.error("💥 Failed to upsert social handle:", err);
      res.status(500).json({ error: "Failed to update social handle" });
    }
  });

  router.delete("/me/social-handles/:network", async (req, res) => {
    try {
      if (!req.currentUser) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const network = String(req.params.network || "").toLowerCase();

      if (!SUPPORTED_SOCIAL_NETWORKS.includes(network)) {
        return res.status(400).json({ error: "Unsupported social network" });
      }

      await prisma.userSocialHandle.deleteMany({
        where: {
          userId: req.currentUser.id,
          network,
        },
      });

      const rows = await prisma.userSocialHandle.findMany({
        where: { userId: req.currentUser.id },
        select: {
          network: true,
          handle: true,
          updatedAt: true,
        },
      });

      res.json({
        success: true,
        username: req.currentUser.username,
        handles: buildSocialHandlesPayload(req.currentUser.username, rows),
      });
    } catch (err) {
      console.error("💥 Failed to delete social handle:", err);
      res.status(500).json({ error: "Failed to delete social handle" });
    }
  });

  router.get("/:username/social-handles", optionalBotAuth(prisma), async (req, res) => {
    try {
      const { username } = req.params;
      const user = await prisma.user.findUnique({
        where: { username },
        select: {
          id: true,
          username: true,
        },
      });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const rows = await prisma.userSocialHandle.findMany({
        where: { userId: user.id },
        select: {
          network: true,
          handle: true,
          updatedAt: true,
        },
      });

      res.json({
        username: user.username,
        handles: buildSocialHandlesPayload(user.username, rows),
      });
    } catch (err) {
      console.error("💥 Failed to fetch social handles:", err);
      res.status(500).json({ error: "Failed to fetch social handles" });
    }
  });

  // 👤 Get single user by username
  router.get("/:username", optionalBotAuth(prisma), async (req, res) => {
    try {
      const { username } = req.params;
      const user = await prisma.user.findUnique({
        where: { username },
        select: {
          id: true,
          username: true,
          email: true, // internal use only
          role: true,
          avatarUrl: true,
          kudosGiven: true,
        },
      });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // if authenticated, return full user object
      if (req.currentUser || req.botUser) {
        return res.json({ ...user, avatarUrl: getAvatarUrl(user) });
      }

      res.json(sanitizeUser({ ...user, avatarUrl: getAvatarUrl(user) }));
    } catch (err) {
      console.error("💥 Failed to fetch user:", err);
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  app.use("/api/users", router);
}
