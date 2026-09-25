# openSUSE Kudos

Kudos is openSUSE's contributor recognition platform. Live at
https://kudos.opensuse.org.

- **Peer-to-peer recognition is the core feature.** Any contributor can thank
  another with a kudo; people can share their kudos and badges on social media
  if they choose to. Teams (a `User` with `role = TEAM`) can be recognised as a
  group too.
- **Badges are also a measurement tool, not just gamification.** Badge holders
  tell us how many people actually contribute to Leap, Tumbleweed, the wiki and
  so on — real insight into the project. Treat badge data as statistics worth
  keeping accurate (e.g. badges are never revoked; see `docs/teams.md`).

## This repository

- `backend/` — Express 5 API with Prisma (`backend/prisma/schema.prisma`).
  Routes emit activity on `eventBus` (`backend/src/routes/now.js`), which is
  broadcast publicly on `/api/now/stream`.
- `frontend/` — Vue SPA. Theme and colours live in `frontend/src/assets/themes/`.
- `notify/` — `kudos-notify`, a separate service that reads `/api/now/stream`
  and sends all user-facing email (plain-text templates in `notify/templates/`).
  New email notifications go here: emit an activity event from the backend
  with usernames only (the stream is public) and let the notifier resolve
  addresses with its bot token.
- `systemd/` — units for the backend, notifier, init and backup.
- `docs/teams.md` — design and rationale for teams.

## Related projects

- https://github.com/openSUSE/kudos-badges — all badge definitions and artwork.
- https://src.opensuse.org/kudos/kudos-bots — bots (Matrix, git scanning, …)
  that grant badges and post activity through the bot API.
- https://src.opensuse.org/kudos — RPM spec files for kudos and kudos-badges.

## Build and deployment

The packages under src.opensuse.org/kudos are built in the Open Build Service
project https://build.opensuse.org/project/show/openSUSE:infrastructure:kudos.
`kudos-prod.infra.opensuse.org` installs them with `zypper dup`, and regular
automatic updates on the machines roll new builds out without manual action —
so a merged change reaches production once OBS rebuilds the package.

Changes here that affect packaging — new dependencies, new installed files or
directories, systemd units, env variables — need a matching spec change in
src.opensuse.org/kudos. Any RPM spec work should follow
https://github.com/openSUSE/openSUSE-packaging-skill.

## Principles

- Prefer moderation over gatekeeping: allow the action and give admins an undo,
  rather than denylists or reserved names that block real contributors.
- Frontend colours: use only the LCP colour scheme variables from our CSS; no
  ad-hoc hex/rgb values.
