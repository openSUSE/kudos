<!--
Copyright © 2025-present Lubos Kocman
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

    <!-- Dashboard -->
    <section v-if="currentTab === 'Dashboard'" class="crud">
      <h2>📊 Overview</h2>
      <div class="dashboard-cards">
        <div class="stat-card">
          <span class="stat-icon">👥</span>
          <span class="stat-value">{{ overview.users ?? '...' }}</span>
          <span class="stat-label">Users</span>
        </div>
        <div class="stat-card">
          <span class="stat-icon">💚</span>
          <span class="stat-value">{{ overview.kudos ?? '...' }}</span>
          <span class="stat-label">Kudos</span>
        </div>
        <div class="stat-card">
          <span class="stat-icon">🏅</span>
          <span class="stat-value">{{ overview.badges ?? '...' }}</span>
          <span class="stat-label">Badges</span>
        </div>
      </div>
      <div class="admin-actions">
        <h3>⚙️ Maintenance</h3>
        <div class="action-buttons">
          <button @click="syncBadges" class="btn blue">🔄 Sync Badges from Seed</button>
          <button @click="resetDb" class="btn red">💣 Reset Database</button>
        </div>
      </div>
    </section>

    <!-- Users -->
    <section v-if="currentTab === 'Users'" class="crud">
      <h2>👥 Users</h2>
      <form class="create-form" @submit.prevent="createUser">
        <input v-model="newUser.username" placeholder="username" required />
        <select v-model="newUser.role" required>
          <option v-for="role in userRoles" :key="role" :value="role">{{ role }}</option>
        </select>
        <button class="btn green" type="submit">➕ Create User</button>
      </form>
      <table v-if="regularUsers.length">
        <thead><tr><th>Username</th><th>Role</th><th>Actions</th></tr></thead>
        <tbody>
          <tr v-for="u in regularUsers" :key="u.username">
            <td>{{ u.username }}</td>
            <td>
              <select v-model="u.role">
                <option v-for="role in userRoles" :key="role" :value="role">{{ role }}</option>
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

    <!-- Bots -->
    <section v-if="currentTab === 'Bots'" class="crud">
      <h2>🤖 Bots</h2>
      <form class="create-form" @submit.prevent="createBot">
        <input v-model="newBot.username" placeholder="bot username" required />
        <button class="btn green" type="submit">➕ Create Bot</button>
      </form>
      <table v-if="bots.length">
        <thead><tr><th>Username</th><th>Secret</th><th>Actions</th></tr></thead>
        <tbody>
          <tr v-for="b in bots" :key="b.username">
            <td>{{ b.username }}</td>
            <td>
              <code v-if="revealedSecrets[b.username]">{{ revealedSecrets[b.username] }}</code>
              <button v-if="revealedSecrets[b.username]" @click="copySecret(revealedSecrets[b.username])" class="btn green">📋 Copy</button>
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

    <!-- Kudos -->
    <section v-if="currentTab === 'Kudos'" class="crud">
      <h2>💚 Kudos Feed</h2>
      <div class="search-bar">
        <input v-model="kudosSearch" placeholder="Search kudos by user or message..." @input="debouncedFetchKudos" />
      </div>
      <table v-if="kudos.length">
        <thead><tr><th>From</th><th>To</th><th>Category</th><th>Message</th><th>Date</th><th>Actions</th></tr></thead>
        <tbody>
          <tr v-for="k in kudos" :key="k.id">
            <td>{{ k.fromUser?.username || 'unknown' }}</td>
            <td>{{ k.recipients.map(r => r.user.username).join(', ') }}</td>
            <td>{{ k.category?.icon }} {{ k.category?.label || '—' }}</td>
            <td class="truncate">{{ k.message }}</td>
            <td>{{ formatDate(k.createdAt) }}</td>
            <td><button @click="deleteKudo(k.id)" class="btn red">🗑️ Delete</button></td>
          </tr>
        </tbody>
      </table>
      <p v-else class="empty">No kudos recorded.</p>
      <div v-if="kudosPagination.pages > 1" class="pagination">
        <button :disabled="kudosPagination.page <= 1" @click="fetchKudos(kudosPagination.page - 1)" class="btn">← Prev</button>
        <span class="page-info">Page {{ kudosPagination.page }} of {{ kudosPagination.pages }} ({{ kudosPagination.total }} total)</span>
        <button :disabled="kudosPagination.page >= kudosPagination.pages" @click="fetchKudos(kudosPagination.page + 1)" class="btn">Next →</button>
      </div>
    </section>

    <!-- Badges -->
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
        <thead><tr><th>Slug</th><th>Title</th><th>Description</th><th>Holders</th><th>Actions</th></tr></thead>
        <tbody>
          <tr v-for="b in badges" :key="b.slug">
            <td>{{ b.slug }}</td>
            <td>{{ b.title }}</td>
            <td class="truncate">{{ b.description }}</td>
            <td>{{ b.holders || 0 }}</td>
            <td>
              <button v-if="b.holders > 0" @click="dropBadgeFromUsers(b.slug)" class="btn yellow">🧹 Drop from users</button>
              <button v-else @click="deleteBadge(b.slug)" class="btn red">🗑️ Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-else class="empty">No badges yet.</p>
    </section>

    <!-- Grant Badge -->
    <section v-if="currentTab === 'Grant Badge'" class="crud">
      <h2>🏆 Grant Badge</h2>
      <form class="create-form" @submit.prevent="grantBadge">
        <div class="autocomplete-wrapper">
          <input v-model="query" placeholder="username" @input="searchUsers" autocomplete="off" required />
          <ul v-if="suggestions.length" class="suggestions">
            <li v-for="user in suggestions" :key="user.username" @click="selectUser(user)">{{ user.username }}</li>
          </ul>
        </div>
        <select v-model="grantBadgeData.badgeSlug" required>
          <option disabled value="">Select a badge</option>
          <option v-for="b in badges" :key="b.slug" :value="b.slug">{{ b.title }}</option>
        </select>
        <button class="btn green" type="submit">🏆 Grant Badge</button>
      </form>
    </section>

    <!-- Categories -->
    <section v-if="currentTab === 'Categories'" class="crud">
      <h2>📂 Kudos Categories</h2>
      <form class="create-form" @submit.prevent="createCategory">
        <input v-model="newCategory.code" placeholder="code (e.g. teamwork)" required />
        <input v-model="newCategory.label" placeholder="label (e.g. Teamwork)" required />
        <input v-model="newCategory.icon" placeholder="icon (emoji)" required />
        <input v-model="newCategory.defaultMsg" placeholder="default message (optional)" />
        <button class="btn green" type="submit">➕ Add Category</button>
      </form>
      <table v-if="categories.length">
        <thead><tr><th>Icon</th><th>Code</th><th>Label</th><th>Default Msg</th><th>Kudos</th><th>Actions</th></tr></thead>
        <tbody>
          <tr v-for="c in categories" :key="c.id">
            <td>{{ c.icon }}</td>
            <td>{{ c.code }}</td>
            <td>{{ c.label }}</td>
            <td class="truncate">{{ c.defaultMsg || '—' }}</td>
            <td>{{ c.kudosCount || 0 }}</td>
            <td>
              <button @click="deleteCategory(c.id, c.code)" class="btn red" :disabled="c.kudosCount > 0" :title="c.kudosCount > 0 ? 'Cannot delete - category in use' : 'Delete category'">🗑️ Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-else class="empty">No categories yet.</p>
    </section>
  </main>
</template>

<script setup>
import { ref, onMounted, computed } from "vue";
import { useNotifications } from "../composables/useNotifications.js";

const { addNotification } = useNotifications();
const tabs = ["Dashboard", "Users", "Bots", "Kudos", "Badges", "Grant Badge", "Categories"];
const currentTab = ref("Dashboard");

const users = ref([]);
const kudos = ref([]);
const badges = ref([]);
const categories = ref([]);
const overview = ref({});
const allRoles = ["USER", "MEMBER", "MODERATOR", "ADMIN", "BOT"];
const userRoles = computed(() => allRoles.filter(r => r !== 'BOT'));

const regularUsers = computed(() => users.value.filter(u => u.role !== 'BOT'));
const bots = computed(() => users.value.filter(u => u.role === 'BOT'));
const revealedSecrets = ref({});

const kudosSearch = ref("");
const kudosPagination = ref({ page: 1, pages: 1, total: 0 });

const newUser = ref({ username: "", role: "USER" });
const newBot = ref({ username: "" });
const newBadge = ref({ slug: "", title: "", picture: "", color: "", description: "" });
const newCategory = ref({ code: "", label: "", icon: "", defaultMsg: "" });
const grantBadgeData = ref({ username: "", badgeSlug: "" });
const query = ref("");
const suggestions = ref([]);

let debounceTimer = null;
function debouncedFetchKudos() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => fetchKudos(1), 300);
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function searchUsers() {
  if (!query.value) { suggestions.value = []; return; }
  suggestions.value = users.value.filter(u => u.username.toLowerCase().includes(query.value.toLowerCase()));
}

function selectUser(user) {
  grantBadgeData.value.username = user.username;
  query.value = user.username;
  suggestions.value = [];
}

async function fetchOverview() {
  try { const res = await fetch("/api/admin/overview"); if (res.ok) overview.value = await res.json(); }
  catch (err) { console.error("Failed to fetch overview:", err); }
}

async function fetchUsers() {
  const res = await fetch("/api/users");
  if (res.ok) users.value = await res.json();
}

async function fetchKudos(page = 1) {
  const params = new URLSearchParams({ page, limit: 50 });
  if (kudosSearch.value) params.set("search", kudosSearch.value);
  const res = await fetch("/api/admin/kudos?" + params);
  if (res.ok) {
    const data = await res.json();
    kudos.value = data.kudos;
    kudosPagination.value = { page: data.page, pages: data.pages, total: data.total };
  }
}

async function fetchBadges() {
  const res = await fetch("/api/admin/badges");
  if (res.ok) badges.value = await res.json();
}

async function fetchCategories() {
  const res = await fetch("/api/admin/categories");
  if (res.ok) categories.value = await res.json();
}

async function fetchBotSecret(bot) {
  const res = await fetch("/api/admin/bots/" + bot.username + "/secret");
  if (res.ok) {
    const data = await res.json();
    revealedSecrets.value = { ...revealedSecrets.value, [bot.username]: data.secret };
    addNotification({ title: "Success", message: "Secret revealed." });
  } else {
    addNotification({ title: "Error", message: "Failed to fetch bot secret." });
  }
}

async function copySecret(secret) {
  try { await navigator.clipboard.writeText(secret); addNotification({ title: "Success", message: "Secret copied to clipboard!" }); }
  catch (err) { console.error("Failed to copy secret: ", err); addNotification({ title: "Error", message: "Failed to copy secret." }); }
}

async function rotateSecret(bot) {
  if (!confirm("Rotate bot secret for " + bot.username + "? Existing integrations will break!")) return;
  const res = await fetch("/api/admin/bots/" + bot.username + "/secret/rotate", { method: "POST" });
  if (res.ok) { addNotification({ title: "Success", message: "Bot secret rotated successfully." }); fetchBotSecret(bot); }
}

async function generateSecret(bot) {
  if (!confirm("Generate a new bot secret for " + bot.username + "? Existing integrations will break!")) return;
  const res = await fetch("/api/admin/bots/" + bot.username + "/secret/generate", { method: "POST" });
  if (res.ok) { addNotification({ title: "Success", message: "Bot secret generated successfully." }); fetchBotSecret(bot); }
}

async function createUser() {
  const res = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newUser.value) });
  if (res.ok) { addNotification({ title: "Success", message: "User created!" }); newUser.value.username = ""; newUser.value.role = "USER"; fetchUsers(); }
  else { const error = await res.json(); addNotification({ title: "Error", message: "Failed to create user: " + error.error }); }
}

async function createBot() {
  const res = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...newBot.value, role: "BOT" }) });
  if (res.ok) { addNotification({ title: "Success", message: "Bot created!" }); newBot.value.username = ""; fetchUsers(); }
  else { const error = await res.json(); addNotification({ title: "Error", message: "Failed to create bot: " + error.error }); }
}

async function updateUserRole(username, role) {
  if (!confirm("Update role for " + username + " to " + role + "?")) return;
  const res = await fetch("/api/admin/users/" + username + "/role", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }) });
  if (res.ok) { addNotification({ title: "Success", message: "User role updated!" }); fetchUsers(); }
  else { addNotification({ title: "Error", message: "Failed to update user role." }); }
}

async function deleteUser(username) {
  if (!confirm("Delete user " + username + "?")) return;
  const res = await fetch("/api/admin/users/" + username, { method: "DELETE" });
  if (res.ok) { addNotification({ title: "Success", message: "User '" + username + "' deleted." }); }
  fetchUsers();
}

async function deleteKudo(id) {
  if (!confirm("Delete this kudo?")) return;
  const res = await fetch("/api/admin/kudos/" + id, { method: "DELETE" });
  if (res.ok) { addNotification({ title: "Success", message: "Kudo #" + id + " deleted." }); }
  else { addNotification({ title: "Error", message: "Failed to delete kudo." }); }
  fetchKudos(kudosPagination.value.page);
}

async function createBadge() {
  const res = await fetch("/api/admin/badges", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newBadge.value) });
  if (res.ok) { addNotification({ title: "Success", message: "Badge created!" }); Object.keys(newBadge.value).forEach(k => (newBadge.value[k] = "")); fetchBadges(); }
  else { const error = await res.json(); addNotification({ title: "Error", message: "Failed to create badge: " + error.error }); }
}

async function grantBadge() {
  const { username, badgeSlug } = grantBadgeData.value;
  if (!username || !badgeSlug) { addNotification({ title: "Error", message: "Username and badge must be provided." }); return; }
  const res = await fetch("/api/admin/badges/grant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(grantBadgeData.value) });
  if (res.ok) { addNotification({ title: "Success", message: "Badge '" + badgeSlug + "' granted to '" + username + "'!" }); grantBadgeData.value.username = ""; grantBadgeData.value.badgeSlug = ""; query.value = ""; fetchBadges(); }
  else { const error = await res.json(); addNotification({ title: "Error", message: "Failed to grant badge: " + error.error }); }
}

async function deleteBadge(slug) {
  if (!confirm("Delete badge " + slug + "?")) return;
  const res = await fetch("/api/admin/badges/" + slug, { method: "DELETE" });
  if (res.ok) addNotification({ title: "Success", message: "Badge deleted successfully." });
  else addNotification({ title: "Error", message: "Cannot delete badge — it may still be assigned to users." });
  fetchBadges();
}

async function dropBadgeFromUsers(slug) {
  if (!confirm("Remove '" + slug + "' from all users?")) return;
  const res = await fetch("/api/admin/badges/" + slug + "/drop", { method: "POST" });
  if (res.ok) { const data = await res.json(); addNotification({ title: "Success", message: data.message || "Badge dropped from users." }); fetchBadges(); }
  else { addNotification({ title: "Error", message: "Failed to drop badge." }); }
}

async function createCategory() {
  const res = await fetch("/api/admin/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newCategory.value) });
  if (res.ok) { addNotification({ title: "Success", message: "Category created!" }); newCategory.value = { code: "", label: "", icon: "", defaultMsg: "" }; fetchCategories(); }
  else { const error = await res.json(); addNotification({ title: "Error", message: "Failed to create category: " + error.error }); }
}

async function deleteCategory(id, code) {
  if (!confirm("Delete category '" + code + "'?")) return;
  const res = await fetch("/api/admin/categories/" + id, { method: "DELETE" });
  if (res.ok) { addNotification({ title: "Success", message: "Category deleted." }); fetchCategories(); }
  else { const error = await res.json(); addNotification({ title: "Error", message: error.error || "Failed to delete category." }); }
}

async function syncBadges() {
  if (!confirm("Re-sync badges from seed data?")) return;
  const res = await fetch("/api/admin/sync-badges", { method: "POST" });
  if (res.ok) { addNotification({ title: "Success", message: "Badges re-synced from seed." }); fetchBadges(); fetchOverview(); }
  else { addNotification({ title: "Error", message: "Failed to sync badges." }); }
}

async function resetDb() {
  if (!confirm("WARNING: This will DELETE all kudos, badges, and categories. Are you sure?")) return;
  if (!confirm("FINAL WARNING: This action is irreversible!")) return;
  const res = await fetch("/api/admin/reset-db", { method: "POST" });
  if (res.ok) { addNotification({ title: "Success", message: "Database reset successfully." }); fetchOverview(); fetchKudos(); fetchBadges(); fetchCategories(); }
  else { addNotification({ title: "Error", message: "Failed to reset database." }); }
}

onMounted(() => { fetchOverview(); fetchUsers(); fetchKudos(); fetchBadges(); fetchCategories(); });
</script>

<style scoped>
.admin-view {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1.5rem;
}

/* Header */
.header {
  margin-bottom: 1.5rem;
}
.header h1 {
  margin: 0 0 0.25rem 0;
}
.subtitle {
  margin: 0;
  color: var(--color-text-secondary, #666);
}

/* Tabs */
.tabs {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
  border-bottom: 2px solid var(--color-border, #ddd);
  padding-bottom: 0.5rem;
}
.tabs button {
  padding: 0.5rem 1rem;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 4px 4px 0 0;
  font-size: 0.95rem;
  color: var(--color-text, #333);
}
.tabs button:hover {
  background: var(--color-bg-hover, #f0f0f0);
}
.tabs button.active {
  background: var(--color-primary, #0066cc);
  color: #fff;
}

/* CRUD sections */
.crud {
  animation: fadeIn 0.2s ease;
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Dashboard cards */
.dashboard-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}
.stat-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  background: var(--color-bg-card, #f9f9f9);
  padding: 1.25rem;
  border-radius: 8px;
  text-align: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}
.stat-icon {
  font-size: 1.5rem;
}
.stat-value {
  font-size: 2rem;
  font-weight: bold;
  color: var(--color-primary, #0066cc);
}
.stat-label {
  color: var(--color-text-secondary, #666);
  font-size: 0.9rem;
}

/* Admin actions / Maintenance */
.admin-actions {
  margin-top: 1rem;
}
.admin-actions h3 {
  margin: 0 0 0.75rem 0;
}
.action-buttons {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

/* Tables */
table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
}
th, td {
  text-align: left;
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid var(--color-border, #eee);
}
th {
  background: var(--color-bg-card, #f5f5f5);
  font-weight: 600;
}
.truncate {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Buttons – use space-separated classes: "btn green", "btn red", etc. */
.btn {
  cursor: pointer;
  padding: 0.4rem 0.8rem;
  border: none;
  border-radius: 4px;
  font-size: 0.85rem;
  background: var(--color-bg-card, #e0e0e0);
  color: var(--color-text, #333);
  transition: background 0.15s;
}
.btn:hover {
  filter: brightness(0.92);
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn.green {
  background: #2da44e;
  color: #fff;
}
.btn.green:hover {
  background: #258c42;
}
.btn.yellow {
  background: #d4a017;
  color: #fff;
}
.btn.yellow:hover {
  background: #b8860b;
}
.btn.red {
  background: #d32f2f;
  color: #fff;
}
.btn.red:hover {
  background: #b71c1c;
}
.btn.blue {
  background: #1976d2;
  color: #fff;
}
.btn.blue:hover {
  background: #1565c0;
}

/* Forms */
.create-form {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  align-items: flex-end;
  margin-top: 1rem;
}
.create-form input,
.create-form select {
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--color-border, #ccc);
  border-radius: 4px;
  font-size: 0.9rem;
}

/* Search bar */
.search-bar {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}
.search-bar input {
  flex: 1;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border, #ccc);
  border-radius: 4px;
}

/* Pagination */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  margin-top: 1rem;
}
.page-info {
  font-size: 0.9rem;
  color: var(--color-text-secondary, #666);
}

/* Autocomplete */
.autocomplete-wrapper {
  position: relative;
}
.suggestions {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: #fff;
  border: 1px solid var(--color-border, #ccc);
  border-radius: 0 0 4px 4px;
  max-height: 200px;
  overflow-y: auto;
  z-index: 10;
  margin: 0;
  padding: 0;
}
.suggestions li {
  list-style: none;
  padding: 0.4rem 0.6rem;
  cursor: pointer;
}
.suggestions li:hover {
  background: var(--color-bg-hover, #f0f0f0);
}

/* Empty state */
.empty {
  color: var(--color-text-secondary, #888);
  font-style: italic;
  padding: 1rem 0;
}
</style>
