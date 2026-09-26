// SPDX-License-Identifier: Apache-2.0
// openSUSE Kudos — Minimal Production Seed (no users, no badges)

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Running production seed (categories only)…");

  // ========================================================================
  // 🌳 Kudos Categories
  // ========================================================================
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
  console.log(`🌿 Categories initialized (${categories.length}).`);

  // ========================================================================
  // 🏅 Badges come from kudos-badges (meta/ + locales/), synced
  // by the backend on every start. See docs/badges.md.
  // ========================================================================

  // ========================================================================
  // 🧹 Legacy badge cleanup
  // Remove deprecated "tumbleweed" badge and detach assignments first.
  // ========================================================================
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
  } else {
    console.log('🧹 Legacy badge "tumbleweed" not found, nothing to clean up.');
  }

  // ========================================================================
  // 🏁 Done
  // ========================================================================
  const counts = {
    categories: await prisma.kudosCategory.count(),
    badges: await prisma.badge.count(),
  };
  console.table(counts);
  console.log("🌳 Production seed complete.");
}

main()
  .catch(e => {
    console.error("💥 Production seed failed:", e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());

