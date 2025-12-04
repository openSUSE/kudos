<!--
Copyright © 2025–present Lubos Kocman
and openSUSE contributors
SPDX-License-Identifier: Apache-2.0
-->

<template>
  <div class="home container">

    <!-- ⚡ Recent Activity -->
    <section class="activity section-box">
      <h2>⚡ Recent Activity
      <span class="arrow-prompt" aria-hidden="true">&gt;&gt;&gt;</span>
      </h2>
      <p class="hint">
        💡 Live stream available at
        <a href="/api/now/stream" target="_blank" rel="noopener">/api/now/stream</a>
      </p>
    <div v-if="statsSummary" class="stats-line" v-html="statsSummary"></div>
    </section>

    <!-- 💚 Latest Kudos -->
    <section class="section-box">
      <h2>💚 Latest Kudos
      <span class="arrow-prompt" aria-hidden="true">&gt;&gt;&gt;</span>
      </h2>

      <div v-if="visibleKudos.length" class="kudos-feed kudos-feed--compact">
        <router-link
          v-for="k in visibleKudos"
          :key="k.id"
          class="kudo-line"
          :to="`/kudo/${k.slug}`"
        >
          <span class="icon">{{ k.category?.icon || "💚" }}</span>
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
      <h2>🏅 Recently Earned Badges
      <span class="arrow-prompt" aria-hidden="true">&gt;&gt;&gt;</span>
      </h2>
      <p class="hint">Badges earned by openSUSE contributors in the last 30 days.</p>

      <div v-if="badges.length" class="badges-grid">
        <div
          v-for="(b, index) in badges"
          :key="index"
          class="badge-wrapper"
        >
          <div class="badge-card">
            <router-link
              :to="`/badge/${b.slug}`"
              :aria-label="`View details for ${b.title} badge`"
            >
              <img v-if="b.picture" :src="b.picture" :alt="b.title" class="badge-image" />
            </router-link>
          </div>

          <!-- 👇 Consistent title style -->
          <div class="badge-title">
            {{ b.title }}
          </div>

          <!-- 👇 New: show who earned it -->
          <div v-if="b.user" class="badge-earned-by">
            earned by <strong>@{{ b.user.username }}</strong>
          </div>
        </div>
      </div>

      <div v-else class="quiet">
        <p>💫 No badges earned recently — keep spreading kudos!</p>
      </div>

      <div class="view-all">
        <router-link to="/badges" class="view-link">→ View All Badges</router-link>
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
  const top3 = leaderboard.value.slice(0, 3);

  const summaryParts = [];
  if (r[0]) summaryParts.push(`${r[0].icon} ${r[0].value} ${r[0].label.toLowerCase()}`);
  if (r[1]) summaryParts.push(`${r[1].icon} ${r[1].value} ${r[1].label.toLowerCase()}`);
  if (r[2]) summaryParts.push(`${r[2].icon} ${r[2].value} ${r[2].label.toLowerCase()}`);

  let summary = summaryParts.join(" | ");

  if (top3.length) {
    const medals = ["🥇", "🥈", "🥉"];
    const links = top3
      .map((u, i) => `<a href="/user/${u.username}" class="geeko-link">${medals[i]} @${u.username}</a>`)
      .join(" ");
    summary += ` | 🦎 Top Geekos in past 30 days: ${links}`;
  }

  return summary;
}


const statsSummary = ref("");

onMounted(async () => {
  try {
    const res = await fetch("/api/summary");
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
    console.error("Failed to load summary:", err);
  }
});

onUnmounted(() => {
  if (cycleTimer) clearInterval(cycleTimer);
});
</script>

<style scoped>
/* keep home-specific styles — shared kudos styles now live in base.css */

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

.stats-line {
  margin-top: 0.6rem;
  font-family: "VT323", monospace;
  color: var(--geeko-green);
  opacity: 0.9;
}

.stats-line .geeko-link {
  color: var(--butterfly-blue);
  text-decoration: none;
  margin: 0 0.2rem;
  transition: color 0.2s ease;
}
.stats-line .geeko-link:hover {
  color: var(--geeko-green);
  text-shadow: 0 0 4px rgba(0, 255, 128, 0.6);
}


.badges-grid,
.leaderboard-grid,
.stats,
.overview {
  margin-top: 1.2rem;
}

.badge-earned-by {
  margin-top: 0.2rem;
  font-size: 0.85rem;
  color: var(--text-secondary);
  opacity: 0.85;
  font-family: "Pixel Operator", monospace;
}
.badge-earned-by strong {
  color: var(--geeko-green);
  text-shadow: 0 0 2px rgba(66, 205, 66, 0.5);
}

</style>
