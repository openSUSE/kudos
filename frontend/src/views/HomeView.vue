<!--
Copyright © 2025–present Lubos Kocman
and openSUSE contributors
SPDX-License-Identifier: Apache-2.0
-->

<template>
  <div class="home container">

    <section class="section-box">
      <h2>💚 {{ t('home.latest_kudos') }}
      <span class="arrow-prompt" aria-hidden="true">&gt;&gt;&gt;</span>
      </h2>

      <div v-if="visibleKudos.length" class="kudos-feed kudos-feed--compact">
        <router-link
          v-for="k in visibleKudos"
          :key="k.id"
          class="kudo-line"
          :class="{ 'group-kudo': isGroupKudo(k) }"
          :to="`/kudo/${k.slug}`"
        >
          <span class="icon">{{ k.category?.icon || "💚" }}</span>
          <router-link :to="`/user/${k.fromUser.username}`" class="user" @click.stop>@{{ k.fromUser.username }}</router-link>
          →
          <!-- Group recipients or single recipient -->
          <template v-if="isGroupKudo(k)">
            <span class="users-group">
              <router-link
                v-for="(r, idx) in k.recipients"
                :key="r.userId"
                :to="`/user/${r.user.username}`"
                class="user"
                @click.stop
              >
                @{{ r.user.username }}<span v-if="idx < k.recipients.length - 1" class="separator">,</span>
              </router-link>
            </span>
            <span class="group-indicator">👥</span>
          </template>
          <template v-else>
            <router-link :to="`/user/${k.recipients[0]?.user.username}`" class="user" @click.stop>@{{ k.recipients[0]?.user.username }}</router-link>
          </template>
          <span class="message">"{{ k.message }}"</span>
          <span class="timestamp">{{ timeAgo(k.createdAt) }}</span>
        </router-link>
      </div>

      <div v-else class="quiet">
        <p>🦎 {{ t('home.no_kudos') }}</p>
      </div>

      <div class="view-all">
        <router-link to="/kudos" class="view-link">→ View all {{ totals.kudos }} kudos</router-link>
      </div>
    </section>

    <section class="recent-badges section-box">
      <h2>🏅 {{ t('home.recent_badges') }}
      <span class="arrow-prompt" aria-hidden="true">&gt;&gt;&gt;</span>
      </h2>
      <p class="hint">{{ t('home.badges_hint') }}</p>

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
              <img v-if="b.picture" :src="getBadgeImageUrl(b.picture)" :alt="b.title" class="badge-image" />
            </router-link>
          </div>

          <div class="badge-title">
            {{ b.title }}
          </div>

          <div v-if="b.user" class="badge-earned-by">
            {{ t('home.earned_by') }} <router-link :to="`/user/${b.user.username}`"><strong>@{{ b.user.username }}</strong></router-link>
          </div>
        </div>
      </div>

      <div v-else class="quiet">
        <p>💫 {{ t('home.no_badges') }}</p>
      </div>

      <div class="view-all">
        <router-link to="/badges" class="view-link">→ View all {{ totals.badges }} badges</router-link>
      </div>
    </section>

    <section class="section-box leaderboard-section">
      <h2>🏆 {{ t('home.most_recognized') }}
      <span class="arrow-prompt" aria-hidden="true">&gt;&gt;&gt;</span>
      </h2>
      <p class="hint">{{ t('home.most_recognized_hint') }}</p>

      <div v-if="receivedLeaderboard.length" class="leaderboard-list">
        <div v-for="group in receivedLeaderboard" :key="`received-${group.rank}`" class="leaderboard-row">
          <div class="leaderboard-rank">
            <span class="rank-badge" :title="rankTitle(group.rank)">{{ rankMedal(group.rank) }}</span>
          </div>
          <div class="leaderboard-users">
            <router-link
              v-for="user in group.users"
              :key="user.username"
              :to="`/user/${user.username}`"
              class="user"
            >
              @{{ user.username }}
            </router-link>
          </div>
          <div class="leaderboard-points">{{ group.points }} {{ t('home.recognitions') }}</div>
        </div>
      </div>

      <div v-else class="quiet">
        <p>🫥 {{ t('home.no_leaderboard') }}</p>
      </div>

      <div class="view-all">
        <router-link to="/stats" class="view-link">→ {{ t('home.view_stats') }}</router-link>
      </div>
    </section>

  </div>
</template>

<script setup>
import { useI18n } from "vue-i18n";
import { ref, onMounted, onUnmounted } from "vue";

const { t } = useI18n();

const allKudos = ref([]);
const visibleKudos = ref([]);
const badges = ref([]);
const receivedLeaderboard = ref([]);
const totals = ref({ kudos: 0, badges: 0 });
let cycleIndex = 0;
let cycleTimer = null;

function getBadgeImageUrl(pictureUrl) {
  if (pictureUrl) {
    return pictureUrl.replace('/badges/', '/badges/previews/200/');
  }
  return '';
}

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)} m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  return `${Math.floor(diff / 86400)} d ago`;
}

function isGroupKudo(kudo) {
  return kudo.recipients?.length > 1;
}

function rankMedal(rank) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  if (rank === 4) return "🥔";
  return `${rank}.`;
}

function rankTitle(rank) {
  if (rank === 1) return "Gold";
  if (rank === 2) return "Silver";
  if (rank === 3) return "Bronze";
  if (rank === 4) return "Potato";
  return `Rank ${rank}`;
}

function rotateKudos() {
  if (!allKudos.value.length) return;
  const start = cycleIndex * 5;
  visibleKudos.value = allKudos.value.slice(start, start + 5);
  cycleIndex = (cycleIndex + 1) % Math.ceil(allKudos.value.length / 5);
}

onMounted(async () => {
  try {
    const res = await fetch("/api/summary");
    if (res.ok) {
      const data = await res.json();
      allKudos.value = data.recentKudos || [];
      badges.value = data.recentBadges || [];
      receivedLeaderboard.value = data.leaderboards?.received || [];
      totals.value = data.totals || { kudos: 0, badges: 0 };
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

.home .section-box {
  padding-top: 0.85rem;
  padding-bottom: 0.85rem;
}

.leaderboard-section .hint {
  margin-bottom: 0.2rem;
}

.leaderboard-list {
  margin-top: 1rem;
  display: grid;
  gap: 0.65rem;
}

.leaderboard-row {
  display: grid;
  grid-template-columns: 60px minmax(0, 1fr) auto;
  gap: 0.75rem;
  align-items: center;
  padding: 0.8rem 0.9rem;
  border: 1px solid rgba(66, 205, 66, 0.15);
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.15);
}

.leaderboard-rank {
  font-family: "Pixel Operator Bold", monospace;
  color: var(--geeko-green);
  display: flex;
  align-items: center;
  justify-content: center;
}

.rank-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2rem;
  min-height: 2rem;
  border: 1px solid rgba(66, 205, 66, 0.18);
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.18);
  box-shadow: 0 0 0 1px rgba(66, 205, 66, 0.08) inset;
}

.leaderboard-users {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.45rem;
}

.leaderboard-users .user {
  text-decoration: none;
  color: var(--geeko-green);
}

.leaderboard-users .user:hover {
  text-decoration: underline;
}

.leaderboard-points {
  color: var(--text-secondary);
  font-family: "Pixel Operator", monospace;
  white-space: nowrap;
}

.leaderboard-footer {
  margin-top: 0.9rem;
  color: var(--butterfly-blue);
  font-family: "Pixel Operator", monospace;
  font-size: 0.95rem;
  font-weight: 700;
  opacity: 1;
  text-shadow: 0 0 3px rgba(61, 174, 233, 0.22);
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
.badge-earned-by a {
  text-decoration: none;
}
.badge-earned-by a:hover {
  text-decoration: underline;
}

</style>
