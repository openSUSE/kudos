// Copyright © 2025–present Lubos Kocman and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { customAlphabet } from "nanoid";

const prisma = new PrismaClient();
const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 8);

async function main() {
  const defaultPassword = "opensuse";
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  console.log("🌱 Seeding local test data (password: opensuse)");


  // ────────────────────────────────────────────────
  // 🧱 Kudos Categories
  // ────────────────────────────────────────────────
  const categories = [
    { code: "CODE", label: "Code & Engineering", icon: "💻", defaultMsg: "Your code makes openSUSE stronger every day. 💪" },
    { code: "ARTWORK", label: "Artwork & Design", icon: "🎨", defaultMsg: "You bring color and creativity to our distro. 🌈" },
    { code: "TRANSLATION", label: "Translations & Localization", icon: "🌐", defaultMsg: "Thanks for helping openSUSE speak every language! 💬" },
    { code: "MODERATION", label: "Community Moderation", icon: "🛡️", defaultMsg: "Your kindness keeps our community safe and welcoming." },
    { code: "ORGANIZING", label: "Event & Release Organizing", icon: "📅", defaultMsg: "You make openSUSE gatherings run like clockwork!" },
    { code: "INFRASTRUCTURE", label: "Infrastructure Heroes", icon: "🦸", defaultMsg: "You keep the lights on and the servers purring. ⚙️" },
    { code: "SUPPORT", label: "Support & User Assistance", icon: "🧑‍💻", defaultMsg: "Many thanks for helping me out! 🧑‍💻" },
  ];

  await Promise.all(
    categories.map(cat =>
      prisma.kudosCategory.upsert({
        where: { code: cat.code },
        update: {},
        create: cat,
      })
    )
  );
  console.log(`🌟 Seeded ${categories.length} kudos categories.`);

  // ────────────────────────────────────────────────
  // 🏅 Badges
  // ────────────────────────────────────────────────
  const badges = [

    // Secondary Arches
    { slug: "arm", title: "openSUSE Arm", description: "For contributions to openSUSE on Arm", picture: "/badges/arm.png" },
    { slug: "power", title: "openSUSE POWER", description: "For contributions to openSUSE on POWER", picture: "/badges/power.png" },
    { slug: "systemz", title: "openSUSE SYSTEM-Z", description: "For contributions to openSUSE on SYSTEM-Z", picture: "/badges/systemz.png" },

    // Milestone badges (gave kudos)
    { slug: "gave-1-kudos", title: "First Kudos Given", description: "Shared your first kudos.", picture: "/badges/gave1.png" },
    { slug: "gave-10-kudos", title: "10 Kudos Given", description: "Shared 10 kudos.", picture: "/badges/gave10.png" },
    { slug: "gave-100-kudos", title: "100 Kudos Given", description: "Shared 100 kudos.", picture: "/badges/gave100.png" },
    { slug: "gave-1000-kudos", title: "1000 Kudos Given", description: "Shared 1000 kudos.", picture: "/badges/gave1000.png" },

    // Milestone badges (received kudos)
    { slug: "got-1-kudos", title: "Got First Kudo", description: "Received your first kudos.", picture: "/badges/got1.png" },
    { slug: "got-10-kudos", title: "Got 10 Kudos", description: "Received 10 kudos.", picture: "/badges/got10.png" },
    { slug: "got-100-kudos", title: "Got 100 Kudos", description: "Received 100 kudos.", picture: "/badges/got100.png" },
    { slug: "got-1000-kudos", title: "Got 1000 Kudos", description: "Received 1000 kudos.", picture: "/badges/got1000.png" },

    // Membership officials
    { slug: "member", title: "openSUSE Member", description: "Only for official members", picture: "/badges/member.png" },

    // Themed badges - NonCode
    { slug: "artwork", title: "True Artist", description: "True openSUSE Artist.", picture: "/badges/artwork.png" },
    { slug: "localization", title: "Localization guru", description: "Recognition for openSUSE translations.", picture: "/badges/localization.png" },
    { slug: "documentation", title: "Tech writer expert", description: "Recognition for work on openSUSE documentation.", picture: "/badges/documentation.png" },
    { slug: "moderation", title: "Moderator", description: "Recognition for moderation on forums and social media.", picture: "/badges/moderation.png" },
    { slug: "social", title: "Influencer", description: "Social Media Influencer.", picture: "/badges/influencer.png" },
    { slug: "booth", title: "Booth staff", description: "openSUSE Booth staff member.", picture: "/badges/booth.png" },
    { slug: "marketing", title: "Marketing specialist", description: "Active Marketing specialist", picture: "/badges/marketing.png" },

    // Themed badges - Code
    { slug: "packager", title: "openSUSE Packager", description: "openSUSE Packager", picture: "/badges/packager.png" },
    { slug: "quality", title: "Quality Assurance", description: "Recognition for QA Work.", picture: "/badges/quality.png" },
    { slug: "webdev", title: "openSUSE Web developer", description: "Recognition for developing openSUSE Webservices.", picture: "/badges/webdev.png" },
    { slug: "hero", title: "openSUSE Hero", description: "openSUSE Hero", picture: "/badges/heroes.png" },
    { slug: "appliance", title: "Specialized Images", description: "For contributions to Specialized openSUSE Images", picture: "/badges/appliance.png" },

    // Themed badges — Leap 15 series
    { slug: "leap-150", title: "Leap 15.0 Contributor", description: "Recognition as a Leap 15.0 contributor.", picture: "/badges/leap150.png" },
    { slug: "leap-151", title: "Leap 15.1 Contributor", description: "Recognition as a Leap 15.1 contributor.", picture: "/badges/leap151.png" },
    { slug: "leap-152", title: "Leap 15.2 Contributor", description: "Recognition as a Leap 15.2 contributor.", picture: "/badges/leap152.png" },
    { slug: "leap-153", title: "Leap 15.3 Contributor", description: "Recognition as a Leap 15.3 contributor.", picture: "/badges/leap153.png" },
    { slug: "leap-154", title: "Leap 15.4 Contributor", description: "Recognition as a Leap 15.4 contributor.", picture: "/badges/leap154.png" },
    { slug: "leap-155", title: "Leap 15.5 Contributor", description: "Recognition as a Leap 15.5 contributor.", picture: "/badges/leap155.png" },
    { slug: "leap-156", title: "Leap 15.6 Contributor", description: "Recognition as a Leap 15.6 contributor.", picture: "/badges/leap156.png" },

    // Themed badges — Leap 16 series
    { slug: "leap-160", title: "Leap 16.0 Contributor", description: "Recognition as a Leap 16.0 contributor.", picture: "/badges/leap160.png" },
    { slug: "leap-161", title: "Leap 16.1 Contributor", description: "Recognition as a Leap 16.1 contributor.", picture: "/badges/leap161.png" },

    // Themed badges - Tumbleweed series
    { slug: "tumbleweed", title: "Tumbleweed Contributor", description: "Recognition as a Tumbleweed contributor.", picture: "/badges/tumbleweed.png" },
    { slug: "microos", title: "MicroOS Contributor", description: "Recognition as a MicroOS contributor.", picture: "/badges/microos.png" },
    { slug: "kalpa", title: "Kalpa Contributor", description: "Recognition as a Kalpa contributor.", picture: "/badges/kalpa.png" },
    { slug: "slowroll", title: "Slowroll Contributor", description: "Recognition as a Slowroll contributor.", picture: "/badges/slowroll.png" },

    // Funny Anti badges
    { slug: "nuked", title: "Nuked Production", description: "Nobody really wants this badge. But it looks so cool.", picture: "/badges/nuked.png" },
  ];

  await Promise.all(
    badges.map(b =>
      prisma.badge.upsert({
        where: { slug: b.slug },
        update: {},
        create: b,
      })
    )
  );

  console.log(`🏅 Seeded ${badges.length} badges.`);

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
  const BADGERBOT_SECRET = process.env.BADGERBOT_SECRET || "DEV_STATIC_BOT_TOKEN_123";
  const userSeeds = [
    { username: "klocman", role: "ADMIN", avatarUrl: "" },
    { username: "carmeleon", role: "USER", avatarUrl: "" },
    { username: "heavencp", role: "MEMBER", avatarUrl: "" },
    { username: "knurft", role: "MEMBER", avatarUrl: "" },
    { username: "brightstar", role: "MEMBER", avatarUrl: "" },
    { username: "badger", role: "BOT", avatarUrl: "/avatars/badger.gif", botSecret: BADGERBOT_SECRET },
  ];

  const users = await prisma.$transaction(
    userSeeds.map(u =>
      prisma.user.upsert({
        where: { username: u.username },
        update: {},
        create: { ...u, passwordHash },
      })
    )
  );

  const userMap = Object.fromEntries(users.map(u => [u.username, u]));
  console.table(users.map(u => ({ username: u.username, id: u.id })));

  // ────────────────────────────────────────────────
  // 🎖️ UserBadge links (assignments)
  // ────────────────────────────────────────────────
  const assign = [
    { user: "heavencp", badges: ["hero", "artwork"] },
    { user: "klocman", badges: ["nuked"] },
    { user: "brightstar", badges: ["power", "tumbleweed", "member"] },
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
