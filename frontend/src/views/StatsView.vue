<!--
Copyright © 2025–present Lubos Kocman
and openSUSE contributors
SPDX-License-Identifier: Apache-2.0
-->

<template>
  <div class="stats-view container">
    <section class="section-box">
      <h2>📈 {{ t('stats.title') }}
      <span class="arrow-prompt" aria-hidden="true">&gt;&gt;&gt;</span>
      </h2>
      <p class="hint">{{ t('stats.subtitle') }}</p>

      <div class="summary-grid">
        <article class="summary-card">
          <span class="summary-icon">💚</span>
          <strong>{{ stats.totals.kudos }}</strong>
          <span>{{ t('stats.kudos_given') }}</span>
        </article>
        <article class="summary-card">
          <span class="summary-icon">🏅</span>
          <strong>{{ stats.totals.badges }}</strong>
          <span>{{ t('stats.badges_awarded') }}</span>
        </article>
        <article class="summary-card">
          <span class="summary-icon">👥</span>
          <strong>{{ stats.totals.users }}</strong>
          <span>{{ t('stats.users') }}</span>
        </article>
        <article class="summary-card">
          <span class="summary-icon">🧩</span>
          <strong>{{ stats.totals.categories }}</strong>
          <span>{{ t('stats.categories') }}</span>
        </article>
      </div>

      <div class="trend-grid">
        <article class="trend-card">
          <span>{{ t('stats.trend_recognitions') }}</span>
          <strong>{{ stats.trends.recognitions.current }}</strong>
          <small>{{ trendLabel(stats.trends.recognitions.delta) }}</small>
        </article>
        <article class="trend-card">
          <span>{{ t('stats.trend_kudos') }}</span>
          <strong>{{ stats.trends.kudos.current }}</strong>
          <small>{{ trendLabel(stats.trends.kudos.delta) }}</small>
        </article>
        <article class="trend-card">
          <span>{{ t('stats.trend_badges') }}</span>
          <strong>{{ stats.trends.badges.current }}</strong>
          <small>{{ trendLabel(stats.trends.badges.delta) }}</small>
        </article>
      </div>
    </section>

    <section class="section-box">
      <h2>🗓️ {{ t('stats.monthly_recognized') }}
      <span class="arrow-prompt" aria-hidden="true">&gt;&gt;&gt;</span>
      </h2>
      <p class="hint">{{ t('stats.monthly_recognized_hint') }}</p>

      <div v-if="stats.years.length" class="year-switcher">
        <button
          v-for="year in stats.years"
          :key="year"
          type="button"
          class="year-pill"
          :class="{ active: year === selectedYear }"
          @click="selectedYear = year"
        >
          {{ year }}
        </button>
      </div>

      <div v-if="monthlyRows.length" class="table-wrap">
        <table class="stats-table">
          <thead>
            <tr>
              <th>{{ t('stats.month') }}</th>
              <th v-for="rank in medalColumns" :key="rank">{{ rankMedal(rank) }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in monthlyRows" :key="`${selectedYear}-${row.monthIndex}`">
              <th scope="row">{{ row.monthLabel }}</th>
              <td v-for="rank in medalColumns" :key="`${selectedYear}-${row.monthIndex}-${rank}`">
                <template v-if="row.groups[rank - 1]">
                  <div class="rank-users">
                    <router-link
                      v-for="user in row.groups[rank - 1].users"
                      :key="user.username"
                      :to="`/user/${user.username}`"
                      class="user"
                    >
                      @{{ user.username }}
                    </router-link>
                  </div>
                  <div class="rank-points">{{ row.groups[rank - 1].points }} {{ t('stats.recognitions') }}</div>
                </template>
                <span v-else class="empty-cell">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="quiet">
        <p>🫥 {{ t('stats.no_monthly_data') }}</p>
      </div>
    </section>

    <section class="section-box">
      <h2>🌍 {{ t('stats.all_time_leaderboards') }}
      <span class="arrow-prompt" aria-hidden="true">&gt;&gt;&gt;</span>
      </h2>
      <p class="hint">{{ t('stats.all_time_leaderboards_hint') }}</p>

      <div class="badge-insights-grid">
        <div class="badge-panel">
          <h3>{{ t('stats.all_time_most_recognized') }}</h3>
          <table v-if="receivedPageRows.length" class="stats-table badge-table">
            <thead>
              <tr>
                <th>#</th>
                <th>{{ t('stats.user') }}</th>
                <th>{{ t('stats.recognitions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in receivedPageRows" :key="`received-${row.username}`">
                <td>{{ rankMedal(row.rank) }}</td>
                <th scope="row"><router-link :to="`/user/${row.username}`" class="user">@{{ row.username }}</router-link></th>
                <td>{{ row.points }}</td>
              </tr>
            </tbody>
          </table>
          <div v-else class="quiet"><p>🫥 {{ t('stats.no_leaderboard') }}</p></div>
          <div class="pager" v-if="receivedTotalPages > 1">
            <button type="button" class="year-pill" :disabled="receivedPage === 1" @click="receivedPage -= 1">{{ t('stats.prev') }}</button>
            <span>{{ receivedPage }} / {{ receivedTotalPages }}</span>
            <button type="button" class="year-pill" :disabled="receivedPage === receivedTotalPages" @click="receivedPage += 1">{{ t('stats.next') }}</button>
          </div>
        </div>

        <div class="badge-panel">
          <h3>{{ t('stats.all_time_top_recognizers') }}</h3>
          <table v-if="givenPageRows.length" class="stats-table badge-table">
            <thead>
              <tr>
                <th>#</th>
                <th>{{ t('stats.user') }}</th>
                <th>{{ t('stats.recognitions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in givenPageRows" :key="`given-${row.username}`">
                <td>{{ rankMedal(row.rank) }}</td>
                <th scope="row"><router-link :to="`/user/${row.username}`" class="user">@{{ row.username }}</router-link></th>
                <td>{{ row.points }}</td>
              </tr>
            </tbody>
          </table>
          <div v-else class="quiet"><p>🫥 {{ t('stats.no_leaderboard') }}</p></div>
          <div class="pager" v-if="givenTotalPages > 1">
            <button type="button" class="year-pill" :disabled="givenPage === 1" @click="givenPage -= 1">{{ t('stats.prev') }}</button>
            <span>{{ givenPage }} / {{ givenTotalPages }}</span>
            <button type="button" class="year-pill" :disabled="givenPage === givenTotalPages" @click="givenPage += 1">{{ t('stats.next') }}</button>
          </div>
        </div>
      </div>
    </section>

    <section class="section-box">
      <h2>🧭 {{ t('stats.category_recognition') }}
      <span class="arrow-prompt" aria-hidden="true">&gt;&gt;&gt;</span>
      </h2>
      <p class="hint">{{ t('stats.category_recognition_hint') }}</p>

      <div v-if="stats.categoryRecognitions.length" class="table-wrap">
        <table class="stats-table category-table">
          <thead>
            <tr>
              <th>{{ t('stats.category') }}</th>
              <th>{{ t('stats.recent_30d') }}</th>
              <th>{{ t('stats.lifetime') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="category in stats.categoryRecognitions" :key="category.code">
              <th scope="row" class="category-cell">
                <span class="category-icon">{{ category.icon || '🧩' }}</span>
                <span>{{ category.label }}</span>
              </th>
              <td>{{ category.recentRecognitions }}</td>
              <td>{{ category.lifetimeRecognitions }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="quiet">
        <p>🫥 {{ t('stats.no_category_data') }}</p>
      </div>
    </section>

    <section class="section-box">
      <h2>🏅 {{ t('stats.badge_insights') }}
      <span class="arrow-prompt" aria-hidden="true">&gt;&gt;&gt;</span>
      </h2>
      <p class="hint">{{ t('stats.badge_insights_hint') }}</p>

      <div class="badge-insights-grid">
        <div class="badge-panel">
          <h3>{{ t('stats.most_common_badges') }}</h3>
          <table v-if="stats.badgeStats.mostCommon.length" class="stats-table badge-table">
            <thead>
              <tr>
                <th>{{ t('stats.badge') }}</th>
                <th>{{ t('stats.recent_30d') }}</th>
                <th>{{ t('stats.lifetime') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="badge in stats.badgeStats.mostCommon" :key="`common-${badge.slug}`">
                <th scope="row" class="category-cell">
                  <span>{{ badge.title }}</span>
                </th>
                <td>{{ badge.recentAwards }}</td>
                <td>{{ badge.lifetimeAwards }}</td>
              </tr>
            </tbody>
          </table>
          <div v-else class="quiet">
            <p>🫥 {{ t('stats.no_badge_stats') }}</p>
          </div>
        </div>

        <div class="badge-panel">
          <h3>{{ t('stats.rarest_badges') }}</h3>
          <table v-if="stats.badgeStats.rarest.length" class="stats-table badge-table">
            <thead>
              <tr>
                <th>{{ t('stats.badge') }}</th>
                <th>{{ t('stats.recent_30d') }}</th>
                <th>{{ t('stats.lifetime') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="badge in stats.badgeStats.rarest" :key="`rare-${badge.slug}`">
                <th scope="row" class="category-cell">
                  <span>{{ badge.title }}</span>
                </th>
                <td>{{ badge.recentAwards }}</td>
                <td>{{ badge.lifetimeAwards }}</td>
              </tr>
            </tbody>
          </table>
          <div v-else class="quiet">
            <p>🫥 {{ t('stats.no_badge_stats') }}</p>
          </div>
        </div>
      </div>
    </section>

    <section class="section-box leaderboard-section">
      <h2>👀 {{ t('stats.most_followed') }}
      <span class="arrow-prompt" aria-hidden="true">&gt;&gt;&gt;</span>
      </h2>
      <p class="hint">{{ t('stats.most_followed_hint') }}</p>

      <div v-if="stats.followRankings.mostFollowed.length" class="leaderboard-list">
        <div v-for="group in stats.followRankings.mostFollowed" :key="`followed-${group.rank}`" class="leaderboard-row">
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
          <div class="leaderboard-points">{{ group.points }} {{ t('stats.followers') }}</div>
        </div>
      </div>

      <div v-else class="quiet">
        <p>🫥 {{ t('stats.no_follow_data') }}</p>
      </div>
    </section>

    <section class="section-box leaderboard-section">
      <h2>🙌 {{ t('stats.most_following') }}
      <span class="arrow-prompt" aria-hidden="true">&gt;&gt;&gt;</span>
      </h2>
      <p class="hint">{{ t('stats.most_following_hint') }}</p>

      <div v-if="stats.followRankings.mostFollowing.length" class="leaderboard-list">
        <div v-for="group in stats.followRankings.mostFollowing" :key="`following-${group.rank}`" class="leaderboard-row">
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
          <div class="leaderboard-points">{{ group.points }} {{ t('stats.following') }}</div>
        </div>
      </div>

      <div v-else class="quiet">
        <p>🫥 {{ t('stats.no_follow_data') }}</p>
      </div>
    </section>

    <div class="view-all">
      <router-link to="/" class="view-link">→ {{ t('stats.back_home') }}</router-link>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

const stats = reactive({
  totals: {
    kudos: 0,
    badges: 0,
    users: 0,
    categories: 0,
  },
  years: [],
  monthlyRecognitions: {},
  followRankings: {
    mostFollowed: [],
    mostFollowing: [],
  },
  allTimeLeaderboards: {
    received: [],
    given: [],
  },
  trends: {
    recognitions: { current: 0, previous: 0, delta: 0 },
    kudos: { current: 0, previous: 0, delta: 0 },
    badges: { current: 0, previous: 0, delta: 0 },
  },
  categoryRecognitions: [],
  badgeStats: {
    mostCommon: [],
    rarest: [],
  },
});

const medalColumns = [1, 2, 3, 4];
const selectedYear = ref(null);
const pageSize = 10;
const receivedPage = ref(1);
const givenPage = ref(1);

const monthlyRows = computed(() => {
  if (!selectedYear.value) return [];
  return stats.monthlyRecognitions[selectedYear.value] || [];
});

const receivedTotalPages = computed(() => Math.max(1, Math.ceil(stats.allTimeLeaderboards.received.length / pageSize)));
const givenTotalPages = computed(() => Math.max(1, Math.ceil(stats.allTimeLeaderboards.given.length / pageSize)));

const receivedPageRows = computed(() => {
  const start = (receivedPage.value - 1) * pageSize;
  return stats.allTimeLeaderboards.received.slice(start, start + pageSize);
});

const givenPageRows = computed(() => {
  const start = (givenPage.value - 1) * pageSize;
  return stats.allTimeLeaderboards.given.slice(start, start + pageSize);
});

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

function trendLabel(delta) {
  if (delta > 0) return `+${delta} vs prev 30d`;
  if (delta < 0) return `${delta} vs prev 30d`;
  return "No change vs prev 30d";
}

onMounted(async () => {
  try {
    const response = await fetch("/api/stats");
    if (!response.ok) return;

    const data = await response.json();
    stats.totals = data.totals || stats.totals;
    stats.years = data.years || [];
    stats.monthlyRecognitions = data.monthlyRecognitions || {};
    stats.followRankings = data.followRankings || stats.followRankings;
    stats.allTimeLeaderboards = data.allTimeLeaderboards || stats.allTimeLeaderboards;
    stats.trends = data.trends || stats.trends;
    stats.categoryRecognitions = data.categoryRecognitions || [];
    stats.badgeStats = data.badgeStats || stats.badgeStats;

    if (stats.years.length) {
      selectedYear.value = stats.years[0];
    }
  } catch (error) {
    console.error("Failed to load stats:", error);
  }
});
</script>

<style scoped>
.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.summary-card {
  padding: 1rem 1.1rem;
  border: 1px solid rgba(66, 205, 66, 0.2);
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.18);
  display: grid;
  gap: 0.35rem;
  align-content: start;
}

.summary-icon {
  font-size: 1.35rem;
}

.summary-card strong {
  font-size: 2rem;
  line-height: 1;
  color: var(--geeko-green);
  font-family: "Pixel Operator Bold", monospace;
}

.summary-card span:last-child {
  color: var(--text-secondary);
  font-family: "Pixel Operator", monospace;
}

.trend-grid {
  margin-top: 1rem;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 0.8rem;
}

.trend-card {
  border: 1px solid rgba(66, 205, 66, 0.2);
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.16);
  padding: 0.7rem 0.8rem;
  display: grid;
  gap: 0.15rem;
}

.trend-card span,
.trend-card small {
  color: var(--text-secondary);
  font-family: "Pixel Operator", monospace;
}

.trend-card strong {
  color: var(--geeko-green);
  font-family: "Pixel Operator Bold", monospace;
  font-size: 1.25rem;
}

.year-switcher {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 1rem;
}

.year-pill {
  border: 1px solid rgba(66, 205, 66, 0.2);
  background: rgba(0, 0, 0, 0.16);
  color: var(--text);
  border-radius: 999px;
  padding: 0.45rem 0.8rem;
  font-family: "Pixel Operator", monospace;
  cursor: pointer;
}

.year-pill.active {
  background: rgba(66, 205, 66, 0.18);
  color: var(--geeko-green);
  border-color: rgba(66, 205, 66, 0.4);
}

.table-wrap {
  margin-top: 1rem;
  overflow-x: auto;
}

.stats-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 760px;
}

.stats-table th,
.stats-table td {
  border: 1px solid rgba(66, 205, 66, 0.12);
  padding: 0.75rem;
  vertical-align: top;
}

.stats-table thead th {
  background: rgba(0, 0, 0, 0.18);
  color: var(--text-secondary);
  font-family: "Pixel Operator", monospace;
  text-align: center;
}

.stats-table tbody th {
  text-align: left;
  width: 8rem;
  color: var(--geeko-green);
  font-family: "Pixel Operator Bold", monospace;
}

.category-table tbody th {
  width: 50%;
}

.category-cell {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.category-icon {
  font-size: 1.1rem;
}

.badge-insights-grid {
  margin-top: 1rem;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
}

.badge-panel h3 {
  margin: 0 0 0.5rem;
  color: var(--geeko-green);
  font-family: "Pixel Operator Bold", monospace;
}

.badge-table {
  min-width: 100%;
}

.pager {
  margin-top: 0.65rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
}

.pager span {
  color: var(--text-secondary);
  font-family: "Pixel Operator", monospace;
}

.stats-table td {
  text-align: center;
}

.rank-users {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.25rem 0.4rem;
}

.rank-users .user,
.leaderboard-users .user {
  text-decoration: none;
  color: var(--geeko-green);
}

.rank-users .user:hover,
.leaderboard-users .user:hover {
  text-decoration: underline;
}

.rank-points,
.empty-cell {
  margin-top: 0.3rem;
  color: var(--text-secondary);
  font-family: "Pixel Operator", monospace;
  white-space: nowrap;
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

@media (max-width: 720px) {
  .leaderboard-row {
    grid-template-columns: 52px minmax(0, 1fr);
  }

  .leaderboard-points {
    grid-column: 1 / -1;
  }
}
</style>
