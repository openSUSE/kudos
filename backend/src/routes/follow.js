// backend/src/routes/follow.js
// SPDX-License-Identifier: Apache-2.0

import express from "express";

export function mountFollowRoutes(app, prisma) {
  const router = express.Router();

  /**
   * Convert username → userId
   */
  async function usernameToId(username) {
    const u = await prisma.user.findUnique({
      where: { username },
      select: { id: true }
    });
    return u?.id || null;
  }

  /**
   * POST /api/follow/:username  (Follow user)
   */
  router.post("/:username", async (req, res) => {
    const current = req.session.user?.username;
    const target = req.params.username;

    if (!current) return res.status(401).json({ error: "Not logged in" });
    if (current === target)
      return res.status(400).json({ error: "Cannot follow yourself" });

    const currentId = await usernameToId(current);
    const targetId = await usernameToId(target);

    if (!currentId || !targetId)
      return res.status(404).json({ error: "User not found" });

    await prisma.follow.create({
      data: {
        followerId: currentId,
        followingId: targetId
      }
    });

    res.json({ ok: true });
  });

  /**
   * DELETE /api/follow/:username  (Unfollow user)
   */
  router.delete("/:username", async (req, res) => {
    const current = req.session.user?.username;
    const target = req.params.username;

    if (!current) return res.status(401).json({ error: "Not logged in" });

    const currentId = await usernameToId(current);
    const targetId = await usernameToId(target);

    if (!currentId || !targetId)
      return res.status(404).json({ error: "User not found" });

    await prisma.follow.deleteMany({
      where: {
        followerId: currentId,
        followingId: targetId
      }
    });

    res.json({ ok: true });
  });

  /**
   * GET /api/follow/:username/followers
   * List users who follow :username
   */
  router.get("/:username/followers", async (req, res) => {
    const username = req.params.username;
    const userId = await usernameToId(username);

    if (!userId) return res.json([]);

    const rows = await prisma.follow.findMany({
      where: { followingId: userId },
      include: { follower: true }
    });

    res.json(rows.map(r => r.follower));
  });

  /**
   * GET /api/follow/:username/following
   * List users :username is following
   */
  router.get("/:username/following", async (req, res) => {
    const username = req.params.username;
    const userId = await usernameToId(username);

    if (!userId) return res.json([]);

    const rows = await prisma.follow.findMany({
      where: { followerId: userId },
      include: { following: true }
    });

    res.json(rows.map(r => r.following));
  });

  /**
   * GET /api/follow/:username/status
   * Is logged-in user following :username?
   */
  router.get("/:username/status", async (req, res) => {
    const current = req.session.user?.username;
    const target = req.params.username;

    if (!current) return res.json({ loggedIn: false, following: false });

    const currentId = await usernameToId(current);
    const targetId = await usernameToId(target);

    if (!currentId || !targetId)
      return res.json({ loggedIn: true, following: false });

    const link = await prisma.follow.findFirst({
      where: {
        followerId: currentId,
        followingId: targetId
      }
    });

    res.json({
      loggedIn: true,
      following: !!link
    });
  });

  app.use("/api/follow", router);
}
