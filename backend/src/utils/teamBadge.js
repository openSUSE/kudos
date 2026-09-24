// backend/src/utils/teamBadge.js
// Copyright © 2025–present Lubos Kocman and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0
//
// Several badges (hero, release, …) were used to mark team affiliation before
// teams existed as a concept. Binding such a badge to a team keeps the old
// workflow working: granting the badge still puts someone on the roster.
//
// The relationship is deliberately one-way. Granting adds a member; losing
// membership never revokes the badge, because the badge records what someone
// did and the roster records who is there now. See docs/teams.md.

import { eventBus } from "../routes/now.js";

/**
 * If the granted badge is bound to a team, make the recipient an active
 * member of it. Idempotent, and a no-op for ordinary achievement badges.
 *
 * Returns the team username when a membership was created, otherwise null.
 */
export async function syncBadgeTeamMembership(prisma, { userId, badgeId }) {
  try {
    const badge = await prisma.badge.findUnique({
      where: { id: badgeId },
      select: { teamUserId: true, teamUser: { select: { username: true } } },
    });

    if (!badge?.teamUserId) return null;

    const existing = await prisma.teamMember.findUnique({
      where: {
        teamUserId_userId: { teamUserId: badge.teamUserId, userId },
      },
    });

    if (existing?.state === "ACTIVE") return null;

    if (existing) {
      // A pending request short-circuits to active: the badge is a stronger
      // statement of belonging than a member's approval would have been.
      await prisma.teamMember.update({
        where: { id: existing.id },
        data: { state: "ACTIVE", approvedAt: new Date() },
      });
    } else {
      await prisma.teamMember.create({
        data: {
          teamUserId: badge.teamUserId,
          userId,
          state: "ACTIVE",
          approvedAt: new Date(),
        },
      });
    }

    await prisma.teamEvent.create({
      data: {
        teamUserId: badge.teamUserId,
        actorId: userId,
        targetId: userId,
        action: "joined_via_badge",
      },
    });

    return badge.teamUser?.username || null;
  } catch (err) {
    // Never let roster bookkeeping break a badge grant.
    console.error("💥 Failed to sync badge team membership:", err);
    return null;
  }
}

/**
 * Grant a team's membership badge to every ACTIVE member who does not hold it
 * yet. Run when an admin binds the badge, so the roster and the holder list
 * start out matching instead of the badge covering only future grants.
 *
 * Each grant goes through the usual activity pipeline, so recipients are
 * notified exactly as if an admin had granted the badge by hand.
 *
 * Returns the number of badges granted.
 */
export async function grantBadgeToTeamMembers(prisma, { teamUserId, badge }) {
  const members = await prisma.teamMember.findMany({
    where: {
      teamUserId,
      state: "ACTIVE",
      user: { role: { notIn: ["TEAM", "BOT"] } },
      NOT: { user: { badges: { some: { badgeId: badge.id } } } },
    },
    include: { user: { select: { id: true, username: true, fullName: true } } },
  });
  if (!members.length) return 0;

  await prisma.userBadge.createMany({
    data: members.map((m) => ({ userId: m.userId, badgeId: badge.id })),
  });

  const baseUrl = process.env.BASE_URL || process.env.VITE_DEV_SERVER || "http://localhost:3000";
  const badgePicture = badge.picture?.startsWith("http") ? badge.picture : `${baseUrl}${badge.picture}`;
  const grantedAt = new Date();

  for (const { user } of members) {
    const permalink = `${baseUrl}/badge/${badge.slug}/earned-by/${user.username}`;
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
        grantedAt,
        permalink: `${permalink}/share`,
        achievementPermalink: permalink,
        shareText: `${user.fullName || user.username} just earned badge in openSUSE Kudos for ${badge.description || badge.title}`,
      },
    });
  }

  return members.length;
}
