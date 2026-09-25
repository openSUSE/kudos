# Teams — design & implementation plan

Status: draft, branch `teams`, **uncommitted and local only — do not push.**
Nothing here is committed policy yet.

## Where this stands (2026-09-17)

Done and tested:

- Schema: `Role.TEAM`, `MembershipState`, `TeamProfile`, `TeamMember`,
  `TeamEvent`, `Badge.teamUserId`. Applied with `npx prisma db push` (this
  project has no `migrations/` directory).
- `backend/src/routes/teams.js` — list, create, detail, join, approve,
  remove/leave. 5 teams/day/user, 14-day auto-approve on read,
  empty-team recovery (next joiner is auto-approved). Mounted in `app.js`.
- Members may thank their own team; only sole-member teams are blocked
  (`kudos.js`, just after the existing self-recognition check), and
  `KudosRecipient.internal` records inside-the-team kudos at send time.
- `EMERITUS` membership state with rejoin, and a former-members list.
- Badge slot on every team, `TBD` when unbound, plus the admin-only bind
  endpoint. A bound badge becomes the team avatar.
- Teams section on every user profile above social handles, fed by
  `GET /api/teams/user/:username`; team accounts show their roster in the same
  slot instead.
- Frontend: teams button in `Header.vue` — "Join Team" (also shown logged
  out, via `/api/login?returnTo=/teams`) or "My Teams" for members, with a
  heartbeat and a count while invites or join requests wait for you
  (`GET /api/teams/me/status`); `/teams` route,
  `TeamsView.vue` (join-or-create box, roster, approvals, remove/leave),
  people+teams grouping in the `/kudos/new` recipient picker, en strings.
- `backend/src/utils/teamBadge.js` — `syncBadgeTeamMembership()`. **Wired into
  `routes/badges.js` and `routes/bot.js`.**
- Admin moderation — a `Teams` tab in `AdminView.vue` over six endpoints in
  `routes/admin.js`. See [Admin moderation](#admin-moderation) below.
- Invitations (2026-09-25): members and admins invite existing users, who
  join once they accept; admins can also add someone directly. See
  [Invitations](#invitations) below.

Next, in order:

1. **`routes/admin.js` grant site is not wired**, deliberately. It is already
   broken on its own: it passes `grantedBy` to `prisma.userBadge.create()` and
   `UserBadge` has no such column, so that endpoint throws a Prisma validation
   error today. Decide first — drop the field, or add a `grantedBy` column for
   attribution — then add the `syncBadgeTeamMembership()` call.
2. Backfilling existing badge holders onto a roster is *done*, as an opt-in on
   the bind — no separate migration script needed. Still to do: actually run it
   for `hero` → Heroes, confirmed by Lubos.
3. `Badge.emeritusTitle` — the bind UI landed without it.
4. Finish the bind list — the judgment-call badges below are unconfirmed.

Not started: leaderboard filtering, team leaderboard, merge/rename tooling,
`/teams/manage`.

## Admin moderation

Teams are self-managing by design, so the admin surface deliberately covers
only what a team cannot fix from the inside: a name that should never have been
claimed, and a roster with nobody left to edit it. Everything is admin-only
(`isAdmin`), not admin-or-bot like the rest of `routes/admin.js`.

| Endpoint | For |
| --- | --- |
| `GET /api/admin/teams` | every team including archived, with active/pending/alumni counts, kudos received, creator, bound badge |
| `GET /api/admin/teams/:username` | full roster in all three states plus the last 30 `TeamEvent` rows, resolved to usernames |
| `PATCH /api/admin/teams/:username` | `{ archived: bool }` — archive or restore |
| `DELETE /api/admin/teams/:username` | erase the team; `?force=1` required once it holds kudos |
| `DELETE /api/admin/teams/:username/members/:member` | remove anyone, in any state |

### Archive is the default answer, delete is the exception

A team that ran out of members is not a fake team. Archiving hides it from the
directory and blocks joins while the roster, the kudos and the history survive,
which is what "everyone left" actually calls for. Deletion is for a team that
should never have existed.

So deletion refuses with `409` while the team holds kudos, mirroring the
existing badge-delete guard, and only proceeds with `?force=1`. Praise
addressed to a team is somebody's words, and a duplicate is nearly always
better archived than erased. The UI turns that `409` into a second confirm
quoting the count.

The delete path also clears what no foreign key covers: `TeamEvent` has no
relation to hang a cascade on, a bound badge is unbound rather than deleted
(the badge outlives the team), and a kudo left with no recipients at all is
removed because the feed cannot render one. `TeamProfile` and `TeamMember`
cascade from the `User` row.

### Admin removal deletes the row, like any other removal

Admin removal reuses the member-removal semantics from `routes/teams.js`: the
row goes away rather than becoming `EMERITUS`. Removal by someone else is a
correction, and listing the person as an alumnus would put words in their
mouth. A `PENDING` request is removed silently — being told you were ejected
from a team you never got into is only confusing.

### Admin team creation

Admins skip the 5-per-day rate limit, and can pass `joinAsMember: false` to
create a team they are not in — the normal shape for an official group: the
admin sets it up, and the first real member is auto-approved because an empty
team has nobody to ask. The admin tab defaults that checkbox to off, the
opposite of `/teams`, where the creator is always the founding member.

### Binding a badge to a team, and the backfill

`PUT /api/teams/:username/badge` (admin-only) sets a team's membership badge. It is
surfaced in the Teams tab, which lists every badge with its holder count.

Binding on its own only affects *future* grants — `syncBadgeTeamMembership()`
runs when a badge is granted, so a team that adopts an existing badge starts
with an empty roster even though the badge has holders. Passing
`addHolders: true` backfills them as `ACTIVE`.

The backfill is opt-in rather than automatic because the two cases pull in
opposite directions. A working-group badge like `release` has holders who *are*
the team, and importing them is the whole point. A long-lived award like `hero`
has holders accumulated across years who were never one group, and a 200-person
roster cannot be undone in one click. The admin sees the count and decides.

It skips anyone already on the roster — importantly including `EMERITUS`
members, who left on purpose and must not be dragged back by an import — and
ignores `TEAM` and `BOT` holders. Re-running it adds nobody twice.

Binding also works the other way, and that part is not opt-in: every `ACTIVE`
member who does not hold the badge yet is granted it, through the normal
activity pipeline, so they are notified as for any other grant. The roster and
the holder list start out matching. People who self-join later are *not*
granted it — joining must not let anyone award themselves a badge — so an admin
re-saving the same badge later is how those gaps get closed; it only grants to
members still missing it.

### Why there is no reserved-name list

An earlier version refused a list of official-sounding names (`release-team`,
`board`, `opensuse-*`, …) on the theory that such groups need an authority
behind them, and told the user to ask an admin instead.

It was removed. The people most likely to type `release-team` are the release
team, so the gate fired almost exclusively on legitimate users — Lubos hit it
creating his own team — and "that name is not yours to claim" is a poor first
impression for exactly the contributors this feature is meant to serve. The
list was also a guess that blocked a handful of names while missing every other
real working group, buying suspicion rather than safety.

What replaced it is structural rather than nominal:

- A name already held by a user or team is still rejected, now
  **case-insensitively** (see below).
- An admin can archive or delete anything that turns out to be fake.
- A team can never become a login (see below).

### Two collisions the name list was gesturing at, now closed properly

Teams are `User` rows, so a team name and a person's username share one column.
Removing the name list made it worth fixing that properly:

1. **Case-sensitive uniqueness.** `normalizeTeamName()` lowercases, human
   usernames arrive from OIDC with their original case, and SQLite's default
   collation is case-sensitive — so the taken-name check for `bobsmith` sailed
   past the existing user `BobSmith` and created a lookalike team.
   `findUserByNameInsensitive()` in `routes/teams.js` now tries the unique
   index first and falls back to an in-memory compare. Prisma's
   `mode: "insensitive"` is PostgreSQL-only, and team creation is rare and
   rate-limited, so the one-column scan is the portable choice.

2. **A team could swallow a login.** The OIDC callback looked up the incoming
   username and bound the session to whatever row it found, *including* a
   `TEAM` or `BOT` row. A team created under the name of someone who had never
   logged in here would capture that person's first login. `routes/auth.js`
   now refuses and redirects with `?error=username_conflict`, leaving an admin
   to rename the team. This bug predates the admin tab; the name list never
   protected against it, since it covered ~20 org names and no human ones.

### Teams are excluded from the admin Users table

They are `User` rows, so they were showing up there with a role dropdown that
has no `TEAM` option, and `DELETE /api/admin/users/:username` would have
stranded their `TeamEvent` rows. They stay in the `/api/users` response for the
badge-grant autocomplete — `AdminView.vue` filters them out of that one table.

## Problem

Someone recognised "the agama team" but could only name two people, because the
giver has to enumerate humans. Group recognition works
(`backend/src/routes/kudos.js:1530` — one `Kudos` with several `KudosRecipient`
rows and a `groupHash`), but the unit is wrong: there is no way to address a
team as such, so credit lands on whoever the giver happened to know.

## Core decisions

### A team is a `User` row with `role = TEAM`

Not a parallel `Team` model.

- `KudosRecipient.userId` already points at it — the kudos path needs no change.
  Team kudos, and mixed "agama team + lkocman" kudos, work immediately.
- Profile route, share image + QR, badges, follow, feeds and notifications all
  come for free. A separate model would force `KudosRecipient` to go polymorphic
  (`userId?` + `teamId?`), touching most of the 1716 lines of `kudos.js`, all of
  stats, and the share renderer.
- One namespace: `/user/agama` is unambiguous and the recipient autocomplete in
  `KudoCreateView.vue` picks teams up with no new endpoint.
- `notify.js:69` sends to `user.email`. Point a team's at its mailing list and a
  team kudo reaches everyone, including people the giver could not have named.
  This single line is most of the value.

Known wart: `Role` conflates permission level with account kind. `BOT` already
set that precedent so `TEAM` is consistent. A separate `kind` column
(`PERSON | BOT | TEAM`) would be cleaner — cheap now, annoying later.

Known consequence: teams appear in user lists and leaderboards. Note `BOT` is
not filtered from those today either (`users.js:44`, `stats.js`), so one fix
covers both. Teams then get their own leaderboard.

### One roster; badges feed it but do not define it

Earlier draft had badge-backed rosters *derived* from badge holders. Rejected:
`UserBadge` has no revocation, so a derived roster only grows, and a term-limited
team like `opensuse-board` would accumulate every past member forever. It also
forced a `UserBadge.revokedAt` column whose only purpose was roster hygiene.

Settled model — `TeamMember` is the single source of truth, and the badge is a
**write-side hook** into it:

- Granting a bound badge adds the recipient as `ACTIVE`
  (`backend/src/utils/teamBadge.js`). The old workflow — admin or badger bot
  grants `hero` — still puts someone on the Heroes roster, unchanged.
- Leaving or being removed touches only `TeamMember`. **The badge is never
  revoked.** Badge = what you did; team = who is there now.
- One-time migration seeds existing holders of a bound badge as `ACTIVE`
  members. After that the two drift apart on purpose.

The binding is one nullable field, `Badge.teamUserId`. A badge is
team-conferring **iff** it is bound; unbound badges stay pure achievements.

### Binding is an admin action

Everything else about teams is member-local by design. Binding is not, because
it reaches outside the team: a bound badge adds every holder to the roster, so a
member-level bind would let anyone create a team, point the `hero` badge at it
and claim the Heroes. There is no criterion that fixes this at member level —
requiring the binder to hold the badge does not help, since any one Hero could
still bind it to a pet team.

`PUT /api/teams/:username/badge` therefore requires `role = ADMIN`. A badge
belongs to at most one team; rebinding replaces, and an empty slug unbinds.
Unbinding leaves existing members and their badges alone — it only stops future
grants feeding the roster.

### Every team shows a badge slot, "TBD" when empty

A team with no badge renders a dashed `🏅 Badge: TBD` placeholder
(`TeamBadgeSlot.vue`) rather than showing nothing. The teams that have a badge
worth claiming are exactly the ones who would never discover an invisible
optional field, and the placeholder gives members something concrete to point at
when asking an admin. A bound badge also becomes the team's avatar.

### Bind an existing badge; never auto-create one

Creating a team does **not** mint a badge. Binding is optional, opt-in, and only
ever selects from badges that already exist.

A badge minted automatically for every self-declared team would be a badge
anybody can award themselves by typing a name — which devalues every badge
already granted, exactly when we have decided badges are the permanent record.
Most teams should simply have no badge; that is the normal case, not a gap.
Badges stay something granted by an existing authority, and the bind dropdown is
how a team claims the one it already earned.

### No manager role

Membership is self-declared and nothing but display and credit-routing depends
on it, so it does not need to be defended.

**Any logged-in user can create a team.** OIDC means every account is a real
openSUSE account, so creation is attributable and reversible, and the stakes are
recognition rather than access. Approving a member is likewise local to the team
— any active member can do it.

No `OWNER`, no `canCreateTeams`, no new value in `Role` beyond `TEAM`.
`createdById` is kept for audit, not for power. Admins step in for disputes
(rename, archive, merge), not for routine setup.

Consequence: a member may **not** send kudos to a team they belong to. With
self-join, allowing it would be self-recognition with two extra clicks. Extends
the existing rule at `kudos.js:1521`.

## Which badges to bind

Rule of thumb: bind a badge only if "thank this group" is a meaningful sentence.

- **Bind** — `hero`, `release`, `opensuse-board`, `election-official`,
  `moderation`, `booth`.
- **Judgment call, per badge** — `artwork`, `localization`, `documentation`,
  `marketing`, `quality`, `webdev`, `packager`. Contribution areas that in
  openSUSE often do have a working group behind them.
- **Do not bind** — counters (`gave-*`, `got-*`, `wiki-*`, `tumbleweed-*`),
  per-release contributor badges (`leap-15x`, `leap-16x`), events (`if2026`,
  `osc2026`), `nuked`, distro badges (`microos`, `kalpa`, `slowroll`).
- **Especially not `member`.** Several hundred holders; recognising it would
  mean nothing.
- **No historical badges.** `leap-150` contributors were a team, but its roster
  dissolved in 2018 and should not become a live kudos recipient.

Free upside: `Badge.picture` is the team avatar (`/badges/heroes.png` exists)
and `Badge.link` is its homepage, so badge-backed teams need almost no setup.
`Kudos.badgeId` already exists, so a team kudo can carry the badge art on its
share image.

## Members may thank their own team

Originally blocked as self-recognition. Reversed: a newcomer thanking the team
for being welcoming is aimed at the other twenty people, not at themselves, and
that is one of the better things the feature can do.

The only case still blocked is a team you are the **sole active member** of,
which is individual self-kudos wearing a team name.

## Counting: three separate numbers, never one

The gaming worry is real but it is a *scoring* problem, not a permissions
problem. Rather than forbidding the action, make it not pay.

**1. A team's score is the kudos the team account received.** Not the sum of its
members' personal kudos — that would rank by headcount, double-count anything
sent to a team and a member together, and silently rewrite history every time
somebody joins or leaves.

**2. Team kudos never enter a member's personal total.** They appear on the
profile as a separate "Team kudos" section, clearly attributed to the team. This
is what actually defuses self-recognition: there is no personal bump to exclude,
because there is no personal bump. (Also why `KudosRecipient` rows must not be
fanned out per member — see slice 3.)

**3. Inside and outside praise are counted apart.** `KudosRecipient.internal` is
set at send time when the sender is an ACTIVE member of the recipient team.
Team rankings should use external kudos; internal ones still display, and can be
labelled as coming from within the team.

`internal` is recorded at send time rather than derived later on purpose.
Membership drifts, so a derived answer changes retroactively, and leaving →
sending → rejoining would launder an internal kudo into an external one.

Consequence to keep in mind when the team leaderboard is built: rank on
`internal = false`, and consider ranking on *distinct external givers* rather
than raw count, since ten kudos from one enthusiast say less than ten from ten.

## Leaving: emeritus is a state, not a badge

Implemented.

For badge-backed teams emeritus already exists implicitly: you keep the `hero`
badge and drop off the Heroes roster. A separate "Hero Emeritus" badge would
state the same fact twice and re-inflate the badge namespace.

But that only covers badge-backed teams — `agama` has no badge, so leaving
currently erases the person entirely. So emeritus belongs in the membership
state, where it works for every team and mints nothing:

- `MembershipState` gains `EMERITUS`; `TeamMember` gains `leftAt`.
- **Leaving** sets `EMERITUS`; the row stays and the team page lists a *Former
  members* section. Rejoining needs no second approval — you were vouched for
  once already — and logs a `rejoined` event.
- **Being removed by someone else** deletes the row. Removal is usually
  correcting a mistake, and billing someone as an alumnus of a team they were
  never really on would be a lie. A never-approved `PENDING` request that is
  withdrawn is not an alumnus either. Both paths stay logged in `TeamEvent`.
- `memberCount` and auto-approve continue to filter on `ACTIVE`, so alumni never
  inflate a roster.

This also fixes the term-limited `opensuse-board` case without any badge
revocation: past board members are alumni, current ones are members, and
everyone keeps the badge they earned.

### "Ex" badges are a rendering of the state, not a second badge

For some teams the *former* status is itself an honour worth naming — the Board
and election officials are elected for a term, and "served a term" is a
completed, creditable thing. For others it would be strange: nobody wants an
"ex-openSUSE Hero" badge, because you do not stop having been one.

So make it opt-in per badge and **derive it**, rather than granting anything:

```prisma
// Badge += emeritusTitle String?   // e.g. "Board Emeritus"; null = no ex form
```

A bound badge held by someone who is `EMERITUS` on that team renders with
`emeritusTitle` and a muted variant. Nothing is granted, nothing is revoked, and
rejoining the Board flips the display back on its own.

Granting a real second badge on leaving was rejected for exactly the reason
`UserBadge.revokedAt` was: a returning member would hold a "former member" badge
that has become false, and we have committed to badges never being taken away.
Deriving keeps one source of truth — `TeamMember.state`.

Free with it: `approvedAt` → `leftAt` gives "2019–2021" on the profile, which
says more than any badge does.

Limit to know about: a `TeamMember` row holds one `leftAt`, so a second term
overwrites the first. Full term history lives in `TeamEvent` and would have to be
rendered from there if the Board ever wants "served 2019–2021, 2023–2025".

## Schema

```prisma
enum Role { USER MEMBER MODERATOR ADMIN BOT TEAM }

model TeamProfile {
  teamUserId  Int      @id            // == User.id, role TEAM
  description String?
  listEmail   String?                 // public; notifications fan out here
  homepage    String?
  chatUrl     String?
  createdById Int
  archivedAt  DateTime?
  createdAt   DateTime @default(now())
}

model TeamMember {
  teamUserId  Int
  userId      Int
  state       MembershipState @default(PENDING)
  requestedAt DateTime @default(now())
  approvedAt  DateTime?
  approvedById Int?
  invitedById Int?                    // sender of an open invite
  leftAt      DateTime?
  @@unique([teamUserId, userId])
}

enum MembershipState { PENDING ACTIVE EMERITUS INVITED }

model TeamEvent {           // change log, shown on the team page
  id         Int      @id @default(autoincrement())
  teamUserId Int
  actorId    Int
  targetId   Int?
  action     String   // requested | approved | invited | invite_accepted |
                      // invite_declined | invite_withdrawn | added | left | removed | …
  createdAt  DateTime @default(now())
}

// Badge += teamUserId Int?   (done)
// No UserBadge.revokedAt — see "One roster" above; not needed.
```

## Slices

### 1. Badge-backed teams (start here)

Smallest thing that makes Heroes, Release Team and the Board recognisable. No
new permission model, no approval queue, no join flow.

- `Role.TEAM`, `TeamProfile`, `Badge.teamUserId`, `UserBadge.revokedAt` +
  migration.
- Roster resolver: active holders of the bound badge.
- Exclude `TEAM` (and `BOT`) from person leaderboards in the stats endpoints —
  not from `/api/users`, see the UI section; add a team leaderboard.
- Block kudos from a member to their own team.
- Team page at `/user/:username` — reuse `UserProfileView.vue`, branch on role:
  roster instead of "kudos given", badge art as avatar.
- Admin: create a TEAM account, bind a badge, set list email. *(Done — the
  Teams tab in `AdminView.vue`; see [Admin moderation](#admin-moderation).)*
- Seed the bind list above.

### 2. Open teams + join flow

- `TeamMember`, `TeamEvent` + migration.
- `/teams` browse, with a "Join a team" box: autocomplete existing teams, or
  create if no match. Founder is auto-approved (nobody to ask), and the team
  page shows "new team · 1 member · started by X".
- Any active member approves from a pending-requests list.
- **Auto-approve after ~14 days** with no response, stated up front to both
  sides. Without this, requests rot in inactive teams and the feature dies.
- Leaving is always unilateral; removing others is allowed but logged to
  `TeamEvent` and notified. Add a two-person rule only if abuse appears.
- New teams stay out of the team leaderboard until 2–3 members.
- Typing a badge-backed team name explains how to earn the badge instead of
  offering to join.

### 3. Polish

- `/teams/manage` — teams you are in, pending requests, team profile editing.
- *Done:* member profiles have a "Team Recognition" section, one block per team,
  fed by `GET /api/teams/user/:username/kudos`. It is computed live from
  membership and **counted separately** from personal kudos. Current members see
  all of the team's kudos; former members see those up to `leftAt`. Internal
  kudos (including ones the person sent) are labelled "from within the team". Do not fan out `KudosRecipient`
  rows per member: it inflates personal stats, lets a 30-person team dwarf every
  individual, and breaks when the roster changes.
- Team kudos on the share image / notification email to the list.

## UI surface

Slice 1 has **no join or create UI at all** — that is the point of starting
there. Teams are created by an admin in `AdminView.vue` (make a TEAM account,
bind a badge, set the list email), and you "join" the Heroes team by being
granted the `hero` badge. Users only ever see teams: the team page at
`/user/:username`, and the recipient autocomplete when giving kudos.

Slice 2 adds the join flow:

| Where | What |
| --- | --- |
| `Header.vue:29` | `Teams` nav link, next to "All Badges" |
| `/teams` → new `TeamsView.vue` | browse list, with the join box on top: one input, autocompletes existing teams, no match becomes "Create team *agama*" |
| `/user/:username` (person) | **Teams section above social handles**, on every profile and public. Current teams as chips, former ones muted below. This is how you discover that someone is a Hero |
| `/user/:username` (team) | the same slot shows the **roster** instead — the chips link here, so the page has to answer "who are these people" |
| `/teams/manage` → new view | only in the nav if you are in a team: pending requests, roster, team profile |

### Why `/teams` stays, rather than folding into the profile

Tempting to drop the separate view and hang everything off your own profile. It
does not work: a profile can only show the teams you are *already in*, so it
cannot answer "what teams exist and which could I join". Putting the directory
there would also hide it from logged-out visitors and bury a public listing
inside a page that is fundamentally about one person.

So the two are different jobs: `/teams` is the doorway (browse, join, create),
the profile section is the destination (who is in what). The header CTA points
at `/teams` because it says "Join Team", and the profile section links back to
it with "Find or start a team →".

### `GET /api/users` must not blanket-filter teams

Four consumers, conflicting needs:

- `KudoCreateView.vue:101` — **must** include teams, or a team cannot be
  addressed at all.
- `Header.vue:204` person search — probably should include them.
- `AdminView.vue` — should, for the badge-grant autocomplete; the Users table
  filters `TEAM` out client-side and the Teams tab handles them instead.
- Anything ranking people — should not.

So teams need an explicit query param on that endpoint rather than a blanket
exclusion, and leaderboard filtering belongs in the stats endpoints instead.

## Implementation note

"In-app message" needs more than it looks. `useNotifications.js` is ephemeral
toasts — in-memory, auto-dismissing, nothing persisted. The `Notification` table
has a list endpoint (`routes/notifications.js`) but no UI consumes it, and the
model has no link or payload field, so an approve button cannot hang off it.

So approvals live in the team management page as a pending-requests list, and
notifications are only a nudge pointing there. Same UX, far less machinery.

Correction (2026-09-25): unread rows *are* shown — `store/auth.js` polls
`/api/notifications/unread` every 30 s and turns each into a toast, and the
server marks them read on fetch. They just vanished after 4 s and went nowhere
when clicked. `Notification.link` now holds an in-app path for every type
(the kudo, the badge page, the team page, or `/teams?team=` for anything
waiting on you), clicking the toast opens it, and `team_invite` /
`team_join_request` toasts stay until clicked or closed.

### Join requests are emailed, because the in-app nudge reached nobody

In practice the "nudge" above was invisible: the `Notification` rows have no
UI, and the pending list sat inside a collapsed "Members" panel on the team
card with nothing outside it saying anyone was waiting. Lubos only found the
approve button by expanding the card on purpose.

Three changes, one per way the request was getting lost:

- **Email every active member.** `POST /api/teams/:username/join` emits a
  `team_join_request` activity event. `kudos-notify` (`notify/index.cjs`, the
  production mailer run by `kudos-notify.service`) reads it off the SSE stream,
  resolves each member's address via `/api/users/:username` with its bot token,
  and sends `notify/templates/team_join_request.txt`. The event carries
  usernames only — `/api/now/stream` is public. It is sent through the
  notifier rather than `services/notify.js` so it gets the same `DRY_RUN`,
  `Reply-To` and preferences link as the kudos and badge mails. The team's
  `listEmail` is deliberately *not* mailed: it is a public list, and a join
  request is a roster chore, not an announcement.
- **Say it on the card.** `GET /api/teams` returns `pendingCount`, counted
  only for teams where the viewer is `ACTIVE` (the same rule as the detail
  endpoint's pending list), so outsiders always see 0. The card gets a
  highlighted "N waiting for approval" line and the button reads "Review N
  requests" instead of "Members".
- **Open it for them.** The email links to `/teams?team=<name>`, which
  expands and scrolls to that card. With no `?team=`, the first team with a
  waiting request opens by itself. Inside the panel the pending list now comes
  first, above the roster.

## Invitations

Join requests only work when the person already knows the team exists. The
other direction — a member who knows exactly who is missing — needed an
invite.

- **Existing Kudos users only, by username.** An account exists only after an
  openSUSE ID login, which is spam filter enough; there is no invite-by-email
  and no mail to people who never signed up. The lookup is case-insensitive
  (OIDC usernames keep their case), and team or bot accounts cannot be invited.
- **Consent, not conscription.** `POST /api/teams/:username/invite` creates a
  `TeamMember` in state `INVITED`, which counts for nothing — not in the
  member count, not on the profile. The invitee accepts with the ordinary
  `POST /join` and declines with `DELETE /members/:self`; a member withdraws
  with the same `DELETE`. `approve` refuses an invite: it is waiting on the
  invitee, not the team.
- **Who may invite:** any active member, same as approving, and admins into any
  team. 20 invites per member per day, counted from `TeamEvent`; admins are
  exempt. Re-inviting someone already invited is a no-op, so a double click is
  not a second email.
- **Collisions resolve to the obvious thing.** Inviting someone with a pending
  request approves them. A former member invited back keeps `EMERITUS` (with
  `invitedById` set) so they stay listed as an alumnus until they answer;
  declining or withdrawing just clears the invite. `hasOpenInvite()` in
  `teams.js` is the one place that knows both shapes.
- **Email via kudos-notify**, like join requests: a `team_invite` event
  (usernames only) and `notify/templates/team_invite.txt`, linking to
  `/teams?team=<name>`. Invitations sit at the top of `/teams` with the
  inviter's name, since an invite from a person you know is one you accept.
  The inviter gets an in-app row when it is accepted; a decline is silent.
- **Admin direct add** (`POST /api/admin/teams/:username/members`) skips the
  accept step — for setting up an official group or fixing a roster. The person
  is notified and the `added` event records who did it. The admin team panel
  offers both, with invite as the default.

Invites do not expire. A stale one costs nothing — it grants no membership —
and a member can withdraw it from the team card.

Not done: joining by invite or approval does not grant the team's bound badge;
only binding does (`grantBadgeToTeamMembers`). Same gap as for approvals.

## Open

- Which of the judgment-call badges actually have a working group behind them.
- Whether `username` renames need an alias table, since `/user/agama` keys off
  `username` and a rename breaks existing links.
