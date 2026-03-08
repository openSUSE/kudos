<!--
Copyright © 2025–present Lubos Kocman
and openSUSE contributors
SPDX-License-Identifier: Apache-2.0
-->

<template>
  <div v-if="!userNotFound" class="profile-view">
    <header class="profile-header">
      <img
        :src="avatarSrc"
        :alt="user.username || 'user avatar'"
        class="avatar-large"
        @error="onAvatarError"
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
            <img :src="b.picture" :alt="b.title" class="badge-image" />
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
            <img :src="u.avatarUrl || dicebearUrl(u.username)" :alt="u.username" />
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
            <img :src="u.avatarUrl || dicebearUrl(u.username)" :alt="u.username" />
          </router-link>
        </div>

        <span v-else class="quiet small">
          {{ t('user_profile.no_followers') }}
        </span>
      </div>
    </section>

    <!-- Preferences Section -->
    <section v-if="isCurrentUser" class="section-box preferences-section">
      <h2>{{ t('user_profile.preferences') }}</h2>
      <div class="form-row">
        <label class="form-label" for="email-notifications">{{ t('user_profile.email_notifications') }}</label>
        <div class="toggle-switch">
          <input type="checkbox" id="email-notifications" v-model="preferences.emailNotificationsEnabled" />
          <label for="email-notifications"></label>
        </div>
      </div>
      <div class="form-row">
        <label class="form-label" for="matrix-handle">Matrix Handle</label>
        <input type="text" id="matrix-handle" class="form-input" v-model="preferences.matrixHandle" :placeholder="user.username" />
      </div>
      <div class="form-row">
        <label class="form-label" for="slack-handle">Slack Handle</label>
        <input type="text" id="slack-handle" class="form-input" v-model="preferences.slackHandle" :placeholder="user.username" />
      </div>
      <div class="form-row">
        <label class="form-label" for="github-handle">GitHub Handle</label>
        <input type="text" id="github-handle" class="form-input" v-model="preferences.githubHandle" :placeholder="user.username" />
      </div>
      <div class="form-row">
        <label class="form-label" for="gitea-handle">src.opensuse.org Handle</label>
        <input type="text" id="gitea-handle" class="form-input" v-model="preferences.giteaHandle" :placeholder="user.username" />
      </div>
      <button @click="savePreferences" class="save-button">{{ t('user_profile.save_preferences') }}</button>
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
import { useNotifications } from "../composables/useNotifications.js";

const { addNotification } = useNotifications();

const route = useRoute();
const auth = useAuthStore();

const user = ref({});
const kudos = ref([]);
const badges = ref([]);
const followers = ref([]);
const following = ref([]);
const userNotFound = ref(false);

const preferences = ref({
  emailNotificationsEnabled: true,
  matrixHandle: '',
  slackHandle: '',
  githubHandle: '',
  giteaHandle: '',
});

const { isAuthenticated: loggedIn, user: currentUser } = storeToRefs(auth);
const isCurrentUser = computed(
  () => currentUser.value?.username === route.params.username
);

const isFollowing = ref(false);


/* Avatar helpers */
const dicebearUrl = (seed) =>
  `https://api.dicebear.com/9.x/identicon/svg?seed=${encodeURIComponent(seed || "unknown")}`

const avatarSrc = computed(() => {
  const u = user.value || {}
  if (u.avatarUrl && typeof u.avatarUrl === "string" && u.avatarUrl.trim() !== "")
    return u.avatarUrl
  return dicebearUrl(u.username)
})

function onAvatarError(e) {
  const fallback = dicebearUrl(user.value?.username)
  if (e?.target?.src !== fallback) e.target.src = fallback
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

/* Load user data */
async function loadUser(username) {
  const profileResponse = await fetch(`/api/profile/${username}`);

  if (!profileResponse.ok) {
    userNotFound.value = true;
    return;
  }

  const profileData = await profileResponse.json();
  if (!profileData || !profileData.user) {
    userNotFound.value = true;
    return;
  }

  user.value = profileData.user;
  kudos.value = profileData.recentKudos || [];
  badges.value = profileData.recentBadges || [];
  // The stats are now part of the profileData, so we can use them directly
  stats.value = profileData.stats || { receivedKudos: 0, givenKudos: 0, earnedBadges: 0 };

  if (isCurrentUser.value) {
    preferences.value.emailNotificationsEnabled = profileData.user.emailNotificationsEnabled;
    preferences.value.matrixHandle = profileData.user.matrixHandle;
    preferences.value.slackHandle = profileData.user.slackHandle;
    preferences.value.githubHandle = profileData.user.githubHandle;
    preferences.value.giteaHandle = profileData.user.giteaHandle;
  }


  await loadNetwork();
}

async function savePreferences() {
  try {
    const username = user.value.username;
    const response = await fetch(`/api/profile/${username}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(preferences.value),
    });

    if (response.ok) {
      addNotification({
        type: 'success',
        title: 'Success',
        message: t('user_profile.preferences_saved', 'User preferences saved'),
      });
    } else {
      const errorData = await response.json().catch(() => ({}));
      addNotification({
        type: 'error',
        title: 'Error',
        message: t('user_profile.preferences_error', 'Failed to save preferences') + (errorData.error ? `: ${errorData.error}` : ''),
      });
    }
  } catch (err) {
    addNotification({
      type: 'error',
      title: 'Network Error',
      message: t('user_profile.preferences_network_error', 'Network error while saving preferences.'),
    });
    console.error("💥 Failed to save preferences:", err);
  }
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

const stats = ref({ receivedKudos: 0, givenKudos: 0, earnedBadges: 0 });

const statsSummary = computed(() => {
  if (!user.value.username) return ""

  return `💚 ${stats.value.receivedKudos} ${t('user_profile.stats_received')} | 💌 ${stats.value.givenKudos} ${t('user_profile.stats_given')} | 🏅 ${stats.value.earnedBadges} ${t('user_profile.stats_badges')}`
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

.preferences-section {
  margin-top: 2rem;
  padding: 1.5rem;
  border: 1px solid var(--geeko-green);
  border-radius: 8px;
  background-color: #00000030;
}

.form-row {
  display: flex;
  align-items: center;
  margin-bottom: 1rem;
}

.form-label {
  flex: 1;
  text-align: left;
  color: var(--geeko-green);
  font-family: "Pixel Operator", monospace;
}

.form-input {
  flex: 2;
  background-color: #333;
  border: 1px solid #555;
  color: white;
  padding: 0.5rem;
  font-family: "Pixel Operator", monospace;
}

.save-button {
  background-color: var(--geeko-green);
  color: black;
  border: none;
  padding: 0.5rem 1rem;
  font-family: "Pixel Operator Bold", monospace;
  cursor: pointer;
  border-radius: 4px;
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 50px;
  height: 25px;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-switch label {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: .4s;
  border-radius: 25px;
}

.toggle-switch label:before {
  position: absolute;
  content: "";
  height: 19px;
  width: 19px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: .4s;
  border-radius: 50%;
}

.toggle-switch input:checked + label {
  background-color: var(--geeko-green);
}

.toggle-switch input:checked + label:before {
  transform: translateX(25px);
}
</style>
