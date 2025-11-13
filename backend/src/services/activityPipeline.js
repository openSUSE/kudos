// backend/src/services/activityPipeline.js
// SPDX-License-Identifier: Apache-2.0

// Activity Pipeline
// -----------------
// Central dispatcher for all activity events emitted by routes.
//
// Routes should emit:
//   eventBus.emit("activity", { type: "kudos" | "badge" | "follow", payload })
//
// The pipeline:
//   - stores DB notifications
//   - sends email using notify.js
//   - broadcasts to SSE stream (now.js)
// Slack/Matrix bots handle their own event ingestion externally.

import { eventBus } from "../routes/now.js";
import { sendNotification } from "./notify.js";

export function setupActivityPipeline(prisma) {
  console.log("⚡ Activity pipeline initialized");

  // Listen for all activity events
  eventBus.on("activity", async (event) => {
    try {
      if (!event || !event.type) {
        console.warn("⚠️ Invalid activity event:", event);
        return;
      }

      if (event.type === "kudos") {
        await handleKudosEvent(prisma, event.payload);
        return;
      }

      if (event.type === "badge") {
        await handleBadgeEvent(prisma, event.payload);
        return;
      }

      if (event.type === "follow") {
        await handleFollowEvent(prisma, event.payload);
        return;
      }

      console.warn(`⚠️ Unknown activity type: ${event.type}`);
    } catch (err) {
      console.error("💥 Activity pipeline error:", err);
    }
  });
}

// Kudos Notification Handler
async function handleKudosEvent(prisma, payload) {
  const {
    from,
    to,
    category,
    message,
    createdAt,
    permalink,
  } = payload;

  const user = await prisma.user.findUnique({
    where: { username: to },
    select: { id: true, email: true },
  });

  if (!user) {
    console.warn(`⚠️ Kudos recipient not found: ${to}`);
    return;
  }

  // Send in-app + email notification
  await sendNotification(prisma, {
    userId: user.id,
    subject: `💚 New Kudos from ${from}`,
    message: `💚 You received kudos from ${from}!`,
    type: "kudos",
    template: "kudos_email",
    permalink,
    shareUrl: permalink,
    context: {
      fromUser: from,
      category,
      message: message || null,
      permalink,
      shareUrl: permalink,
    },
  });

  console.log(`📨 Kudos notification delivered → ${to}`);
}

// Badge Notification Handler
async function handleBadgeEvent(prisma, payload) {
  const {
    username,
    badgeSlug,
    badgeTitle,
    badgeDescription,
    badgePicture,
    grantedAt,
    permalink,
  } = payload;

  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, email: true },
  });

  if (!user) {
    console.warn(`⚠️ Badge recipient not found: ${username}`);
    return;
  }

  await sendNotification(prisma, {
    userId: user.id,
    subject: `🏅 You earned the "${badgeTitle}" badge`,
    type: "badge",
    message: `🏅 Badge earned: ${badgeTitle}`,
    template: "badge_email",
    permalink,
    shareUrl: permalink,
    context: {
      username,
      badgeTitle,
      badgeDescription,
      badgePicture,
      permalink,
      shareUrl: permalink,
      shareText: `I just earned the "${badgeTitle}" badge on the openSUSE Community Portal! 🦎`,
    },
  });

  console.log(`📨 Badge notification delivered → ${username}`);
}

// User Follow Notification Handler
async function handleFollowEvent(prisma, payload) {
  const { follower, targetUser, permalink } = payload;

  const user = await prisma.user.findUnique({
    where: { username: targetUser },
    select: { id: true, email: true },
  });

  if (!user) {
    console.warn(`⚠️ Follow target not found: ${targetUser}`);
    return;
  }

  await sendNotification(prisma, {
    userId: user.id,
    subject: `⭐ ${follower} is now following you`,
    message: `⭐ ${follower} started following your updates.`,
    type: "follow",
    template: "follow_email",
    permalink,
    context: {
      follower,
      targetUser,
      permalink,
    },
  });

  console.log(`📨 Follow notification delivered → ${targetUser}`);
}
