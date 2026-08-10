<!--
Copyright © 2025–present Lubos Kocman
and openSUSE contributors
SPDX-License-Identifier: Apache-2.0
-->

<template>
  <div class="home container">
    <GeekoGuide top="45px" :opacity="0.9" />

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

      <div v-if="visibleBadgeGroups.length" class="badge-groups-row" aria-live="polite">
        <div
          v-for="group in visibleBadgeGroups"
          :key="group.slug"
          class="badge-group-card"
        >
          <router-link :to="`/badge/${group.slug}`" class="badge-group-img-link">
            <img
              v-if="group.picture"
              :src="getBadgeImageUrl(group.picture)"
              :alt="group.title"
              class="badge-group-image"
            />
          </router-link>
          <router-link :to="`/badge/${group.slug}`" class="badge-group-title">
            {{ group.title }}
          </router-link>
          <p class="badge-group-meta">
            {{ group.users.length }}
            {{ group.users.length === 1 ? t('home.person_earned') : t('home.people_earned') }}
          </p>
          <div class="badge-user-pills">
            <router-link
              v-for="u in group.users.slice(0, 5)"
              :key="u.username"
              :to="`/badge/${group.slug}/earned-by/${u.username}`"
              class="user-pill"
              :title="`@${u.username} earned ${group.title}`"
            >
              <img :src="u.avatarUrl" :alt="u.username" />
            </router-link>
            <span v-if="group.users.length > 5" class="pill-overflow">+{{ group.users.length - 5 }}</span>
          </div>
        </div>
      </div>

      <div v-else class="quiet">
        <p>💫 {{ t('home.no_badges') }}</p>
      </div>


      <div class="view-all">
        <router-link to="/badges/recent" class="view-link">→ View all {{ totals.badges }} earned badges</router-link>
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
import GeekoGuide from "../components/GeekoGuide.vue";

const { t } = useI18n();

const allKudos = ref([]);
const visibleKudos = ref([]);
const allBadgeGroups = ref([]);
const visibleBadgeGroups = ref([]);
const BADGE_COLUMNS = 7;
const BADGE_ROWS = 2;
const BADGES_PER_PAGE = BADGE_COLUMNS * BADGE_ROWS;
const receivedLeaderboard = ref([]);
const totals = ref({ kudos: 0, badges: 0 });
let kudosCycleIndex = 0;
let badgeCycleIndex = 0;
let kudosTimer = null;
let badgeTimer = null;

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
  const start = kudosCycleIndex * 5;
  visibleKudos.value = allKudos.value.slice(start, start + 5);
  kudosCycleIndex = (kudosCycleIndex + 1) % Math.ceil(allKudos.value.length / 5);
}

function rotateBadge() {
  if (!allBadgeGroups.value.length) return;
  const start = badgeCycleIndex * BADGES_PER_PAGE;
  visibleBadgeGroups.value = allBadgeGroups.value.slice(start, start + BADGES_PER_PAGE);
  badgeCycleIndex = (badgeCycleIndex + 1) % Math.ceil(allBadgeGroups.value.length / BADGES_PER_PAGE);
}

onMounted(async () => {
  try {
    const res = await fetch("/api/summary");
    if (res.ok) {
      const data = await res.json();
      allKudos.value = data.recentKudos || [];
      allBadgeGroups.value = data.recentBadgeGroups || [];
      receivedLeaderboard.value = data.leaderboards?.received || [];
      totals.value = data.totals || { kudos: 0, badges: 0 };

      rotateKudos();
      rotateBadge();

      // Stagger: kudos every 20s starting immediately, badges every 20s starting 10s later
      kudosTimer = setInterval(rotateKudos, 20000);
      setTimeout(() => {
        rotateBadge();
        badgeTimer = setInterval(rotateBadge, 20000);
      }, 10000);
    }
  } catch (err) {
    console.error("Failed to load summary:", err);
  }
});

onUnmounted(() => {
  if (kudosTimer) clearInterval(kudosTimer);
  if (badgeTimer) clearInterval(badgeTimer);
});
</script>

<style scoped>
/* keep home-specific styles — shared kudos styles now live in base.css */

.home.container {
  position: relative;
}

@media (min-width: 1221px) {
  .home.container {
    padding-left: 149px;
  }
}

@media (min-width: 1101px) and (max-width: 1220px) {
  .home.container {
    padding-left: 117px;
  }
}

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

.badge-groups-row {
  display: grid;
  grid-template-columns: repeat(7, minmax(110px, 1fr));
  gap: 0.75rem;
  margin-top: 0.9rem;
  align-items: start;
}

.badge-group-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  text-align: center;
}

.badge-group-img-link {
  display: block;
}

.badge-group-image {
  width: 80px;
  height: 80px;
  object-fit: contain;
  border-radius: 10px;
  border: 1px solid rgba(66, 205, 66, 0.2);
  background: rgba(0, 0, 0, 0.14);
  image-rendering: pixelated;
  display: block;
  transition: border-color 0.15s ease;
}

.badge-group-img-link:hover .badge-group-image {
  border-color: var(--geeko-green);
}

.badge-group-title {
  display: block;
  font-family: "Pixel Operator", monospace;
  font-size: 0.82rem;
  color: var(--geeko-green);
  text-decoration: none;
  line-height: 1.25;
  word-break: break-word;
}

.badge-group-title:hover {
  text-decoration: underline;
}

.badge-group-meta {
  margin: 0;
  font-size: 0.78rem;
  color: var(--text-secondary);
}

.badge-user-pills {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.2rem;
}

.user-pill {
  display: inline-flex;
  align-items: center;
  border: 1px solid rgba(66, 205, 66, 0.2);
  border-radius: 50%;
  padding: 1px;
  text-decoration: none;
  transition: border-color 0.15s ease;
}

.user-pill img {
  width: 22px;
  height: 22px;
  border-radius: 50%;
}

.user-pill:hover {
  border-color: var(--geeko-green);
}

.pill-overflow {
  font-size: 0.75rem;
  color: var(--text-secondary);
  align-self: center;
}

@media (max-width: 1600px) {
  .badge-groups-row {
    grid-template-columns: repeat(6, minmax(110px, 1fr));
  }
}

@media (max-width: 1380px) {
  .badge-groups-row {
    grid-template-columns: repeat(5, minmax(110px, 1fr));
  }
}

@media (max-width: 1120px) {
  .badge-groups-row {
    grid-template-columns: repeat(4, minmax(100px, 1fr));
  }
}

@media (max-width: 840px) {
  .badge-groups-row {
    grid-template-columns: repeat(3, minmax(96px, 1fr));
  }
}

@media (max-width: 620px) {
  .badge-groups-row {
    grid-template-columns: repeat(2, minmax(96px, 1fr));
  }
}

</style>
