<!--
Copyright © 2025–present Lubos Kocman
and openSUSE contributors
SPDX-License-Identifier: Apache-2.0
-->

<template>
  <div v-if="!userNotFound" class="profile-view">
    <header class="profile-header">
      <img
        :src="user.avatarUrl"
        :alt="user.username || 'user avatar'"
        class="avatar-large"
      />

      <div class="user-meta">
        <h1>@{{ user.username }}</h1>

        <p v-if="isCurrentUser" class="subtitle">
          🎉 {{ t('user_profile.welcome_back') }}
        </p>

        <!-- Follow/Unfollow button -->
        <button
          v-else-if="loggedIn"
          class="follow-button"
          :class="{ following: isFollowing }"
          @click="toggleFollow"
        >
          <span class="star">{{ isFollowing ? '★' : '☆' }}</span>
          <span>{{ isFollowing ? t('user_profile.following') : t('user_profile.follow') }}</span>
        </button>
      </div>
    </header>

    <div v-if="statsSummary" class="stats-line">
      {{ statsSummary }}
    </div>

    <section class="section-box">
      <h2 class="kudos-title">
        💚 {{ t('user_profile.kudos_received') }}
      </h2>

      <div v-if="kudos.length" class="kudos-feed flicker">
        <router-link
          v-for="k in kudos"
          :key="k.id"
          class="kudo-line"
          :to="`/kudo/${k.slug}`"
        >
          <span class="icon">{{ k.category?.icon || '💚' }}</span>
          <span class="user">@{{ k.fromUser.username }}</span>
          <span class="message">"{{ k.message }}"</span>
          <span class="timestamp">{{ formatTime(k.createdAt) }}</span>
        </router-link>
      </div>

      <div v-else class="quiet">
        <p>💬 {{ t('user_profile.no_kudos') }}</p>
      </div>
    </section>

    <section class="section-box">
      <h2>🏅 {{ t('user_profile.badges_earned') }}</h2>

      <div v-if="badges.length" class="badges-grid">
        <div v-for="(b, index) in badges" :key="index" class="badge-wrapper">
          <router-link
            :to="`/badge/${b.slug}`"
            class="badge-card"
            :aria-label="`View details for ${b.title} badge`"
          >
            <img :src="getBadgeImageUrl(b.picture)" :alt="b.title" class="badge-image" />
          </router-link>
          <div class="badge-title">
            {{ b.title }}
          </div>
        </div>
      </div>

      <div v-else class="quiet">
        <p>🦎 {{ t('user_profile.no_badges') }}</p>
      </div>
    </section>

    <section v-if="isCurrentUser" class="section-box social-section">
      <h2>🌐 Social Handles</h2>
      <p class="quiet small social-help">
        Set your handle per network exactly as you want it posted, usually starting with @ (for example @alice). We do not add @ automatically. If empty, we use your @{{ user.username }} login.
      </p>

      <div class="social-table-wrap">
        <table class="social-table">
          <thead>
            <tr>
              <th>Network</th>
              <th>Handle (include @ if needed)</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="network in socialNetworks" :key="network.key">
              <td>{{ network.label }}</td>
              <td>
                <input
                  v-model="socialOverrides[network.key]"
                  class="social-input"
                  :placeholder="`@${profileUsername}`"
                  maxlength="80"
                />
              </td>
              <td class="social-actions">
                <button
                  class="social-btn social-btn-save"
                  :disabled="socialBusy[network.key] || socialLoading"
                  @click="saveSocialHandle(network.key)"
                >
                  Save
                </button>
                <button
                  class="social-btn social-btn-reset"
                  :disabled="socialBusy[network.key] || socialLoading || !socialOverrides[network.key]"
                  @click="clearSocialHandle(network.key)"
                >
                  Reset
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p v-if="socialMessage" class="social-message">{{ socialMessage }}</p>
    </section>

    <!-- followship Section -->
    <section class="followship section-box">
      <h2>⭐ {{ t('user_profile.followship') }}</h2>

      <!-- Following -->
      <div class="followship-row">
        <span class="followship-label">{{ t('user_profile.following_label') }}</span>

        <div v-if="following.length" class="followship-avatars">
          <router-link
            v-for="u in following"
            :key="u.username"
            :to="`/user/${u.username}`"
            class="follow"
            :title="u.username"
          >
            <img :src="u.avatarUrl" :alt="u.username" />
          </router-link>
        </div>

        <span v-else class="quiet small">
          @{{ user.username }} {{ t('user_profile.no_following') }}
        </span>
      </div>

      <!-- Followers -->
      <div class="followship-row">
        <span class="followship-label">{{ t('user_profile.followers_label') }}:</span>

        <div v-if="followers.length" class="followship-avatars">
          <router-link
            v-for="u in followers"
            :key="u.username"
            :to="`/user/${u.username}`"
            class="follow"
            :title="u.username"
          >
            <img :src="u.avatarUrl" :alt="u.username" />
          </router-link>
        </div>

        <span v-else class="quiet small">
          {{ t('user_profile.no_followers') }}
        </span>
      </div>
    </section>
  </div>
  <div v-else class="profile-view quiet">
    <h1>{{ t('user_profile.user_not_found_title') }}</h1>
    <p>The user <code>@{{ route.params.username }}</code> {{ t('user_profile.user_not_found_message') }}</p>
  </div>
</template>

<script setup>
import { useI18n } from "vue-i18n";
const { t } = useI18n();
import { ref, onMounted, computed, watch } from "vue";
import { useRoute } from "vue-router";
import { useAuthStore } from "../store/auth.js";
import { storeToRefs } from "pinia";

const route = useRoute();
const auth = useAuthStore();

const user = ref({});
const kudos = ref([]);
const badges = ref([]);
const followers = ref([]);
const following = ref([]);
const userNotFound = ref(false);
const socialLoading = ref(false);
const socialOverrides = ref({});
const socialBusy = ref({});
const socialMessage = ref("");
let socialMessageTimer = null;

const socialNetworks = [
  { key: "matrix", label: "Matrix" },
  { key: "mastodon", label: "Mastodon" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "x", label: "X" },
  { key: "telegram", label: "Telegram" },
  { key: "reddit", label: "Reddit" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "threads", label: "Threads" },
];

const { isAuthenticated: loggedIn, user: currentUser } = storeToRefs(auth);
const isCurrentUser = computed(
  () => currentUser.value?.username === route.params.username
);
const profileUsername = computed(
  () => user.value?.username || route.params.username || "unknown"
);

const isFollowing = ref(false);


function getBadgeImageUrl(pictureUrl) {
  if (pictureUrl) {
    return pictureUrl.replace('/badges/', '/badges/previews/200/');
  }
  return '';
}

function formatTime(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleDateString([], { month: "short", day: "numeric" })
}

/* Follow/unfollow */
async function toggleFollow() {
  const target = user.value.username
  const method = isFollowing.value ? "DELETE" : "POST"

  await fetch(`/api/follow/${target}`, {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });

  isFollowing.value = !isFollowing.value
  await loadNetwork()
}

async function loadNetwork() {
  const username = user.value.username

  if (!username) return;

  const [followersData, followingData, status] = await Promise.all([
    fetch(`/api/follow/${username}/followers`).then(r => r.json()),
    fetch(`/api/follow/${username}/following`).then(r => r.json()),
    fetch(`/api/follow/${username}/status`).then(r => r.json())
  ])

  followers.value = followersData || []
  following.value = followingData || []
  isFollowing.value = status?.following || false
}

function showSocialMessage(message) {
  if (socialMessageTimer) {
    clearTimeout(socialMessageTimer);
  }

  socialMessage.value = message;
  socialMessageTimer = setTimeout(() => {
    socialMessage.value = "";
  }, 2500);
}

async function loadSocialHandles(username) {
  if (!username) return;

  socialLoading.value = true;

  try {
    const response = await fetch(`/api/users/${username}/social-handles`);
    if (!response.ok) {
      throw new Error("failed to load social handles");
    }

    const data = await response.json();
    const next = {};

    for (const network of socialNetworks) {
      next[network.key] = "";
    }

    for (const row of data.handles || []) {
      if (Object.prototype.hasOwnProperty.call(next, row.network)) {
        next[row.network] = row.handle || "";
      }
    }

    socialOverrides.value = next;
  } catch (err) {
    console.error("Failed to load social handles:", err);
    socialOverrides.value = {};
  } finally {
    socialLoading.value = false;
  }
}

function normalizeSocialHandleInput(rawHandle) {
  const value = String(rawHandle || "").trim();
  if (!value) return "";

  // Keep explicit formats intact (URLs, paths, phone-like values, or already prefixed handles).
  if (
    value.startsWith("@") ||
    value.includes("://") ||
    value.startsWith("www.") ||
    value.includes("/") ||
    value.includes(" ") ||
    value.startsWith("+")
  ) {
    return value;
  }

  // For plain handles, auto-prefix @ to reduce user friction.
  return `@${value}`;
}

async function saveSocialHandle(network) {
  const handle = normalizeSocialHandleInput(socialOverrides.value[network]);
  socialBusy.value = { ...socialBusy.value, [network]: true };

  try {
    if (!handle) {
      await clearSocialHandle(network, true);
      showSocialMessage(`Reset ${network} to default`);
      return;
    }

    const response = await fetch(`/api/users/me/social-handles/${network}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ handle }),
    });

    if (!response.ok) {
      throw new Error("failed to save social handle");
    }

    socialOverrides.value = { ...socialOverrides.value, [network]: handle };
    showSocialMessage(`Saved ${network} handle`);
  } catch (err) {
    console.error("Failed to save social handle:", err);
    showSocialMessage(`Failed to save ${network} handle`);
  } finally {
    socialBusy.value = { ...socialBusy.value, [network]: false };
  }
}

async function clearSocialHandle(network, silent = false) {
  socialBusy.value = { ...socialBusy.value, [network]: true };

  try {
    const response = await fetch(`/api/users/me/social-handles/${network}`, {
      method: "DELETE",
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("failed to reset social handle");
    }

    socialOverrides.value = { ...socialOverrides.value, [network]: "" };

    if (!silent) {
      showSocialMessage(`Reset ${network} to default`);
    }
  } catch (err) {
    console.error("Failed to reset social handle:", err);
    if (!silent) {
      showSocialMessage(`Failed to reset ${network}`);
    }
  } finally {
    socialBusy.value = { ...socialBusy.value, [network]: false };
  }
}

/* Load user data */
async function loadUser(username) {
  const userResponse = await fetch(`/api/users/${username}`);

  if (!userResponse.ok) {
    userNotFound.value = true;
    return;
  }

  const userData = await userResponse.json();
  if (!userData || !userData.username) {
    userNotFound.value = true;
    return;
  }

  const [userKudos, userBadges] = await Promise.all([
    fetch(`/api/kudos/user/${username}`).then(r => r.json()),
    fetch(`/api/badges/user/${username}`).then(r => r.json())
  ]);

  user.value = userData.user || userData || {};
  kudos.value = Array.isArray(userKudos) ? userKudos : [];
  badges.value = Array.isArray(userBadges) ? userBadges : [];

  await loadSocialHandles(username);
  await loadNetwork();
}

/* Run on first load */
onMounted(() => {
  loadUser(route.params.username)
})

/* Run when navigating between /user/alice → /user/bob */
watch(
  () => route.params.username,
  async (newUsername, oldUsername) => {
    if (newUsername && newUsername !== oldUsername) {
      userNotFound.value = false;
      await loadUser(newUsername)
    }
  }
)

const statsSummary = computed(() => {
  if (!user.value.username) return ""

  const receivedKudos = kudos.value.length
  const givenKudos = user.value.kudosGiven?.length || 0
  const earnedBadges = badges.value.length

  return `💚 ${receivedKudos} ${t('user_profile.stats_received')} | 💌 ${givenKudos} ${t('user_profile.stats_given')} | 🏅 ${earnedBadges} ${t('user_profile.stats_badges')}`
})
</script>

<style scoped>
.profile-view {
  text-align: center;
  padding: 2rem;
}

/* Layout */
.profile-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.avatar-large {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  box-shadow: 0 0 8px rgba(66, 205, 66, 0.5);
  object-fit: cover;
}

.user-meta h1 {
  margin: 0;
  color: var(--geeko-green);
  font-family: "Pixel Operator Bold", monospace;
  font-size: 2rem;
}

.subtitle {
  color: #b4ffb4;
}

/* Follow button */
.follow-button {
  margin-top: 0.5rem;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.8rem;
  border: 2px solid var(--geeko-green);
  background: transparent;
  color: var(--geeko-green);
  font-family: "Pixel Operator", monospace;
  font-size: 1rem;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.follow-button .star {
  font-size: 1.2rem;
}

.follow-button.following {
  background: var(--geeko-green);
  color: black;
  box-shadow: 0 0 10px rgba(0, 255, 120, 0.6);
}

/* Stats line */
.stats-line {
  margin-top: 0.6rem;
  font-family: "Pixel Operator", monospace;
  color: var(--geeko-green);
  opacity: 0.9;
  font-size: 1.1rem;
}

/* Kudos */
.kudos-title {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  font-family: "Pixel Operator Bold", monospace;
  color: var(--geeko-green);
}

.kudos-feed {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-top: 1rem;
}

.kudo-line {
  font-family: "Pixel Operator", monospace;
  color: #b4ffb4;
  text-decoration: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  border-bottom: 1px solid rgba(0,255,0,0.05);
}



/* ⭐ followship */
.followship {
  margin-top: 1.5rem;
}

.followship-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  margin: 0.3rem 0;
}

.followship-label {
  font-family: "Pixel Operator Bold";
  color: var(--geeko-green);
  margin-right: 0.5rem;
  white-space: nowrap;
}

.followship-avatars {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-left: 0.3rem;
}

.follow img {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 2px solid var(--geeko-green);
  object-fit: cover;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  image-rendering: pixelated;
}

.follow:hover img {
  transform: scale(1.08);
  box-shadow: 0 0 8px rgba(66, 205, 66, 0.4);
}

.small {
  opacity: 0.7;
  font-size: 0.9rem;
}

.social-section {
  margin-top: 1.5rem;
}

.social-help {
  margin-top: 0;
  margin-bottom: 0.8rem;
}

.social-table-wrap {
  overflow-x: auto;
}

.social-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-family: "Pixel Operator", monospace;
}

.social-table th,
.social-table td {
  border-bottom: 1px solid rgba(0, 255, 100, 0.18);
  padding: 0.5rem;
  color: var(--text-primary);
  vertical-align: middle;
}

.social-input {
  width: 100%;
  min-width: 180px;
  border: 1px solid rgba(0, 255, 100, 0.35);
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-primary);
  border-radius: 6px;
  padding: 0.35rem 0.5rem;
  font-family: "Pixel Operator", monospace;
}

.social-input:focus {
  outline: none;
  border-color: var(--geeko-green);
  box-shadow: 0 0 4px rgba(0, 255, 100, 0.25);
}

.social-actions {
  white-space: nowrap;
}

.social-btn {
  border: 1px dashed var(--geeko-green);
  background: transparent;
  color: var(--geeko-green);
  border-radius: 6px;
  padding: 0.28rem 0.55rem;
  cursor: pointer;
  font-family: "Pixel Operator", monospace;
  margin-right: 0.35rem;
}

.social-btn:hover:not(:disabled) {
  background: var(--geeko-green);
  color: black;
}

.social-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.social-btn-reset {
  border-color: #ff7070;
  color: #ff9d9d;
}

.social-btn-reset:hover:not(:disabled) {
  background: #ff7070;
  color: black;
}

.social-message {
  margin-top: 0.7rem;
  color: var(--geeko-green);
  font-family: "Pixel Operator", monospace;
}
</style>
