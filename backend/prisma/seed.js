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
