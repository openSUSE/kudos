// backend/src/utils/grantBadge.js
// Copyright © 2025–present Lubos Kocman and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0
//
// The one way a badge gets granted: by an admin, by a bot, or claimed at an
// event. Keeping it in one place means every path gets the same team roster
// sync, in-app notification, email (kudos-notify reads the activity off
// /api/now/stream) and share links.

import { eventBus } from "../routes/now.js";
import { syncBadgeTeamMembership } from "./teamBadge.js";

export function getBaseUrl() {
  return process.env.BASE_URL || process.env.VITE_DEV_SERVER || "http://localhost:3000";
}

export function buildBadgeAchievementPermalink(baseUrl, badgeSlug, username) {
  return `${baseUrl}/badge/${badgeSlug}/earned-by/${username}`;
}

export function buildBadgeAchievementShareUrl(baseUrl, badgeSlug, username) {
  return `${buildBadgeAchievementPermalink(baseUrl, badgeSlug, username)}/share`;
}

export function buildBadgeShareText(displayName, badgeTitle, badgeDescription) {
  const badgeSummary = badgeDescription || badgeTitle;
  return `${displayName} just earned badge in openSUSE Kudos for ${badgeSummary}`;
}

/**
 * Grant `badge` to `user`. Idempotent: someone who already holds the badge
 * gets `{ alreadyGranted: true }` and no second notification.
 *
 * `eventId` records the BadgeEvent the badge was claimed at, if any.
 */
export async function grantBadge(prisma, { user, badge, eventId = null }) {
  const baseUrl = getBaseUrl();
  const permalink = buildBadgeAchievementPermalink(baseUrl, badge.slug, user.username);
  const shareUrl = buildBadgeAchievementShareUrl(baseUrl, badge.slug, user.username);

  let granted;
  try {
    granted = await prisma.userBadge.create({
      data: { userId: user.id, badgeId: badge.id, eventId },
    });
  } catch (err) {
    // Two scans of the same QR code racing each other.
    if (err.code === "P2002") return { alreadyGranted: true, permalink, shareUrl };
    throw err;
  }

  // If this badge is bound to a team, granting it also puts the recipient
  // on that team's roster. No-op for ordinary achievement badges.
  await syncBadgeTeamMembership(prisma, { userId: user.id, badgeId: badge.id });

  const badgePicture = badge.picture.startsWith("http")
    ? badge.picture
    : `${baseUrl}${badge.picture}`;
  const shareText = buildBadgeShareText(
    user.fullName || user.username,
    badge.title,
    badge.description
  );

  // Notify pipeline (DB + email + followers)
  eventBus.emit("activity", {
    type: "badge",
    actorId: user.id,
    targetUserId: user.id,
    payload: {
      username: user.username,
      badgeSlug: badge.slug,
      badgeTitle: badge.title,
      badgeDescription: badge.description,
      badgePicture,
      grantedAt: granted.grantedAt,
      permalink: shareUrl,
      achievementPermalink: permalink,
      shareUrl,
      shareText,
    },
  });

  return { alreadyGranted: false, granted, permalink, shareUrl };
}
