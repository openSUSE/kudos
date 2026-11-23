// backend/src/routes/notifications.js
// Copyright © 2025–present Lubos Kocman and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * Notification Routes
 * --------------------
 * Notification reads and updates are always scoped to the authenticated user.
 */
export function mountNotificationsRoutes(app, prisma) {
  const currentUser = (req) => req.currentUser || req.user;

  app.get("/api/notifications", async (req, res) => {
    const user = currentUser(req);
    if (!user) return res.status(401).json({ error: "Not authenticated" });

    try {
      const notes = await prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      });
      return res.json(notes);
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
      return res.status(500).json({ error: "Error fetching notifications" });
    }
  });

  // Polling is intentionally read-only. The history page (or opening a toast)
  // is where a notification becomes read.
  app.get("/api/notifications/unread", async (req, res) => {
    const user = currentUser(req);
    if (!user) return res.status(401).json({ error: "Not authenticated" });

    try {
      const notes = await prisma.notification.findMany({
        where: { userId: user.id, read: false },
        orderBy: { createdAt: "desc" },
        take: 10,
      });
      return res.json(notes);
    } catch (err) {
      console.error("Failed to fetch unread notifications:", err);
      return res.status(500).json({ error: "Error fetching notifications" });
    }
  });

  app.patch("/api/notifications/:id/read", async (req, res) => {
    const user = currentUser(req);
    if (!user) return res.status(401).json({ error: "Not authenticated" });

    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Invalid notification ID" });
    }

    try {
      const result = await prisma.notification.updateMany({
        where: { id, userId: user.id, read: false },
        data: { read: true },
      });
      if (!result.count) {
        // Do not disclose whether another user's notification exists.
        return res.status(404).json({ error: "Notification not found" });
      }
      return res.json({ read: true });
    } catch (err) {
      console.error("Failed to mark notification read:", err);
      return res.status(500).json({ error: "Error updating notification" });
    }
  });
}
