// Copyright © 2025–present Lubos Kocman and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0

import express from "express";
import crypto from "crypto";
import { eventBus } from "./now.js"; // optional — used to broadcast admin changes

export function mountAdminRoutes(app, prisma) {
  const router = express.Router();

  // 🧩 Middleware: check if user is admin or bot
  router.use(async (req, res, next) => {
    const user = req.currentUser;
    if (!user || (user.role !== "ADMIN" && user.role !== "BOT")) {
      return res.status(403).json({ error: "Admin or bot privileges required" });
    }
    next();
  });

  // 🧩 Middleware: check if user is admin
  const isAdmin = (req, res, next) => {
    const user = req.currentUser;
    if (!user || user.role !== "ADMIN") {
      return res.status(403).json({ error: "Admin privileges required" });
    }
    next();
  };


  // ==========================================================
  // 📋 GET /api/admin/overview — quick stats for dashboard
  // ==========================================================
  router.get("/overview", async (req, res) => {
    try {
      const [users, kudos, badges] = await Promise.all([
        prisma.user.count(),
        prisma.kudos.count(),
        prisma.badge.count(),
      ])
      res.json({ users, kudos, badges })
    } catch (err) {
      console.error("💥 Admin overview failed:", err)
      res.status(500).json({ error: "Failed to load admin overview" })
    }
  })

  // ==========================================================
  // 🏅 GET /api/admin/badges — list all badges
  // ==========================================================
  router.get("/badges", async (req, res) => {
    try {
      // `holders` drives the Badges tab's delete-vs-drop choice and the team
      // membership badge picker, both of which read 0 without it.
      const badges = await prisma.badge.findMany({
        orderBy: { title: "asc" },
        include: { _count: { select: { userAwards: true } } },
      })
      res.json(
        badges.map(({ _count, ...badge }) => ({
          ...badge,
          holders: _count.userAwards,
        }))
      )
    } catch (err) {
      console.error("💥 Failed to load badges:", err)
      res.status(500).json({ error: "Failed to load badges" })
    }
  })

  // ==========================================================
  // ➕ POST /api/admin/badges — create new badge
  // ==========================================================
  router.post("/badges", async (req, res) => {
    try {
      const { slug, title, description, color, picture, link } = req.body
      if (!slug || !title)
        return res.status(400).json({ error: "Missing slug or title" })

      const badge = await prisma.badge.create({
        data: { slug, title, description, color, picture, link },
      })

      eventBus?.emit("update", { type: "badge", data: badge })
      res.status(201).json(badge)
    } catch (err) {
      console.error("💥 Failed to create badge:", err)
      res.status(500).json({ error: "Failed to create badge" })
    }
  })

  // ==========================================================
  // ✏️ PATCH /api/admin/badges/:slug — update badge fields
  // ==========================================================
  router.patch("/badges/:slug", isAdmin, async (req, res) => {
    try {
      const { slug } = req.params
      const { description } = req.body

      if (typeof description !== "string") {
        return res.status(400).json({ error: "Description must be a string" })
      }

      const badge = await prisma.badge.update({
        where: { slug },
        data: { description: description.trim() },
      })

      eventBus?.emit("update", { type: "badge", data: badge })
      res.json(badge)
    } catch (err) {
      console.error("💥 Failed to update badge:", err)
      if (err.code === "P2025") {
        return res.status(404).json({ error: "Badge not found" })
      }
      res.status(500).json({ error: "Failed to update badge" })
    }
  })

  // ==========================================================
  // 🪄 POST /api/admin/badges/grant — grant badge to user
  // ==========================================================
  router.post("/badges/grant", async (req, res) => {
    try {
      const { username, badgeSlug } = req.body
      const actor = req.currentUser

      if (!username || !badgeSlug)
        return res
          .status(400)
          .json({ error: "Missing username or badgeSlug" })

      // find both user and badge
      const [user, badge] = await Promise.all([
        prisma.user.findUnique({ where: { username } }),
        prisma.badge.findUnique({ where: { slug: badgeSlug } }),
      ])

      if (!user || !badge)
        return res.status(404).json({ error: "User or badge not found" })

      // check existing ownership
      const existing = await prisma.userBadge.findFirst({
        where: { userId: user.id, badgeId: badge.id },
      })

      if (existing)
        return res.status(200).json({ message: "Badge already granted" })

      // create new link
      const granted = await prisma.userBadge.create({
        data: {
          userId: user.id,
          badgeId: badge.id,
          grantedBy: actor?.username || "system",
        },
      })

      console.log(
        `🏅 ${actor.username} granted badge '${badgeSlug}' to ${username}`
      )

      eventBus?.emit("update", {
        type: "badge-grant",
        data: { username, badgeSlug, grantedBy: actor.username },
      })

      res.json({
        message: `Badge '${badgeSlug}' granted to ${username}`,
        granted,
      })
    } catch (err) {
      console.error("💥 Failed to grant badge:", err)
      res.status(500).json({ error: "Failed to grant badge" })
    }
  })

  // ==========================================================
  // ❌ DELETE /api/admin/badges/:slug — delete badge
  // ==========================================================
  router.delete("/badges/:slug", async (req, res) => {
    try {
      const { slug } = req.params

      // prevent deletion if badge is assigned to users
      const inUse = await prisma.userBadge.count({
        where: { badge: { slug } },
      })
      if (inUse > 0)
        return res.status(400).json({
          error: `Cannot delete — badge '${slug}' is assigned to ${inUse} user(s).`,
        })

      await prisma.badge.delete({ where: { slug } })
      res.json({ message: `Badge '${slug}' deleted.` })
    } catch (err) {
      console.error("💥 Failed to delete badge:", err)
      res.status(500).json({ error: "Failed to delete badge" })
    }
  })

  // ==========================================================
  // 🧹 POST /api/admin/reset-db — reset the entire database
  // ==========================================================
  router.post("/reset-db", async (req, res) => {
    try {
      await prisma.kudosRecipient.deleteMany()
      await prisma.kudos.deleteMany()
      await prisma.userBadge.deleteMany()
      await prisma.badge.deleteMany()
      await prisma.kudosCategory.deleteMany()
      res.json({ message: "Database cleared." })
    } catch (err) {
      console.error("💥 Failed to reset database:", err)
      res.status(500).json({ error: "Database reset failed" })
    }
  })

  // ==========================================================
  // 🔄 POST /api/admin/sync-badges — re-import from seed.js
  // ==========================================================
  router.post("/sync-badges", async (req, res) => {
    try {
      const seed = await import("../../prisma/seed.js")
      await seed.main?.()
      res.json({ message: "Badges re-synced successfully." })
    } catch (err) {
      console.error("💥 Failed to sync badges:", err)
      res.status(500).json({ error: "Failed to sync badges" })
    }
  })

  // ==========================================================
  // ➕ POST /api/admin/users — create new user
  // ==========================================================
  router.post("/users", isAdmin, async (req, res) => {
    try {
      const { username, email, role } = req.body;
      if (!username || !role) {
        return res.status(400).json({ error: "Missing username or role" });
      }

      const data = {
        username,
        email,
        role,
      };

      if (role === "BOT") {
        data.botSecret = crypto.randomBytes(32).toString("hex");
      }

      const user = await prisma.user.create({ data });

      res.status(201).json(user);
    } catch (err) {
      console.error("💥 Failed to create user:", err);
      if (err.code === 'P2002') {
        return res.status(409).json({ error: "Username already exists" });
      }
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  // ==========================================================
  // ❌ DELETE /api/admin/users/:username — delete user
  // ==========================================================
  router.delete("/users/:username", isAdmin, async (req, res) => {
    try {
      const { username } = req.params;

      const user = await prisma.user.findUnique({ where: { username } });
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Find all kudos sent by the user
      const kudosSent = await prisma.kudos.findMany({
        where: { fromUser: { username } },
        select: { id: true },
      });
      const kudosSentIds = kudosSent.map((k) => k.id);

      // Delete all KudosRecipient records associated with those kudos
      if (kudosSentIds.length > 0) {
        await prisma.kudosRecipient.deleteMany({
          where: { kudosId: { in: kudosSentIds } },
        });
      }

      // Delete all kudos sent by the user
      await prisma.kudos.deleteMany({ where: { fromUser: { username } } });

      // Delete all kudos received by the user
      await prisma.kudosRecipient.deleteMany({ where: { user: { username } } });

      // Delete all badges the user has
      await prisma.userBadge.deleteMany({ where: { user: { username } } });

      // Delete all follow relationships
      await prisma.follow.deleteMany({ where: { follower: { username } } });
      await prisma.follow.deleteMany({ where: { following: { username } } });

      // Finally, delete the user
      await prisma.user.delete({ where: { username } });

      res.json({ message: `User '${username}' deleted.` });
    } catch (err) {
      console.error("💥 Failed to delete user:", err);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // ==========================================================
  // 🎭 PUT /api/admin/users/:username/role — update user role
  // ==========================================================
  router.put("/users/:username/role", isAdmin, async (req, res) => {
    try {
      const { username } = req.params;
      const { role } = req.body;

      if (!role) {
        return res.status(400).json({ error: "Missing role" });
      }

      const user = await prisma.user.update({
        where: { username },
        data: { role },
      });

      res.json({ message: `User '${username}' role updated to ${role}.`, user });
    } catch (err) {
      console.error("💥 Failed to update user role:", err);
      res.status(500).json({ error: "Failed to update user role" });
    }
  });

  // ==========================================================
  // �️ PATCH /api/admin/bots/:username/can-create-users — toggle user creation privilege
  // ==========================================================
  router.patch("/bots/:username/can-create-users", isAdmin, async (req, res) => {
    try {
      const { username } = req.params;
      const { canCreateUsers } = req.body;

      if (typeof canCreateUsers !== "boolean") {
        return res.status(400).json({ error: "canCreateUsers must be a boolean" });
      }

      const user = await prisma.user.findUnique({ where: { username } });
      if (!user || user.role !== "BOT") {
        return res.status(404).json({ error: "Bot not found" });
      }

      const updated = await prisma.user.update({
        where: { username },
        data: { canCreateUsers },
      });

      console.log(`🛡️ Admin ${req.currentUser.username} set canCreateUsers=${canCreateUsers} for bot '${username}'`);
      res.json({ username, canCreateUsers: updated.canCreateUsers });
    } catch (err) {
      console.error("💥 Failed to update canCreateUsers:", err);
      res.status(500).json({ error: "Failed to update privilege" });
    }
  });

  // ==========================================================
  // �🔐 GET /api/admin/bots/:username/secret — get bot secret
  // ==========================================================
  router.get("/bots/:username/secret", isAdmin, async (req, res) => {
    try {
      const { username } = req.params;
      const user = await prisma.user.findUnique({ where: { username } });

      if (!user || user.role !== "BOT") {
        return res.status(404).json({ error: "Bot not found" });
      }

      res.json({ secret: user.botSecret });
    } catch (err) {
      console.error(`💥 Failed to get bot secret for ${req.params.username}:`, err);
      res.status(500).json({ error: "Failed to get bot secret" });
    }
  });

  // ==========================================================
  // ♻️ POST /api/admin/bots/:username/secret/rotate — rotate bot secret
  // ==========================================================
  router.post("/bots/:username/secret/rotate", isAdmin, async (req, res) => {
    try {
      const { username } = req.params;
      const newSecret = crypto.randomBytes(32).toString("hex");

      const user = await prisma.user.update({
        where: { username },
        data: { botSecret: newSecret },
      });

      if (!user || user.role !== "BOT") {
        return res.status(404).json({ error: "Bot not found" });
      }

      res.json({ secret: newSecret });
    } catch (err) {
      console.error(`💥 Failed to rotate bot secret for ${req.params.username}:`, err);
      res.status(500).json({ error: "Failed to rotate bot secret" });
    }
  });

  // ==========================================================
  // ✨ POST /api/admin/bots/:username/secret/generate — generate bot secret
  // ==========================================================
  router.post("/bots/:username/secret/generate", isAdmin, async (req, res) => {
    try {
      const { username } = req.params;
      const newSecret = crypto.randomBytes(32).toString("hex");

      const user = await prisma.user.update({
        where: { username },
        data: { botSecret: newSecret },
      });

      if (!user || user.role !== "BOT") {
        return res.status(404).json({ error: "Bot not found" });
      }

      res.json({ secret: newSecret });
    } catch (err) {
      console.error(`💥 Failed to generate bot secret for ${req.params.username}:`, err);
      res.status(500).json({ error: "Failed to generate bot secret" });
    }
  });

  // ==========================================================
  // 👥 Teams
  //
  // Teams run themselves — any active member approves, removes and leaves via
  // /api/teams. These routes are the backstop for what a team cannot fix from
  // the inside: a fake or duplicate team, and a roster nobody is left to edit
  // because everyone walked away. See docs/teams.md.
  // ==========================================================

  // Resolve a team by username, or answer 404. A team is a User with role TEAM,
  // so a plain user of the same name must not be reachable through here.
  async function findTeamOr404(res, username) {
    const team = await prisma.user.findFirst({
      where: { username, role: "TEAM" },
      include: { teamProfile: true },
    });
    if (!team) {
      res.status(404).json({ error: "Team not found" });
      return null;
    }
    return team;
  }

  // ==========================================================
  // 📋 GET /api/admin/teams — every team, archived ones included
  // ==========================================================
  router.get("/teams", isAdmin, async (req, res) => {
    try {
      const teams = await prisma.user.findMany({
        where: { role: "TEAM" },
        include: { teamProfile: true },
        orderBy: { username: "asc" },
      });
      const teamIds = teams.map((t) => t.id);

      const [memberCounts, kudosCounts, badges, creators] = await Promise.all([
        prisma.teamMember.groupBy({
          by: ["teamUserId", "state"],
          where: { teamUserId: { in: teamIds } },
          _count: { _all: true },
        }),
        prisma.kudosRecipient.groupBy({
          by: ["userId"],
          where: { userId: { in: teamIds } },
          _count: { _all: true },
        }),
        prisma.badge.findMany({
          where: { teamUserId: { in: teamIds } },
          select: { slug: true, title: true, picture: true, teamUserId: true },
        }),
        prisma.user.findMany({
          where: {
            id: { in: teams.map((t) => t.teamProfile?.createdById).filter(Boolean) },
          },
          select: { id: true, username: true },
        }),
      ]);

      const countFor = (teamId, state) =>
        memberCounts.find((c) => c.teamUserId === teamId && c.state === state)
          ?._count._all || 0;

      const kudosByTeam = new Map(kudosCounts.map((k) => [k.userId, k._count._all]));
      const badgeByTeam = new Map(badges.map((b) => [b.teamUserId, b]));
      const creatorById = new Map(creators.map((u) => [u.id, u.username]));

      res.json(
        teams.map((t) => ({
          username: t.username,
          displayName: t.fullName || t.username,
          description: t.teamProfile?.description || null,
          listEmail: t.teamProfile?.listEmail || null,
          homepage: t.teamProfile?.homepage || null,
          chatUrl: t.teamProfile?.chatUrl || null,
          createdAt: t.createdAt,
          createdBy: creatorById.get(t.teamProfile?.createdById) || null,
          archivedAt: t.teamProfile?.archivedAt || null,
          activeCount: countFor(t.id, "ACTIVE"),
          pendingCount: countFor(t.id, "PENDING"),
          emeritusCount: countFor(t.id, "EMERITUS"),
          invitedCount: countFor(t.id, "INVITED"),
          kudosReceived: kudosByTeam.get(t.id) || 0,
          badge: badgeByTeam.get(t.id) || null,
        }))
      );
    } catch (err) {
      console.error("💥 Failed to list teams:", err);
      res.status(500).json({ error: "Failed to list teams" });
    }
  });

  // ==========================================================
  // 🔍 GET /api/admin/teams/:username — full roster + audit trail
  //
  // Unlike the public team page this shows every state at once, including the
  // pending requests an outsider never sees, and the TeamEvent log — which is
  // what tells a spam team apart from a quiet real one.
  // ==========================================================
  router.get("/teams/:username", isAdmin, async (req, res) => {
    try {
      const team = await findTeamOr404(res, req.params.username);
      if (!team) return;

      const [roster, events, badge] = await Promise.all([
        prisma.teamMember.findMany({
          where: { teamUserId: team.id },
          include: { user: { select: { username: true, fullName: true, role: true } } },
          orderBy: [{ state: "asc" }, { requestedAt: "asc" }],
        }),
        prisma.teamEvent.findMany({
          where: { teamUserId: team.id },
          orderBy: { createdAt: "desc" },
          take: 30,
        }),
        prisma.badge.findFirst({
          where: { teamUserId: team.id },
          select: { slug: true, title: true, picture: true },
        }),
      ]);

      const actorIds = [
        ...new Set(events.flatMap((e) => [e.actorId, e.targetId]).filter(Boolean)),
      ];
      const people = await prisma.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, username: true },
      });
      const nameById = new Map(people.map((u) => [u.id, u.username]));

      res.json({
        username: team.username,
        displayName: team.fullName || team.username,
        description: team.teamProfile?.description || null,
        listEmail: team.teamProfile?.listEmail || null,
        archivedAt: team.teamProfile?.archivedAt || null,
        badge,
        members: roster.map((m) => ({
          username: m.user.username,
          displayName: m.user.fullName || m.user.username,
          state: m.state,
          requestedAt: m.requestedAt,
          approvedAt: m.approvedAt,
          leftAt: m.leftAt,
        })),
        events: events.map((e) => ({
          action: e.action,
          actor: nameById.get(e.actorId) || null,
          target: e.targetId ? nameById.get(e.targetId) || null : null,
          createdAt: e.createdAt,
        })),
      });
    } catch (err) {
      console.error("💥 Failed to load team:", err);
      res.status(500).json({ error: "Failed to load team" });
    }
  });

  // ==========================================================
  // 📦 PATCH /api/admin/teams/:username — archive or restore
  //
  // Archiving hides a team from the directory and blocks new joins while
  // keeping its kudos and roster intact. The right answer for a team that has
  // simply run out of members; deletion is for teams that should never have
  // existed.
  // ==========================================================
  router.patch("/teams/:username", isAdmin, async (req, res) => {
    try {
      const { archived } = req.body;
      if (typeof archived !== "boolean") {
        return res.status(400).json({ error: "archived must be a boolean" });
      }

      const team = await findTeamOr404(res, req.params.username);
      if (!team) return;

      const profile = await prisma.teamProfile.update({
        where: { teamUserId: team.id },
        data: { archivedAt: archived ? new Date() : null },
      });

      await prisma.teamEvent.create({
        data: {
          teamUserId: team.id,
          actorId: req.currentUser.id,
          action: archived ? "archived" : "unarchived",
        },
      });

      console.log(
        `📦 Admin ${req.currentUser.username} ${archived ? "archived" : "restored"} team '${team.username}'`
      );
      res.json({ username: team.username, archivedAt: profile.archivedAt });
    } catch (err) {
      console.error("💥 Failed to archive team:", err);
      res.status(500).json({ error: "Failed to update team" });
    }
  });

  // ==========================================================
  // 🗑️ DELETE /api/admin/teams/:username — erase a team for good
  //
  // Refuses while the team holds kudos unless ?force=1, mirroring the badge
  // delete guard: praise addressed to a team is somebody's words, and a
  // duplicate is usually better archived than erased.
  // ==========================================================
  router.delete("/teams/:username", isAdmin, async (req, res) => {
    try {
      const team = await findTeamOr404(res, req.params.username);
      if (!team) return;

      const force = req.query.force === "1" || req.query.force === "true";
      const received = await prisma.kudosRecipient.findMany({
        where: { userId: team.id },
        select: { kudosId: true },
      });

      if (received.length && !force) {
        return res.status(409).json({
          error: `Team '${team.username}' has received ${received.length} kudo(s). Archive it, or repeat with force to delete them too.`,
          kudosReceived: received.length,
        });
      }

      // Kudos the team was addressed in. A kudo left with no recipients cannot
      // be rendered by the feed, so it goes too — but only when the team was
      // the last one named.
      const sent = await prisma.kudos.findMany({
        where: { fromUserId: team.id },
        select: { id: true },
      });
      const sentIds = sent.map((k) => k.id);

      await prisma.kudosRecipient.deleteMany({
        where: { OR: [{ userId: team.id }, { kudosId: { in: sentIds } }] },
      });
      await prisma.kudos.deleteMany({ where: { id: { in: sentIds } } });

      const orphaned = await prisma.kudos.findMany({
        where: { id: { in: received.map((r) => r.kudosId) }, recipients: { none: {} } },
        select: { id: true },
      });
      await prisma.kudos.deleteMany({
        where: { id: { in: orphaned.map((k) => k.id) } },
      });

      // A bound badge stays a badge — it just stops belonging to anyone.
      await prisma.badge.updateMany({
        where: { teamUserId: team.id },
        data: { teamUserId: null },
      });

      await prisma.userBadge.deleteMany({ where: { userId: team.id } });
      await prisma.follow.deleteMany({ where: { followerId: team.id } });
      await prisma.follow.deleteMany({ where: { followingId: team.id } });
      // TeamEvent has no foreign key to hang a cascade on, so it is cleared here.
      await prisma.teamEvent.deleteMany({ where: { teamUserId: team.id } });

      // TeamProfile and TeamMember cascade from the User row.
      await prisma.user.delete({ where: { id: team.id } });

      console.log(
        `🗑️ Admin ${req.currentUser.username} deleted team '${team.username}'`
      );
      res.json({
        message: `Team '${team.username}' deleted.`,
        kudosDeleted: sentIds.length + orphaned.length,
      });
    } catch (err) {
      console.error("💥 Failed to delete team:", err);
      res.status(500).json({ error: "Failed to delete team" });
    }
  });

  // ==========================================================
  // ➕ POST /api/admin/teams/:username/members — add someone directly
  //
  // Skips the invite's accept step, so it is for setting up an official group
  // or fixing a roster, not for the everyday case — admins can use the normal
  // invite on the team page for that. The person is notified, and the
  // TeamEvent log records who added them, which is the undo trail.
  // ==========================================================
  router.post("/teams/:username/members", isAdmin, async (req, res) => {
    try {
      const team = await findTeamOr404(res, req.params.username);
      if (!team) return;

      const name = String(req.body?.username || "").trim().replace(/^@/, "");
      const target = name
        ? await prisma.user.findUnique({ where: { username: name } })
        : null;
      if (!target || target.role === "TEAM" || target.role === "BOT") {
        return res.status(404).json({ error: `No user called '${name}'.` });
      }

      const membership = await prisma.teamMember.findUnique({
        where: { teamUserId_userId: { teamUserId: team.id, userId: target.id } },
      });
      if (membership?.state === "ACTIVE") {
        return res.status(409).json({ error: `'${target.username}' is already a member.` });
      }

      const data = {
        state: "ACTIVE",
        approvedAt: new Date(),
        approvedById: req.currentUser.id,
        invitedById: null,
        leftAt: null,
      };
      if (membership) {
        await prisma.teamMember.update({ where: { id: membership.id }, data });
      } else {
        await prisma.teamMember.create({
          data: { ...data, teamUserId: team.id, userId: target.id },
        });
      }

      await prisma.teamEvent.create({
        data: {
          teamUserId: team.id,
          actorId: req.currentUser.id,
          targetId: target.id,
          action: "added",
        },
      });

      await prisma.notification.create({
        data: {
          userId: target.id,
          type: "team_added",
          message: `An admin added you to ${team.username}`,
        },
      });

      console.log(
        `➕ Admin ${req.currentUser.username} added '${target.username}' to team '${team.username}'`
      );
      res.status(201).json({ message: `'${target.username}' added to '${team.username}'.` });
    } catch (err) {
      console.error("💥 Failed to add team member:", err);
      res.status(500).json({ error: "Failed to add member" });
    }
  });

  // ==========================================================
  // 👤 DELETE /api/admin/teams/:username/members/:member
  //
  // Same semantics as a member removing a member: the row goes away rather
  // than becoming EMERITUS, because an admin removal is a correction and
  // listing the person as an alumnus would put words in their mouth.
  // ==========================================================
  router.delete("/teams/:username/members/:member", isAdmin, async (req, res) => {
    try {
      const team = await findTeamOr404(res, req.params.username);
      if (!team) return;

      const target = await prisma.user.findUnique({
        where: { username: req.params.member },
      });
      if (!target) return res.status(404).json({ error: "User not found" });

      const membership = await prisma.teamMember.findUnique({
        where: { teamUserId_userId: { teamUserId: team.id, userId: target.id } },
      });
      if (!membership) return res.status(404).json({ error: "Not a member" });

      await prisma.teamMember.delete({ where: { id: membership.id } });

      await prisma.teamEvent.create({
        data: {
          teamUserId: team.id,
          actorId: req.currentUser.id,
          targetId: target.id,
          action: "removed",
        },
      });

      // Silent for a request or invite that never became membership — being
      // told you were removed from a team you never got into is only confusing.
      if (membership.state !== "PENDING" && membership.state !== "INVITED") {
        await prisma.notification.create({
          data: {
            userId: target.id,
            type: "team_removed",
            message: `An admin removed you from ${team.username}`,
          },
        });
      }

      console.log(
        `👤 Admin ${req.currentUser.username} removed '${target.username}' from team '${team.username}'`
      );
      res.json({ message: `'${target.username}' removed from '${team.username}'.` });
    } catch (err) {
      console.error("💥 Failed to remove team member:", err);
      res.status(500).json({ error: "Failed to remove member" });
    }
  });

  // ==========================================================
  // 🧭 Default route info
  // ==========================================================
  router.get("/", (req, res) => {
    res.json({
      message: "🧭 Admin API ready — available endpoints:",
      endpoints: [
        "GET    /api/admin/overview",
        "GET    /api/admin/badges",
        "POST   /api/admin/badges",
        "PATCH  /api/admin/badges/:slug",
        "POST   /api/admin/badges/grant",
        "DELETE /api/admin/badges/:slug",
        "POST   /api/admin/reset-db",
        "POST   /api/admin/sync-badges",
        "DELETE /api/admin/users/:username",
        "PUT    /api/admin/users/:username/role",
        "GET    /api/admin/teams",
        "GET    /api/admin/teams/:username",
        "PATCH  /api/admin/teams/:username",
        "DELETE /api/admin/teams/:username",
        "POST   /api/admin/teams/:username/members",
        "DELETE /api/admin/teams/:username/members/:member",
        "GET    /api/admin/bots/:username/secret",
        "PATCH  /api/admin/bots/:username/can-create-users",
        "POST   /api/admin/bots/:username/secret/rotate",
        "POST   /api/admin/bots/:username/secret/generate",
      ],
    })
  })

  app.use("/api/admin", router)
}