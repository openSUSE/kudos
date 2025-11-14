// backend/src/routes/now.js
// SPDX-License-Identifier: Apache-2.0

// Live Event Stream (SSE)
// -----------------------
// Exposes /api/now/stream for real-time updates.
// The eventBus emits two channels:
//   - "update"    (legacy events from old routes)
//   - "activity"  (new unified pipeline events)
// Bots and clients subscribe here.

import express from "express";
import EventEmitter from "events";

// Global event bus for the whole app
export const eventBus = new EventEmitter();

// prisma included for compatibility with app.js usage
export function mountNowRoutes(app, prisma) {
  const router = express.Router();

  router.get("/stream", (req, res) => {
    res.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const send = (type, data) => {
      res.write(`event: ${type}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Initial connection message
    send("info", { message: "Connected to openSUSE Kudos live stream 🌈" });

    // Unified listener for all event types
    const listener = (payload) => {
      const data = payload.data || payload.payload || null;
      send(payload.type, data);
    };

    // Subscribe to legacy + new event channels
    eventBus.on("update", listener);
    eventBus.on("activity", listener);

    // Cleanup after disconnect
    req.on("close", () => {
      eventBus.off("update", listener);
      eventBus.off("activity", listener);
    });
  });

  app.use("/api/now", router);
}
