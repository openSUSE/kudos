// backend/src/routes/notifications.js
// Copyright © 2025–present Lubos Kocman and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * Notification Routes
 * --------------------
 * Returns unread notifications for the currently logged-in user.
 * Uses req.currentUser (attached by auth middleware).
 */

export function mountNotificationsRoutes(app, prisma) {
  app.get("/api/notifications/unread", async (req, res) => {
    try {
      // ✅ Ensure user is loaded from session middleware
      const user = req.currentUser || req.user;

      if (!user) {
        console.warn("🔒 Unauthorized access to /api/notifications/unread");
        return res.status(401).send("Not authenticated");
      }

      // ✅ Fetch the most recent unread notifications
      const notes = await prisma.notification.findMany({
        where: { userId: user.id, read: false },
        orderBy: { createdAt: "desc" },
        take: 10,
      });

      // ✅ Return the notifications first
      res.json(notes);

      // ✅ Optionally mark them as read after sending (non-blocking)
      prisma.notification
        .updateMany({
          where: { userId: user.id, read: false },
          data: { read: true },
        })
        .catch((err) =>
          console.error("⚠️ Failed to mark notifications as read:", err)
        );
    } catch (err) {
      console.error("❌ Failed to fetch unread notifications:", err);
      res.status(500).send("Error fetching notifications");
    }
  });
}
