<!--───────────────────────────────────────────────────────────────
👥 TeamsView.vue – Browse, join and create teams
───────────────────────────────────────────────────────────────
Copyright © 2025–present Lubos Kocman
and openSUSE contributors
SPDX-License-Identifier: Apache-2.0
───────────────────────────────────────────────────────────────-->
<template>
  <div class="teams-view">
    <h1>{{ t('teams.title') }}</h1>

    <!-- ✉️ Invitations first: they are the one thing on this page waiting on
         you, and the invite email lands here. -->
    <section v-if="myInvites.length" class="invites">
      <h2>{{ t('teams.invitations') }}</h2>
      <article
        v-for="team in myInvites"
        :key="team.username"
        :id="`team-${team.username}`"
        class="team-card invite-card"
      >
        <header>
          <router-link :to="`/user/${team.username}`">{{ team.displayName }}</router-link>
          <span class="state invited">{{ t('teams.invited') }}</span>
        </header>
        <p v-if="team.invitedBy" class="invite-from">
          <i18n-t keypath="teams.invited_by" tag="span">
            <template #name>
              <router-link :to="`/user/${team.invitedBy.username}`">{{ team.invitedBy.displayName }}</router-link>
            </template>
          </i18n-t>
        </p>
        <p v-if="team.description" class="desc">{{ team.description }}</p>
        <p class="meta">{{ t('teams.member_count', team.memberCount) }}</p>
        <div class="invite-actions">
          <button class="btn btn-small btn-accept" :disabled="busy" @click="join(team)">
            {{ t('teams.accept_invite') }}
          </button>
          <button class="btn btn-small btn-danger" :disabled="busy" @click="declineInvite(team)">
            {{ t('teams.decline_invite') }}
          </button>
        </div>
      </article>
    </section>
    <!-- Leads with the problem, not the feature: "recognise a team" is only
         obviously worth doing once you have seen that the alternative is
         thanking the two people you could name. -->
    <p class="intro">{{ t('teams.intro') }}</p>
    <p class="intro-self">{{ t('teams.intro_self') }}</p>

    <!-- Self-organisation is the whole model, and it is not guessable from a
         search box: nothing on screen says that starting a team needs no
         permission. Three lines, because the earlier single-paragraph version
         of this read as fine print and got skipped. -->
    <ul class="how">
      <li><span class="how-mark">🌱</span>{{ t('teams.how_start') }}</li>
      <li><span class="how-mark">✉️</span>{{ t('teams.how_invite') }}</li>
      <li><span class="how-mark">🤝</span>{{ t('teams.how_manage') }}</li>
      <li>
        <span class="how-mark">🏅</span>
        <i18n-t keypath="teams.how_badge" tag="span">
          <template #repo>
            <a href="https://github.com/openSUSE/kudos-badges" target="_blank" rel="noopener">openSUSE/kudos-badges</a>
          </template>
        </i18n-t>
      </li>
    </ul>

    <!-- 🔎 One box for both joining and creating. The box says so in its own
         heading: "search" alone reads as lookup-only, and the create path is
         the one people arrive here needing. -->
    <div class="join-box">
      <h2 class="join-title">🔎 {{ t('teams.find_or_start') }}</h2>
      <p class="join-sub">{{ t('teams.find_or_start_sub') }}</p>

      <input
        v-model="query"
        class="join-input"
        type="text"
        :placeholder="t('teams.search_placeholder')"
        @keyup.enter="onEnter"
      />

      <template v-if="suggestions.length">
        <p class="list-label">{{ t('teams.existing_matches') }}</p>
        <ul class="suggestions">
          <li v-for="team in suggestions" :key="team.username">
            <router-link :to="`/user/${team.username}`" class="sug-name">
              {{ team.displayName }}
              <small>@{{ team.username }} · {{ t('teams.member_count', team.memberCount) }}</small>
            </router-link>
            <button
              v-if="canJoin(team)"
              class="btn btn-small"
              :disabled="busy"
              @click="join(team)"
            >
              {{ joinLabel(team) }}
            </button>
            <span v-else class="state" :class="team.myState.toLowerCase()">
              {{ stateLabel(team.myState) }}
            </span>
          </li>
        </ul>
      </template>

      <!-- The create slot is always occupied, so its position is learned before
           it is needed: an idle prompt at rest, the real button once a name has
           been typed. Nothing appears only when the typed name already exists —
           there the list above is the answer. -->
      <div v-if="canCreate" class="create-slot is-live">
        <p class="create-lead">
          {{ suggestions.length ? t('teams.or_create') : t('teams.no_match', { name: normalized }) }}
        </p>
        <button class="btn btn-create" :disabled="busy" @click="create">
          ＋ {{ t('teams.create', { name: normalized }) }}
        </button>
        <p class="create-note">{{ t('teams.create_note') }}</p>
      </div>

      <p v-else-if="normalized.length < 2" class="create-slot is-idle">
        <span class="idle-plus" aria-hidden="true">＋</span>
        {{ t('teams.create_idle') }}
      </p>

      <p v-if="error" class="error">{{ error }}</p>
    </div>

    <!-- 👤 Teams you belong to, with anything waiting on you -->
    <section v-if="myTeams.length" class="section">
      <h2>{{ t('teams.your_teams') }}</h2>
      <div class="team-grid">
        <article
          v-for="team in myTeams"
          :key="team.username"
          :id="`team-${team.username}`"
          class="team-card"
          :class="{ 'has-pending': team.pendingCount }"
        >
          <header>
            <router-link :to="`/user/${team.username}`">{{ team.displayName }}</router-link>
            <span class="state" :class="team.myState.toLowerCase()">
              {{ stateLabel(team.myState) }}
            </span>
          </header>
          <p v-if="team.description" class="desc">{{ team.description }}</p>
          <p class="meta">{{ t('teams.member_count', team.memberCount) }}</p>
          <p v-if="team.pendingCount" class="pending-flag">
            ⏳ {{ t('teams.pending_count', team.pendingCount) }}
          </p>

          <TeamBadgeSlot :badge="team.badge" />

          <button
            v-if="team.myState === 'ACTIVE'"
            class="btn btn-small"
            @click="toggleDetail(team.username)"
          >
            {{
              expanded === team.username
                ? t('teams.hide_members')
                : team.pendingCount
                  ? t('teams.review_requests', team.pendingCount)
                  : t('teams.manage')
            }}
          </button>

          <div v-if="expanded === team.username && detail" class="detail">
            <!-- Requests first: they are the only thing here waiting on you. -->
            <div v-if="detail.pending.length" class="pending-list">
              <h3>{{ t('teams.pending_requests') }}</h3>
              <ul>
                <li v-for="p in detail.pending" :key="p.username">
                  <router-link :to="`/user/${p.username}`">{{ p.displayName }}</router-link>
                  <button class="btn btn-small" :disabled="busy" @click="approve(team, p)">
                    {{ t('teams.approve') }}
                  </button>
                </li>
              </ul>
            </div>

            <form class="invite-form" @submit.prevent="invite(team)">
              <h3>{{ t('teams.invite_title') }}</h3>
              <div class="invite-row">
                <input
                  v-model="inviteName"
                  class="invite-input"
                  type="text"
                  list="invite-candidates"
                  autocomplete="off"
                  :placeholder="t('teams.invite_placeholder')"
                />
                <button class="btn btn-small" type="submit" :disabled="busy || !inviteName.trim()">
                  {{ t('teams.invite_button') }}
                </button>
              </div>
              <datalist id="invite-candidates">
                <option
                  v-for="u in inviteCandidates"
                  :key="u.username"
                  :value="u.username"
                >{{ u.fullName || u.username }}</option>
              </datalist>
              <p class="meta invite-hint">{{ t('teams.invite_hint') }}</p>
              <p v-if="inviteMessage" class="invite-ok">{{ inviteMessage }}</p>
            </form>

            <div v-if="detail.invited?.length" class="pending-list">
              <h3>{{ t('teams.invited_list') }}</h3>
              <ul>
                <li v-for="p in detail.invited" :key="p.username">
                  <router-link :to="`/user/${p.username}`">{{ p.displayName }}</router-link>
                  <button class="btn btn-small btn-danger" :disabled="busy" @click="withdrawInvite(team, p)">
                    {{ t('teams.withdraw_invite') }}
                  </button>
                </li>
              </ul>
            </div>

            <ul class="roster">
              <li v-for="m in detail.members" :key="m.username">
                <router-link :to="`/user/${m.username}`">{{ m.displayName }}</router-link>
                <button
                  class="btn btn-small btn-danger"
                  :disabled="busy"
                  @click="removeMember(team, m)"
                >
                  {{ m.username === myUsername ? t('teams.leave') : t('teams.remove') }}
                </button>
              </li>
            </ul>
            <p class="meta remove-hint">{{ t('teams.remove_hint') }}</p>

            <div v-if="detail.alumni?.length" class="alumni-list">
              <h3>{{ t('teams.alumni') }}</h3>
              <ul>
                <li v-for="a in detail.alumni" :key="a.username">
                  <router-link :to="`/user/${a.username}`">{{ a.displayName }}</router-link>
                </li>
              </ul>
            </div>

            <p v-if="!detail.pending.length" class="meta">{{ t('teams.no_pending') }}</p>
          </div>
        </article>
      </div>
    </section>

    <!-- 🌍 Everything else -->
    <section class="section">
      <h2>{{ t('teams.all_teams') }}</h2>
      <p v-if="!otherTeams.length" class="meta">{{ t('teams.empty') }}</p>
      <div class="team-grid">
        <article v-for="team in otherTeams" :key="team.username" class="team-card">
          <header>
            <router-link :to="`/user/${team.username}`">{{ team.displayName }}</router-link>
            <span v-if="team.myState" class="state" :class="team.myState.toLowerCase()">
              {{ stateLabel(team.myState) }}
            </span>
          </header>
          <p v-if="team.description" class="desc">{{ team.description }}</p>
          <p class="meta">{{ t('teams.member_count', team.memberCount) }}</p>

          <TeamBadgeSlot :badge="team.badge" />

          <button class="btn btn-small" :disabled="busy" @click="join(team)">
            {{ joinLabel(team) }}
          </button>
        </article>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { useAuthStore } from "../store/auth.js";
import TeamBadgeSlot from "../components/TeamBadgeSlot.vue";

const { t } = useI18n();
const route = useRoute();
const auth = useAuthStore();
const myUsername = computed(() => auth.user?.username || null);

const teams = ref([]);
const query = ref("");
const error = ref("");
const busy = ref(false);
const expanded = ref(null);
const detail = ref(null);
const inviteName = ref("");
const inviteMessage = ref("");
const people = ref(null);

// Mirrors normalizeTeamName() in backend/src/routes/teams.js so the preview
// matches the name the server will actually create.
const normalized = computed(() =>
  query.value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
);

const suggestions = computed(() => {
  const q = normalized.value;
  if (q.length < 2) return [];
  return teams.value
    .filter(
      (team) =>
        team.username.includes(q) ||
        String(team.displayName || "").toLowerCase().includes(query.value.trim().toLowerCase())
    )
    .slice(0, 8);
});

// Only offer creation once it is clear nothing existing matches, so the
// default path is joining rather than spawning a near-duplicate.
const canCreate = computed(
  () =>
    normalized.value.length >= 2 &&
    !teams.value.some((team) => team.username === normalized.value)
);

// A team you have left belongs with the ones you could join, not with yours —
// but it keeps its badge so the "Rejoin" is obvious.
const isCurrent = (team) =>
  team.myState === "ACTIVE" || team.myState === "PENDING";

// `invited` also covers a former member asked back, whose state stays EMERITUS.
const myInvites = computed(() => teams.value.filter((team) => team.invited));
const myTeams = computed(() => teams.value.filter(isCurrent));
const otherTeams = computed(() =>
  teams.value.filter((team) => !isCurrent(team) && !team.invited)
);

function stateLabel(state) {
  if (state === "ACTIVE") return t("teams.member");
  if (state === "EMERITUS") return t("teams.former_member");
  if (state === "INVITED") return t("teams.invited");
  return t("teams.pending");
}

// Joining a team that invited you accepts the invitation.
const canJoin = (team) =>
  !team.myState || team.myState === "EMERITUS" || team.invited;

const joinLabel = (team) => {
  if (team.invited) return t("teams.accept_invite");
  return team.myState === "EMERITUS" ? t("teams.rejoin") : t("teams.join");
};

// People who could be invited: real accounts not already on the roster or
// invited. Only a suggestion list — the server resolves the name either way.
const inviteCandidates = computed(() => {
  if (!people.value || !detail.value) return [];
  const taken = new Set([
    ...detail.value.members.map((m) => m.username),
    ...(detail.value.invited || []).map((m) => m.username),
  ]);
  return people.value.filter(
    (u) => u.role !== "TEAM" && u.role !== "BOT" && !taken.has(u.username)
  );
});

async function loadPeople() {
  if (people.value) return;
  try {
    const res = await fetch("/api/users", { credentials: "include" });
    people.value = res.ok ? await res.json() : [];
  } catch {
    people.value = [];
  }
}

async function load() {
  try {
    const res = await fetch("/api/teams", { credentials: "include" });
    if (!res.ok) throw new Error("Failed to load teams");
    teams.value = await res.json();
  } catch (err) {
    console.error(err);
    error.value = t("teams.load_failed");
  }
}

async function join(team) {
  busy.value = true;
  error.value = "";
  try {
    const res = await fetch(`/api/teams/${team.username}/join`, {
      method: "POST",
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to join");
    await load();
  } catch (err) {
    error.value = err.message;
  } finally {
    busy.value = false;
  }
}

async function create() {
  busy.value = true;
  error.value = "";
  try {
    const res = await fetch("/api/teams", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: normalized.value, displayName: query.value.trim() }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to create team");
    query.value = "";
    await load();
  } catch (err) {
    error.value = err.message;
  } finally {
    busy.value = false;
  }
}

function onEnter() {
  const exact = teams.value.find((team) => team.username === normalized.value);
  if (exact && canJoin(exact)) join(exact);
  else if (canCreate.value) create();
}

async function refreshDetail(username) {
  const res = await fetch(`/api/teams/${username}`, { credentials: "include" });
  if (res.ok) detail.value = await res.json();
}

async function toggleDetail(username) {
  if (expanded.value === username) {
    expanded.value = null;
    detail.value = null;
    return;
  }
  expanded.value = username;
  detail.value = null;
  inviteName.value = "";
  inviteMessage.value = "";
  await refreshDetail(username);
  loadPeople();
}

async function invite(team) {
  busy.value = true;
  error.value = "";
  inviteMessage.value = "";
  try {
    const res = await fetch(`/api/teams/${team.username}/invite`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: inviteName.value.trim() }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to send invitation");

    const name = data.username || inviteName.value.trim();
    inviteMessage.value = data.approvedRequest
      ? t("teams.invite_approved", { name })
      : data.alreadyInvited
        ? t("teams.invite_already", { name })
        : t("teams.invite_sent", { name });
    inviteName.value = "";
    await refreshDetail(team.username);
    await load();
  } catch (err) {
    error.value = err.message;
  } finally {
    busy.value = false;
  }
}

// Declining and withdrawing both delete the invite; the server tells them
// apart by who is asking.
async function dropInvite(team, username) {
  busy.value = true;
  error.value = "";
  try {
    const res = await fetch(`/api/teams/${team.username}/members/${username}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to update invitation");
    }
    if (expanded.value === team.username) await refreshDetail(team.username);
    await load();
  } catch (err) {
    error.value = err.message;
  } finally {
    busy.value = false;
  }
}

function declineInvite(team) {
  if (!window.confirm(t("teams.confirm_decline", { team: team.displayName }))) return;
  dropInvite(team, myUsername.value);
}

function withdrawInvite(team, person) {
  dropInvite(team, person.username);
}

async function approve(team, person) {
  busy.value = true;
  try {
    const res = await fetch(
      `/api/teams/${team.username}/members/${person.username}/approve`,
      { method: "POST", credentials: "include" }
    );
    if (!res.ok) throw new Error("Failed to approve");
    await refreshDetail(team.username);
    await load();
  } catch (err) {
    error.value = err.message;
  } finally {
    busy.value = false;
  }
}

// Any member may remove any member — people come and go, and a rule that only
// the creator can prune the roster dies the day the creator moves on. Removals
// are logged to TeamEvent and the person is notified, which is the check.
async function removeMember(team, person) {
  const isSelf = person.username === myUsername.value;
  const prompt = isSelf
    ? t("teams.confirm_leave", { team: team.displayName })
    : t("teams.confirm_remove", { name: person.displayName, team: team.displayName });

  if (!window.confirm(prompt)) return;

  busy.value = true;
  error.value = "";
  try {
    const res = await fetch(
      `/api/teams/${team.username}/members/${person.username}`,
      { method: "DELETE", credentials: "include" }
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to remove member");
    }

    if (isSelf) {
      // No longer a member, so the detail panel is no longer ours to see.
      expanded.value = null;
      detail.value = null;
    } else {
      await refreshDetail(team.username);
    }
    await load();
  } catch (err) {
    error.value = err.message;
  } finally {
    busy.value = false;
  }
}

// Open the card that needs attention instead of making people hunt for it.
// `?team=` comes from the join-request email; without it, the first team with
// someone waiting opens by itself, because a collapsed card is exactly how
// the approve button went unnoticed.
async function openInitialTeam() {
  // The invite email links here too; that card is already open, just bring it
  // into view.
  const invite = myInvites.value.find((team) => team.username === route.query.team);
  if (invite) {
    await nextTick();
    document
      .getElementById(`team-${invite.username}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  const actionable = myTeams.value.filter((team) => team.myState === "ACTIVE");
  const target =
    actionable.find((team) => team.username === route.query.team) ||
    actionable.find((team) => team.pendingCount > 0);
  if (!target) return;

  await toggleDetail(target.username);
  await nextTick();
  document
    .getElementById(`team-${target.username}`)
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}

onMounted(async () => {
  await load();
  await openInitialTeam();
});
</script>

<style scoped>
.teams-view {
  max-width: 900px;
  margin: 0 auto;
  padding: 1.5rem 1rem 3rem;
  color: var(--text-primary);
}

.intro {
  color: var(--text-secondary);
  margin-bottom: 0.7rem;
  max-width: 68ch;
  line-height: 1.5;
}

/* Bridges the problem statement into the three how-it-works lines, so it sits
   a step above .intro rather than trailing off with it. */
.intro-self {
  margin: 0 0 0.8rem;
  max-width: 68ch;
  font-weight: 600;
  color: var(--text-primary);
}

/* Deliberately not shrunk into fine print — this is the part people need to
   read before the search box makes sense. */
.how {
  list-style: none;
  margin: 0 0 1.5rem;
  padding: 0 0 0 0.9rem;
  max-width: 68ch;
  border-left: 3px solid color-mix(in srgb, var(--geeko-green) 55%, transparent);
}

.how li {
  display: flex;
  gap: 0.55rem;
  margin-bottom: 0.4rem;
  font-size: 0.93rem;
  line-height: 1.45;
  color: var(--text-secondary);
}

.how li:last-child {
  margin-bottom: 0;
}

.how-mark {
  flex: none;
  line-height: 1.45;
}

.how a {
  color: var(--geeko-green);
}

.join-box {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 10px;
  padding: 1.1rem 1rem 1rem;
  margin-bottom: 2rem;
}

.join-title {
  margin: 0 0 0.25rem;
  font-size: 1.15rem;
}

.join-sub {
  margin: 0 0 0.85rem;
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.join-input {
  width: 100%;
  padding: 0.7rem 0.9rem;
  font-size: 1rem;
  border: 1px solid var(--card-border);
  border-radius: 8px;
  background: var(--card-bg);
  color: var(--text-primary);
}

.list-label {
  margin: 0.9rem 0 0;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--text-muted);
}

.suggestions {
  list-style: none;
  margin: 0.35rem 0 0;
  padding: 0;
}

.suggestions li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.45rem 0;
  border-bottom: 1px solid var(--card-border);
}

.sug-name {
  display: flex;
  flex-direction: column;
  text-decoration: none;
  color: var(--text-primary);
}

.sug-name small {
  color: var(--text-muted);
}

/* The create half of the box. Same footprint idle or live, so the button does
   not arrive from nowhere the first time somebody types an unknown name. */
.create-slot {
  margin-top: 0.9rem;
  padding: 0.75rem 0.85rem;
  border: 1px dashed var(--card-border);
  border-radius: 8px;
}

/* Geeko green plus, turquoise copy — the invitation reads as an action rather
   than as fine print. Both hues go through local vars so the light theme can
   restate them without repeating the rule. */
.create-slot.is-idle {
  --idle-plus: var(--geeko-green);
  --idle-text: var(--turquoise-teal);

  margin-bottom: 0;
  /* Bold and at body size: a saturated accent at 0.88rem regular reads as a
     washed-out caption, which is the opposite of an invitation to act. */
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.45;
  color: var(--idle-text);
  border-color: color-mix(in srgb, var(--turquoise-teal) 35%, transparent);
}

.create-slot.is-idle .idle-plus {
  color: var(--idle-plus);
  font-weight: 700;
}

/* The palette accents are tuned for the dark themes; on the light theme's mint
   card they land near 1.9:1, which is unreadable for body copy. Same hues,
   mixed toward the body text colour until the row clears AA. */
html.light .create-slot.is-idle {
  --idle-plus: color-mix(in srgb, var(--geeko-green) 45%, var(--text-primary));
  --idle-text: color-mix(in srgb, var(--turquoise-teal) 45%, var(--text-primary));
}

.create-slot.is-live {
  border-style: solid;
  border-color: var(--butterfly-blue);
  background: color-mix(in srgb, var(--butterfly-blue) 8%, transparent);
}

.create-lead {
  margin: 0 0 0.6rem;
  font-weight: 600;
  color: var(--text-primary);
}

.create-note {
  margin: 0.5rem 0 0;
  font-size: 0.82rem;
  color: var(--text-secondary);
}

.section {
  margin-top: 2rem;
}

.team-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1rem;
}

.team-card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 10px;
  padding: 0.9rem;
}

.team-card.has-pending {
  border-color: var(--yarrow-yellow, #ffd33d);
}

.pending-flag {
  color: var(--yarrow-yellow, #ffd33d);
  font-size: 0.85rem;
  margin: 0.2rem 0;
}

.team-card header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  font-weight: 600;
}

.team-card header a {
  color: var(--text-primary);
  text-decoration: none;
}

.desc {
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.meta {
  color: var(--text-muted);
  font-size: 0.85rem;
}

.state {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  padding: 2px 6px;
  border-radius: 4px;
}

.state.active {
  background: var(--geeko-green);
  color: #000;
}

.state.pending {
  background: var(--yarrow-yellow);
  color: #000;
}

.state.invited {
  background: var(--butterfly-blue);
  color: #000;
}

.invites {
  margin-bottom: 2rem;
}

.invites h2 {
  margin-top: 0;
}

.invite-card {
  border-color: var(--butterfly-blue);
  margin-bottom: 0.8rem;
}

.invite-from {
  margin: 0.3rem 0;
  font-size: 0.9rem;
}

.invite-from a {
  color: var(--text-primary);
}

.invite-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.6rem;
}

.btn-accept {
  background: var(--geeko-green);
  border-color: var(--geeko-green);
  color: #000;
  font-weight: 600;
}

.invite-form h3 {
  font-size: 0.9rem;
  margin: 0.6rem 0 0.3rem;
}

.invite-row {
  display: flex;
  gap: 0.4rem;
}

.invite-input {
  flex: 1;
  min-width: 0;
  padding: 0.35rem 0.6rem;
  border: 1px solid var(--card-border);
  border-radius: 6px;
  background: var(--card-bg);
  color: var(--text-primary);
}

.invite-hint {
  margin: 0.3rem 0 0;
  font-size: 0.78rem;
}

.invite-ok {
  margin: 0.3rem 0 0;
  font-size: 0.85rem;
  color: var(--geeko-green);
}

/* Same light-theme correction as .create-slot.is-idle: raw Geeko green on the
   mint card is too faint for text. */
html.light .invite-ok {
  color: color-mix(in srgb, var(--geeko-green) 45%, var(--text-primary));
}

.state.emeritus {
  background: transparent;
  border: 1px solid var(--card-border);
  color: var(--text-muted);
}

.detail {
  margin-top: 0.75rem;
  border-top: 1px solid var(--card-border);
  padding-top: 0.6rem;
}

.roster,
.pending-list ul,
.alumni-list ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.roster li,
.pending-list li,
.alumni-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 2px 0;
}

.roster a {
  color: var(--text-primary);
  text-decoration: none;
}

.remove-hint {
  margin: 0.4rem 0 0;
  font-size: 0.78rem;
}

.btn-danger {
  border-color: var(--radish-red);
  color: var(--radish-red);
  background: transparent;
}

.btn-danger:hover {
  background: rgba(255, 91, 69, 0.12);
}

.pending-list h3,
.alumni-list h3 {
  font-size: 0.9rem;
  margin: 0.6rem 0 0.3rem;
}

.alumni-list a {
  color: var(--text-muted);
  text-decoration: none;
}

.btn-small {
  font-size: 0.8rem;
  padding: 3px 10px;
}

.btn-create {
  background: var(--butterfly-blue);
  border-color: var(--butterfly-blue);
  color: #000;
  font-weight: 600;
  font-size: 0.95rem;
  padding: 0.5rem 1rem;
}

.btn-create:hover {
  filter: brightness(1.08);
}

.error {
  color: var(--radish-red);
  margin-top: 0.6rem;
}
</style>
