// Copyright © 2025–present Lubos Kocman and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0

import express from "express";
import {
  buildRankedUserList,
  buildCategoryRecognitionStats,
  buildFollowRankings,
  buildMonthlyRecognitionByYear,
} from "../utils/stats.js";

export function mountStatsRoutes(app, prisma) {
  const router = express.Router();

  router.get("/", async (req, res) => {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      const [
        totalKudos,
        totalBadges,
        totalUsers,
        totalCategories,
        kudosEntries,
        followEntries,
        nonKudoBadgeAwards,
      ] = await Promise.all([
        prisma.kudos.count(),
        prisma.userBadge.count(),
        prisma.user.count(),
        prisma.kudosCategory.count(),
        prisma.kudos.findMany({
          select: {
            createdAt: true,
            category: {
              select: {
                code: true,
                label: true,
                icon: true,
              },
            },
            fromUser: {
              select: {
                username: true,
                avatarUrl: true,
              },
            },
            recipients: {
              select: {
                user: {
                  select: {
                    username: true,
                    avatarUrl: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: "asc" },
        }),
        prisma.follow.findMany({
          select: {
            follower: {
              select: {
                username: true,
                avatarUrl: true,
              },
            },
            following: {
              select: {
                username: true,
                avatarUrl: true,
              },
            },
          },
        }),
        prisma.userBadge.findMany({
          where: {
            badge: {
              NOT: {
                OR: [
                  { slug: { startsWith: "got-" } },
                  { slug: { startsWith: "gave-" } },
                ],
              },
            },
          },
          select: {
            grantedAt: true,
            badge: {
              select: {
                slug: true,
                title: true,
                picture: true,
              },
            },
          },
        }),
      ]);

      const monthlyRecognitions = buildMonthlyRecognitionByYear(kudosEntries, 4);
      const followRankings = buildFollowRankings(followEntries, 4);
      const categoryRecognitions = buildCategoryRecognitionStats(kudosEntries, thirtyDaysAgo);

      const receivedMap = new Map();
      const givenMap = new Map();
      let recognitionsLast30 = 0;
      let recognitionsPrev30 = 0;
      let kudosLast30 = 0;
      let kudosPrev30 = 0;

      const ensureUser = (map, user) => {
        if (!user) return null;
        if (!map.has(user.username)) {
          map.set(user.username, {
            username: user.username,
            avatarUrl: user.avatarUrl,
            points: 0,
          });
        }
        return map.get(user.username);
      };

      for (const entry of kudosEntries) {
        const createdAt = new Date(entry.createdAt);
        const recognitionCount = (entry.recipients || []).length;

        if (createdAt >= thirtyDaysAgo) {
          recognitionsLast30 += recognitionCount;
          kudosLast30 += 1;
        } else if (createdAt >= sixtyDaysAgo) {
          recognitionsPrev30 += recognitionCount;
          kudosPrev30 += 1;
        }

        const giver = ensureUser(givenMap, entry.fromUser);
        if (giver) {
          giver.points += recognitionCount;
        }

        for (const recipient of entry.recipients || []) {
          const receiver = ensureUser(receivedMap, recipient.user);
          if (receiver) {
            receiver.points += 1;
          }
        }
      }

      const badgeMap = new Map();
      for (const award of nonKudoBadgeAwards) {
        const badge = award.badge;
        if (!badge) continue;

        if (!badgeMap.has(badge.slug)) {
          badgeMap.set(badge.slug, {
            slug: badge.slug,
            title: badge.title,
            picture: badge.picture,
            lifetimeAwards: 0,
            recentAwards: 0,
          });
        }

        const row = badgeMap.get(badge.slug);
        row.lifetimeAwards += 1;
        if (new Date(award.grantedAt) >= thirtyDaysAgo) {
          row.recentAwards += 1;
        }
      }

      const badgesSortedByCommon = Array.from(badgeMap.values()).sort((a, b) => {
        const lifetimeDelta = b.lifetimeAwards - a.lifetimeAwards;
        if (lifetimeDelta !== 0) return lifetimeDelta;

        const recentDelta = b.recentAwards - a.recentAwards;
        if (recentDelta !== 0) return recentDelta;

        return a.title.localeCompare(b.title);
      });

      const badgesSortedByRare = [...badgesSortedByCommon]
        .filter((badge) => badge.lifetimeAwards > 0)
        .sort((a, b) => {
          const lifetimeDelta = a.lifetimeAwards - b.lifetimeAwards;
          if (lifetimeDelta !== 0) return lifetimeDelta;

          const recentDelta = a.recentAwards - b.recentAwards;
          if (recentDelta !== 0) return recentDelta;

          return a.title.localeCompare(b.title);
        });

      const mostCommon = badgesSortedByCommon.slice(0, 8);
      const mostCommonSlugs = new Set(mostCommon.map((badge) => badge.slug));

      const badgeStats = {
        mostCommon,
        rarest: badgesSortedByRare
          .filter((badge) => !mostCommonSlugs.has(badge.slug))
          .slice(0, 8),
      };

      let badgesLast30 = 0;
      let badgesPrev30 = 0;
      for (const award of nonKudoBadgeAwards) {
        const grantedAt = new Date(award.grantedAt);
        if (grantedAt >= thirtyDaysAgo && grantedAt <= now) {
          badgesLast30 += 1;
        } else if (grantedAt >= sixtyDaysAgo && grantedAt < thirtyDaysAgo) {
          badgesPrev30 += 1;
        }
      }

      const allTimeLeaderboards = {
        received: buildRankedUserList(Array.from(receivedMap.values()), "points"),
        given: buildRankedUserList(Array.from(givenMap.values()), "points"),
      };

      const trends = {
        recognitions: {
          current: recognitionsLast30,
          previous: recognitionsPrev30,
          delta: recognitionsLast30 - recognitionsPrev30,
        },
        kudos: {
          current: kudosLast30,
          previous: kudosPrev30,
          delta: kudosLast30 - kudosPrev30,
        },
        badges: {
          current: badgesLast30,
          previous: badgesPrev30,
          delta: badgesLast30 - badgesPrev30,
        },
      };

      res.json({
        totals: {
          kudos: totalKudos,
          badges: totalBadges,
          users: totalUsers,
          categories: totalCategories,
        },
        years: monthlyRecognitions.years,
        monthlyRecognitions: monthlyRecognitions.byYear,
        followRankings: {
          mostFollowed: followRankings.mostFollowed,
          mostFollowing: followRankings.mostFollowing,
        },
        allTimeLeaderboards,
        trends,
        categoryRecognitions,
        badgeStats,
      });
    } catch (err) {
      console.error("💥 Stats API error:", err);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  app.use("/api/stats", router);
}
