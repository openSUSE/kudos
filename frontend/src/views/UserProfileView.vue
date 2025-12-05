<!--
Copyright © 2025–present Lubos Kocman
and openSUSE contributors
SPDX-License-Identifier: Apache-2.0
-->

<template>
  <div class="profile-view">
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
          🎉 Welcome back, Geeko!
        </p>

        <!-- Follow/Unfollow button -->
        <button
          v-else-if="loggedIn"
          class="follow-button"
          :class="{ following: isFollowing }"
          @click="toggleFollow"
        >
          <span class="star">{{ isFollowing ? '★' : '☆' }}</span>
          <span>{{ isFollowing ? 'Following' : 'Follow' }}</span>
        </button>
      </div>
    </header>

    <!-- Stats Summary -->
    <div v-if="statsSummary" class="stats-line">
      {{ statsSummary }}
    </div>

    <!-- Give Kudos Button -->
    <div v-if="isCurrentUser" class="give-kudos-box">
      <router-link to="/kudos/new" class="give-kudos-link">
        <span class="plus">➕</span>
        <span>Give Kudos</span>
      </router-link>
    </div>

    <!-- Kudos Section -->
    <section class="section-box">
      <h2 class="kudos-title">
        💚 Kudos Received
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
        <p>💬 No kudos yet — be the first to appreciate this Geeko!</p>
      </div>
    </section>

    <!-- Badges -->
    <section class="section-box">
      <h2>🏅 Badges Earned</h2>

      <div v-if="badges.length" class="badges-grid">
        <router-link
          v-for="(b, index) in badges"
          :key="index"
          class="badge-card"
          :to="`/badge/${b.slug}`"
        >
          <img :src="b.picture" :alt="b.title" class="badge-image" />
          <div class="badge-info">{{ b.title }}</div>
        </router-link>
      </div>

      <div v-else class="quiet">
        <p>🦎 No badges yet — every journey begins with a first contribution!</p>
      </div>
    </section>

    <!-- followship Section -->
    <section class="followship section-box">
      <h2>⭐ Followship</h2>

      <!-- Following -->
      <div class="followship-row">
        <span class="followship-label">Following:</span>

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
          @{{ user.username }} is a Honey badger 🦡 because they don’t follow anybody.
        </span>
      </div>

      <!-- Followers -->
      <div class="followship-row">
        <span class="followship-label">Followers:</span>

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
          🦡 Honey badger doesn’t need followers.
        </span>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from "vue"
import { useRoute } from "vue-router"

const route = useRoute()

const user = ref({})
const kudos = ref([])
const badges = ref([])
const followers = ref([])
const following = ref([])

const isCurrentUser = ref(false)
const isFollowing = ref(false)

const stored = JSON.parse(localStorage.getItem("user") || "{}")
const loggedIn = !!stored?.username

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
    headers: { "Content-Type": "application/json" }
  })

  isFollowing.value = !isFollowing.value
  await loadNetwork()
}

async function loadNetwork() {
  const username = user.value.username

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
  isCurrentUser.value = stored.username === username

  const [userData, userKudos, userBadges] = await Promise.all([
    fetch(`/api/users/${username}`).then(r => r.json()),
    fetch(`/api/kudos/user/${username}`).then(r => r.json()),
    fetch(`/api/badges/user/${username}`).then(r => r.json())
  ])

  user.value = userData.user || userData || {}
  kudos.value = Array.isArray(userKudos) ? userKudos : []
  badges.value = Array.isArray(userBadges) ? userBadges : []

  await loadNetwork()
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
      await loadUser(newUsername)
    }
  }
)

const statsSummary = computed(() => {
  if (!user.value.username) return ""

  const receivedKudos = kudos.value.length
  const givenKudos = user.value.kudosGiven?.length || 0
  const earnedBadges = badges.value.length

  return `💚 ${receivedKudos} received | 💌 ${givenKudos} given | 🏅 ${earnedBadges} badges`
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

/* Badges */
.badges-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 1rem;
}
.badge-card {
  text-align: center;
  text-decoration: none;
  color: #caffca;
}
.badge-image {
  width: 80px;
  height: 80px;
  object-fit: contain;
}
.badge-info {
  margin-top: 0.4rem;
  font-family: "Pixel Operator", monospace;
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
</style>
