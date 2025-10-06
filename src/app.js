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

dotenv.config();

const prisma = new PrismaClient();
const app = express();
const require = Module.createRequire(import.meta.url);

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

// --- routes ---

app.get("/", async (req, res, next) => {
  try {
    const items = await prisma.recognition.findMany({
      where: { type: "PEER_TO_PEER" },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        fromUser: true,
        recipients: { include: { user: true } },
      },
    });

    console.log("🔍 Recognitions loaded:");
    for (const r of items) {
      console.log(`  id=${r.id}, slug=${r.slug}, message="${r.message?.slice(0, 30)}"`);
    }
    res.render("index", { title: "openSUSE Kudos", items });
    //res.render("index", { title: "openSUSE Kudos", items , layout: false});
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
    include: { fromUser: true, recipients: { include: { user: true } } },
  });
  res.json(items);
});

// API: recent achievements
app.get("/api/achievements/recent", async (req, res) => {
  const recents = await prisma.recognition.findMany({
    where: { type: "ACHIEVEMENT" },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { recipients: { include: { user: true } }, achievement: true },
  });
  const mapped = recents.map((r) => ({
    id: r.id,
    slug: r.slug, // add this line for consistency / future use
    user: r.recipients[0]?.user?.username || "someone",
    achievement: {
      title: r.achievement?.title || "Achievement",
      color: r.achievement?.color || "var(--geeko-green)",
    },
    createdAt: r.createdAt,
  }));
  res.json(mapped);
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
app.get("/recognition/new", async (req, res) => {
  if (!req.session?.userId) return res.redirect("/login");
  const users = await prisma.user.findMany({
    where: { role: { not: "BOT" } },
    orderBy: { username: "asc" },
  });
  res.render("recognition_new", { title: "New Kudos", users });
});

// Handle recognition submission
app.post("/recognition/new", async (req, res, next) => {
  try {
    if (!req.currentUser) return res.redirect("/login");
    const { recipientId, message } = req.body;
    const fromUserId = req.currentUser.id;
    const slug = crypto.randomUUID().slice(0, 8);
    const rec = await prisma.recognition.create({
      data: {
        slug,
        type: "PEER_TO_PEER",
        message,
        fromUserId,
        recipients: { create: [{ userId: parseInt(recipientId) }] },
      },
    });
    res.redirect(`/recognition/${rec.slug}`);
  } catch (err) {
    next(err);
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
    res.render("recognition", { title: "Recognition", rec });
  } catch (e) {
    next(e);
  }
});

// Achievements list
app.get("/achievements", async (req, res) => {
  const list = await prisma.achievement.findMany({ orderBy: { title: "asc" } });
  let myAchievements = [];
  if (req.session?.userId) {
    myAchievements = await prisma.userAchievement.findMany({
      where: { userId: req.session.userId },
      include: { achievement: true },
    });
  }
  res.render("achievements", { title: "Achievements", list, myAchievements });
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

// Avatars (jdenticon)
app.get("/avatars/:username.png", (req, res) => {
  const size = 64;
  const svg = jdenticon.toSvg(req.params.username, size);
  res.setHeader("Content-Type", "image/svg+xml");
  res.send(svg);
});

// User profile
app.get("/user/:username", async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { username: req.params.username },
  });
  if (!user) return res.status(404).send("Not found");
  const badges = await prisma.userAchievement.findMany({
    where: { userId: user.id },
    include: { achievement: true },
  });
  res.render("user", { title: user.username, user, badges });
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
