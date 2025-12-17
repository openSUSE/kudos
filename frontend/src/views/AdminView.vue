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
        <input v-model="newUser.email" placeholder="email" type="email" />
        <select v-model="newUser.role" required>
          <option v-for="role in userRoles" :key="role" :value="role">
            {{ role }}
          </option>
        </select>
        <button class="btn green" type="submit">➕ Create User</button>
      </form>

      <table v-if="regularUsers.length">
        <thead>
          <tr><th>Username</th><th>Email</th><th>Role</th><th>Actions</th></tr>
        </thead>
        <tbody>
          <tr v-for="u in regularUsers" :key="u.username">
            <td>{{ u.username }}</td>
            <td>{{ u.email }}</td>
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
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="b in bots" :key="b.username">
            <td>{{ b.username }}</td>
            <td>
              <code v-if="b.revealedSecret">{{ b.revealedSecret }}</code>
              <button v-if="b.revealedSecret" @click="copySecret(b.revealedSecret)" class="btn green">📋 Copy</button>
            </td>
            <td>
              <button @click="fetchBotSecret(b)" class="btn yellow">🔐 Reveal</button>
              <button @click="rotateSecret(b)" class="btn red">♻️ Rotate</button>
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
            <td>{{ b.description }}</td>
            <td>{{ b.holders || 0 }}</td>
            <td>
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
  </main>
</template>

<script setup>
import { ref, onMounted, computed } from "vue";

const tabs = ["Users", "Bots", "Kudos", "Badges"];
const currentTab = ref("Users");

const users = ref([]);
const kudos = ref([]);
const badges = ref([]);
const allRoles = ["USER", "MEMBER", "MODERATOR", "ADMIN", "BOT"];
const userRoles = computed(() => allRoles.filter(r => r !== 'BOT'));

const regularUsers = computed(() => users.value.filter(u => u.role !== 'BOT'));
const bots = computed(() => users.value.filter(u => u.role === 'BOT'));
const revealedSecrets = ref({});

const newUser = ref({
  username: "",
  email: "",
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
    revealedSecrets.value[bot.username] = data.secret;
  }
}

async function copySecret(secret) {
  try {
    await navigator.clipboard.writeText(secret);
    alert("Secret copied to clipboard!");
  } catch (err) {
    console.error("Failed to copy secret: ", err);
    alert("Failed to copy secret.");
  }
}

// Actions
async function rotateSecret(bot) {
  if (!confirm(`Rotate bot secret for ${bot.username}? Existing integrations will break!`)) return;
  const res = await fetch(`/api/admin/bots/${bot.username}/secret/rotate`, { method: "POST" });
  if (res.ok) {
    alert("Bot secret rotated successfully.");
    fetchBotSecret(bot);
  }
}

async function createUser() {
  const res = await fetch("/api/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(newUser.value)
  });
  if (res.ok) {
    alert("User created!");
    Object.keys(newUser.value).forEach(k => (newUser.value[k] = ""));
    newUser.value.role = "USER";
    fetchUsers();
  } else {
    const error = await res.json();
    alert(`Failed to create user: ${error.error}`);
  }
}

async function createBot() {
  const res = await fetch("/api/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...newBot.value, role: 'BOT' })
  });
  if (res.ok) {
    alert("Bot created!");
    newBot.value.username = "";
    fetchUsers();
  } else {
    const error = await res.json();
    alert(`Failed to create bot: ${error.error}`);
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
    alert("User role updated!");
    fetchUsers();
  } else {
    alert("Failed to update user role.");
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
    alert("Badge created!");
    Object.keys(newBadge.value).forEach(k => (newBadge.value[k] = ""));
    fetchBadges();
  }
}

async function deleteBadge(slug) {
  if (!confirm(`Delete badge ${slug}?`)) return;
  const res = await fetch(`/api/admin/badges/${slug}`, { method: "DELETE" });
  if (res.ok) alert("Badge deleted successfully.");
  else alert("Cannot delete badge — it may still be assigned to users.");
  fetchBadges();
}

async function dropBadgeFromUsers(slug) {
  if (!confirm(`Remove '${slug}' from all users?`)) return;
  const res = await fetch(`/api/admin/badges/${slug}/drop`, { method: "POST" });
  if (res.ok) {
    const data = await res.json();
    alert(data.message || "Badge dropped from users.");
    fetchBadges();
  } else {
    alert("Failed to drop badge.");
  }
}

onMounted(() => {
  fetchUsers();
  fetchKudos();
  fetchBadges();
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

.empty {
  color: var(--text-muted);
  margin-top: 1rem;
}

.bot-management {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}
</style>
