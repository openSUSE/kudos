# Event badges — claim a badge by scanning a QR code

## The short version

For a conference or meetup (openSUSE Conference, openSUSE Asia Summit, …):

1. **Before the event**, merge the badge into
   [openSUSE/kudos-badges](https://github.com/openSUSE/kudos-badges) like any
   other badge (`meta/<slug>.json`, art, `locales/en.json`). Do it early
   enough for OBS to rebuild and for Weblate to translate the title.
2. **In Admin → Events**, create an event: name, badge, start and end, in
   the event's own time zone. This gives you a short link,
   `https://kudos.opensuse.org/c/<token>`.
3. **At the event**, show the link:
   - **QR for slides** downloads an SVG to drop into a slide deck. It is
     vector, so it stays sharp on any projector.
   - **Booth display** opens `/c/<token>/display`: a full-screen page with a
     big QR code, the badge, the link as text, and a live claim counter.
     It needs no login, so the booth laptop never holds an admin session.
     Click it once to go full screen.
4. **Attendees** scan the code, log in or sign up for an openSUSE account,
   land back on the claim page and get the badge automatically, with the
   usual share links and email.

Outside the window, or without the exact link, the badge can't be claimed.

## Design

### The link is the only secret

The token in the link (10 characters, ~50 bits) is all you need to claim.
There is no per-attendee code and nothing to check at the door. Whoever can
see the QR code can claim, and that is the point: being in the room is the
qualification.

The token leaves out look-alike characters (`0/o`, `1/l/i`) and is matched
without regard to case, so people can type it off a slide on a phone that
capitalises the first letter. The link is kept short so the QR code has
fewer, bigger dots, which matters when you scan a projector from the back
of a hall.

### Most people who scan have no account yet

The claim page is built around the round trip through
[id.opensuse.org](https://id.opensuse.org): it sends people to login with
`returnTo=/c/<token>`, and once they are back and logged in it claims the
badge without a second tap.

Signing up can leave the browser the QR scanner opened, for example when
the email verification link opens the phone's default browser. The page
therefore tells people that **the link keeps working until the event
ends**, so they can simply open it again. This is why the window should
cover the whole day or conference, not a single talk.

As a safety net, a browser that opened the link while the window was open
can still finish claiming for up to an hour after it ends
(`CLAIM_GRACE_MS` in `backend/src/routes/events.js`). A closed event gets
no grace period.

### Leaks: close, don't revoke

If the link leaks (someone posts the slide photo on social media), an admin
can **close** the event, which stops new claims at once, or move the window.
Closing never takes a badge back. Badges are statistics we rely on and are
never revoked (see [badges.md](badges.md)). The admin view lists everyone who
claimed and when, so a burst of claims three days after the event stands out.
The badge and the link of an event can't be changed, because they are what
was printed.

### Time zones

The admin setting up an event is often far from it: the Asia Summit may be
set up from Europe. The form takes wall-clock times plus a time zone
(defaulting to the browser's), shows the resulting UTC window, and sends only
UTC to the server. Attendees see times in their phone's time zone, with the
zone name.

### Data

- `BadgeEvent` holds the name, token, badge, window and `closed` flag.
- `UserBadge.eventId` records which event a badge was claimed at, so claim
  counts per event survive even if the same badge is later granted elsewhere.
- Claims go through `backend/src/utils/grantBadge.js`, the same path as admin
  and bot grants. They emit the usual `badge` activity: in-app notification,
  email from kudos-notify, Now stream and team roster sync.

## API

| Method | Path | Who |
| --- | --- | --- |
| `GET` | `/api/events/:token` | anyone. Badge, window, `state`, `claimable`, claim count, `claimed` |
| `POST` | `/api/events/:token/claim` | logged-in people (not bots or teams) |
| `GET` | `/api/events/:token/qr.svg[?download]` | anyone. Black on white, quiet zone included |
| `GET` | `/api/admin/events` | admins |
| `POST` | `/api/admin/events` | admins. `{ name, badgeSlug, startsAt, endsAt }` (ISO) |
| `GET` | `/api/admin/events/:id` | admins. Includes `claimedBy` |
| `PATCH` | `/api/admin/events/:id` | admins. `name`, `startsAt`, `endsAt`, `closed` |

An unknown token is a plain 404, the same as any other missing page.
