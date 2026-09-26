// Copyright © 2025–present Lubos Kocman and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0
//
// Sync badge definitions from kudos-badges.
//
// Badge definitions live in the kudos-badges repository next to their artwork:
// meta/<slug>.json for the image and link, locales/en.json for the English
// title and description. The kudos-badges package installs them under
// /usr/share/kudos/badges, and this module upserts them into the Badge table
// on every backend start, so a badge merged there appears here once the new
// package is installed. See docs/badges.md.
//
// Badges are never deleted: one that disappears from kudos-badges is only
// marked retired, because its holders keep it and badge counts are statistics
// we rely on.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * Where the kudos-badges files are. In production backend/public/badges is a
 * symlink to /usr/share/kudos/badges; in development runme-*.sh clones the
 * repository into frontend/public/badges.
 */
export function resolveKudosBadgesDir() {
  if (process.env.KUDOS_BADGES_DIR) return process.env.KUDOS_BADGES_DIR;
  const candidates = [
    path.join(backendDir, "public/badges"),
    path.join(backendDir, "../frontend/public/badges"),
  ];
  return candidates.find((dir) => fs.existsSync(path.join(dir, "meta"))) || candidates[0];
}

/**
 * Read the kudos-badges definitions from disk. Returns `{ badges, problems }`: badges that are
 * complete enough to sync, and a note for each entry that was skipped.
 * Returns `badges: null` when there are none at all (an older
 * kudos-badges package without meta/).
 */
export function loadKudosBadges(dir) {
  const metaDir = path.join(dir, "meta");
  if (!fs.existsSync(metaDir)) return { badges: null, problems: [] };

  const problems = [];
  let en = {};
  try {
    en = JSON.parse(fs.readFileSync(path.join(dir, "locales/en.json"), "utf8"));
  } catch (err) {
    problems.push(`locales/en.json: ${err.message}`);
  }

  const badges = [];
  for (const file of fs.readdirSync(metaDir).filter((f) => f.endsWith(".json")).sort()) {
    const slug = file.replace(/\.json$/, "");
    try {
      if (!SLUG_RE.test(slug)) throw new Error("invalid slug");
      const meta = JSON.parse(fs.readFileSync(path.join(metaDir, file), "utf8"));
      const strings = en[slug];
      if (typeof meta.image !== "string" || !meta.image) throw new Error("missing image");
      if (!strings?.title || !strings?.description) throw new Error("missing English title or description");

      badges.push({
        slug,
        title: strings.title,
        description: strings.description,
        picture: `/badges/${meta.image}`,
        link: typeof meta.link === "string" ? meta.link : null,
        retired: meta.retired === true,
      });
    } catch (err) {
      problems.push(`meta/${file}: ${err.message}`);
    }
  }
  return { badges, problems };
}

/**
 * Upsert the kudos-badges definitions into the Badge table. They are marked
 * `fromKudosBadges` so the admin UI knows their text is owned by kudos-badges.
 * Team bindings and grants are runtime state and are left alone.
 */
export async function syncKudosBadges(prisma, { dir = resolveKudosBadgesDir(), log = console } = {}) {
  const { badges, problems } = loadKudosBadges(dir);
  for (const p of problems) log.warn(`🏅 kudos-badges: skipped ${p}`);

  if (badges === null) {
    log.warn(`🏅 No kudos-badges metadata in ${dir} (older kudos-badges without meta/?); badges left as they are.`);
    return { synced: 0, retired: 0 };
  }

  for (const b of badges) {
    const data = {
      title: b.title,
      description: b.description,
      picture: b.picture,
      link: b.link,
      retired: b.retired,
      fromKudosBadges: true,
    };
    await prisma.badge.upsert({
      where: { slug: b.slug },
      update: data,
      create: { slug: b.slug, ...data },
    });
  }

  // Retire badges that were removed from kudos-badges. Skip this when
  // anything failed to load: a broken package must not retire half the badges.
  let retired = 0;
  if (problems.length === 0 && badges.length > 0) {
    const result = await prisma.badge.updateMany({
      where: { fromKudosBadges: true, retired: false, slug: { notIn: badges.map((b) => b.slug) } },
      data: { retired: true },
    });
    retired = result.count;
  }

  log.log(`🏅 Badges synced from kudos-badges in ${dir}: ${badges.length} badges, ${retired} newly retired.`);
  return { synced: badges.length, retired };
}
