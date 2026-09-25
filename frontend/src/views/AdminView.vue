<!--
Copyright © 2025–present Lubos Kocman
and openSUSE contributors
SPDX-License-Identifier: Apache-2.0
-->

<template>
  <main class="admin-view">
    <header class="header">
      <h1>🛠️ Admin Control Center</h1>
      <p class="subtitle">Manage badges, users, kudos, and bots securely.</p>
    </header>

    <nav class="tabs">
      <button
        v-for="tab in tabs"
        :key="tab"
        :class="{ active: currentTab === tab }"
        @click="currentTab = tab"
      >
        {{ tab }}
      </button>
    </nav>

    <!-- 👥 Users -->
    <section v-if="currentTab === 'Users'" class="crud">
      <h2>👥 Users</h2>

      <form class="create-form" @submit.prevent="createUser">
        <input v-model="newUser.username" placeholder="username" required />
        <select v-model="newUser.role" required>
          <option v-for="role in userRoles" :key="role" :value="role">
            {{ role }}
          </option>
        </select>
        <button class="btn green" type="submit">➕ Create User</button>
      </form>

      <table v-if="regularUsers.length">
        <thead>
          <tr><th>Username</th><th>Role</th><th>Actions</th></tr>
        </thead>
        <tbody>
          <tr v-for="u in regularUsers" :key="u.username">
            <td>{{ u.username }}</td>
            <td>
              <select v-model="u.role">
                <option v-for="role in userRoles" :key="role" :value="role">
                  {{ role }}
                </option>
              </select>
            </td>
            <td>
              <button @click="updateUserRole(u.username, u.role)" class="btn green">💾 Save</button>
              <button @click="deleteUser(u.username)" class="btn red">🗑️ Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-else class="empty">No users found.</p>
    </section>

    <!-- 🤖 Bots -->
    <section v-if="currentTab === 'Bots'" class="crud">
      <h2>🤖 Bots</h2>

      <form class="create-form" @submit.prevent="createBot">
        <input v-model="newBot.username" placeholder="bot username" required />
        <button class="btn green" type="submit">➕ Create Bot</button>
      </form>

      <table v-if="bots.length">
        <thead>
          <tr>
            <th>Username</th>
            <th>Secret</th>
            <th>Can Create Users</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="b in bots" :key="b.username">
            <td>{{ b.username }}</td>
            <td>
              <code v-if="revealedSecrets[b.username]">{{ revealedSecrets[b.username] }}</code>
              <button v-if="revealedSecrets[b.username]" @click="copySecret(revealedSecrets[b.username])" class="btn green">📋 Copy</button>
            </td>
            <td style="text-align:center">
              <input
                type="checkbox"
                :checked="b.canCreateUsers"
                @change="toggleCanCreateUsers(b, $event.target.checked)"
                :title="b.canCreateUsers ? 'Revoke user creation privilege' : 'Grant user creation privilege'"
              />
            </td>
            <td>
              <button @click="fetchBotSecret(b)" class="btn yellow">🔐 Reveal</button>
              <button @click="rotateSecret(b)" class="btn red">♻️ Rotate</button>
              <button @click="generateSecret(b)" class="btn blue">✨ Generate</button>
              <button @click="deleteUser(b.username)" class="btn red">🗑️ Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-else class="empty">No bots found.</p>

    </section>

    <section v-if="currentTab === 'Kudos'" class="crud">
      <h2>💚 Kudos Feed</h2>
      <table v-if="kudos.length">
        <thead>
          <tr><th>From</th><th>To</th><th>Message</th><th>Actions</th></tr>
        </thead>
        <tbody>
          <tr v-for="k in kudos" :key="k.id">
            <td>{{ k.fromUser?.username || 'unknown' }}</td>
            <td>{{ k.recipients.map(r => r.user.username).join(', ') }}</td>
            <td>{{ k.message }}</td>
            <td><button @click="deleteKudo(k.id)" class="btn red">🗑️ Delete</button></td>
          </tr>
        </tbody>
      </table>
      <p v-else class="empty">No kudos recorded.</p>
    </section>

    <section v-if="currentTab === 'Badges'" class="crud">
      <h2>🏅 Badges</h2>

      <form class="create-form" @submit.prevent="createBadge">
        <input v-model="newBadge.slug" placeholder="slug" required />
        <input v-model="newBadge.title" placeholder="title" required />
        <input v-model="newBadge.picture" placeholder="picture URL" />
        <input v-model="newBadge.color" placeholder="CSS color" />
        <input v-model="newBadge.description" placeholder="description" />
        <button class="btn green" type="submit">➕ Add Badge</button>
      </form>

      <table v-if="badges.length">
        <thead>
          <tr>
            <th>Slug</th>
            <th>Title</th>
            <th>Description</th>
            <th>Holders</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="b in badges" :key="b.slug">
            <td>{{ b.slug }}</td>
            <td>{{ b.title }}</td>
            <td>
              <input
                v-model="b.description"
                class="badge-description-input"
                placeholder="badge description"
              />
            </td>
            <td>{{ b.holders || 0 }}</td>
            <td>
              <button
                @click="updateBadgeDescription(b.slug, b.description)"
                class="btn green"
              >
                💾 Save
              </button>
              <button
                v-if="b.holders > 0"
                @click="dropBadgeFromUsers(b.slug)"
                class="btn yellow"
              >
                🧹 Drop from users
              </button>
              <button
                v-else
                @click="deleteBadge(b.slug)"
                class="btn red"
              >
                🗑️ Delete
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <p v-else class="empty">No badges yet.</p>
    </section>

    <!-- 👥 Teams -->
    <section v-if="currentTab === 'Teams'" class="crud">
      <h2>👥 Teams</h2>
      <p class="hint">
        Teams run themselves — members approve and remove each other. Step in
        here for fakes, duplicates, and rosters nobody is left to fix.
      </p>

      <form class="create-form" @submit.prevent="createTeam">
        <input v-model="newTeam.name" placeholder="team name (e.g. release-team)" required />
        <input v-model="newTeam.displayName" placeholder="display name" />
        <input v-model="newTeam.listEmail" placeholder="list email" />
        <input v-model="newTeam.description" placeholder="description" />
        <label class="checkbox">
          <input type="checkbox" v-model="newTeam.joinAsMember" />
          add me as first member
        </label>
        <button class="btn green" type="submit">➕ Create Team</button>
      </form>

      <table v-if="teams.length">
        <thead>
          <tr>
            <th>Team</th>
            <th>Badge</th>
            <th>Members</th>
            <th>Kudos</th>
            <th>Created by</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in teams" :key="t.username" :class="{ archived: t.archivedAt }">
            <td>
              <strong>{{ t.username }}</strong>
              <span v-if="t.displayName !== t.username" class="muted"> · {{ t.displayName }}</span>
              <span v-if="t.archivedAt" class="muted"> · archived</span>
            </td>
            <td>{{ t.badge?.slug || '—' }}</td>
            <td>
              {{ t.activeCount }} active
              <span v-if="t.pendingCount" class="muted">· {{ t.pendingCount }} pending</span>
              <span v-if="t.invitedCount" class="muted">· {{ t.invitedCount }} invited</span>
              <span v-if="t.emeritusCount" class="muted">· {{ t.emeritusCount }} alumni</span>
            </td>
            <td>{{ t.kudosReceived }}</td>
            <td>{{ t.createdBy || '—' }}</td>
            <td class="actions">
              <button @click="openTeam(t.username)" class="btn blue">
                {{ teamDetail?.username === t.username ? '🔽 Close' : '👥 Roster' }}
              </button>
              <button
                v-if="t.archivedAt"
                @click="setTeamArchived(t, false)"
                class="btn green"
              >
                ♻️ Restore
              </button>
              <button v-else @click="setTeamArchived(t, true)" class="btn yellow">
                📦 Archive
              </button>
              <button @click="deleteTeam(t)" class="btn red">🗑️ Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-else class="empty">No teams yet.</p>

      <!-- Roster of the team currently opened -->
      <div v-if="teamDetail" class="team-detail">
        <h3>👥 {{ teamDetail.displayName }} <span class="muted">({{ teamDetail.username }})</span></h3>

        <div class="badge-bind">
          <label>Team membership badge</label>
          <select v-model="badgeBindSlug">
            <option value="">— none —</option>
            <option v-for="b in badges" :key="b.slug" :value="b.slug">
              {{ b.title }} ({{ b.slug }}) — {{ b.holders || 0 }} holder(s)
            </option>
          </select>
          <label v-if="bindHolderCount" class="checkbox">
            <input type="checkbox" v-model="addBadgeHolders" />
            also add the {{ bindHolderCount }} current holder(s) to this roster
          </label>
          <button @click="bindTeamBadge" class="btn green">💾 Save membership badge</button>
        </div>
        <p class="hint hint-left">
          The membership badge becomes the team's avatar. Saving grants it to
          every active member who does not hold it yet, and granting it
          afterwards adds the recipient to this roster. Holders from before the bind are only
          added if you tick the box — people already on the roster, and former
          members, are left as they are.
        </p>

        <form class="badge-bind" @submit.prevent="inviteToTeam">
          <label>Add a person</label>
          <input
            v-model="teamMemberName"
            list="team-member-candidates"
            autocomplete="off"
            placeholder="username"
          />
          <datalist id="team-member-candidates">
            <option v-for="u in regularUsers" :key="u.username" :value="u.username" />
          </datalist>
          <button type="submit" class="btn green" :disabled="!teamMemberName.trim()">✉️ Invite</button>
          <button type="button" class="btn" :disabled="!teamMemberName.trim()" @click="addToTeam">➕ Add directly</button>
        </form>
        <p class="hint hint-left">
          Invite is the normal path: the person gets an email and joins once
          they accept. Add directly skips their consent — use it to set up an
          official group or fix a roster. Both are logged below.
        </p>

        <table v-if="teamDetail.members.length">
          <thead>
            <tr><th>Member</th><th>State</th><th>Since</th><th>Actions</th></tr>
          </thead>
          <tbody>
            <tr v-for="m in teamDetail.members" :key="m.username">
              <td>{{ m.username }}</td>
              <td>{{ m.state }}</td>
              <td>{{ formatDate(m.approvedAt || m.requestedAt) }}</td>
              <td>
                <button @click="removeTeamMember(m)" class="btn red">🗑️ Remove</button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="empty">
          This team has no members at all — nobody can approve a join request,
          so the next person to ask gets in automatically.
        </p>

        <details v-if="teamDetail.events.length" class="events">
          <summary>📜 Recent activity ({{ teamDetail.events.length }})</summary>
          <ul>
            <li v-for="(e, i) in teamDetail.events" :key="i">
              <span class="muted">{{ formatDate(e.createdAt) }}</span>
              — <strong>{{ e.action }}</strong>
              <span v-if="e.actor"> by {{ e.actor }}</span>
              <span v-if="e.target && e.target !== e.actor"> → {{ e.target }}</span>
            </li>
          </ul>
        </details>
      </div>
    </section>

    <!-- 🏆 Grant Badge -->
    <section v-if="currentTab === 'Grant Badge'" class="crud">
      <h2>🏆 Grant Badge</h2>
      <form class="create-form" @submit.prevent="grantBadge">
        <div class="autocomplete-wrapper">
          <input
            v-model="query"
            placeholder="username"
            @input="searchUsers"
            autocomplete="off"
            required
          />
          <ul v-if="suggestions.length" class="suggestions">
            <li
              v-for="user in suggestions"
              :key="user.username"
              @click="selectUser(user)"
            >
              {{ user.username }}
            </li>
          </ul>
        </div>
        <select v-model="grantBadgeData.badgeSlug" required>
          <option disabled value="">Select a badge</option>
          <option v-for="b in badges" :key="b.slug" :value="b.slug">
            {{ b.title }}
          </option>
        </select>
        <button class="btn green" type="submit">🏆 Grant Badge</button>
      </form>
    </section>
  </main>
</template>

<script setup>
import { ref, onMounted, computed } from "vue";
import { useNotifications } from "../composables/useNotifications.js";

const { addNotification } = useNotifications();
const tabs = ["Users", "Bots", "Teams", "Kudos", "Badges", "Grant Badge"];
const currentTab = ref("Users");

const users = ref([]);
const kudos = ref([]);
const badges = ref([]);
const allRoles = ["USER", "MEMBER", "MODERATOR", "ADMIN", "BOT"];
const userRoles = computed(() => allRoles.filter(r => r !== 'BOT'));

// Teams are User rows with role = TEAM, but the role dropdown here cannot
// express that and deleting one as a plain user would strand its roster, so
// they live in their own tab. They stay in `users` for the badge autocomplete.
const regularUsers = computed(() =>
  users.value.filter(u => u.role !== 'BOT' && u.role !== 'TEAM')
);
const bots = computed(() => users.value.filter(u => u.role === 'BOT'));
const revealedSecrets = ref({});

const newUser = ref({
  username: "",
  role: "USER"
});

const newBot = ref({
  username: ""
});

const newBadge = ref({
  slug: "",
  title: "",
  picture: "",
  color: "",
  description: ""
});

const grantBadgeData = ref({
  username: "",
  badgeSlug: ""
});

const teams = ref([]);
const teamDetail = ref(null);
const teamMemberName = ref("");
const badgeBindSlug = ref("");
const addBadgeHolders = ref(false);

// Only offer the backfill for a badge that is not already this team's
// membership badge — re-saving an existing bind is not the moment to import
// anybody.
const bindHolderCount = computed(() => {
  if (!badgeBindSlug.value || badgeBindSlug.value === teamDetail.value?.badge?.slug) return 0;
  return badges.value.find(b => b.slug === badgeBindSlug.value)?.holders || 0;
});

// Active members who will be granted the badge on save. The roster payload
// does not say who holds what, so this is an upper bound; the server skips
// anyone who already has it.
const bindMemberCount = computed(() => {
  if (!badgeBindSlug.value) return 0;
  return teamDetail.value?.members.filter(m => m.state === "ACTIVE").length || 0;
});

const newTeam = ref({
  name: "",
  displayName: "",
  listEmail: "",
  description: "",
  // Official teams are usually set up by an admin who is not in them, so the
  // founding-member shortcut is opt-in here, unlike on /teams.
  joinAsMember: false
});

const query = ref("");
const suggestions = ref([]);

function searchUsers() {
  if (!query.value) {
    suggestions.value = [];
    return;
  }
  suggestions.value = users.value.filter(u =>
    u.username.toLowerCase().includes(query.value.toLowerCase())
  );
}

function selectUser(user) {
  grantBadgeData.value.username = user.username;
  query.value = user.username;
  suggestions.value = [];
}

// Fetchers
async function fetchUsers() {
  const res = await fetch("/api/users");
  if (res.ok) users.value = await res.json();
}

async function fetchKudos() {
  const res = await fetch("/api/kudos");
  if (res.ok) kudos.value = await res.json();
}

async function fetchBadges() {
  const res = await fetch("/api/admin/badges");
  if (res.ok) badges.value = await res.json();
}

async function fetchBotSecret(bot) {
  const res = await fetch(`/api/admin/bots/${bot.username}/secret`);
  if (res.ok) {
    const data = await res.json();
    revealedSecrets.value = {
      ...revealedSecrets.value,
      [bot.username]: data.secret
    };
    addNotification({ title: "Success", message: "Secret revealed." });
  } else {
    addNotification({ title: "Error", message: "Failed to fetch bot secret." });
  }
}

async function copySecret(secret) {
  try {
    await navigator.clipboard.writeText(secret);
    addNotification({ title: "Success", message: "Secret copied to clipboard!" });
  } catch (err) {
    console.error("Failed to copy secret: ", err);
    addNotification({ title: "Error", message: "Failed to copy secret." });
  }
}

// Actions
async function rotateSecret(bot) {
  if (!confirm(`Rotate bot secret for ${bot.username}? Existing integrations will break!`)) return;
  const res = await fetch(`/api/admin/bots/${bot.username}/secret/rotate`, { method: "POST" });
  if (res.ok) {
    addNotification({ title: "Success", message: "Bot secret rotated successfully." });
    fetchBotSecret(bot);
  }
}

async function generateSecret(bot) {
  if (!confirm(`Generate a new bot secret for ${bot.username}? Existing integrations will break!`)) return;
  const res = await fetch(`/api/admin/bots/${bot.username}/secret/generate`, { method: "POST" });
  if (res.ok) {
    addNotification({ title: "Success", message: "Bot secret generated successfully." });
    fetchBotSecret(bot);
  }
}

async function toggleCanCreateUsers(bot, value) {
  if (!confirm(`${value ? 'Grant' : 'Revoke'} user creation privilege for bot '${bot.username}'?`)) {
    fetchUsers();
    return;
  }
  const res = await fetch(`/api/admin/bots/${bot.username}/can-create-users`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ canCreateUsers: value }),
  });
  if (res.ok) {
    addNotification({ title: "Success", message: `User creation privilege ${value ? 'granted' : 'revoked'} for '${bot.username}'.` });
  } else {
    addNotification({ title: "Error", message: `Failed to update user creation privilege.` });
  }
  fetchUsers();
}

async function createUser() {
  const res = await fetch("/api/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(newUser.value)
  });
  if (res.ok) {
    addNotification({ title: "Success", message: "User created!" });
    newUser.value.username = "";
    newUser.value.role = "USER";
    fetchUsers();
  } else {
    const error = await res.json();
    addNotification({ title: "Error", message: `Failed to create user: ${error.error}` });
  }
}

async function createBot() {
  const res = await fetch("/api/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...newBot.value, role: 'BOT' })
  });
  if (res.ok) {
    addNotification({ title: "Success", message: "Bot created!" });
    newBot.value.username = "";
    fetchUsers();
  } else {
    const error = await res.json();
    addNotification({ title: "Error", message: `Failed to create bot: ${error.error}` });
  }
}

async function updateUserRole(username, role) {
  if (!confirm(`Update role for ${username} to ${role}?`)) return;
  const res = await fetch(`/api/admin/users/${username}/role`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role })
  });
  if (res.ok) {
    addNotification({ title: "Success", message: "User role updated!" });
    fetchUsers();
  } else {
    addNotification({ title: "Error", message: "Failed to update user role." });
  }
}

async function deleteUser(username) {
  if (!confirm(`Delete user ${username}?`)) return;
  await fetch(`/api/admin/users/${username}`, { method: "DELETE" });
  fetchUsers();
}

async function deleteKudo(id) {
  if (!confirm("Delete this kudo?")) return;
  await fetch(`/api/admin/kudos/${id}`, { method: "DELETE" });
  fetchKudos();
}

async function createBadge() {
  const res = await fetch("/api/admin/badges", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(newBadge.value)
  });
  if (res.ok) {
    addNotification({ title: "Success", message: "Badge created!" });
    Object.keys(newBadge.value).forEach(k => (newBadge.value[k] = ""));
    fetchBadges();
  }
}

async function updateBadgeDescription(slug, description) {
  const normalizedDescription = (description || "").trim();
  const res = await fetch(`/api/admin/badges/${slug}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description: normalizedDescription }),
  });

  if (res.ok) {
    addNotification({ title: "Success", message: `Badge '${slug}' updated.` });
    fetchBadges();
    return;
  }

  const error = await res.json().catch(() => ({ error: "Unknown error" }));
  addNotification({ title: "Error", message: `Failed to update badge: ${error.error}` });
}

async function grantBadge() {
  const { username, badgeSlug } = grantBadgeData.value;
  if (!username || !badgeSlug) {
    addNotification({ title: "Error", message: "Username and badge must be provided." });
    return;
  }
  const res = await fetch("/api/badges/grant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(grantBadgeData.value)
  });
  if (res.ok) {
    addNotification({ title: "Success", message: `Badge '${badgeSlug}' granted to '${username}'!` });
    grantBadgeData.value.username = "";
    grantBadgeData.value.badgeSlug = "";
    query.value = "";
  } else {
    const error = await res.json();
    addNotification({ title: "Error", message: `Failed to grant badge: ${error.error}` });
  }
}

async function deleteBadge(slug) {
  if (!confirm(`Delete badge ${slug}?`)) return;
  const res = await fetch(`/api/admin/badges/${slug}`, { method: "DELETE" });
  if (res.ok) addNotification({ title: "Success", message: "Badge deleted successfully." });
  else addNotification({ title: "Error", message: "Cannot delete badge — it may still be assigned to users." });
  fetchBadges();
}

async function dropBadgeFromUsers(slug) {
  if (!confirm(`Remove '${slug}' from all users?`)) return;
  const res = await fetch(`/api/admin/badges/${slug}/drop`, { method: "POST" });
  if (res.ok) {
    const data = await res.json();
    addNotification({ title: "Success", message: data.message || "Badge dropped from users." });
    fetchBadges();
  } else {
    addNotification({ title: "Error", message: "Failed to drop badge." });
  }
}

// ---------------------------------------------------------------
// Teams
// ---------------------------------------------------------------
function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

async function fetchTeams() {
  const res = await fetch("/api/admin/teams");
  if (res.ok) teams.value = await res.json();
}

async function loadTeam(username) {
  const res = await fetch(`/api/admin/teams/${username}`);
  if (!res.ok) {
    addNotification({ title: "Error", message: "Failed to load team roster." });
    return;
  }
  teamDetail.value = await res.json();
  badgeBindSlug.value = teamDetail.value.badge?.slug || "";
  addBadgeHolders.value = false;
}

async function openTeam(username) {
  if (teamDetail.value?.username === username) {
    teamDetail.value = null;
    return;
  }
  await loadTeam(username);
}

async function createTeam() {
  const res = await fetch("/api/teams", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(newTeam.value),
  });
  if (res.ok) {
    const team = await res.json();
    addNotification({ title: "Success", message: `Team '${team.username}' created.` });
    newTeam.value = { name: "", displayName: "", listEmail: "", description: "", joinAsMember: false };
    fetchTeams();
    fetchUsers();
  } else {
    const error = await res.json().catch(() => ({ error: "Unknown error" }));
    addNotification({ title: "Error", message: `Failed to create team: ${error.error}` });
  }
}

async function setTeamArchived(team, archived) {
  const verb = archived ? "Archive" : "Restore";
  if (!confirm(`${verb} team '${team.username}'?`)) return;
  const res = await fetch(`/api/admin/teams/${team.username}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ archived }),
  });
  if (res.ok) {
    addNotification({ title: "Success", message: `Team '${team.username}' ${archived ? "archived" : "restored"}.` });
    fetchTeams();
  } else {
    addNotification({ title: "Error", message: `Failed to ${verb.toLowerCase()} team.` });
  }
}

async function deleteTeam(team) {
  const members = team.activeCount + team.pendingCount + team.emeritusCount + (team.invitedCount || 0);
  if (!confirm(`Delete team '${team.username}' and its ${members} membership record(s)? This cannot be undone.`)) return;

  let res = await fetch(`/api/admin/teams/${team.username}`, { method: "DELETE" });

  // The backend refuses while the team holds kudos, so that deleting a
  // duplicate never silently takes somebody's thank-you note with it.
  if (res.status === 409) {
    const blocked = await res.json().catch(() => ({ error: "Team has kudos." }));
    if (!confirm(`${blocked.error}\n\nDelete the team and those kudos anyway?`)) return;
    res = await fetch(`/api/admin/teams/${team.username}?force=1`, { method: "DELETE" });
  }

  if (res.ok) {
    const data = await res.json();
    addNotification({ title: "Success", message: data.message || "Team deleted." });
    if (teamDetail.value?.username === team.username) teamDetail.value = null;
    fetchTeams();
    fetchUsers();
  } else {
    const error = await res.json().catch(() => ({ error: "Unknown error" }));
    addNotification({ title: "Error", message: `Failed to delete team: ${error.error}` });
  }
}

// The invite goes through the public endpoint, which lets admins invite into
// teams they are not on; only the direct add needs an admin route.
async function inviteToTeam() {
  const team = teamDetail.value.username;
  const username = teamMemberName.value.trim();
  const res = await fetch(`/api/teams/${team}/invite`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });
  const data = await res.json().catch(() => ({ error: "Unknown error" }));
  if (res.ok) {
    const message = data.approvedRequest
      ? `'${username}' had already asked to join and is now a member.`
      : data.alreadyInvited
        ? `'${username}' is already invited.`
        : `Invitation sent to '${data.username || username}'.`;
    addNotification({ title: "Success", message });
    teamMemberName.value = "";
    await loadTeam(team);
    fetchTeams();
  } else {
    addNotification({ title: "Error", message: `Failed to invite: ${data.error}` });
  }
}

async function addToTeam() {
  const team = teamDetail.value.username;
  const username = teamMemberName.value.trim();
  if (!confirm(`Add '${username}' to '${team}' without asking them? They will be notified.`)) return;
  const res = await fetch(`/api/admin/teams/${team}/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });
  const data = await res.json().catch(() => ({ error: "Unknown error" }));
  if (res.ok) {
    addNotification({ title: "Success", message: data.message });
    teamMemberName.value = "";
    await loadTeam(team);
    fetchTeams();
  } else {
    addNotification({ title: "Error", message: `Failed to add member: ${data.error}` });
  }
}

async function removeTeamMember(member) {
  const team = teamDetail.value.username;
  if (!confirm(`Remove '${member.username}' from '${team}'?`)) return;
  const res = await fetch(`/api/admin/teams/${team}/members/${member.username}`, {
    method: "DELETE",
  });
  if (res.ok) {
    addNotification({ title: "Success", message: `'${member.username}' removed from '${team}'.` });
    await loadTeam(team);
    fetchTeams();
  } else {
    const error = await res.json().catch(() => ({ error: "Unknown error" }));
    addNotification({ title: "Error", message: `Failed to remove member: ${error.error}` });
  }
}

async function bindTeamBadge() {
  const team = teamDetail.value.username;
  const importing = addBadgeHolders.value && bindHolderCount.value > 0;

  const steps = [];
  if (importing) {
    steps.push(`add all ${bindHolderCount.value} holder(s) of '${badgeBindSlug.value}' to the '${team}' roster`);
  }
  if (bindMemberCount.value) {
    steps.push(`grant '${badgeBindSlug.value}' to active members of '${team}' who do not hold it yet (up to ${bindMemberCount.value})`);
  }
  if (steps.length && !confirm(`This will ${steps.join(", and ")}. Continue?`)) return;

  const res = await fetch(`/api/teams/${team}/badge`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ badgeSlug: badgeBindSlug.value, addHolders: importing }),
  });
  if (res.ok) {
    const data = await res.json();
    addNotification({
      title: "Success",
      message: badgeBindSlug.value
        ? `'${badgeBindSlug.value}' is now the membership badge of '${team}'.` +
          (data.holdersAdded ? ` ${data.holdersAdded} holder(s) added to the roster.` : "") +
          (data.badgesGranted ? ` Badge granted to ${data.badgesGranted} member(s).` : "")
        : `Membership badge removed from '${team}'.`,
    });
    await loadTeam(team);
    fetchTeams();
    fetchBadges();
  } else {
    const error = await res.json().catch(() => ({ error: "Unknown error" }));
    addNotification({ title: "Error", message: `Failed to set membership badge: ${error.error}` });
  }
}

onMounted(() => {
  fetchUsers();
  fetchKudos();
  fetchBadges();
  fetchTeams();
});
</script>

<style scoped>
.admin-view {
  padding: 2rem;
  text-align: center;
}

.header {
  margin-bottom: 1.5rem;
}

.tabs {
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 2rem;
}

.tabs button {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--geeko-green);
  color: var(--geeko-green);
  padding: 0.4rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.tabs button.active,
.tabs button:hover {
  background: var(--geeko-green);
  color: black;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
}

th, td {
  border-bottom: 1px solid rgba(255,255,255,0.1);
  padding: 0.4rem 0.6rem;
}

th {
  color: var(--geeko-green);
}

tr:hover {
  background: rgba(255,255,255,0.03);
}

.btn {
  font-family: "Pixel Operator", monospace;
  border: none;
  border-radius: 4px;
  padding: 0.3rem 0.6rem;
  cursor: pointer;
  margin: 0 0.2rem;
}

.btn.green { background: var(--geeko-green); color: black; }
.btn.yellow { background: var(--yarrow-yellow); color: black; }
.btn.red { background: #e43e3e; color: white; }
.btn.blue { background: #1e8feb; color: white; }

.create-form {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: center;
  margin-bottom: 1rem;
}

.create-form input, .create-form select {
  font-family: "Pixel Operator", monospace;
  padding: 0.3rem;
  border: 1px solid var(--card-border);
  border-radius: 4px;
}

.badge-description-input {
  width: 100%;
  min-width: 220px;
  font-family: "Pixel Operator", monospace;
  padding: 0.3rem;
  border: 1px solid var(--card-border);
  border-radius: 4px;
}

.empty {
  color: var(--text-muted);
  margin-top: 1rem;
}

.hint {
  color: var(--text-muted);
  margin: 0 auto 1rem;
  max-width: 48rem;
}

.hint-left {
  margin-left: 0;
  text-align: left;
}

.muted {
  color: var(--text-muted);
}

tr.archived td {
  opacity: 0.55;
}

.actions {
  white-space: nowrap;
}

.checkbox {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--text-muted);
}

.team-detail {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  text-align: left;
}

.badge-bind {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin: 0.75rem 0;
}

.badge-bind input {
  font-family: "Pixel Operator", monospace;
  padding: 0.3rem;
  border: 1px solid var(--card-border);
  border-radius: 4px;
}

.badge-bind select {
  font-family: "Pixel Operator", monospace;
  padding: 0.3rem;
  border: 1px solid var(--card-border);
  border-radius: 4px;
}

.events {
  margin-top: 1rem;
}

.events summary {
  cursor: pointer;
  color: var(--geeko-green);
}

.events ul {
  list-style: none;
  padding: 0.5rem 0 0;
  margin: 0;
}

.events li {
  padding: 0.15rem 0;
}

.bot-management {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.autocomplete-wrapper {
  position: relative;
}

.suggestions {
  position: absolute;
  background: var(--tile-bg, #2c2c2c);
  border: 1px solid var(--divider, #444);
  border-radius: 6px;
  width: 100%;
  top: calc(100% + 4px);
  left: 0;
  z-index: 1000;
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 200px;
  overflow-y: auto;
  text-align: left;
}

.suggestions li {
  padding: 6px 10px;
  cursor: pointer;
  transition: background 0.2s;
}

.suggestions li:hover {
  background: rgba(115, 186, 37, 0.1);
}
</style>
