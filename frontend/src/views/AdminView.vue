<!-- Copyright © 2025–present Lubos Kocman, LCP (Jay Michalska),
     and openSUSE contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<template>
  <main class="admin-view">
    <header class="header">
      <h1>🛠️ Admin Dashboard</h1>
      <p class="subtitle">
        Manage users, monitor stats, and keep the openSUSE Kudos system healthy.
      </p>
    </header>

    <!-- STATS OVERVIEW -->
    <section class="stats-grid" v-if="stats">
      <div class="stat-card">
        <h2>{{ stats.users }}</h2>
        <p>Registered Users</p>
      </div>
      <div class="stat-card">
        <h2>{{ stats.kudos }}</h2>
        <p>Total Kudos</p>
      </div>
      <div class="stat-card">
        <h2>{{ stats.badges }}</h2>
        <p>Badges Defined</p>
      </div>
      <div class="stat-card">
        <h2>{{ stats.categories }}</h2>
        <p>Kudos Categories</p>
      </div>
    </section>

    <section v-else class="loading">
      <p>Loading stats...</p>
    </section>

    <!-- ACTIONS -->
    <section class="actions">
      <h2>Quick Actions</h2>
      <div class="buttons">
        <button @click="refreshStats" class="btn green">🔄 Refresh Stats</button>
        <button @click="syncBadges" class="btn yellow">🏅 Recalculate Badges</button>
        <button @click="resetDB" class="btn red">💣 Reset Database</button>
      </div>
    </section>

    <!-- LEADERBOARD -->
    <section class="leaderboard">
      <h2>🏆 Top Contributors</h2>
      <table v-if="leaders.length > 0">
        <thead>
          <tr>
            <th>#</th>
            <th>User</th>
            <th>Kudos Given</th>
            <th>Kudos Received</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(u, idx) in leaders" :key="u.username">
            <td>{{ idx + 1 }}</td>
            <td class="user-cell">
              <img
                v-if="u.avatarUrl"
                :src="u.avatarUrl"
                class="avatar"
                alt="Avatar"
              />
              <span>{{ u.username }}</span>
            </td>
            <td>{{ u.given }}</td>
            <td>{{ u.received }}</td>
          </tr>
        </tbody>
      </table>

      <p v-else class="empty">No leaderboard data yet.</p>
    </section>
  </main>
</template>

<script setup>
import { ref, onMounted } from "vue";

const stats = ref(null);
const leaders = ref([]);
const loading = ref(true);

async function fetchStats() {
  try {
    const res = await fetch("/api/stats");
    if (!res.ok) throw new Error("Failed to load stats");
    stats.value = await res.json();
  } catch (err) {
    console.error("💥 Failed to fetch stats:", err);
  }
}

async function fetchLeaders() {
  try {
    const res = await fetch("/api/overview/leaderboard");
    if (!res.ok) throw new Error("Failed to load leaderboard");
    leaders.value = await res.json();
  } catch (err) {
    console.error("💥 Failed to fetch leaderboard:", err);
  } finally {
    loading.value = false;
  }
}

async function refreshStats() {
  await Promise.all([fetchStats(), fetchLeaders()]);
}

async function syncBadges() {
  if (!confirm("Recalculate all badges? This may take a few seconds.")) return;
  try {
    const res = await fetch("/api/admin/sync-badges", { method: "POST" });
    const data = await res.json();
    alert(data.message || "Badges recalculated!");
  } catch (err) {
    alert("Failed to sync badges.");
    console.error(err);
  }
}

async function resetDB() {
  if (!confirm("⚠️ This will reset all data. Are you sure?")) return;
  try {
    const res = await fetch("/api/admin/reset-db", { method: "POST" });
    const data = await res.json();
    alert(data.message || "Database reset completed!");
    await refreshStats();
  } catch (err) {
    alert("Database reset failed.");
    console.error(err);
  }
}

onMounted(refreshStats);
</script>

<style scoped>
.admin-view {
  max-width: 1100px;
  margin: 2rem auto;
  padding: 1.5rem;
}

.header {
  text-align: center;
  margin-bottom: 2rem;
}

.header h1 {
  font-size: 2.2rem;
  color: var(--green-900, #73ba25);
  margin-bottom: 0.3rem;
}

.subtitle {
  color: var(--text-muted, #666);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: var(--surface, #fff);
  border: 2px solid var(--green-500, #73ba25);
  border-radius: 1rem;
  padding: 1rem;
  text-align: center;
  transition: all 0.2s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.08);
}

.stat-card h2 {
  font-size: 1.8rem;
  color: var(--green-900, #73ba25);
  margin: 0;
}

.stat-card p {
  color: var(--text-secondary, #555);
  margin: 0.2rem 0 0;
}

.actions {
  text-align: center;
  margin: 2rem 0;
}

.actions h2 {
  margin-bottom: 1rem;
  font-size: 1.3rem;
}

.buttons {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 1rem;
}

.btn {
  border: none;
  border-radius: 0.5rem;
  padding: 0.6rem 1.2rem;
  font-weight: 600;
  color: #fff;
  cursor: pointer;
  transition: background 0.2s ease;
}

.btn.green {
  background: #73ba25;
}
.btn.green:hover {
  background: #5fa41e;
}

.btn.yellow {
  background: #f6c915;
  color: #222;
}
.btn.yellow:hover {
  background: #dfb413;
}

.btn.red {
  background: #e43e3e;
}
.btn.red:hover {
  background: #c73131;
}

.leaderboard {
  margin-top: 3rem;
}

.leaderboard h2 {
  margin-bottom: 1rem;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: 0.6rem;
  border-bottom: 1px solid #ddd;
  text-align: left;
}

th {
  background: var(--surface-alt, #f5f5f5);
  color: var(--text-primary, #222);
}

.user-cell {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
}

.empty {
  text-align: center;
  color: var(--text-muted, #666);
  margin-top: 1rem;
}

.loading {
  text-align: center;
  color: #999;
  margin: 2rem 0;
}
</style>
