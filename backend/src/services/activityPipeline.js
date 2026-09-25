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
//   - broadcasts to SSE stream (now.js)
// Email is not sent from here: kudos-notify reads the stream and mails people.
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

      // Nothing to do here: routes/teams.js writes the in-app rows itself, and
      // the email goes out from kudos-notify, which reads this off the stream.
      if (event.type === "team_join_request" || event.type === "team_invite") {
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

  // In-app notification; kudos-notify sends the email
  await sendNotification(prisma, {
    userId: user.id,
    message: `💚 You received kudos from ${from}!`,
    type: "kudos",
    link: permalink,
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
    shareText,
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
    message: `🏅 Badge earned: ${badgeTitle}`,
    type: "badge",
    link: permalink,
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
    message: `⭐ ${follower} started following your updates.`,
    type: "follow",
    link: `/user/${encodeURIComponent(follower)}`,
  });

  console.log(`📨 Follow notification delivered → ${targetUser}`);
}
