// Copyright © 2025–present Lubos Kocman, LCP (Jay Michalska), and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0

import express from "express";
import EventEmitter from "events";

// Global event bus for the whole app
export const eventBus = new EventEmitter();

export function mountNowRoutes(app) {
  const router = express.Router();

  // 🪄 SSE Stream for bots or real-time clients
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

    // Send a welcome ping
    send("info", { message: "Connected to openSUSE Kudos live stream 🌈" });

    // On each new event, stream it to this client
    const listener = (payload) => send(payload.type, payload.data);
    eventBus.on("update", listener);

    // Clean up on disconnect
    req.on("close", () => eventBus.off("update", listener));
  });

  app.use("/api/now", router);
}
