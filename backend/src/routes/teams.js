// backend/src/routes/teams.js
// Copyright © 2025–present Lubos Kocman and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0
//
// A team is a User row with role = TEAM, so it can receive kudos, own a
// profile and appear in the recipient picker with no changes to those paths.
// See docs/teams.md for the design and the rejected alternatives.

import express from "express";
import { getAvatarUrl } from "../utils/user.js";
import { grantBadgeToTeamMembers } from "../utils/teamBadge.js";
import { eventBus } from "./now.js";

function getBaseUrl() {
  return process.env.BASE_URL || process.env.VITE_DEV_SERVER || "http://localhost:3000";
}

// Where a notification about a team should land. Anything asking you to act
// opens the team's card on /teams; everything else goes to the team's page.
export function teamActionPath(team) {
  return `/teams?team=${encodeURIComponent(team.username)}`;
}

export function teamPagePath(team) {
  return `/user/${encodeURIComponent(team.username)}`;
}

// Requests that nobody acts on are auto-approved after this long. Without it
// they rot forever in teams whose members have drifted away.
const AUTO_APPROVE_DAYS = 14;

// How many teams one account may create per day.
const CREATE_LIMIT_PER_DAY = 5;

// How many invitations one member may send per day. Each one is an email to
// somebody who did not ask for it, so the cap matters more than for creation.
const INVITE_LIMIT_PER_DAY = 20;

// There is deliberately no reserved-name list. An earlier version blocked
// official-sounding names like `release-team` on the theory that they need an
// authority behind them, but the people most likely to type one are the actual
// members of that group — and being told your own team's name is not yours to
// claim is a bad first impression for exactly the contributors this is for.
// Any such list is also a guess: it blocks a handful of names and misses every
// other real working group, so it buys suspicion rather than safety.
//
// The protections that do hold are structural: a name already taken by a user
// or team is rejected below, and an admin can archive or delete anything that
// turns out to be a fake or a duplicate. See docs/teams.md.

/**
 * Turn free text ("Agama Team!") into a usable username ("agama-team").
 */
export function normalizeTeamName(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/**
 * Shape the bound badge for the UI. Every team reports a badge slot, `null`
 * when nothing is bound yet, so the gap is visible rather than invisible —
 * teams that could claim a badge are the ones least likely to know they can.
 */
function publicBadge(badge) {
  if (!badge) return null;
  return {
    slug: badge.slug,
    title: badge.title,
    picture: badge.picture,
  };
}

function publicTeam(teamUser, { memberCount = 0, myState = null, badge = null } = {}) {
  return {
    username: teamUser.username,
    displayName: teamUser.fullName || teamUser.username,
    // A bound badge is the team's membership badge, so it wins over the generated avatar.
    avatarUrl: badge?.picture || getAvatarUrl(teamUser),
    badge: publicBadge(badge),
    description: teamUser.teamProfile?.description || null,
    listEmail: teamUser.teamProfile?.listEmail || null,
    homepage: teamUser.teamProfile?.homepage || null,
    chatUrl: teamUser.teamProfile?.chatUrl || null,
    archivedAt: teamUser.teamProfile?.archivedAt || null,
    createdAt: teamUser.createdAt,
    memberCount,
    myState,
  };
}

/**
 * Promote join requests that nobody answered within AUTO_APPROVE_DAYS.
 *
 * Lazy: this runs when a team is looked at rather than on a timer, so a team
 * nobody ever visits keeps its requests pending. Good enough until there is a
 * scheduler; the promotion still happens the moment anyone opens the page.
 */
async function promoteStaleRequests(prisma, teamUserId) {
  const cutoff = new Date(Date.now() - AUTO_APPROVE_DAYS * 86400_000);

  const stale = await prisma.teamMember.findMany({
    where: { teamUserId, state: "PENDING", requestedAt: { lt: cutoff } },
    select: { id: true, userId: true },
  });

  if (!stale.length) return;

  await prisma.$transaction([
    prisma.teamMember.updateMany({
      where: { id: { in: stale.map((m) => m.id) } },
      data: { state: "ACTIVE", approvedAt: new Date() },
    }),
    prisma.teamEvent.createMany({
      data: stale.map((m) => ({
        teamUserId,
        actorId: m.userId,
        targetId: m.userId,
        action: "auto_approved",
      })),
    }),
  ]);
}

async function findTeam(prisma, username) {
  return prisma.user.findFirst({
    where: { username, role: "TEAM" },
    include: { teamProfile: true },
  });
}

/**
 * Find a user whose name matches case-insensitively.
 *
 * Team names are lowercased by normalizeTeamName, but human usernames come
 * from OIDC with their original case, and both live in the same `username`
 * column. A plain lookup for "bobsmith" therefore misses the user "BobSmith"
 * under SQLite's case-sensitive default collation, which would let a team be
 * created as a lookalike of a real person.
 *
 * Prisma's `mode: "insensitive"` is PostgreSQL-only, so the exact match runs
 * against the unique index first and the fallback compares in memory. Team
 * creation is rare and rate-limited, so the scan of one column is cheap.
 */
async function findUserByNameInsensitive(prisma, username) {
  const exact = await prisma.user.findUnique({ where: { username } });
  if (exact) return exact;

  const target = username.toLowerCase();
  const candidates = await prisma.user.findMany({
    select: { id: true, username: true, fullName: true, role: true },
  });

  const hit = candidates.find((u) => u.username.toLowerCase() === target);
  return hit || null;
}

async function membershipOf(prisma, teamUserId, userId) {
  if (!userId) return null;
  return prisma.teamMember.findUnique({
    where: { teamUserId_userId: { teamUserId, userId } },
  });
}

/**
 * An open invitation. Usually state INVITED, but a former member invited back
 * stays EMERITUS with `invitedById` set, so they keep showing as an alumnus
 * until they answer; accepting is the same one-click rejoin they already had.
 */
function hasOpenInvite(m) {
  return m?.state === "INVITED" || (m?.state === "EMERITUS" && !!m.invitedById);
}

export function mountTeamRoutes(app, prisma) {
  const router = express.Router();

  function requireLogin(req, res, next) {
    if (!req.currentUser) {
      return res.status(401).json({ error: "Authentication required" });
    }
    next();
  }

  // ---------------------------------------------------------------
  // GET /api/teams/me/status — what the header's teams button needs
  // Whether you are on a team, plus the things waiting for you there: open
  // invites to you and join requests you could approve. Two segments, so it
  // never collides with /:username.
  // ---------------------------------------------------------------
  router.get("/me/status", requireLogin, async (req, res) => {
    try {
      const mine = await prisma.teamMember.findMany({
        where: { userId: req.currentUser.id },
        select: { teamUserId: true, state: true, invitedById: true },
      });
      const activeTeamIds = mine.filter((m) => m.state === "ACTIVE").map((m) => m.teamUserId);
      const invites = mine.filter(hasOpenInvite).length;
      const requests = activeTeamIds.length
        ? await prisma.teamMember.count({
            where: { teamUserId: { in: activeTeamIds }, state: "PENDING" },
          })
        : 0;

      res.json({ inTeam: activeTeamIds.length > 0, invites, requests });
    } catch (e) {
      console.error("💥 Failed to load team status:", e);
      res.status(500).json({ error: "Failed to load team status" });
    }
  });

  // ---------------------------------------------------------------
  // GET /api/teams — browse teams
  // ---------------------------------------------------------------
  router.get("/", async (req, res) => {
    try {
      const teams = await prisma.user.findMany({
        where: { role: "TEAM" },
        include: { teamProfile: true },
        orderBy: { username: "asc" },
      });

      const counts = await prisma.teamMember.groupBy({
        by: ["teamUserId"],
        where: { state: "ACTIVE" },
        _count: { _all: true },
      });
      const countByTeam = new Map(counts.map((c) => [c.teamUserId, c._count._all]));

      const mine = req.currentUser
        ? await prisma.teamMember.findMany({
            where: { userId: req.currentUser.id },
            select: { teamUserId: true, state: true, invitedById: true },
          })
        : [];
      const stateByTeam = new Map(mine.map((m) => [m.teamUserId, m.state]));

      // An invitation from a name you know is one you accept; from a team name
      // alone it looks like spam.
      const inviterIds = mine.filter(hasOpenInvite).map((m) => m.invitedById);
      const inviters = inviterIds.length
        ? await prisma.user.findMany({
            where: { id: { in: inviterIds } },
            select: { id: true, username: true, fullName: true },
          })
        : [];
      const inviterById = new Map(inviters.map((u) => [u.id, u]));
      const invitedByTeam = new Map(
        mine
          .filter(hasOpenInvite)
          .map((m) => {
            const u = inviterById.get(m.invitedById);
            return [m.teamUserId, u ? { username: u.username, displayName: u.fullName || u.username } : null];
          })
      );

      // Waiting requests, but only for teams the viewer can act on — the same
      // rule as the pending list on the detail endpoint. Without this a member
      // has to expand every card to find out whether anyone is waiting.
      const myActiveTeamIds = mine
        .filter((m) => m.state === "ACTIVE")
        .map((m) => m.teamUserId);
      const pending = myActiveTeamIds.length
        ? await prisma.teamMember.groupBy({
            by: ["teamUserId"],
            where: { state: "PENDING", teamUserId: { in: myActiveTeamIds } },
            _count: { _all: true },
          })
        : [];
      const pendingByTeam = new Map(pending.map((p) => [p.teamUserId, p._count._all]));

      const bound = await prisma.badge.findMany({
        where: { teamUserId: { not: null } },
      });
      const badgeByTeam = new Map(bound.map((b) => [b.teamUserId, b]));

      res.json(
        teams
          .filter((t) => !t.teamProfile?.archivedAt)
          .map((t) => ({
            ...publicTeam(t, {
              memberCount: countByTeam.get(t.id) || 0,
              myState: stateByTeam.get(t.id) || null,
              badge: badgeByTeam.get(t.id) || null,
            }),
            pendingCount: pendingByTeam.get(t.id) || 0,
            invited: invitedByTeam.has(t.id),
            invitedBy: invitedByTeam.get(t.id) || null,
          }))
      );
    } catch (err) {
      console.error("💥 Failed to list teams:", err);
      res.status(500).json({ error: "Failed to list teams" });
    }
  });

  // ---------------------------------------------------------------
  // POST /api/teams — create a team (any logged-in user)
  //
  // Admins skip the rate limit, and can create a team they are not in
  // (`joinAsMember: false`) — the normal shape for an official group: the admin
  // sets it up, and the first real member auto-approves because an empty team
  // has nobody to ask.
  // ---------------------------------------------------------------
  router.post("/", express.json(), requireLogin, async (req, res) => {
    try {
      const creator = req.currentUser;
      const isAdmin = creator.role === "ADMIN";
      const username = normalizeTeamName(req.body?.name);

      if (username.length < 2) {
        return res.status(400).json({ error: "Team name is too short" });
      }

      const taken = await findUserByNameInsensitive(prisma, username);
      if (taken) {
        return res.status(409).json({
          error:
            taken.role === "TEAM"
              ? "That team already exists — join it instead."
              : "That name is already taken by a user.",
        });
      }

      if (!isAdmin) {
        const since = new Date(Date.now() - 86400_000);
        const recent = await prisma.teamProfile.count({
          where: { createdById: creator.id, createdAt: { gte: since } },
        });
        if (recent >= CREATE_LIMIT_PER_DAY) {
          return res
            .status(429)
            .json({ error: "You have created too many teams today." });
        }
      }

      // The founder is active immediately — there is nobody to approve them.
      const joinAsMember = req.body?.joinAsMember !== false;

      const team = await prisma.user.create({
        data: {
          username,
          fullName: String(req.body?.displayName || "").trim() || username,
          email: String(req.body?.listEmail || "").trim() || null,
          role: "TEAM",
          teamProfile: {
            create: {
              description: String(req.body?.description || "").trim() || null,
              listEmail: String(req.body?.listEmail || "").trim() || null,
              homepage: String(req.body?.homepage || "").trim() || null,
              chatUrl: String(req.body?.chatUrl || "").trim() || null,
              createdById: creator.id,
            },
          },
          ...(joinAsMember
            ? {
                teamRoster: {
                  create: {
                    userId: creator.id,
                    state: "ACTIVE",
                    approvedAt: new Date(),
                    approvedById: creator.id,
                  },
                },
              }
            : {}),
        },
        include: { teamProfile: true },
      });

      await prisma.teamEvent.create({
        data: {
          teamUserId: team.id,
          actorId: creator.id,
          targetId: joinAsMember ? creator.id : null,
          action: "created",
        },
      });

      res.status(201).json(
        publicTeam(team, {
          memberCount: joinAsMember ? 1 : 0,
          myState: joinAsMember ? "ACTIVE" : null,
        })
      );
    } catch (err) {
      console.error("💥 Failed to create team:", err);
      res.status(500).json({ error: "Failed to create team" });
    }
  });

  // ---------------------------------------------------------------
  // GET /api/teams/user/:username — the teams one person belongs to
  //
  // Public and shown on every profile, not just your own: "who is on the
  // agama team" was the original complaint, and a roster nobody can see from
  // a person's page does not answer it. Two segments, so this never collides
  // with the single-segment /:username route below.
  // ---------------------------------------------------------------
  router.get("/user/:username", async (req, res) => {
    try {
      const person = await prisma.user.findUnique({
        where: { username: req.params.username },
        select: { id: true },
      });
      if (!person) return res.status(404).json({ error: "User not found" });

      const memberships = await prisma.teamMember.findMany({
        where: { userId: person.id, state: { in: ["ACTIVE", "EMERITUS"] } },
        include: { team: { include: { teamProfile: true } } },
        orderBy: [{ state: "asc" }, { approvedAt: "asc" }],
      });

      const visible = memberships.filter((m) => !m.team.teamProfile?.archivedAt);

      const badges = await prisma.badge.findMany({
        where: { teamUserId: { in: visible.map((m) => m.teamUserId) } },
      });
      const badgeByTeam = new Map(badges.map((b) => [b.teamUserId, b]));

      const counts = await prisma.teamMember.groupBy({
        by: ["teamUserId"],
        where: { state: "ACTIVE", teamUserId: { in: visible.map((m) => m.teamUserId) } },
        _count: { _all: true },
      });
      const countByTeam = new Map(counts.map((c) => [c.teamUserId, c._count._all]));

      res.json(
        visible.map((m) => ({
          ...publicTeam(m.team, {
            memberCount: countByTeam.get(m.teamUserId) || 0,
            badge: badgeByTeam.get(m.teamUserId) || null,
          }),
          state: m.state,
          joinedAt: m.approvedAt,
          leftAt: m.leftAt,
        }))
      );
    } catch (err) {
      console.error("💥 Failed to list a user's teams:", err);
      res.status(500).json({ error: "Failed to list teams" });
    }
  });

  // ---------------------------------------------------------------
  // GET /api/teams/user/:username/kudos — team kudos for a member's profile
  // ---------------------------------------------------------------
  //
  // Computed live from membership, never fanned out into KudosRecipient rows,
  // so it stays out of personal totals (docs/teams.md, "Counting"). Current
  // members see all of the team's recognition, including kudos they sent it
  // themselves (labelled internal). Former members see what arrived up to
  // the day they left.
  // ---------------------------------------------------------------
  const TEAM_KUDOS_PREVIEW = 5;

  router.get("/user/:username/kudos", async (req, res) => {
    try {
      const person = await prisma.user.findUnique({
        where: { username: req.params.username },
        select: { id: true },
      });
      if (!person) return res.status(404).json({ error: "User not found" });

      const memberships = await prisma.teamMember.findMany({
        where: { userId: person.id, state: { in: ["ACTIVE", "EMERITUS"] } },
        include: { team: { include: { teamProfile: true } } },
        orderBy: [{ state: "asc" }, { approvedAt: "asc" }],
      });
      const visible = memberships.filter((m) => !m.team.teamProfile?.archivedAt);

      const badges = await prisma.badge.findMany({
        where: { teamUserId: { in: visible.map((m) => m.teamUserId) } },
      });
      const badgeByTeam = new Map(badges.map((b) => [b.teamUserId, b]));

      const result = [];
      for (const m of visible) {
        const where = { recipients: { some: { userId: m.teamUserId } } };
        if (m.state === "EMERITUS" && m.leftAt) where.createdAt = { lte: m.leftAt };

        const [total, kudos] = await Promise.all([
          prisma.kudos.count({ where }),
          prisma.kudos.findMany({
            where,
            include: {
              fromUser: true,
              category: true,
              recipients: { where: { userId: m.teamUserId }, select: { internal: true } },
            },
            orderBy: { createdAt: "desc" },
            take: TEAM_KUDOS_PREVIEW,
          }),
        ]);
        if (!total) continue;

        result.push({
          team: publicTeam(m.team, { badge: badgeByTeam.get(m.teamUserId) || null }),
          state: m.state,
          joinedAt: m.approvedAt,
          leftAt: m.leftAt,
          total,
          kudos: kudos.map((k) => ({
            id: k.id,
            slug: k.slug,
            message: k.message,
            createdAt: k.createdAt,
            category: k.category ? { icon: k.category.icon, label: k.category.label } : null,
            fromUser: { username: k.fromUser.username },
            internal: !!k.recipients[0]?.internal,
          })),
        });
      }

      res.json(result);
    } catch (err) {
      console.error("💥 Failed to list a user's team kudos:", err);
      res.status(500).json({ error: "Failed to list team kudos" });
    }
  });

  // ---------------------------------------------------------------
  // GET /api/teams/:username — team detail + roster
  // ---------------------------------------------------------------
  router.get("/:username", async (req, res) => {
    try {
      const team = await findTeam(prisma, req.params.username);
      if (!team) return res.status(404).json({ error: "Team not found" });

      await promoteStaleRequests(prisma, team.id);

      const roster = await prisma.teamMember.findMany({
        where: { teamUserId: team.id },
        include: { user: true },
        orderBy: [{ state: "asc" }, { requestedAt: "asc" }],
      });

      const badge = await prisma.badge.findFirst({ where: { teamUserId: team.id } });

      const active = roster.filter((m) => m.state === "ACTIVE");
      const alumni = roster.filter((m) => m.state === "EMERITUS");
      const myState =
        roster.find((m) => m.userId === req.currentUser?.id)?.state || null;

      // Only members see who is waiting to be let in, or who was invited.
      const pending =
        myState === "ACTIVE" ? roster.filter((m) => m.state === "PENDING") : [];
      const invited = myState === "ACTIVE" ? roster.filter(hasOpenInvite) : [];

      res.json({
        ...publicTeam(team, { memberCount: active.length, myState, badge }),
        members: active.map((m) => ({
          username: m.user.username,
          displayName: m.user.fullName || m.user.username,
          avatarUrl: getAvatarUrl(m.user),
          joinedAt: m.approvedAt,
        })),
        alumni: alumni.map((m) => ({
          username: m.user.username,
          displayName: m.user.fullName || m.user.username,
          avatarUrl: getAvatarUrl(m.user),
          joinedAt: m.approvedAt,
          leftAt: m.leftAt,
        })),
        pending: pending.map((m) => ({
          username: m.user.username,
          displayName: m.user.fullName || m.user.username,
          avatarUrl: getAvatarUrl(m.user),
          requestedAt: m.requestedAt,
        })),
        invited: invited.map((m) => ({
          username: m.user.username,
          displayName: m.user.fullName || m.user.username,
          avatarUrl: getAvatarUrl(m.user),
          invitedAt: m.requestedAt,
        })),
      });
    } catch (err) {
      console.error("💥 Failed to fetch team:", err);
      res.status(500).json({ error: "Failed to fetch team" });
    }
  });

  // ---------------------------------------------------------------
  // POST /api/teams/:username/join — request membership
  // ---------------------------------------------------------------
  router.post("/:username/join", requireLogin, async (req, res) => {
    try {
      const team = await findTeam(prisma, req.params.username);
      if (!team) return res.status(404).json({ error: "Team not found" });
      if (team.teamProfile?.archivedAt) {
        return res.status(409).json({ error: "That team is archived." });
      }

      const existing = await membershipOf(prisma, team.id, req.currentUser.id);

      // An alumnus was vouched for once already, so coming back needs no second
      // approval.
      if (existing?.state === "EMERITUS" && !existing.invitedById) {
        await prisma.teamMember.update({
          where: { id: existing.id },
          data: { state: "ACTIVE", approvedAt: new Date(), leftAt: null },
        });
        await prisma.teamEvent.create({
          data: {
            teamUserId: team.id,
            actorId: req.currentUser.id,
            targetId: req.currentUser.id,
            action: "rejoined",
          },
        });
        return res.status(201).json({ state: "ACTIVE", rejoined: true });
      }

      // Joining a team that invited you is accepting: a member already vouched
      // for you, and saying yes is the consent the invite was waiting for.
      if (hasOpenInvite(existing)) {
        await prisma.teamMember.update({
          where: { id: existing.id },
          data: {
            state: "ACTIVE",
            approvedAt: new Date(),
            approvedById: existing.invitedById,
            invitedById: null,
            leftAt: null,
          },
        });
        await prisma.teamEvent.create({
          data: {
            teamUserId: team.id,
            actorId: req.currentUser.id,
            targetId: req.currentUser.id,
            action: "invite_accepted",
          },
        });
        if (existing.invitedById) {
          await prisma.notification.create({
            data: {
              userId: existing.invitedById,
              type: "team_invite_accepted",
              message: `${req.currentUser.username} accepted your invitation to ${team.username}`,
              link: teamPagePath(team),
            },
          });
        }
        return res.status(201).json({ state: "ACTIVE", accepted: true });
      }

      if (existing) {
        return res.json({ state: existing.state, alreadyRequested: true });
      }

      // An empty team would leave the request with nobody to answer it.
      const activeCount = await prisma.teamMember.count({
        where: { teamUserId: team.id, state: "ACTIVE" },
      });
      const state = activeCount === 0 ? "ACTIVE" : "PENDING";

      await prisma.teamMember.create({
        data: {
          teamUserId: team.id,
          userId: req.currentUser.id,
          state,
          approvedAt: state === "ACTIVE" ? new Date() : null,
        },
      });

      await prisma.teamEvent.create({
        data: {
          teamUserId: team.id,
          actorId: req.currentUser.id,
          targetId: req.currentUser.id,
          action: state === "ACTIVE" ? "approved" : "requested",
        },
      });

      // Nudge the existing members; approval itself lives on the team page.
      if (state === "PENDING") {
        const members = await prisma.teamMember.findMany({
          where: { teamUserId: team.id, state: "ACTIVE" },
          select: { userId: true, user: { select: { username: true } } },
        });

        await prisma.notification.createMany({
          data: members.map((m) => ({
            userId: m.userId,
            type: "team_join_request",
            message: `${req.currentUser.username} asked to join ${team.username}`,
            link: teamActionPath(team),
          })),
        });

        // The in-app rows above have no UI yet, so on their own nobody learns
        // a request exists. kudos-notify picks this up from the SSE stream and
        // emails each member. Usernames only: the stream is public, and the
        // notifier resolves addresses itself with its bot token.
        eventBus.emit("activity", {
          type: "team_join_request",
          actorId: req.currentUser.id,
          targetUserIds: members.map((m) => m.userId),
          payload: {
            team: team.username,
            teamDisplayName: team.fullName || team.username,
            requester: req.currentUser.username,
            requesterDisplayName: req.currentUser.fullName || req.currentUser.username,
            members: members.map((m) => m.user.username),
            autoApproveDays: AUTO_APPROVE_DAYS,
            // Lands on the team card with the pending list already open.
            approveUrl: `${getBaseUrl()}/teams?team=${encodeURIComponent(team.username)}`,
            requesterUrl: `${getBaseUrl()}/user/${encodeURIComponent(req.currentUser.username)}`,
          },
        });
      }

      res.status(201).json({ state, autoApproveDays: AUTO_APPROVE_DAYS });
    } catch (err) {
      console.error("💥 Failed to join team:", err);
      res.status(500).json({ error: "Failed to join team" });
    }
  });

  // ---------------------------------------------------------------
  // POST /api/teams/:username/invite — ask an existing user to join
  //
  // The other direction of a join request: any active member (or an admin)
  // names someone, and they become a member once they accept. Only existing
  // Kudos accounts can be invited, and those exist only after an openSUSE ID
  // login, which is spam filter enough — there is no invite-by-email.
  // ---------------------------------------------------------------
  router.post("/:username/invite", express.json(), requireLogin, async (req, res) => {
    try {
      const team = await findTeam(prisma, req.params.username);
      if (!team) return res.status(404).json({ error: "Team not found" });
      if (team.teamProfile?.archivedAt) {
        return res.status(409).json({ error: "That team is archived." });
      }

      const inviter = req.currentUser;
      const isAdmin = inviter.role === "ADMIN";

      if (!isAdmin) {
        const own = await membershipOf(prisma, team.id, inviter.id);
        if (own?.state !== "ACTIVE") {
          return res
            .status(403)
            .json({ error: "Only members of this team can invite people." });
        }

        const since = new Date(Date.now() - 86400_000);
        const recent = await prisma.teamEvent.count({
          where: { actorId: inviter.id, action: "invited", createdAt: { gte: since } },
        });
        if (recent >= INVITE_LIMIT_PER_DAY) {
          return res
            .status(429)
            .json({ error: "You have sent too many invitations today." });
        }
      }

      const name = String(req.body?.username || "").trim().replace(/^@/, "");
      if (!name) return res.status(400).json({ error: "Who should be invited?" });

      const target = await findUserByNameInsensitive(prisma, name);
      if (!target || target.role === "TEAM" || target.role === "BOT") {
        return res.status(404).json({
          error: `No Kudos user called '${name}'. They need to log in once with their openSUSE account before they can be invited.`,
        });
      }

      const existing = await membershipOf(prisma, team.id, target.id);

      if (existing?.state === "ACTIVE") {
        return res.status(409).json({ error: `${target.username} is already a member.` });
      }
      // Not re-sent: a second click should not be a second email.
      if (hasOpenInvite(existing)) {
        return res.json({ state: existing.state, alreadyInvited: true });
      }

      // They already asked to join, so the invite is just an approval.
      if (existing?.state === "PENDING") {
        await prisma.teamMember.update({
          where: { id: existing.id },
          data: { state: "ACTIVE", approvedAt: new Date(), approvedById: inviter.id },
        });
        await prisma.teamEvent.create({
          data: { teamUserId: team.id, actorId: inviter.id, targetId: target.id, action: "approved" },
        });
        await prisma.notification.create({
          data: {
            userId: target.id,
            type: "team_join_approved",
            message: `You are now a member of ${team.username}`,
            link: teamPagePath(team),
          },
        });
        return res.json({ state: "ACTIVE", approvedRequest: true });
      }

      // A former member stays EMERITUS until they answer; see hasOpenInvite().
      if (existing) {
        await prisma.teamMember.update({
          where: { id: existing.id },
          data: { invitedById: inviter.id },
        });
      } else {
        await prisma.teamMember.create({
          data: {
            teamUserId: team.id,
            userId: target.id,
            state: "INVITED",
            invitedById: inviter.id,
          },
        });
      }

      await prisma.teamEvent.create({
        data: { teamUserId: team.id, actorId: inviter.id, targetId: target.id, action: "invited" },
      });

      await prisma.notification.create({
        data: {
          userId: target.id,
          type: "team_invite",
          message: `${inviter.username} invited you to join ${team.username}`,
          link: teamActionPath(team),
        },
      });

      // Emailed by kudos-notify, like join requests. Usernames only: the
      // stream is public.
      eventBus.emit("activity", {
        type: "team_invite",
        actorId: inviter.id,
        targetUserId: target.id,
        payload: {
          team: team.username,
          teamDisplayName: team.fullName || team.username,
          inviter: inviter.username,
          inviterDisplayName: inviter.fullName || inviter.username,
          invitee: target.username,
          // Lands on /teams, where the invitation sits at the top.
          acceptUrl: `${getBaseUrl()}/teams?team=${encodeURIComponent(team.username)}`,
          teamUrl: `${getBaseUrl()}/user/${encodeURIComponent(team.username)}`,
        },
      });

      res.status(201).json({ state: "INVITED", username: target.username });
    } catch (err) {
      console.error("💥 Failed to invite to team:", err);
      res.status(500).json({ error: "Failed to send invitation" });
    }
  });

  // ---------------------------------------------------------------
  // POST /api/teams/:username/members/:member/approve
  // Any active member may approve — membership is local to the team.
  // ---------------------------------------------------------------
  router.post("/:username/members/:member/approve", requireLogin, async (req, res) => {
    try {
      const team = await findTeam(prisma, req.params.username);
      if (!team) return res.status(404).json({ error: "Team not found" });

      const approver = await membershipOf(prisma, team.id, req.currentUser.id);
      if (approver?.state !== "ACTIVE") {
        return res
          .status(403)
          .json({ error: "Only members of this team can approve requests." });
      }

      const target = await prisma.user.findUnique({
        where: { username: req.params.member },
      });
      if (!target) return res.status(404).json({ error: "User not found" });

      const membership = await membershipOf(prisma, team.id, target.id);
      if (!membership) {
        return res.status(404).json({ error: "No pending request" });
      }
      if (membership.state === "ACTIVE") {
        return res.json({ state: "ACTIVE" });
      }
      // An invite is waiting on the invitee, not on the team.
      if (membership.state === "INVITED") {
        return res
          .status(409)
          .json({ error: "They were invited and have not accepted yet." });
      }

      await prisma.teamMember.update({
        where: { id: membership.id },
        data: {
          state: "ACTIVE",
          approvedAt: new Date(),
          approvedById: req.currentUser.id,
        },
      });

      await prisma.teamEvent.create({
        data: {
          teamUserId: team.id,
          actorId: req.currentUser.id,
          targetId: target.id,
          action: "approved",
        },
      });

      await prisma.notification.create({
        data: {
          userId: target.id,
          type: "team_join_approved",
          message: `You are now a member of ${team.username}`,
          link: teamPagePath(team),
        },
      });

      res.json({ state: "ACTIVE" });
    } catch (err) {
      console.error("💥 Failed to approve team member:", err);
      res.status(500).json({ error: "Failed to approve member" });
    }
  });

  // ---------------------------------------------------------------
  // DELETE /api/teams/:username/members/:member
  // Leaving is unilateral; removing someone else is logged and notified.
  // ---------------------------------------------------------------
  router.delete("/:username/members/:member", requireLogin, async (req, res) => {
    try {
      const team = await findTeam(prisma, req.params.username);
      if (!team) return res.status(404).json({ error: "Team not found" });

      const target = await prisma.user.findUnique({
        where: { username: req.params.member },
      });
      if (!target) return res.status(404).json({ error: "User not found" });

      const isSelf = target.id === req.currentUser.id;
      if (!isSelf) {
        const actor = await membershipOf(prisma, team.id, req.currentUser.id);
        if (actor?.state !== "ACTIVE") {
          return res
            .status(403)
            .json({ error: "Only members of this team can remove members." });
        }
      }

      const membership = await membershipOf(prisma, team.id, target.id);
      if (!membership) return res.status(404).json({ error: "Not a member" });
      // Declining an invite, or a member withdrawing one. Nobody was put on
      // the roster, so this just undoes the invite: a former member invited
      // back stays a former member, anyone else goes away. No notification —
      // the invitee has nothing to be told, and a decline is not a rebuff
      // worth announcing to the inviter.
      if (hasOpenInvite(membership)) {
        if (membership.state === "EMERITUS") {
          await prisma.teamMember.update({
            where: { id: membership.id },
            data: { invitedById: null },
          });
        } else {
          await prisma.teamMember.delete({ where: { id: membership.id } });
        }
        await prisma.teamEvent.create({
          data: {
            teamUserId: team.id,
            actorId: req.currentUser.id,
            targetId: target.id,
            action: isSelf ? "invite_declined" : "invite_withdrawn",
          },
        });
        return res.json({ success: true, state: membership.state === "EMERITUS" ? "EMERITUS" : null });
      }

      if (membership.state === "EMERITUS") {
        return res.json({ success: true, state: "EMERITUS" });
      }

      // Leaving is a life event and worth keeping: the row becomes EMERITUS and
      // the person is listed as an alumnus. Being removed by somebody else is
      // usually a correction, so that row goes away entirely. A request that was
      // never approved is not an alumnus either.
      const keepAsAlumnus = isSelf && membership.state === "ACTIVE";

      if (keepAsAlumnus) {
        await prisma.teamMember.update({
          where: { id: membership.id },
          data: { state: "EMERITUS", leftAt: new Date() },
        });
      } else {
        await prisma.teamMember.delete({ where: { id: membership.id } });
      }

      await prisma.teamEvent.create({
        data: {
          teamUserId: team.id,
          actorId: req.currentUser.id,
          targetId: target.id,
          action: isSelf ? "left" : "removed",
        },
      });

      if (!isSelf) {
        await prisma.notification.create({
          data: {
            userId: target.id,
            type: "team_removed",
            message: `${req.currentUser.username} removed you from ${team.username}`,
            link: teamPagePath(team),
          },
        });
      }

      res.json({ success: true, state: keepAsAlumnus ? "EMERITUS" : null });
    } catch (err) {
      console.error("💥 Failed to remove team member:", err);
      res.status(500).json({ error: "Failed to remove member" });
    }
  });

  // ---------------------------------------------------------------
  // PUT /api/teams/:username/badge — bind or unbind the team's membership badge
  //
  // Admin only, unlike everything else here. Binding reaches into other
  // people's memberships: a bound badge adds every holder to the roster, so a
  // member-level bind would let anyone claim the Heroes by pointing the `hero`
  // badge at a team they invented. Members see the TBD slot and ask.
  // ---------------------------------------------------------------
  router.put("/:username/badge", express.json(), requireLogin, async (req, res) => {
    try {
      if (req.currentUser.role !== "ADMIN") {
        return res.status(403).json({ error: "Admin privileges required" });
      }

      const team = await findTeam(prisma, req.params.username);
      if (!team) return res.status(404).json({ error: "Team not found" });

      const slug = String(req.body?.badgeSlug || "").trim();

      // Empty slug unbinds. Existing members keep their membership and their
      // badge — unbinding only stops future grants feeding the roster.
      if (!slug) {
        await prisma.badge.updateMany({
          where: { teamUserId: team.id },
          data: { teamUserId: null },
        });
        await prisma.teamEvent.create({
          data: {
            teamUserId: team.id,
            actorId: req.currentUser.id,
            action: "badge_unbound",
          },
        });
        return res.json({ badge: null });
      }

      const badge = await prisma.badge.findUnique({ where: { slug } });
      if (!badge) return res.status(404).json({ error: "Badge not found" });

      if (badge.teamUserId && badge.teamUserId !== team.id) {
        return res
          .status(409)
          .json({ error: "That badge is already bound to another team." });
      }

      await prisma.$transaction([
        // One membership badge per team; rebinding replaces whatever was there.
        prisma.badge.updateMany({
          where: { teamUserId: team.id, NOT: { id: badge.id } },
          data: { teamUserId: null },
        }),
        prisma.badge.update({
          where: { id: badge.id },
          data: { teamUserId: team.id },
        }),
        prisma.teamEvent.create({
          data: {
            teamUserId: team.id,
            actorId: req.currentUser.id,
            action: "badge_bound",
          },
        }),
      ]);

      // Binding only feeds *future* grants into the roster, so a team that
      // adopts a badge people already hold starts out empty and wrong. Opting
      // in backfills them. Not automatic: a long-lived badge like `hero`
      // accumulates holders across years who were never one working group, and
      // there is no undoing a 200-person roster.
      let added = 0;
      if (req.body?.addHolders) {
        const holders = await prisma.userBadge.findMany({
          where: { badgeId: badge.id, user: { role: { notIn: ["TEAM", "BOT"] } } },
          select: { userId: true },
        });
        const holderIds = holders.map((h) => h.userId);

        // Anyone already on the roster keeps the state they have — an EMERITUS
        // holder left on purpose and must not be dragged back in.
        const known = await prisma.teamMember.findMany({
          where: { teamUserId: team.id, userId: { in: holderIds } },
          select: { userId: true },
        });
        const knownIds = new Set(known.map((m) => m.userId));
        const fresh = holderIds.filter((id) => !knownIds.has(id));

        if (fresh.length) {
          await prisma.teamMember.createMany({
            data: fresh.map((userId) => ({
              teamUserId: team.id,
              userId,
              state: "ACTIVE",
              approvedAt: new Date(),
              approvedById: req.currentUser.id,
            })),
          });
        }
        added = fresh.length;

        await prisma.teamEvent.create({
          data: {
            teamUserId: team.id,
            actorId: req.currentUser.id,
            action: "badge_holders_imported",
          },
        });
      }

      // The other direction: everyone already on the team gets the badge, so
      // the roster and the holder list start out matching. Runs after the
      // holder import, which only adds people who hold it already.
      const granted = await grantBadgeToTeamMembers(prisma, { teamUserId: team.id, badge });
      if (granted) {
        await prisma.teamEvent.create({
          data: {
            teamUserId: team.id,
            actorId: req.currentUser.id,
            action: "badge_granted_to_members",
          },
        });
      }

      res.json({ badge: publicBadge(badge), holdersAdded: added, badgesGranted: granted });
    } catch (err) {
      console.error("💥 Failed to bind team badge:", err);
      res.status(500).json({ error: "Failed to bind badge" });
    }
  });

  app.use("/api/teams", router);
}
