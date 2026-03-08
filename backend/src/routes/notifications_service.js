// backend/src/routes/notifications_service.js
import express from "express";
import { botAuth } from "../middleware/botAuth.js";

export function mountNotificationsServiceRoutes(app, prisma) {
  const router = express.Router();

  router.get("/users-to-notify", botAuth(prisma), async (req, res) => {
    try {
      const allUsers = await prisma.user.findMany({
        select: {
          username: true,
          email: true,
          emailNotificationsEnabled: true,
          matrixHandle: true,
          slackHandle: true,
          githubHandle: true,
          giteaHandle: true,
          followers: {
            select: {
              follower: {
                select: {
                  email: true,
                  emailNotificationsEnabled: true,
                },
              },
            },
          },
        },
      });

      const usersToNotify = allUsers.map((user) => {
        const followers = user.followers
          .map((f) => f.follower)
          .filter((f) => f && f.emailNotificationsEnabled && f.email)
          .map((f) => f.email);

        return {
          username: user.username,
          email: user.email,
          emailNotificationsEnabled: user.emailNotificationsEnabled,
          matrixHandle: user.matrixHandle || user.username,
          slackHandle: user.slackHandle || user.username,
          githubHandle: user.githubHandle || user.username,
          giteaHandle: user.giteaHandle || user.username,
          followers,
        };
      });

      res.json(usersToNotify);
    } catch (err) {
      console.error("💥 Failed to fetch users for notification:", err);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.use("/api/notifications-service", router);
}
