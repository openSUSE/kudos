// Copyright © 2025–present Lubos Kocman and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0

const monthLabels = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function getRankMedal(rank) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  if (rank === 4) return "🥔";
  return `${rank}.`;
}

export function buildRankGroups(items, pointsKey = "points", limit = 4) {
  const sortedItems = [...items].sort((a, b) => {
    const pointDelta = (b[pointsKey] || 0) - (a[pointsKey] || 0);
    if (pointDelta !== 0) return pointDelta;
    return a.username.localeCompare(b.username);
  });

  const groups = [];
  let currentPoints = null;

  for (const item of sortedItems) {
    const itemPoints = item[pointsKey] || 0;

    if (currentPoints !== itemPoints) {
      if (groups.length >= limit) break;

      groups.push({
        rank: groups.length + 1,
        points: itemPoints,
        users: [item],
      });
      currentPoints = itemPoints;
    } else {
      groups[groups.length - 1].users.push(item);
    }
  }

  return groups;
}

export function buildRankedUserList(items, pointsKey = "points") {
  const sortedItems = [...items].sort((a, b) => {
    const pointDelta = (b[pointsKey] || 0) - (a[pointsKey] || 0);
    if (pointDelta !== 0) return pointDelta;
    return a.username.localeCompare(b.username);
  });

  const ranked = [];
  let previousPoints = null;
  let currentRank = 0;

  for (let index = 0; index < sortedItems.length; index += 1) {
    const item = sortedItems[index];
    const points = item[pointsKey] || 0;

    if (points !== previousPoints) {
      currentRank = index + 1;
      previousPoints = points;
    }

    ranked.push({
      ...item,
      rank: currentRank,
      points,
    });
  }

  return ranked;
}

function ensureCountUser(map, user) {
  if (!user) return;

  const key = user.username;
  if (!map.has(key)) {
    map.set(key, {
      username: user.username,
      avatarUrl: user.avatarUrl,
      points: 0,
    });
  }

  map.get(key).points += 1;
}

export function buildMonthlyRecognitionByYear(kudosEntries, limit = 4) {
  const yearBuckets = new Map();

  for (const entry of kudosEntries) {
    const createdAt = new Date(entry.createdAt);
    const year = createdAt.getFullYear();
    const month = createdAt.getMonth();

    if (!yearBuckets.has(year)) {
      yearBuckets.set(year, Array.from({ length: 12 }, () => new Map()));
    }

    const monthMap = yearBuckets.get(year)[month];
    for (const recipient of entry.recipients || []) {
      ensureCountUser(monthMap, recipient.user);
    }
  }

  const years = Array.from(yearBuckets.keys()).sort((a, b) => b - a);
  const byYear = {};

  for (const year of years) {
    byYear[year] = yearBuckets.get(year).map((monthMap, monthIndex) => ({
      monthIndex,
      monthLabel: monthLabels[monthIndex],
      groups: buildRankGroups(Array.from(monthMap.values()), "points", limit),
    }));
  }

  return {
    years,
    byYear,
  };
}

export function buildFollowRankings(followEntries, limit = 4) {
  const followedMap = new Map();
  const followingMap = new Map();

  for (const entry of followEntries) {
    ensureCountUser(followedMap, entry.following);
    ensureCountUser(followingMap, entry.follower);
  }

  return {
    mostFollowed: buildRankGroups(Array.from(followedMap.values()), "points", limit),
    mostFollowing: buildRankGroups(Array.from(followingMap.values()), "points", limit),
  };
}

export function buildCategoryRecognitionStats(kudosEntries, sinceDate) {
  const categoryMap = new Map();

  for (const entry of kudosEntries) {
    const category = entry.category;
    if (!category) continue;

    if (!categoryMap.has(category.code)) {
      categoryMap.set(category.code, {
        code: category.code,
        label: category.label,
        icon: category.icon,
        lifetimeRecognitions: 0,
        recentRecognitions: 0,
      });
    }

    const recognitionCount = (entry.recipients || []).length;
    const row = categoryMap.get(category.code);
    row.lifetimeRecognitions += recognitionCount;

    if (sinceDate && new Date(entry.createdAt) >= sinceDate) {
      row.recentRecognitions += recognitionCount;
    }
  }

  return Array.from(categoryMap.values()).sort((a, b) => {
    const lifetimeDelta = b.lifetimeRecognitions - a.lifetimeRecognitions;
    if (lifetimeDelta !== 0) return lifetimeDelta;

    const recentDelta = b.recentRecognitions - a.recentRecognitions;
    if (recentDelta !== 0) return recentDelta;

    return a.label.localeCompare(b.label);
  });
}