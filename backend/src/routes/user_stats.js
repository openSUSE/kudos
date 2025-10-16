// Copyright © 2025–present Lubos Kocman and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0

import express from "express";
import { getAvatarUrl, sanitizeUser } from "../utils/user.js";

export function mountUserProfileRoutes(app, prisma) {
  const router = express.Router();

  // 👤 Get detailed user profile + stats
  router.get("/:username", async (req, res) => {
    try {
      const { username } = req.params;

      // Base user record
      const user = await prisma.user.findUnique({
        where: { username },
        select: {
          id: true,
          username: true,
          email: true, // internal use only
          role: true,
          avatarUrl: true,
          createdAt: true,
        },
      });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Parallel stats lookup
      const [receivedKudos, givenKudos, earnedBadges, givenBadges] = await Promise.all([
        prisma.kudos.count({ where: { recipientId: user.id } }),
        prisma.kudos.count({ where: { fromUserId: user.id } }),
        prisma.userBadge.count({ where: { userId: user.id } }),
        prisma.userBadge.count({ where: { awardedById: user.id } }),
      ]);

      const profile = {
        user: sanitizeUser({ ...user, avatarUrl: getAvatarUrl(user) }),
        stats: {
          receivedKudos,
          givenKudos,
          earnedBadges,
          givenBadges,
        },
      };

      res.json(profile);
    } catch (err) {
      console.error("💥 Failed to fetch user profile:", err);
      res.status(500).json({ error: "Failed to fetch user profile" });
    }
  });

  app.use("/api/profile", router);
}
