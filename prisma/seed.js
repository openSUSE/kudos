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

  // --- Users ---
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

  // --- Achievements ---
  const aHero = await prisma.achievement.upsert({
    where: { code: "HERO" },
    update: {},
    create: {
      code: "HERO",
      title: "openSUSE Hero",
      description: "Exceptional community support.",
      color: "var(--radish-red)",
      icon: "/achievements/hero.png"
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
      icon: "/achievements/artwork.png"
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
      icon: "/achievements/gave10.png"
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
      icon: "/achievements/received10.png"
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
      icon: "/achievements/received1.png"
    }
  });

  // --- Assign achievements ---
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

  // --- Recognitions ---
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
        recipients: { create: [{ userId: crameleon.id }] }
      }
    });
  }

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
        recipients: { create: [{ userId: hellcp.id }] }
      }
    });
  }

  await prisma.recognition.create({
    data: {
      slug: nanoid(),
      type: "PEER_TO_PEER",
      title: "e-Thank-You",
      message:
        "Special e-thank-you to hellcp for creating the openSUSE color system and driving our visual identity forward.",
      fromUserId: lkocman.id,
      recipients: { create: [{ userId: hellcp.id }] }
    }
  });

  const userCount = await prisma.user.count();
  const recCount = await prisma.recognition.count();
  const achCount = await prisma.achievement.count();

  console.log(`🌱 Seed complete: ${userCount} users, ${recCount} recognitions, ${achCount} achievements.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
