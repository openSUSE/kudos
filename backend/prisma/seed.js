// Copyright © 2025–present Lubos Kocman and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { customAlphabet } from "nanoid";

import { isAdminUser } from "../src/utils/user.js";
import { syncKudosBadges } from "../src/services/kudosBadges.js";

const prisma = new PrismaClient();
const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 8);

async function main() {
  const defaultPassword = "opensuse";
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  console.log("🌱 Seeding local test data");

  // ────────────────────────────────────────────────
  // 🧱 Kudos Categories
  // ────────────────────────────────────────────────
  const categories = [
    { code: "CODE", label: "Code & Engineering", icon: "💻", defaultMsg: "Your code makes openSUSE stronger every day. 💪" },
    { code: "ARTWORK", label: "Artwork & Design", icon: "🎨", defaultMsg: "You bring color and creativity to our distro. 🌈" },
    { code: "TRANSLATION", label: "Translations & Localization", icon: "🌐", defaultMsg: "Thanks for helping openSUSE speak every language! 💬🌐" },
    { code: "MODERATION", label: "Community Moderation", icon: "🛡️", defaultMsg: "Your kindness keeps our community safe and welcoming. 🛡️" },
    { code: "ORGANIZING", label: "Event & Release Organizing", icon: "📅", defaultMsg: "You make openSUSE gatherings run like clockwork! 📅" },
    { code: "INFRASTRUCTURE", label: "Infrastructure Heroes", icon: "🦸", defaultMsg: "You keep the lights on and the servers purring. 🦸⚙️" },
    { code: "SUPPORT", label: "Support & User Assistance", icon: "🧑‍💻", defaultMsg: "Thank you for the help! 🧑‍💻" },
    { code: "DOCUMNETATION", label: "Documentation and Publishing", icon: "📚", defaultMsg: "Thanks for improving openSUSE docs! 📚" },
  ];

  await Promise.all(
    categories.map(cat =>
      prisma.kudosCategory.upsert({
        where: { code: cat.code },
        update: {
          label: cat.label,
          icon: cat.icon,
          defaultMsg: cat.defaultMsg,
        },
        create: cat,
      })
    )
  );
  console.log(`🌟 Seeded ${categories.length} kudos categories.`);

  // ────────────────────────────────────────────────
  // 🏅 Badges — from the kudos-badges clone in frontend/public/badges
  // ────────────────────────────────────────────────
  await syncKudosBadges(prisma);

  // Remove legacy badge that is no longer part of kudos-badges.
  const legacyTumbleweedBadge = await prisma.badge.findUnique({
    where: { slug: "tumbleweed" },
    select: { id: true },
  });

  if (legacyTumbleweedBadge) {
    const unassigned = await prisma.userBadge.deleteMany({
      where: { badgeId: legacyTumbleweedBadge.id },
    });

    await prisma.badge.delete({
      where: { id: legacyTumbleweedBadge.id },
    });

    console.log(`🧹 Removed legacy badge "tumbleweed" and unassigned ${unassigned.count} users.`);
  }

// ────────────────────────────────────────────────
// 🎖️ Assign some sample badges
// ────────────────────────────────────────────────
const hero = await prisma.badge.findUnique({ where: { slug: "hero" } });
const artwork = await prisma.badge.findUnique({ where: { slug: "artwork" } });
const nuked = await prisma.badge.findUnique({ where: { slug: "nuked" } });
const power = await prisma.badge.findUnique({ where: { slug: "power" } });
const member = await prisma.badge.findUnique({ where: { slug: "member" } });

  // ────────────────────────────────────────────────
  // 👥 Users
  // ────────────────────────────────────────────────
  console.log("👥  Please use either bob/bob or alice/alice with dev OIDC. Rest is placeholders");
  const BADGERBOT_SECRET = process.env.BADGERBOT_SECRET || "DEV_STATIC_BOT_TOKEN_123";
  const userSeeds = [
    { username: "klocman", role: isAdminUser("klocman") ? "ADMIN" : "USER", avatarUrl: "" },
    { username: "carmeleon", role: isAdminUser("carmeleon") ? "ADMIN" : "USER", avatarUrl: "" },
    { username: "heavencp", role: isAdminUser("heavencp") ? "ADMIN" : "USER", avatarUrl: "" },
    { username: "knurft", role: isAdminUser("knurft") ? "ADMIN" : "USER", avatarUrl: "" },
    { username: "brightstar", role: isAdminUser("brightstar") ? "ADMIN" : "USER", avatarUrl: "" },
    { username: "badger", role: "BOT", avatarUrl: "/avatars/badger.gif", botSecret: BADGERBOT_SECRET, canCreateUsers: true },


    // https://demo.duendesoftware.com test users for oidc
    {
      username: "BobSmith",
      role: "ADMIN",
      avatarUrl: "",
      fullName: "Bob Smith",
      givenName: "Bob",
      familyName: "Smith",
    },
    {
      username: "AliceSmith",
      role: "USER",
      avatarUrl: "",
      fullName: "Alice Smith",
      givenName: "Alice",
      familyName: "Smith",
    },
  ];

  const users = await prisma.$transaction(
    userSeeds.map(u =>
      prisma.user.upsert({
        where: { username: u.username },
        update: {
          role: u.role,
          avatarUrl: u.avatarUrl,
          ...(u.fullName ? { fullName: u.fullName } : {}),
          ...(u.givenName ? { givenName: u.givenName } : {}),
          ...(u.familyName ? { familyName: u.familyName } : {}),
          ...(u.role === "BOT" ? { botSecret: u.botSecret, canCreateUsers: u.canCreateUsers ?? false } : {}),
        },
        create: { ...u, passwordHash },
      })
    )
  );

  const userMap = Object.fromEntries(users.map(u => [u.username, u]));
  console.table(users.map(u => ({ username: u.username, id: u.id })));

  // ────────────────────────────────────────────────
  // 👥 Followers — BobSmith & AliceSmith
  // ────────────────────────────────────────────────

  const follows = [
    // BobSmith follows klocman & carmeleon
    { follower: "BobSmith", following: "klocman" },
    { follower: "BobSmith", following: "carmeleon" },

    // AliceSmith follows everyone (why not, she’s friendly 😄)
    { follower: "AliceSmith", following: "klocman" },
    { follower: "AliceSmith", following: "heavencp" },
    { follower: "AliceSmith", following: "knurft" },
    { follower: "AliceSmith", following: "carmeleon" },
  ];

  for (const f of follows) {
    const followerUser = userMap[f.follower];
    const followingUser = userMap[f.following];

    if (followerUser && followingUser) {
      await prisma.follow.upsert({
        where: {
          followerId_followingId: {
            followerId: followerUser.id,
            followingId: followingUser.id,
          },
        },
        update: {},
        create: {
          followerId: followerUser.id,
          followingId: followingUser.id,
        },
      });
    }
  }

  console.log("👥 Added follower relationships for BobSmith & AliceSmith.");

  // ────────────────────────────────────────────────
  // 🎖️ UserBadge links (assignments)
  // ────────────────────────────────────────────────
  const assign = [
    { user: "heavencp", badges: ["hero", "artwork"] },
    { user: "klocman", badges: ["nuked"] },
    { user: "brightstar", badges: ["power", "member"] },
  ];

  for (const a of assign) {
    const user = userMap[a.user];
    for (const slug of a.badges) {
      const badge = await prisma.badge.findUnique({ where: { slug } });
      if (badge && user) {
        await prisma.userBadge.upsert({
          where: {
            userId_badgeId: { userId: user.id, badgeId: badge.id },
          },
          update: {},
          create: { userId: user.id, badgeId: badge.id },
        });
      }
    }
  }

  console.log("🎖️ Assigned badges to users.");

  // ────────────────────────────────────────────────
  // 💬 Kudos examples
  // ────────────────────────────────────────────────
  const catInfra = await prisma.kudosCategory.findUnique({ where: { code: "INFRASTRUCTURE" } });
  const catArtwork = await prisma.kudosCategory.findUnique({ where: { code: "ARTWORK" } });
  const catCode = await prisma.kudosCategory.findUnique({ where: { code: "CODE" } });
  const catModeration = await prisma.kudosCategory.findUnique({ where: { code: "MODERATION" } });
  const catSupport = await prisma.kudosCategory.findUnique({ where: { code: "SUPPORT" } });

  const kudosData = [
    {
      fromUserId: userMap.klocman.id,
      categoryId: catCode.id,
      message: "Thanks for helping me debug Leap installer issues.",
      recipients: { create: [{ userId: userMap.carmeleon.id }] },
      picture: catCode.icon,
      slug: nanoid(),
    },
    {
      fromUserId: userMap.klocman.id,
      categoryId: catArtwork.id,
      message: "Thank you for the refreshed artwork — it looks amazing!",
      recipients: { create: [{ userId: userMap.heavencp.id }] },
      picture: catArtwork.icon,
      slug: nanoid(),
    },
    {
      fromUserId: userMap.klocman.id,
      categoryId: catSupport.id,
      message: "Thanks for the assistance with getting my audio working in /bar!.",
      recipients: { create: [{ userId: userMap.knurft.id }] },
      picture: catSupport.icon,
      slug: nanoid(),
    },
    {
      fromUserId: userMap.klocman.id,
      categoryId: catInfra.id,
      message: "Keeping OBS humming like a true 🦸!",
      recipients: { create: [{ userId: userMap.carmeleon.id }] },
      picture: catInfra.icon,
      slug: nanoid(),
    },
    {
      fromUserId: userMap.klocman.id,
      categoryId: catModeration.id,
      message: "Thanks for keeping community moderation thoughtful, calm, and welcoming for everyone.",
      recipients: {
        create: [
          { userId: userMap.AliceSmith.id },
          { userId: userMap.BobSmith.id },
        ],
      },
      picture: catModeration.icon,
      slug: nanoid(),
    },
  ];

  await Promise.all(kudosData.map(k => prisma.kudos.create({ data: k })));

  // ────────────────────────────────────────────────
  // 👥 Teams (dev only) — team accounts, rosters, team kudos
  // ────────────────────────────────────────────────
  console.log("👥 Seeding teams and team kudos (dev only)...");

  const teamSeeds = [
    {
      username: "agama",
      fullName: "Agama Team",
      description: "The installer we all deserve. Responsible for the Agama installer.",
      listEmail: "agama@lists.example.org",
      homepage: "https://github.com/agama-project",
      createdBy: "klocman",
      members: ["klocman", "carmeleon", "heavencp"],
      alumni: ["brightstar"],
    },
    {
      username: "release-team",
      fullName: "openSUSE Release Team",
      description: "Keeps the release train rolling.",
      listEmail: "release-team@lists.example.org",
      homepage: "https://en.opensuse.org/Release_Team",
      createdBy: "BobSmith",
      members: ["BobSmith", "AliceSmith"],
      alumni: [],
    },
  ];

  const teamsById = {};
  for (const t of teamSeeds) {
    const creator = userMap[t.createdBy];

    const team = await prisma.user.upsert({
      where: { username: t.username },
      update: { role: "TEAM", fullName: t.fullName },
      create: {
        username: t.username,
        fullName: t.fullName,
        role: "TEAM",
        email: t.listEmail,
        passwordHash,
      },
    });

    await prisma.teamProfile.upsert({
      where: { teamUserId: team.id },
      update: {
        description: t.description,
        listEmail: t.listEmail,
        homepage: t.homepage,
      },
      create: {
        teamUserId: team.id,
        description: t.description,
        listEmail: t.listEmail,
        homepage: t.homepage,
        createdById: creator?.id ?? team.id,
      },
    });

    for (const username of t.members) {
      const member = userMap[username];
      if (!member) continue;
      await prisma.teamMember.upsert({
        where: { teamUserId_userId: { teamUserId: team.id, userId: member.id } },
        update: {
          state: "ACTIVE",
          approvedAt: new Date(),
          approvedById: creator?.id ?? team.id,
          leftAt: null,
        },
        create: {
          teamUserId: team.id,
          userId: member.id,
          state: "ACTIVE",
          approvedAt: new Date(),
          approvedById: creator?.id ?? team.id,
        },
      });
    }

    for (const username of t.alumni) {
      const member = userMap[username];
      if (!member) continue;
      await prisma.teamMember.upsert({
        where: { teamUserId_userId: { teamUserId: team.id, userId: member.id } },
        update: { state: "EMERITUS", leftAt: new Date() },
        create: {
          teamUserId: team.id,
          userId: member.id,
          state: "EMERITUS",
          approvedAt: new Date(),
          leftAt: new Date(),
        },
      });
    }

    await prisma.teamEvent.create({
      data: {
        teamUserId: team.id,
        actorId: creator?.id ?? team.id,
        action: "created",
      },
    });

    teamsById[t.username] = team;
    console.log(`👥 Team @${t.username} seeded (${t.members.length} active, ${t.alumni.length} alumni).`);
  }

  // ────────────────────────────────────────────────
  // 💬 Kudos to teams (dev only) — a mix of internal and external praise
  // ────────────────────────────────────────────────
  const teamKudosData = [
    {
      // klocman is on the agama roster, so this is internal praise.
      fromUserId: userMap.klocman.id,
      categoryId: catCode.id,
      message: "The Agama installer keeps getting better — proud of what we shipped!",
      recipients: { create: [{ userId: teamsById.agama.id, internal: true }] },
      picture: catCode.icon,
      slug: nanoid(),
    },
    {
      // knurft is not on the roster — external praise.
      fromUserId: userMap.knurft.id,
      categoryId: catInfra.id,
      message: "Agama made my openSUSE install painless. Thank you all!",
      recipients: { create: [{ userId: teamsById.agama.id, internal: false }] },
      picture: catInfra.icon,
      slug: nanoid(),
    },
    {
      fromUserId: userMap.carmeleon.id,
      categoryId: catArtwork.id,
      message: "Love the new Agama look — the whole team should hear it.",
      recipients: { create: [{ userId: teamsById.agama.id, internal: true }] },
      picture: catArtwork.icon,
      slug: nanoid(),
    },
    {
      // BobSmith is a member of release-team.
      fromUserId: userMap.BobSmith.id,
      categoryId: catCode.id,
      message: "Thanks to everyone on the release team for a smooth cycle!",
      recipients: { create: [{ userId: teamsById["release-team"].id, internal: true }] },
      picture: catCode.icon,
      slug: nanoid(),
    },
    {
      fromUserId: userMap.heavencp.id,
      categoryId: catSupport.id,
      message: "Release team, your notes made the upgrade seamless. 🎉",
      recipients: { create: [{ userId: teamsById["release-team"].id, internal: false }] },
      picture: catSupport.icon,
      slug: nanoid(),
    },
  ];

  await Promise.all(teamKudosData.map(k => prisma.kudos.create({ data: k })));
  console.log(`💬 Seeded ${teamKudosData.length} kudos to teams.`);

  // ────────────────────────────────────────────────
  // ✅ Summary
  // ────────────────────────────────────────────────
  const counts = {
    users: await prisma.user.count(),
    badges: await prisma.badge.count(),
    kudos: await prisma.kudos.count(),
    categories: await prisma.kudosCategory.count(),
    userBadges: await prisma.userBadge.count(),
  };
  console.log("🌳 Seed complete:");
  console.table(counts);
}

main()
  .catch(e => {
    console.error("💥 Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
