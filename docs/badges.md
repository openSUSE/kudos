# Badges — where they are defined and how they get here

## The short version

A badge is defined entirely in
[openSUSE/kudos-badges](https://github.com/openSUSE/kudos-badges):

```
kudos-badges/
  mentor.png                 artwork (+ previews/200/, previews/800/)
  meta/mentor.json           { "image": "mentor.png", "link": "…", "retired": false }
  locales/en.json            { "mentor": { "title": "…", "description": "…" } }
  locales/<lang>.json        translations, managed via Weblate
```

The file name in `meta/` is the badge's slug, its permanent ID. CI there
(`scripts/check-badges.mjs`) fails a pull request when a top-level png has
no metadata, a badge has no English title or description, a preview is
missing, or a translation refers to a badge that doesn't exist.

Once merged, OBS rebuilds `kudos-badges`, production installs it with
`zypper dup`, and Kudos picks the badge up by itself. **Adding or changing a
badge needs no change in this repository.**

## Why

Badge artwork always lived in kudos-badges, but titles and descriptions were
hardcoded in `backend/prisma/seed-prod.js` (and again in `seed.js`, and a
third time as translatable strings in `frontend/src/locales/strings.*.json`).
A badge merged in kudos-badges did nothing until someone also changed kudos
and the seed ran again, and the three copies had drifted apart. Keeping the
metadata next to the art makes one pull request the whole change.

## How the sync works

`backend/src/services/kudosBadges.js` runs once each time the backend starts
(`app.js`, before it starts listening) and upserts every kudos-badges badge by
slug:

- `title`, `description`, `picture` and `link` come from kudos-badges, and
  the badge is marked `fromKudosBadges`. Those fields are owned by kudos-badges:
  the admin UI shows them read-only and the admin API refuses to edit or
  delete them, because the next sync would silently undo that.
- Team bindings (`teamUserId`) and grants are runtime state; the sync never
  touches them.
- Badges created in the admin UI (`fromKudosBadges = false`) are left alone.
- **Nothing is ever deleted.** A badge that disappears from
  kudos-badges (or has `"retired": true`) is marked `retired`: hidden from
  `GET /api/badges`, but still on the profile of everyone who earned it.
  Badge counts are statistics we rely on (see CLAUDE.md), and badges are
  never revoked. Putting the meta file back un-retires it.
- If any meta file fails to load, the sync still upserts the good ones
  but retires nothing, so a broken package can't hide half the badges.
- If there is no `meta/` directory at all (a `kudos-badges` from before this
  change), the sync logs a warning and leaves the database alone. The two
  packages can therefore be updated in either order.

kudos-badges is read from `KUDOS_BADGES_DIR` if set; otherwise from
`backend/public/badges` (in production a symlink to `/usr/share/kudos/badges`
created by the kudos spec), falling back to `frontend/public/badges`, where
`runme-*.sh` clones kudos-badges for development. The dev seed (`seed.js`)
calls the same sync.

### Getting a new package picked up

The sync runs on start, so a new `kudos-badges` needs `kudos.service`
restarted. The kudos spec does that with an RPM file trigger on
`/usr/share/kudos/badges`, which fires whenever `kudos-badges` installs or
updates files there.

## Translations

Badge strings are translated in a separate Weblate component over
`kudos-badges/locales/*.json`, with `en.json` as the source. The locale codes
match the app's (`strings.<code>.json`), e.g. `pt-BR`, `cs-u-sd-cz642`.

The frontend doesn't bundle them, since they ship with a different package.
`frontend/src/composables/useBadgeText.js` fetches `/badges/locales/<lang>.json`
when a language is loaded and exposes `badgeTitle(badge)` /
`badgeDescription(badge)`, which fall back to the English text from the API.
Always render badge text through those helpers, not `badge.title`.

Server-rendered text — share images, Open Graph tags, email — stays English.

## Migration (2026-09)

The 52 badges in `seed-prod.js` were exported into kudos-badges `meta/` and
`locales/en.json`, and their existing translations moved from
`strings.*.json` to kudos-badges `locales/`. Where the seed and
`strings.en.json` disagreed, the seed's text won: it's what the API and
production were already serving. The first sync after deployment adopts the
existing rows (same slugs), so IDs, grants and team bindings are unchanged.
