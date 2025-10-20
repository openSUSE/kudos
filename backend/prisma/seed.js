// Copyright © 2025–present Lubos Kocman and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { customAlphabet } from "nanoid";

const prisma = new PrismaClient();
const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 8);

async function main() {
  const defaultPassword = "opensuse";
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  console.log("🌱 Seeding local test data (password: opensuse)");

  // ────────────────────────────────────────────────
  // 👥 Users
  // ────────────────────────────────────────────────

  const BADGERBOT_SECRET = process.env.BADGERBOT_SECRET || "DEV_STATIC_BOT_TOKEN_123";

  const users = await prisma.$transaction([
    prisma.user.upsert({
      where: { username: "klocman" },
      update: {},
      create: { username: "klocman", role: "ADMIN", avatarUrl: "", passwordHash }
    }),
    prisma.user.upsert({
      where: { username: "carmeleon" },
      update: {},
      create: { username: "carmeleon", role: "USER", avatarUrl: "", passwordHash }
    }),
    prisma.user.upsert({
      where: { username: "heavencp" },
      update: {},
      create: { username: "heavencp", role: "MEMBER", avatarUrl: "", passwordHash }
    }),
    prisma.user.upsert({
      where: { username: "knurft" },
      update: {},
      create: { username: "knurft", role: "MEMBER", avatarUrl: "", passwordHash }
    }),
    // 🔧 Dedicated automation bot
    prisma.user.upsert({
      where: { username: "badger" },
      update: {},
      create: {
        username: "badger",
        role: "BOT",
        avatarUrl: "/avatars/badger.gif",
        //botSecret: crypto.randomBytes(24).toString("hex"),
        botSecret: BADGERBOT_SECRET,
      }
    }),
  ]);

  const [klocman, carmeleon, heavencp, knurft, badger] = users;

  console.log(`🤖 Bot account ready: badger (secret: ${badger.botSecret})`);    

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

  for (const cat of categories) {
    await prisma.kudosCategory.upsert({
      where: { code: cat.code },
      update: {},
      create: cat
    });
  }
  console.log(`🌟 Seeded ${categories.length} kudos categories.`);

  // ────────────────────────────────────────────────
  // 🏅 Badges
  // ────────────────────────────────────────────────
  const badges = [

    // Secondary Arches
    { slug: "arm", title: "openSUSE Arm", description: "For contributions to openSUSE on Arm", color: "var(--yarrow-yellow)", picture: "/badges/arm.png" },
    { slug: "power", title: "openSUSE Arm", description: "For contributions to openSUSE on POWER", color: "var(--yarrow-yellow)", picture: "/badges/power.png" },
    { slug: "systemz", title: "openSUSE Arm", description: "For contributions to openSUSE on SYSTEM-Z", color: "var(--yarrow-yellow)", picture: "/badges/systemz.png" },

    // Milestone badges (gave kudos)
    { slug: "gave-1-kudos", title: "First Kudos Given", description: "Shared your first kudos.", color: "var(--yarrow-yellow)", picture: "/badges/gave1.png" },
    { slug: "gave-10-kudos", title: "10 Kudos Given", description: "Shared 10 kudos.", color: "var(--yarrow-yellow)", picture: "/badges/gave10.png" },
    { slug: "gave-100-kudos", title: "100 Kudos Given", description: "Shared 100 kudos.", color: "var(--yarrow-yellow)", picture: "/badges/gave100.png" },
    { slug: "gave-1000-kudos", title: "1000 Kudos Given", description: "Shared 1000 kudos.", color: "var(--yarrow-yellow)", picture: "/badges/gave1000.png" },

    // Milestone badges (received kudos)
    { slug: "got-1-kudos", title: "Got First Kudo", description: "Received your first kudos.", color: "var(--yarrow-yellow)", picture: "/badges/got1.png" },
    { slug: "got-10-kudos", title: "Got 10 Kudos", description: "Received 10 kudos.", color: "var(--yarrow-yellow)", picture: "/badges/got10.png" },
    { slug: "got-100-kudos", title: "Got 100 Kudos", description: "Received 100 kudos.", color: "var(--yarrow-yellow)", picture: "/badges/got100.png" },
    { slug: "got-1000-kudos", title: "Got 1000 Kudos", description: "Received 1000 kudos.", color: "var(--yarrow-yellow)", picture: "/badges/got1000.png" },

    // Membership officials, perhaps we could add board member?
    { slug: "member", title: "openSUSE Member", description: "Only for official members", color: "var(--yarrow-yellow)", picture: "/badges/member.png" },

    // Themed badges - NonCode
    { slug: "artwork", title: "True Artist", description: "True openSUSE Artist.", color: "var(--yarrow-yellow)", picture: "/badges/artwork.png" },
    { slug: "localization", title: "Localization guru", description: "Recognition for openSUSE translations.", color: "var(--yarrow-yellow)", picture: "/badges/localization.png" },
    { slug: "documentation", title: "Tech writer expert", description: "Recognition for work on openSUSE documentation.", color: "var(--yarrow-yellow)", picture: "/badges/documentation.png" },
    { slug: "moderation", title: "Moderator", description: "Recognition for moderation on forums and social media.", color: "var(--yarrow-yellow)", picture: "/badges/moderation.png" },
    { slug: "social", title: "Influencer", description: "Social Media Influencer.", color: "var(--yarrow-yellow)", picture: "/badges/influencer.png" },
    { slug: "booth", title: "Booth staff", description: "openSUSE Booth staff member.", color: "var(--yarrow-yellow)", picture: "/badges/booth.png" },
    { slug: "marketing", title: "Marketing specialist", description: "Active Marketing specialist", color: "var(--yarrow-yellow)", picture: "/badges/marketing.png" },

    // Themed badges - Code
    { slug: "packager", title: "openSUSE Packager", description: "openSUSE Packager", color: "var(--yarrow-yellow)", picture: "/badges/packager.png" },
    { slug: "quality", title: "Quality Assurance", description: "Recognition for QA Work.", color: "var(--yarrow-yellow)", picture: "/badges/quality.png" },
    { slug: "webdev", title: "openSUSE Web developer", description: "Recognition for developing openSUSE Webservices.", color: "var(--yarrow-yellow)", picture: "/badges/webdev.png" },
    { slug: "hero", title: "openSUSE Hero", description: "openSUSE Hero", color: "var(--yarrow-yellow)", picture: "/badges/heroes.png" },
    { slug: "appliance", title: "Specialized Images", description: "For contributions to Specialized openSUSE Images", color: "var(--yarrow-yellow)", picture: "/badges/appliance.png" },

    // Themed badges — Leap 15 series
    { slug: "leap-150", title: "Leap 15.0 Contributor", description: "Recognition as a Leap 15.0 contributor.", color: "var(--yarrow-yellow)", picture: "/badges/leap150.png" },
    { slug: "leap-151", title: "Leap 15.1 Contributor", description: "Recognition as a Leap 15.1 contributor.", color: "var(--yarrow-yellow)", picture: "/badges/leap151.png" },
    { slug: "leap-152", title: "Leap 15.2 Contributor", description: "Recognition as a Leap 15.2 contributor.", color: "var(--yarrow-yellow)", picture: "/badges/leap152.png" },
    { slug: "leap-153", title: "Leap 15.3 Contributor", description: "Recognition as a Leap 15.3 contributor.", color: "var(--yarrow-yellow)", picture: "/badges/leap153.png" },
    { slug: "leap-154", title: "Leap 15.4 Contributor", description: "Recognition as a Leap 15.4 contributor.", color: "var(--yarrow-yellow)", picture: "/badges/leap154.png" },
    { slug: "leap-155", title: "Leap 15.5 Contributor", description: "Recognition as a Leap 15.5 contributor.", color: "var(--yarrow-yellow)", picture: "/badges/leap155.png" },
    { slug: "leap-156", title: "Leap 15.6 Contributor", description: "Recognition as a Leap 15.6 contributor.", color: "var(--yarrow-yellow)", picture: "/badges/leap156.png" },


    // Themed badges — Leap 16 series
    { slug: "leap-160", title: "Leap 16.0 Contributor", description: "Recognition as a Leap 16.0 contributor.", color: "var(--yarrow-yellow)", picture: "/badges/leap160.png" },
    { slug: "leap-161", title: "Leap 16.1 Contributor", description: "Recognition as a Leap 16.1 contributor.", color: "var(--yarrow-yellow)", picture: "/badges/leap161.png" },
   // { slug: "leap-162", title: "Leap 16.2 Contributor", description: "Recognition as a Leap 16.2 contributor.", color: "var(--yarrow-yellow)", picture: "/badges/leap162.png" },
   // { slug: "leap-163", title: "Leap 16.3 Contributor", description: "Recognition as a Leap 16.3 contributor.", color: "var(--yarrow-yellow)", picture: "/badges/leap163.png" },
   // { slug: "leap-164", title: "Leap 16.4 Contributor", description: "Recognition as a Leap 16.4 contributor.", color: "var(--yarrow-yellow)", picture: "/badges/leap164.png" },
   // { slug: "leap-165", title: "Leap 16.5 Contributor", description: "Recognition as a Leap 16.5 contributor.", color: "var(--yarrow-yellow)", picture: "/badges/leap165.png" },
   // { slug: "leap-166", title: "Leap 16.6 Contributor", description: "Recognition as a Leap 16.6 contributor.", color: "var(--yarrow-yellow)", picture: "/badges/leap166.png" },

    // Themed badges - Tumbleweed series

    { slug: "tumbleweed", title: "Tumbleweed Contributor", description: "Recognition as a Tumbleweed contributor.", color: "var(--yarrow-yellow)", picture: "/badges/tumbleweed.png" },
    { slug: "microos", title: "MicroOS Contributor", description: "Recognition as a MicroOS contributor.", color: "var(--yarrow-yellow)", picture: "/badges/microos.png" },
    { slug: "kalpa", title: "Kalpa Contributor", description: "Recognition as a Kalpa contributor.", color: "var(--yarrow-yellow)", picture: "/badges/kalpa.png" },
    { slug: "aeon", title: "Aeon Contributor", description: "Recognition as a Aeon contributor.", color: "var(--yarrow-yellow)", picture: "/badges/aeon.png" },
    { slug: "slowroll", title: "Slowroll Contributor", description: "Recognition as a Slowroll contributor.", color: "var(--yarrow-yellow)", picture: "/badges/slowroll.png" },

    // Funny Anti badges
    { slug: "nuked", title: "Nuked Production", description: "Nobody really wants this badge. But it looks so cool.", color: "var(--yarrow-yellow)", picture: "/badges/nuked.png" },
  ];

  for (const b of badges) {
    await prisma.badge.upsert({
      where: { slug: b.slug },
      update: {},
      create: b,
    });
  }
  console.log(`🏅 Seeded ${badges.length} badges.`);

// ────────────────────────────────────────────────
// 🎖️ Assign some sample badges
// ────────────────────────────────────────────────
const hero = await prisma.badge.findUnique({ where: { slug: "hero" } });
const artwork = await prisma.badge.findUnique({ where: { slug: "artwork" } });
const nuked = await prisma.badge.findUnique({ where: { slug: "nuked" } });

if (hero && artwork) {
  await prisma.userBadge.createMany({
    data: [
      { userId: heavencp.id, badgeId: hero.id },
      { userId: heavencp.id, badgeId: artwork.id },
    ],
  });
  console.log(`🏅 Assigned ${hero.title} and ${artwork.title} to heavencp`);
} else {
  console.warn("⚠️ Could not find sample badges to assign");
}

if (nuked) {
    await prisma.userBadge.createMany({
    data: [
      { userId: klocman.id, badgeId: nuked.id },
    ],
  });
}

  // ────────────────────────────────────────────────
  // 💬 Kudos examples
  // ────────────────────────────────────────────────
  const catInfra = await prisma.kudosCategory.findUnique({ where: { code: "INFRASTRUCTURE" } });
  const catArtwork = await prisma.kudosCategory.findUnique({ where: { code: "ARTWORK" } });
  const catCode = await prisma.kudosCategory.findUnique({ where: { code: "CODE" } });
  const catSupport = await prisma.kudosCategory.findUnique({ where: { code: "SUPPORT" } });

  const kudosData = [
    {
      fromUserId: klocman.id,
      categoryId: catCode.id,
      message: "Thanks for helping me debug Leap installer issues.",
      recipients: { create: [{ userId: carmeleon.id }] },
      picture: catCode.icon,
      slug: nanoid(),
    },
    {
      fromUserId: klocman.id,
      categoryId: catArtwork.id,
      message: "Thank you for the refreshed artwork — it looks amazing!",
      recipients: { create: [{ userId: heavencp.id }] },
      picture: catArtwork.icon,
      slug: nanoid(),
    },
    {
      fromUserId: klocman.id,
      categoryId: catSupport.id,
      message: "Thanks for the assistance with getting my audio working in /bar!.",
      recipients: { create: [{ userId: knurft.id }] },
      picture: catSupport.icon,
      slug: nanoid(),
    },
    {
      fromUserId: klocman.id,
      categoryId: catInfra.id,
      message: "Keeping OBS humming like a true 🦸!",
      recipients: { create: [{ userId: carmeleon.id }] },
      picture: catInfra.icon,
      slug: nanoid(),
    },
  ];

  for (const kudos of kudosData) {
    await prisma.kudos.create({ data: kudos });
  }

  // ────────────────────────────────────────────────
  // ✅ Summary
  // ────────────────────────────────────────────────
  const userCount = await prisma.user.count();
  const kudosCount = await prisma.kudos.count();
  const badgeCount = await prisma.badge.count();
  const catCount = await prisma.kudosCategory.count();

  console.log(`🌳 Seed complete: ${userCount} users, ${kudosCount} kudos, ${badgeCount} badges, ${catCount} categories.`);
}

main()
  .catch((e) => {
    console.error("💥 Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
