<!--
Copyright © 2025–present Lubos Kocman
and openSUSE contributors
SPDX-License-Identifier: Apache-2.0
-->

<template>
  <div class="home container">

    <!-- ⚡ Recent Activity -->
    <section class="activity section-box">
      <h2>⚡ Recent Activity</h2>
      <p class="hint">
        💡 Live stream available at <code>/api/now/stream</code>
      </p>

      <div class="activity-underline"></div>

      <!-- slim stat overlay -->
      <div v-if="statsSummary" class="stats-line">
        {{ statsSummary }}
      </div>

      <div v-if="visibleKudos.length" class="kudos-feed">
        <router-link
          v-for="(k, i) in visibleKudos"
          :key="k.id"
          class="kudo-line"
          :to="`/kudo/${k.slug}`"
        >
          <span class="icon">{{ k.category.icon }}</span>
          <span class="user">@{{ k.fromUser.username }}</span>
          →
          <span class="user">@{{ k.recipients[0]?.user.username }}</span>
          <span class="message">"{{ k.message }}"</span>
          <span class="timestamp">{{ timeAgo(k.createdAt) }}</span>
        </router-link>
      </div>

      <div v-else class="quiet">
        <p>🦎 It’s quiet in Geeko Land… send some kudos!</p>
      </div>

      <div class="view-all">
        <router-link to="/kudos" class="view-link">→ View All Kudos</router-link>
      </div>
    </section>

    <!-- 🏅 Recently Earned Badges -->
    <section class="recent-badges section-box">
      <h2>🏅 Recently Earned Badges</h2>
      <p class="hint">Badges earned by openSUSE contributors in the last 30 days.</p>

      <div v-if="badges.length" class="badges-grid">
        <router-link
          v-for="(b, index) in badges"
          :key="index"
          class="badge-card"
          :to="`/badge/${b.slug}`"
          :style="{ borderColor: b.color || 'var(--card-border)' }"
        >
          <img v-if="b.picture" :src="b.picture" :alt="b.title" class="badge-image" />
          <div class="badge-info">
            <h3>{{ b.title }}</h3>
            <p class="badge-meta">
              earned by <strong>{{ b.user.username }}</strong>
            </p>
          </div>
        </router-link>
      </div>

      <div v-else class="quiet">
        <p>💫 No badges earned recently — keep spreading kudos!</p>
      </div>

      <div class="view-all">
        <router-link to="/badges" class="view-link">→ View All Badges</router-link>
      </div>
    </section>

    <!-- 🧑‍💻 Leaderboard -->
    <section class="leaderboard section-box">
      <h2>🏆 Top Geekos in past 30 days</h2>
      <p class="hint">Most kudos received in the last 30 days.</p>

      <div v-if="leaderboard.length" class="leaderboard-grid">
        <div v-for="(u, i) in leaderboard" :key="i" class="leader-card">
          <span class="rank">#{{ i + 1 }}</span>
          <img :src="u.avatarUrl" :alt="u.username" class="avatar" />
          <div class="leader-info">
            <span class="username">@{{ u.username }}</span>
            <span class="count">💚 {{ u.kudosReceived }}</span>
          </div>
        </div>
      </div>

      <div v-else class="quiet">
        <p>🦎 No leaderboard data yet.</p>
      </div>
    </section>

  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";

const allKudos = ref([]);
const visibleKudos = ref([]);
const badges = ref([]);
const leaderboard = ref([]);
const stats = ref({ recent: [], total: [] });
let cycleIndex = 0;
let cycleTimer = null;
// let eventSource; // SSE stream (kept for future use)

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)} m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  return `${Math.floor(diff / 86400)} d ago`;
}

function rotateKudos() {
  if (!allKudos.value.length) return;
  const start = cycleIndex * 5;
  visibleKudos.value = allKudos.value.slice(start, start + 5);
  cycleIndex = (cycleIndex + 1) % Math.ceil(allKudos.value.length / 5);
}

function formatStatsLine() {
  const r = stats.value.recent;
  if (!r.length) return "";
  const summary =
    `${r[0]?.icon} ${r[0]?.value} ${r[0]?.label.toLowerCase()} | ` +
    `${r[1]?.icon} ${r[1]?.value} ${r[1]?.label.toLowerCase()} | ` +
    `${r[2]?.icon} ${r[2]?.value} ${r[2]?.label.toLowerCase()}`;
  const top = leaderboard.value[0];
  return summary + (top ? ` | 🦎 Top Geeko: ${top.username}` : "");
}

const statsSummary = ref("");

onMounted(async () => {
  try {
    const res = await fetch("/api/pulse");
    if (res.ok) {
      const data = await res.json();
      allKudos.value = data.recentKudos || [];
      badges.value = data.recentBadges || [];
      leaderboard.value = data.leaderboard || [];
      stats.value = data.stats || { recent: [], total: [] };
      statsSummary.value = formatStatsLine();
      rotateKudos();
      cycleTimer = setInterval(rotateKudos, 30000);
    }
  } catch (err) {
    console.error("Failed to load pulse:", err);
  }

  // --- SSE kept for future re-activation ---
  // eventSource = new EventSource("/api/now/stream");
  // eventSource.addEventListener("kudos", e => {
  //   const data = JSON.parse(e.data);
  //   allKudos.value.unshift({
  //     fromUser: { username: data.from },
  //     recipients: [{ user: { username: data.to } }],
  //     message: data.message,
  //     category: { icon: data.icon },
  //     createdAt: new Date().toISOString()
  //   });
  //   rotateKudos();
  // });
});

onUnmounted(() => {
  if (cycleTimer) clearInterval(cycleTimer);
  // if (eventSource) eventSource.close();
});
</script>

<style scoped>
/* Animated underline */
.activity h2 {
  position: relative;
  display: inline-block;
  padding-bottom: 6px;
}
.activity-underline {
  position: relative;
  height: 2px;
  background: linear-gradient(90deg, rgba(0,255,128,0), rgba(0,255,128,1), rgba(0,255,128,0));
  width: 0%;
  animation: underlineSweep 30s infinite ease-in-out;
  margin-top: 4px;
}
@keyframes underlineSweep {
  0%, 95%, 100% { width: 0%; opacity: 0.4; }
  5%, 50% { width: 100%; opacity: 1; }
}

/* slim stats line */
.stats-line {
  margin-top: 0.6rem;
  font-family: "VT323", monospace;
  color: var(--geeko-green);
  opacity: 0.9;
}

/* Kudo feed */
.kudos-feed {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-top: 1rem;
}
.kudo-line {
  font-family: "VT323", monospace;
  color: #b4ffb4;
  text-decoration: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  border-bottom: 1px solid rgba(0,255,0,0.05);
}
.kudo-line:hover { color: #9cff9c; }
.icon { margin-right: 0.4rem; }
.user { color: var(--geeko-green); margin: 0 0.25rem; }
.message { flex: 1; margin: 0 0.4rem; color: #caffca; }
.timestamp { opacity: 0.6; font-size: 0.9rem; }

.badges-grid, .leaderboard-grid, .stats, .overview { margin-top: 1.2rem; }
</style>
