import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { customAlphabet } from "nanoid";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 8);
const prisma = new PrismaClient();

async function main() {
  // Use the same password for all local accounts
  const defaultPassword = "opensuse";
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  console.log("Seeding local test data with password:", defaultPassword);

  // --- USERS ---
  const lkocman = await prisma.user.upsert({
    where: { username: "lkocman" },
    update: {},
    create: { username: "lkocman", role: "ADMIN", avatarUrl: "/avatars/lkocman.png", passwordHash }
  });

  const crameleon = await prisma.user.upsert({
    where: { username: "crameleon" },
    update: {},
    create: { username: "crameleon", role: "USER", avatarUrl: "/avatars/crameleon.png", passwordHash }
  });

  const hellcp = await prisma.user.upsert({
    where: { username: "hellcp" },
    update: {},
    create: { username: "hellcp", role: "MEMBER", avatarUrl: "/avatars/hellcp.png", passwordHash }
  });

  await prisma.user.upsert({
    where: { username: "stats-bot" },
    update: {},
    create: { username: "stats-bot", role: "BOT", passwordHash }
  });

  // --- KUDOS CATEGORIES ---
const kudosCategories = [
  {
    code: "CODE",
    label: "Code & Engineering",
    icon: "💻",
    defaultMsg: "Your code makes openSUSE stronger every day. 💪",
  },
  {
    code: "ARTWORK",
    label: "Artwork & Design",
    icon: "🎨",
    defaultMsg: "You bring color and creativity to our distro. 🌈",
  },
  {
    code: "TRANSLATION",
    label: "Translations & Localization",
    icon: "🌐",
    defaultMsg: "Thanks for helping openSUSE speak every language! 💬",
  },
  {
    code: "MODERATION",
    label: "Community Moderation",
    icon: "🛡️",
    defaultMsg: "Your kindness keeps our community safe and welcoming.",
  },
  {
    code: "ORGANIZING",
    label: "Event & Release Organizing",
    icon: "📅",
    defaultMsg: "You make openSUSE gatherings run like clockwork!",
  },
  {
    code: "INFRASTRUCTURE",
    label: "Infrastructure Heroes",
    icon: "🦸",
    defaultMsg: "You keep the lights on and the servers purring. ⚙️",
  },
];

  for (const cat of kudosCategories) {
    await prisma.kudosCategory.upsert({
      where: { code: cat.code },
      update: {},
      create: cat
    });
  }

  console.log(`🌟 Seeded ${kudosCategories.length} kudos categories.`);

  // --- ACHIEVEMENTS ---
  const aHero = await prisma.achievement.upsert({
    where: { code: "HERO" },
    update: {},
    create: {
      code: "HERO",
      title: "openSUSE Hero",
      description: "Exceptional community support.",
      color: "var(--radish-red)",
      picture: "/achievements/hero.svg"
    }
  });

  const aArtwork = await prisma.achievement.upsert({
    where: { code: "ARTWORK" },
    update: {},
    create: {
      code: "ARTWORK",
      title: "Artwork Hero",
      description: "Design & branding leadership.",
      color: "var(--plum-purple)",
      picture: "/achievements/artwork.svg"
    }
  });

  await prisma.achievement.upsert({
    where: { code: "GAVE_10_KUDOS" },
    update: {},
    create: {
      code: "GAVE_10_KUDOS",
      title: "10 Kudos Given",
      description: "Shared 10 thank-yous.",
      color: "var(--yarrow-yellow)",
      picture: "/achievements/gave10.svg"
    }
  });

  await prisma.achievement.upsert({
    where: { code: "RECEIVED_10_KUDOS" },
    update: {},
    create: {
      code: "RECEIVED_10_KUDOS",
      title: "10 Kudos Received",
      description: "Received 10 thank-yous.",
      color: "var(--yarrow-yellow)",
      picture: "/achievements/received10.svg"
    }
  });

  await prisma.achievement.upsert({
    where: { code: "RECEIVED_1_KUDOS" },
    update: {},
    create: {
      code: "RECEIVED_1_KUDOS",
      title: "1 Kudos Received",
      description: "First thank-you received.",
      color: "var(--yarrow-yellow)",
      picture: "/achievements/received1.svg"
    }
  });

  // --- ASSIGN ACHIEVEMENTS ---
  const existingAwards = await prisma.userAchievement.findMany({
    where: { userId: hellcp.id },
    select: { achievementId: true }
  });
  const existingIds = new Set(existingAwards.map(a => a.achievementId));

  const awards = [
    { userId: hellcp.id, achievementId: aHero.id },
    { userId: hellcp.id, achievementId: aArtwork.id }
  ];

  for (const award of awards) {
    if (!existingIds.has(award.achievementId)) {
      await prisma.userAchievement.create({ data: award });
    }
  }

  // --- RECOGNITIONS ---
  const catInfra = await prisma.kudosCategory.findUnique({ where: { code: "INFRASTRUCTURE" } });
  const catArtwork = await prisma.kudosCategory.findUnique({ where: { code: "ARTWORK" } });
  const catCode = await prisma.kudosCategory.findUnique({ where: { code: "CODE" } });

  // To crameleon (code-related kudos)
  const toC = [
    "Thanks for helping me debug Leap installer issues.",
    "Appreciate your patience with the kernel rebuilds!",
    "Your reviews on YaST patches saved me hours.",
    "Always quick to test pre-release images, thank you.",
    "Thanks for being part of the release QA!",
    "Your OBS sync scripts are lifesavers.",
    "Thanks for cleaning up spec files last sprint.",
    "Your translation fixes helped so much!",
    "Great work on the 16.0 release notes.",
    "Couldn’t have done Leap 16 milestone without you."
  ];

  for (const msg of toC) {
    await prisma.recognition.create({
      data: {
        slug: nanoid(),
        type: "PEER_TO_PEER",
        message: msg,
        fromUserId: lkocman.id,
        categoryId: catCode.id,
        picture: catCode.icon,
        recipients: { create: [{ userId: crameleon.id }] }
      }
    });
  }

  // To hellcp (artwork kudos)
  const toH = [
    "Thank you for the refreshed artwork, looks amazing.",
    "The new color palette really brightened the distro.",
    "Love the consistency you brought to openSUSE branding.",
    "The Leap wallpapers are pure art.",
    "Appreciate the design leadership — it shows everywhere."
  ];

  for (const msg of toH) {
    await prisma.recognition.create({
      data: {
        slug: nanoid(),
        type: "PEER_TO_PEER",
        message: msg,
        fromUserId: lkocman.id,
        categoryId: catArtwork.id,
        picture: catArtwork.icon,
        recipients: { create: [{ userId: hellcp.id }] }
      }
    });
  }

  // Example infra kudos
  await prisma.recognition.create({
    data: {
      slug: nanoid(),
      type: "PEER_TO_PEER",
      title: "Infrastructure Hero",
      message: "Keeping OBS humming like a true 🦸!",
      fromUserId: lkocman.id,
      categoryId: catInfra.id,
      picture: catInfra.icon,
      recipients: { create: [{ userId: crameleon.id }] }
    }
  });

  // Special recognition
  await prisma.recognition.create({
    data: {
      slug: nanoid(),
      type: "PEER_TO_PEER",
      title: "KUDOS",
      message:
        "Special e-thank-you to hellcp for creating the openSUSE color system and driving our visual identity forward.",
      fromUserId: lkocman.id,
      categoryId: catArtwork.id,
      picture: catArtwork.icon,
      recipients: { create: [{ userId: hellcp.id }] }
    }
  });

  const userCount = await prisma.user.count();
  const recCount = await prisma.recognition.count();
  const achCount = await prisma.achievement.count();
  const catCount = await prisma.kudosCategory.count();

  console.log(`🌱 Seed complete: ${userCount} users, ${recCount} recognitions, ${achCount} achievements, ${catCount} categories.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
