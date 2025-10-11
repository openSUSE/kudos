import express from "express";
const router = express.Router();

// 🧩 Restrict access to admins
function requireAdmin(req, res, next) {
  if (!req.currentUser || req.currentUser.role !== "ADMIN") {
    return res.status(403).render("error", {
      title: "Access Denied",
      message: "Only administrators can access this page.",
    });
  }
  next();
}

// 🏠 Dashboard (overview)
router.get("/", requireAdmin, async (req, res) => {
  const [users, categories, achievements] = await Promise.all([
    req.prisma.user.findMany({ orderBy: { username: "asc" } }),
    req.prisma.kudosCategory.findMany({ orderBy: { label: "asc" } }),
    req.prisma.achievement.findMany({ orderBy: { title: "asc" } }),
  ]);

  res.render("admin/dashboard", {
    title: "Admin Dashboard",
    users,
    categories,
    achievements,
  });
});

// 👥 USERS management
router.get("/users", requireAdmin, async (req, res) => {
  const users = await req.prisma.user.findMany({ orderBy: { username: "asc" } });
  res.render("admin/users", { title: "Manage Users", users });
});

router.post("/users/add", requireAdmin, async (req, res) => {
  const { username, role } = req.body;
  if (!username || !role) return res.status(400).send("Missing fields");
  await req.prisma.user.create({
    data: { username, role, passwordHash: "", avatarUrl: "" },
  });
  res.redirect("/admin/users");
});

router.post("/users/:id/role", requireAdmin, async (req, res) => {
  const { role } = req.body;
  await req.prisma.user.update({
    where: { id: parseInt(req.params.id) },
    data: { role },
  });
  res.redirect("/admin/users");
});

router.post("/users/:id/delete", requireAdmin, async (req, res) => {
  await req.prisma.user.delete({ where: { id: parseInt(req.params.id) } });
  res.redirect("/admin/users");
});

// 🏷️ CATEGORIES management
router.get("/categories", requireAdmin, async (req, res) => {
  const categories = await req.prisma.kudosCategory.findMany({
    orderBy: { label: "asc" },
  });
  res.render("admin/categories", { title: "Manage Categories", categories });
});

router.post("/categories/add", requireAdmin, async (req, res) => {
  const { code, label, icon, defaultMsg } = req.body;
  await req.prisma.kudosCategory.create({
    data: { code, label, icon, defaultMsg },
  });
  res.redirect("/admin/categories");
});

router.post("/categories/:id/delete", requireAdmin, async (req, res) => {
  await req.prisma.kudosCategory.delete({ where: { id: parseInt(req.params.id) } });
  res.redirect("/admin/categories");
});

// 🏆 ACHIEVEMENTS management
router.get("/achievements", requireAdmin, async (req, res) => {
  const achievements = await req.prisma.achievement.findMany({
    orderBy: { title: "asc" },
  });
  res.render("admin/achievements", { title: "Manage Achievements", achievements });
});

router.post("/achievements/add", requireAdmin, async (req, res) => {
  const { code, title, description, color, picture } = req.body;
  await req.prisma.achievement.create({
    data: { code, title, description, color, picture },
  });
  res.redirect("/admin/achievements");
});

router.post("/achievements/:id/delete", requireAdmin, async (req, res) => {
  await req.prisma.achievement.delete({ where: { id: parseInt(req.params.id) } });
  res.redirect("/admin/achievements");
});

export default router;
