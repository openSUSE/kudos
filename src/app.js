import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { mountAuth } from "./auth.js";
import expressLayouts from "express-ejs-layouts";
import * as jdenticon from "jdenticon";
import crypto from "crypto";
import Module from "module";

import adminRoutes from "./admin.js";

dotenv.config();

const prisma = new PrismaClient();
const app = express();
const require = Module.createRequire(import.meta.url);

// Attach prisma to req for reuse
app.use((req, res, next) => {
  req.prisma = prisma;
  next();
});


// --- resolve paths ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- environment setup ---
process.env.NODE_ENV = "development";

// --- disable EJS cache ---
app.set("view cache", false);

// --- view engine + layout setup ---
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "views"));
app.use(expressLayouts);
app.set("layout", "layout");
app.set("layout extractScripts", false);
app.set("layout extractStyles", false);

// --- static assets ---
app.use(express.static(path.join(__dirname, "..", "public")));

// --- middleware ---
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// --- global EJS vars ---
app.locals.authMode = process.env.AUTH_MODE || "OIDC";

// --- authentication ---
await mountAuth(app, prisma);

// --- DEV: nuke all template caches before every render ---
app.use((req, res, next) => {
  for (const key of Object.keys(require.cache)) {
    if (key.endsWith(".ejs") || key.includes("express-ejs-layouts")) {
      delete require.cache[key];
    }
  }
  next();
});

// --- expose currentUser + authMode to all templates ---
app.use((req, res, next) => {
  res.locals.currentUser = req.currentUser || null;
  res.locals.authMode = app.locals.authMode;
  next();
});

// --- debug logging ---
app.use((req, res, next) => {
  console.log("🧩 Session debug:");
  console.log("  userId:", req.session?.userId);
  console.log("  currentUser:", req.currentUser?.username);
  next();
});

// --- Mount admin interface
app.use("/admin", adminRoutes);

// --- routes ---

app.get("/", async (req, res, next) => {
  try {
    // recent recognitions
    const items = await prisma.recognition.findMany({
      where: { type: "PEER_TO_PEER" },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        fromUser: true,
        recipients: { include: { user: true } },
        category: true,
      },
    });

    // top contributors
    const users = await prisma.user.findMany({
      include: {
        _count: {
          select: {
            recognitions: true, // kudos given
            received: true,     // kudos received
            achievements: true, // badges earned
          },
        },
      },
    });
    const leaderboard = users
      .filter(u => u.role !== "BOT")
      .map(u => ({
        username: u.username,
        avatarUrl: u.avatarUrl,
        achievementsCount: u._count.achievements,
        kudosGiven: u._count.recognitions,
        kudosReceived: u._count.received,
      }))
      .sort((a, b) => b.achievementsCount - a.achievementsCount)
      .slice(0, 5);

    // achievements overview
    const achievements = await prisma.achievement.findMany({
      orderBy: { title: "asc" },
      take: 6,
    });

    res.render("index", {
      title: "openSUSE Kudos",
      items,
      leaderboard,
      achievements,
    });
  } catch (e) {
    next(e);
  }
});


// API: recent peer-to-peer recognitions
app.get("/api/recognitions/recent", async (req, res) => {
  const items = await prisma.recognition.findMany({
    where: { type: "PEER_TO_PEER" },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      fromUser: true,
      recipients: { include: { user: true } },
      category: true,
    },
  });
  res.json(items);
});

app.get("/achievements", async (req, res, next) => {
  try {
    const view = req.query.view || "all";
    const userId = req.session?.userId;

    let achievements = [];
    let myAchievements = [];
    let kudos = [];

    if (view === "my" && userId) {
      myAchievements = await prisma.userAchievement.findMany({
        where: { userId },
        include: {
          achievement: {
            include: { _count: { select: { userAwards: true } } },
          },
        },
        orderBy: { achievement: { title: "asc" } },
      });
    } else if (view === "received" && userId) {
      kudos = await prisma.recognition.findMany({
        where: {
          type: "PEER_TO_PEER",
          recipients: { some: { userId } },
        },
        include: {
          fromUser: true,
          recipients: { include: { user: true } },
          category: true,
        },
        orderBy: { createdAt: "desc" },
      });
    } else if (view === "given" && userId) {
      kudos = await prisma.recognition.findMany({
        where: {
          type: "PEER_TO_PEER",
          fromUserId: userId,
        },
        include: {
          fromUser: true,
          recipients: { include: { user: true } },
          category: true,
        },
        orderBy: { createdAt: "desc" },
      });
    } else {
      achievements = await prisma.achievement.findMany({
        orderBy: { title: "asc" },
        include: { _count: { select: { userAwards: true } } },
      });

      if (userId) {
        myAchievements = await prisma.userAchievement.findMany({
          where: { userId },
        });
      }
    }

    const totalAchievementsCount = await prisma.achievement.count();

    res.render("achievements", {
      title: "Achievements · openSUSE Kudos",
      view,
      achievements,
      myAchievements,
      kudos,
      currentUser: req.currentUser || null,
      totalAchievementsCount,
    });
  } catch (e) {
    next(e);
  }
});


// Printable recognition
app.get("/recognition/:slug/print", async (req, res, next) => {
  try {
    const rec = await prisma.recognition.findUnique({
      where: { slug: req.params.slug },
      include: {
        fromUser: true,
        recipients: { include: { user: true } },
        achievement: true,
      },
    });
    if (!rec) return res.status(404).send("Not found");
    res.render("print", { title: "Print Recognition", rec });
  } catch (e) {
    next(e);
  }
});


// New recognition form
app.get("/recognition/new", async (req, res, next) => {
  try {
    if (!req.session?.userId) return res.redirect("/login");

    const [users, categories] = await Promise.all([
      prisma.user.findMany({
        where: { role: { not: "BOT" } },
        orderBy: { username: "asc" },
      }),
      prisma.kudosCategory.findMany({
        orderBy: { label: "asc" },
      }),
    ]);

    res.render("recognition_new", {
      title: "Give Kudos",
      users,
      categories,
    });
  } catch (e) {
    next(e);
  }
});


// Regular permalink
app.get("/recognition/:slug", async (req, res, next) => {
  try {
    const rec = await prisma.recognition.findUnique({
      where: { slug: req.params.slug },
      include: {
        fromUser: true,
        recipients: { include: { user: true } },
        achievement: true,
      },
    });
    if (!rec) return res.status(404).send("Not found");

    const permalink = `${req.protocol}://${req.get("host")}/recognition/${rec.slug}`;

    res.render("recognition", { title: "Recognition", rec, permalink });
  } catch (e) {
    next(e);
  }
});

// ✉️ Handle new recognition submission
app.post("/recognition/new", async (req, res, next) => {
  try {
    if (!req.session?.userId) return res.redirect("/login");

    const { recipientId, categoryId, message } = req.body;

    if (!recipientId || !categoryId) {
      return res.status(400).send("Missing recipient or category");
    }

    // Generate a unique slug
    const slug = crypto.randomBytes(5).toString("hex");

    // Create the recognition
    const rec = await prisma.recognition.create({
      data: {
        type: "PEER_TO_PEER",
        message,
        slug,
        fromUserId: req.session.userId,
        categoryId: parseInt(categoryId),
        recipients: {
          create: [{ userId: parseInt(recipientId) }],
        },
      },
      include: {
        fromUser: true,
        recipients: { include: { user: true } },
        category: true,
      },
    });

    // Redirect to the new recognition page
    res.redirect(`/recognition/${rec.slug}`);
  } catch (e) {
    console.error("Error creating recognition:", e);
    next(e);
  }
});


// Single achievement
app.get("/achievement/:id", async (req, res) => {
  const codeOrId = req.params.id;
  let ach = await prisma.achievement.findFirst({ where: { code: codeOrId } });
  if (!ach && !isNaN(parseInt(codeOrId))) {
    ach = await prisma.achievement.findUnique({
      where: { id: parseInt(codeOrId) },
    });
  }
  if (!ach) return res.status(404).send("Not found");
  const holders = await prisma.userAchievement.findMany({
    where: { achievementId: ach.id },
    include: { user: true },
  });
  res.render("achievement", { title: ach.title, ach, holders });
});

app.get("/scoreboard", async (req, res, next) => {
  try {
    const period = req.query.period || "30days";
    let cutoffDate = null;

    if (period === "30days") {
      cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30);
    }

    const users = await prisma.user.findMany({
      where: { role: { not: "BOT" } },
      orderBy: { username: "asc" },
    });

    const leaderboard = [];

    for (const u of users) {
      const whereGiven = {
        fromUserId: u.id,
        type: "PEER_TO_PEER",
      };
      const whereReceived = {
        userId: u.id,
        recognition: { type: "PEER_TO_PEER" },
      };

      if (cutoffDate) {
        whereGiven.createdAt = { gte: cutoffDate };
        whereReceived.recognition.createdAt = { gte: cutoffDate };
      }

      const [kudosGiven, kudosReceived, achievementsCount] = await Promise.all([
        prisma.recognition.count({ where: whereGiven }),
        prisma.recognitionRecipient.count({ where: whereReceived }),
        prisma.userAchievement.count({ where: { userId: u.id } }),
      ]);

      leaderboard.push({
        username: u.username,
        avatarUrl: u.avatarUrl,
        achievementsCount,
        kudosGiven,
        kudosReceived,
      });
    }

    leaderboard.sort((a, b) => {
      if (b.kudosReceived !== a.kudosReceived)
        return b.kudosReceived - a.kudosReceived;
      return b.achievementsCount - a.achievementsCount;
    });

    res.render("scoreboard", {
      title:
        (period === "30days"
          ? "Monthly Scoreboard"
          : "All-Time Scoreboard") + " · openSUSE Kudos",
      leaderboard,
      period,
      cutoffDate,
    });
  } catch (e) {
    next(e);
  }
});




// Avatars (jdenticon)
app.get("/avatars/:username.png", (req, res) => {
  const size = 64;
  const svg = jdenticon.toSvg(req.params.username, size);
  res.setHeader("Content-Type", "image/svg+xml");
  res.send(svg);
});

// User profile
app.get("/user/:username", async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { username: req.params.username },
    });
    if (!user) return res.status(404).send("Not found");

    // Compute player stats in parallel
    const [given, received, badges] = await Promise.all([
      prisma.recognition.count({
        where: { fromUserId: user.id, type: "PEER_TO_PEER" },
      }),
      prisma.recognitionRecipient.count({
        where: { userId: user.id, recognition: { type: "PEER_TO_PEER" } },
      }),
      prisma.userAchievement.findMany({
        where: { userId: user.id },
        include: { achievement: true },
      }),
    ]);

    res.render("user", {
      title: `${user.username} · Player Card`,
      user,
      given,
      received,
      badges,
    });
  } catch (e) {
    next(e);
  }
});


// Bot endpoint (stats-run)
app.post("/api/bot/stats-run", async (req, res) => {
  const token = req.get("x-api-token");
  if (!token || token !== process.env.BOT_API_TOKEN)
    return res.status(403).json({ error: "Forbidden" });

  const users = await prisma.user.findMany();
  const gaveMilestones = [10, 100, 1000];
  const recMilestones = [1, 10, 100, 1000];
  const bot = await prisma.user.findUnique({ where: { username: "stats-bot" } });
  const awarded = [];

  const checkMilestones = async (u, milestones, prefix, count) => {
    for (const m of milestones) {
      if (count >= m) {
        const code = `${prefix}_${m}_KUDOS`;
        const ach = await prisma.achievement.findUnique({ where: { code } });
        if (ach) {
          const exists = await prisma.userAchievement.findFirst({
            where: { userId: u.id, achievementId: ach.id },
          });
          if (!exists) {
            await prisma.userAchievement.create({
              data: { userId: u.id, achievementId: ach.id },
            });
            const rec = await prisma.recognition.create({
              data: {
                type: "ACHIEVEMENT",
                title: ach.title,
                fromUserId: bot?.id || u.id,
                achievementId: ach.id,
                recipients: { create: [{ userId: u.id }] },
              },
            });
            awarded.push({ user: u.username, awarded: code, recId: rec.id });
          }
        }
      }
    }
  };

  for (const u of users) {
    if (u.role === "BOT") continue;
    const given = await prisma.recognition.count({
      where: { fromUserId: u.id, type: "PEER_TO_PEER" },
    });
    const received = await prisma.recognitionRecipient.count({
      where: { userId: u.id, recognition: { type: "PEER_TO_PEER" } },
    });
    await checkMilestones(u, gaveMilestones, "GAVE", given);
    await checkMilestones(u, recMilestones, "RECEIVED", received);
  }

  res.json({ awarded });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`✅ Kudos 8-bit (OIDC-ready, cache nuked) running on http://localhost:${PORT}`)
);
