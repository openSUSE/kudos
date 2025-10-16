// backend/src/routes/users.js
// Copyright © 2025–present Lubos Kocman and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0

import express from "express";
import { getAvatarUrl, sanitizeUser } from "../utils/user.js";

export function mountUserRoutes(app, prisma) {
  const router = express.Router();

  // 👥 List all users
  router.get("/", async (_, res) => {
    try {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          username: true,
          email: true, // internal use only
          role: true,
          avatarUrl: true,
        },
      });

      const safeUsers = users.map((u) =>
        sanitizeUser({ ...u, avatarUrl: getAvatarUrl(u) })
      );

      res.json(safeUsers);
    } catch (err) {
      console.error("💥 Failed to list users:", err);
      res.status(500).json({ error: "Failed to list users" });
    }
  });

  // 👤 Get single user by username
  router.get("/:username", async (req, res) => {
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
        },
      });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json(sanitizeUser({ ...user, avatarUrl: getAvatarUrl(user) }));
    } catch (err) {
      console.error("💥 Failed to fetch user:", err);
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  app.use("/api/users", router);
}
