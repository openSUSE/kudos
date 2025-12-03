// SPDX-License-Identifier: Apache-2.0
// openSUSE Kudos — Minimal Production Seed (no users)

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Running production seed (categories + badges only)…");

  // ========================================================================
  // 🌳 Kudos Categories
  // ========================================================================
  const categories = [
    { code: "CODE", label: "Code & Engineering", icon: "💻", defaultMsg: "Your code makes openSUSE stronger every day. 💪" },
    { code: "ARTWORK", label: "Artwork & Design", icon: "🎨", defaultMsg: "You bring color and creativity to our distro. 🌈" },
    { code: "TRANSLATION", label: "Translations & Localization", icon: "🌐", defaultMsg: "Thanks for helping openSUSE speak every language! 💬" },
    { code: "MODERATION", label: "Community Moderation", icon: "🛡️", defaultMsg: "Your kindness keeps our community safe and welcoming." },
    { code: "ORGANIZING", label: "Event & Release Organizing", icon: "📅", defaultMsg: "You make openSUSE gatherings run like clockwork!" },
    { code: "INFRASTRUCTURE", label: "Infrastructure Heroes", icon: "🦸", defaultMsg: "You keep the lights on and the servers purring. ⚙️" },
    { code: "SUPPORT", label: "Support & User Assistance", icon: "🧑‍💻", defaultMsg: "Thank you for the help! 🧑‍💻" },
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
  console.log(`🌿 Categories initialized (${categories.length}).`);

  // ========================================================================
  // 🏅 Full Badge Catalog (ALL badges from your dev seed)
  // ========================================================================
  const badges = [
    // Secondary Arches
    { slug: "arm", title: "openSUSE Arm", description: "For contributions to openSUSE on Arm", picture: "/badges/arm.png" },
    { slug: "power", title: "openSUSE POWER", description: "For contributions to openSUSE on POWER", picture: "/badges/power.png" },
    { slug: "systemz", title: "openSUSE SYSTEM-Z", description: "For contributions to openSUSE on SYSTEM-Z", picture: "/badges/systemz.png" },

    // Milestones — gave kudos
    { slug: "gave-1-kudos", title: "First Kudos Given", description: "Shared your first kudos.", picture: "/badges/gave1.png" },
    { slug: "gave-10-kudos", title: "10 Kudos Given", description: "Shared 10 kudos.", picture: "/badges/gave10.png" },
    { slug: "gave-100-kudos", title: "100 Kudos Given", description: "Shared 100 kudos.", picture: "/badges/gave100.png" },
    { slug: "gave-1000-kudos", title: "1000 Kudos Given", description: "Shared 1000 kudos.", picture: "/badges/gave1000.png" },

    // Milestones — got kudos
    { slug: "got-1-kudos", title: "Got First Kudo", description: "Received your first kudos.", picture: "/badges/got1.png" },
    { slug: "got-10-kudos", title: "Got 10 Kudos", description: "Received 10 kudos.", picture: "/badges/got10.png" },
    { slug: "got-100-kudos", title: "Got 100 Kudos", description: "Received 100 kudos.", picture: "/badges/got100.png" },
    { slug: "got-1000-kudos", title: "Got 1000 Kudos", description: "Received 1000 kudos.", picture: "/badges/got1000.png" },

    // Membership
    { slug: "member", title: "openSUSE Member", description: "Only for official members", picture: "/badges/member.png" },

    // Themed — NonCode
    { slug: "artwork", title: "True Artist", description: "True openSUSE Artist.", picture: "/badges/artwork.png" },
    { slug: "localization", title: "Localization guru", description: "Recognition for openSUSE translations.", picture: "/badges/localization.png" },
    { slug: "documentation", title: "Tech writer expert", description: "Recognition for work on openSUSE documentation.", picture: "/badges/documentation.png" },
    { slug: "moderation", title: "Moderator", description: "Recognition for moderation on forums and social media.", picture: "/badges/moderation.png" },
    { slug: "social", title: "Influencer", description: "Social Media Influencer.", picture: "/badges/influencer.png" },
    { slug: "booth", title: "Booth staff", description: "openSUSE Booth staff member.", picture: "/badges/booth.png" },
    { slug: "marketing", title: "Marketing specialist", description: "Active Marketing specialist", picture: "/badges/marketing.png" },

    // Themed — Code
    { slug: "packager", title: "openSUSE Packager", description: "openSUSE Packager", picture: "/badges/packager.png" },
    { slug: "quality", title: "Quality Assurance", description: "Recognition for QA Work.", picture: "/badges/quality.png" },
    { slug: "webdev", title: "openSUSE Web developer", description: "Recognition for developing openSUSE Webservices.", picture: "/badges/webdev.png" },
    { slug: "hero", title: "openSUSE Hero", description: "openSUSE Hero", picture: "/badges/heroes.png" },
    { slug: "appliance", title: "Specialized Images", description: "For contributions to Specialized openSUSE Images", picture: "/badges/appliance.png" },

    // Leap 15 series
    { slug: "leap-150", title: "Leap 15.0 Contributor", description: "Recognition as a Leap 15.0 contributor.", picture: "/badges/leap150.png" },
    { slug: "leap-151", title: "Leap 15.1 Contributor", description: "Recognition as a Leap 15.1 contributor.", picture: "/badges/leap151.png" },
    { slug: "leap-152", title: "Leap 15.2 Contributor", description: "Recognition as a Leap 15.2 contributor.", picture: "/badges/leap152.png" },
    { slug: "leap-153", title: "Leap 15.3 Contributor", description: "Recognition as a Leap 15.3 contributor.", picture: "/badges/leap153.png" },
    { slug: "leap-154", title: "Leap 15.4 Contributor", description: "Recognition as a Leap 15.4 contributor.", picture: "/badges/leap154.png" },
    { slug: "leap-155", title: "Leap 15.5 Contributor", description: "Recognition as a Leap 155 contributor.", picture: "/badges/leap155.png" },
    { slug: "leap-156", title: "Leap 15.6 Contributor", description: "Recognition as a Leap 15.6 contributor.", picture: "/badges/leap156.png" },

    // Leap 16 series
    { slug: "leap-160", title: "Leap 16.0 Contributor", description: "Recognition as a Leap 16.0 contributor.", picture: "/badges/leap160.png" },
    { slug: "leap-161", title: "Leap 16.1 Contributor", description: "Recognition as a Leap 16.1 contributor.", picture: "/badges/leap161.png" },

    // Tumbleweed series
    { slug: "tumbleweed", title: "Tumbleweed Contributor", description: "Recognition as a Tumbleweed contributor.", picture: "/badges/tumbleweed.png" },
    { slug: "microos", title: "MicroOS Contributor", description: "Recognition for MicroOS work", picture: "/badges/microos.png" },
    { slug: "kalpa", title: "Kalpa Contributor", description: "Recognition as a Kalpa contributor.", picture: "/badges/kalpa.png" },
    { slug: "slowroll", title: "Slowroll Contributor", description: "Recognition as a Slowroll contributor.", picture: "/badges/slowroll.png" },

    // Funny Anti-badge
    { slug: "nuked", title: "Nuked Production", description: "Nobody really wants this badge, but it's cool.", picture: "/badges/nuked.png" },
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
  console.log(`🏅 Badges initialized (${badges.length}).`);

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

