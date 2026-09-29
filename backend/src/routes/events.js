// backend/src/routes/events.js
// Copyright © 2025–present Lubos Kocman and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0
//
// Event badges: an admin opens a claim window for a badge that was merged
// into kudos-badges in advance, and shows the event's link as a QR code on
// slides or at the booth. Anyone with the link can claim the badge while the
// window is open. See docs/events.md.

import express from "express";
import QRCode from "qrcode";
import { customAlphabet } from "nanoid";
import { grantBadge, getBaseUrl } from "../utils/grantBadge.js";

// People may type the link off a slide, so leave out look-alike characters
// (0/o, 1/l/i) and use one case; lookups are case-insensitive for phones that
// capitalise the first letter. 31^10 is ~50 bits: not guessable in the few
// days an event is open.
const newToken = customAlphabet("23456789abcdefghjkmnpqrstuvwxyz", 10);

// Signing up for an openSUSE account can take a while. Someone who opened the
// link while the window was open may still finish claiming this long after it
// ends, in the same browser. Admins should cover the whole day anyway: email
// verification often opens a different browser, which starts without it.
const CLAIM_GRACE_MS = 60 * 60 * 1000;

export function eventClaimUrl(token) {
  return `${getBaseUrl()}/c/${token}`;
}

function eventState(event, now = new Date()) {
  if (event.closed) return "closed";
  if (now < event.startsAt) return "upcoming";
  if (now > event.endsAt) return "ended";
  return "open";
}

function canClaim(event, seenAt, now = new Date()) {
  const state = eventState(event, now);
  if (state === "open") return true;
  if (state !== "ended" || !seenAt) return false;
  return (
    seenAt >= event.startsAt.getTime() &&
    seenAt <= event.endsAt.getTime() &&
    now.getTime() <= event.endsAt.getTime() + CLAIM_GRACE_MS
  );
}

function parseDate(value) {
  const date = new Date(value);
  return value && !Number.isNaN(date.getTime()) ? date : null;
}

const badgeFields = { slug: true, title: true, description: true, picture: true };

// Stewards help run the booth, so they can find the event links without an
// admin. Ended events stay listed a while so they can still see the count.
const STEWARD_ROLES = ["ADMIN", "STEWARD"];
const RECENTLY_ENDED_MS = 14 * 24 * 60 * 60 * 1000;

export function mountEventRoutes(app, prisma) {
  const router = express.Router();

  const findByToken = (token) =>
    prisma.badgeEvent.findUnique({
      where: { token: String(token).toLowerCase() },
      include: { badge: { select: { id: true, ...badgeFields } } },
    });

  // ==========================================================
  // 📋 GET /api/events — current events, for stewards and admins
  // ==========================================================
  // Read-only: no one who opened the window, and no claimers. Setting events
  // up stays under /api/admin/events.
  router.get("/", async (req, res) => {
    if (!STEWARD_ROLES.includes(req.currentUser?.role)) {
      return res.status(403).json({ error: "Stewards and admins only" });
    }
    try {
      const events = await prisma.badgeEvent.findMany({
        where: { endsAt: { gte: new Date(Date.now() - RECENTLY_ENDED_MS) } },
        orderBy: { startsAt: "asc" },
        include: { badge: { select: badgeFields }, _count: { select: { claims: true } } },
      });
      res.json(
        events.map((e) => ({
          name: e.name,
          token: e.token,
          url: eventClaimUrl(e.token),
          startsAt: e.startsAt,
          endsAt: e.endsAt,
          state: eventState(e),
          claims: e._count.claims,
          badge: e.badge,
        }))
      );
    } catch (err) {
      console.error("💥 Failed to list events for stewards:", err);
      res.status(500).json({ error: "Failed to list events" });
    }
  });

  // ==========================================================
  // 🎟️ GET /api/events/:token — what the claim page shows
  // ==========================================================
  router.get("/:token", async (req, res) => {
    try {
      const event = await findByToken(req.params.token);
      if (!event) return res.status(404).json({ error: "Not found" });

      const state = eventState(event);

      // Remember that this browser saw the link in time; see CLAIM_GRACE_MS.
      // Not for the booth display, which polls this all day.
      if (state === "open" && req.query.display === undefined) {
        req.session.seenEvents = { ...req.session.seenEvents, [event.token]: Date.now() };
      }
      const seenAt = req.session.seenEvents?.[event.token];

      const [claims, held] = await Promise.all([
        prisma.userBadge.count({ where: { eventId: event.id } }),
        req.currentUser
          ? prisma.userBadge.findUnique({
              where: { userId_badgeId: { userId: req.currentUser.id, badgeId: event.badgeId } },
            })
          : null,
      ]);

      const { id, ...badge } = event.badge;
      res.json({
        name: event.name,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        state,
        claimable: canClaim(event, seenAt),
        claims,
        claimed: !!held,
        url: eventClaimUrl(event.token),
        badge,
      });
    } catch (err) {
      console.error("💥 Failed to load event:", err);
      res.status(500).json({ error: "Failed to load event" });
    }
  });

  // ==========================================================
  // 🏅 POST /api/events/:token/claim — claim the event's badge
  // ==========================================================
  router.post("/:token/claim", async (req, res) => {
    try {
      const user = req.currentUser;
      if (!user) return res.status(401).json({ error: "Log in to claim this badge" });
      if (user.role === "BOT" || user.role === "TEAM") {
        return res.status(403).json({ error: "Event badges are for people" });
      }

      const event = await findByToken(req.params.token);
      if (!event) return res.status(404).json({ error: "Not found" });

      if (!canClaim(event, req.session.seenEvents?.[event.token])) {
        return res.status(403).json({ error: "This badge can't be claimed right now", state: eventState(event) });
      }

      const { alreadyGranted, permalink } = await grantBadge(prisma, {
        user,
        badge: event.badge,
        eventId: event.id,
      });

      if (!alreadyGranted) {
        console.log(`🎟️ ${user.username} claimed '${event.badge.slug}' at event '${event.name}'`);
      }
      res.json({ claimed: true, alreadyGranted, permalink });
    } catch (err) {
      console.error("💥 Failed to claim event badge:", err);
      res.status(500).json({ error: "Failed to claim badge" });
    }
  });

  // ==========================================================
  // 🔳 GET /api/events/:token/qr.svg — QR code for slides and the booth
  // ==========================================================
  // Public on purpose: whoever can load it already knows the link. Always
  // black on white with a full quiet zone, whatever the site theme, because
  // phone cameras struggle with anything else on a projector.
  router.get("/:token/qr.svg", async (req, res) => {
    try {
      const event = await findByToken(req.params.token);
      if (!event) return res.status(404).json({ error: "Not found" });

      const svg = await QRCode.toString(eventClaimUrl(event.token), {
        type: "svg",
        errorCorrectionLevel: "M",
        margin: 4,
        color: { dark: "#000000", light: "#ffffff" },
      });

      res.set("Content-Type", "image/svg+xml");
      if (req.query.download !== undefined) {
        res.set("Content-Disposition", `attachment; filename="kudos-${event.badge.slug}-qr.svg"`);
      }
      res.send(svg);
    } catch (err) {
      console.error("💥 Failed to render event QR code:", err);
      res.status(500).json({ error: "Failed to render QR code" });
    }
  });

  app.use("/api/events", router);

  // ----------------------------------------------------------
  // Admin: set up and watch events
  // ----------------------------------------------------------
  const admin = express.Router();

  admin.use((req, res, next) => {
    if (req.currentUser?.role !== "ADMIN") {
      return res.status(403).json({ error: "Admin privileges required" });
    }
    next();
  });

  const withSummary = (event, claims) => ({
    id: event.id,
    name: event.name,
    token: event.token,
    url: eventClaimUrl(event.token),
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    closed: event.closed,
    state: eventState(event),
    createdBy: event.createdBy,
    createdAt: event.createdAt,
    badge: event.badge,
    claims,
  });

  // ==========================================================
  // 📋 GET /api/admin/events — all events, newest first
  // ==========================================================
  admin.get("/", async (req, res) => {
    try {
      const events = await prisma.badgeEvent.findMany({
        orderBy: { startsAt: "desc" },
        include: { badge: { select: badgeFields }, _count: { select: { claims: true } } },
      });
      res.json(events.map((e) => withSummary(e, e._count.claims)));
    } catch (err) {
      console.error("💥 Failed to list events:", err);
      res.status(500).json({ error: "Failed to list events" });
    }
  });

  // ==========================================================
  // ➕ POST /api/admin/events — open a claim window for a badge
  // ==========================================================
  admin.post("/", async (req, res) => {
    try {
      const name = String(req.body.name || "").trim();
      const startsAt = parseDate(req.body.startsAt);
      const endsAt = parseDate(req.body.endsAt);

      if (!name || !req.body.badgeSlug || !startsAt || !endsAt) {
        return res.status(400).json({ error: "Name, badge, start and end are required" });
      }
      if (endsAt <= startsAt) {
        return res.status(400).json({ error: "The event must end after it starts" });
      }

      const badge = await prisma.badge.findUnique({ where: { slug: req.body.badgeSlug } });
      if (!badge || badge.retired) return res.status(404).json({ error: "Badge not found" });

      const event = await prisma.badgeEvent.create({
        data: {
          name,
          token: newToken(),
          badgeId: badge.id,
          startsAt,
          endsAt,
          createdBy: req.currentUser.username,
        },
        include: { badge: { select: badgeFields } },
      });

      console.log(`🎟️ ${req.currentUser.username} set up event '${name}' for '${badge.slug}'`);
      res.status(201).json(withSummary(event, 0));
    } catch (err) {
      console.error("💥 Failed to create event:", err);
      res.status(500).json({ error: "Failed to create event" });
    }
  });

  // ==========================================================
  // 🔍 GET /api/admin/events/:id — event with everyone who claimed
  // ==========================================================
  admin.get("/:id", async (req, res) => {
    try {
      const event = await prisma.badgeEvent.findUnique({
        where: { id: Number(req.params.id) },
        include: {
          badge: { select: badgeFields },
          claims: {
            orderBy: { grantedAt: "asc" },
            select: { grantedAt: true, user: { select: { username: true, fullName: true } } },
          },
        },
      });
      if (!event) return res.status(404).json({ error: "Event not found" });

      res.json({
        ...withSummary(event, event.claims.length),
        claimedBy: event.claims.map((c) => ({ ...c.user, grantedAt: c.grantedAt })),
      });
    } catch (err) {
      console.error("💥 Failed to load event:", err);
      res.status(500).json({ error: "Failed to load event" });
    }
  });

  // ==========================================================
  // ✏️ PATCH /api/admin/events/:id — rename, move the window, close/reopen
  // ==========================================================
  // Closing stops new claims, e.g. when the link leaked. It never takes a badge
  // back: badges are statistics and are never revoked (docs/badges.md). Only
  // the window can change; the badge and the link stay what was printed.
  admin.patch("/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const existing = await prisma.badgeEvent.findUnique({ where: { id } });
      if (!existing) return res.status(404).json({ error: "Event not found" });

      const data = {};
      if (req.body.name !== undefined) {
        data.name = String(req.body.name).trim();
        if (!data.name) return res.status(400).json({ error: "Name can't be empty" });
      }
      for (const key of ["startsAt", "endsAt"]) {
        if (req.body[key] === undefined) continue;
        data[key] = parseDate(req.body[key]);
        if (!data[key]) return res.status(400).json({ error: `Invalid ${key}` });
      }
      if (req.body.closed !== undefined) data.closed = !!req.body.closed;

      if ((data.endsAt || existing.endsAt) <= (data.startsAt || existing.startsAt)) {
        return res.status(400).json({ error: "The event must end after it starts" });
      }

      const event = await prisma.badgeEvent.update({
        where: { id },
        data,
        include: { badge: { select: badgeFields }, _count: { select: { claims: true } } },
      });

      console.log(`🎟️ ${req.currentUser.username} updated event '${event.name}':`, data);
      res.json(withSummary(event, event._count.claims));
    } catch (err) {
      console.error("💥 Failed to update event:", err);
      res.status(500).json({ error: "Failed to update event" });
    }
  });

  app.use("/api/admin/events", admin);
}
