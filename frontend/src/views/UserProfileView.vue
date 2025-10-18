<!--
Copyright © 2025–present Lubos Kocman,
and openSUSE contributors
SPDX-License-Identifier: Apache-2.0
-->

<template>
  <div class="profile container">
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
      </div>
    </header>

    <!-- 💚 Stats Summary -->
    <div v-if="statsSummary" class="stats-line">
      {{ statsSummary }}
    </div>

    <!-- ➕ Give Kudos Button -->
    <div v-if="isCurrentUser" class="give-kudos-box">
      <router-link to="/kudos/new" class="give-kudos-link">
        <span class="plus">➕</span>
        <span>Give Kudos</span>
      </router-link>
    </div>

    <!-- 💚 Kudos (one-liner style, user-focused) -->
    <section class="section-box">
      <h2 class="kudos-title">
        💚 Kudos Received
        <span class="arrow-prompt" aria-hidden="true">&gt;&gt;&gt;</span>
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

    <!-- 🏅 Badges -->
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
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from "vue"
import { useRoute } from "vue-router"

const route = useRoute()
const user = ref({})
const kudos = ref([])
const badges = ref([])
const isCurrentUser = ref(false)

// --- Avatar helpers (frontend safety net) ---
const dicebearUrl = (seed) =>
  `https://api.dicebear.com/9.x/identicon/svg?seed=${encodeURIComponent(seed || "unknown")}`

/**
 * Prefer backend-provided avatarUrl if present;
 * otherwise default to DiceBear (no email dependency).
 */
const avatarSrc = computed(() => {
  const u = user.value || {}
  if (u.avatarUrl && typeof u.avatarUrl === "string" && u.avatarUrl.trim() !== "") {
    return u.avatarUrl
  }
  return dicebearUrl(u.username)
})

/** If the provided src 404s, switch to DiceBear once. */
function onAvatarError(e) {
  const u = user.value || {}
  const fallback = dicebearUrl(u.username)
  if (e?.target?.src !== fallback) {
    e.target.src = fallback
  }
}

function formatTime(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleDateString([], { month: "short", day: "numeric" })
}

onMounted(async () => {
  const stored = JSON.parse(localStorage.getItem("user") || "{}")
  const currentUsername = stored.username || stored.user?.username || ""
  const username = route.params.username
  isCurrentUser.value = currentUsername === username

  // Keep your existing endpoints; frontend now guards avatar
  const [userData, userKudos, userBadges] = await Promise.all([
    fetch(`/api/users/${username}`).then(r => r.json()),
    fetch(`/api/kudos/user/${username}`).then(r => r.json()),
    fetch(`/api/badges/user/${username}`).then(r => r.json())
  ])

  user.value = userData.user || userData || {}
  kudos.value = Array.isArray(userKudos) ? userKudos : []
  badges.value = Array.isArray(userBadges) ? userBadges : []
})

const statsSummary = computed(() => {
  if (!user.value.username) return ""

  const receivedKudos = kudos.value.length
  const givenKudos = user.value.kudosGiven?.length || 0
  const earnedBadges = badges.value.length
  const givenBadges = user.value.badgesGiven?.length || 0

  return `💚 ${receivedKudos} received | 💌 ${givenKudos} given | 🏅 ${earnedBadges} badges earned | 🎖️ ${givenBadges} badges given`
})
</script>

<style scoped>
/*───────────────────────────────────────────────────────────────
 🎮 Profile Layout & Kudos List
───────────────────────────────────────────────────────────────*/

/* Header */
.profile-header {
  display: flex;
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

/* Stats line */
.stats-line {
  margin-top: 0.6rem;
  font-family: "Pixel Operator", monospace;
  color: var(--geeko-green);
  opacity: 0.9;
  font-size: 1.1rem;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  border-right: 2px solid var(--geeko-green);
  animation: typing 2.2s steps(50, end), blink 0.8s step-end infinite;
}
@keyframes typing { from { width: 0; } to { width: 100%; } }
@keyframes blink { 50% { border-color: transparent; } }

/* Give Kudos */
.give-kudos-box { text-align: center; margin: 2rem 0; }
.give-kudos-link {
  display: inline-flex; align-items: center; justify-content: center;
  gap: 0.5rem; padding: 1rem 2rem; border: 2px dashed var(--geeko-green);
  color: var(--geeko-green); border-radius: 10px; font-family: "Pixel Operator", monospace;
  font-size: 1.1rem; text-decoration: none; transition: all 0.2s ease;
}
.give-kudos-link:hover { background: var(--geeko-green); color: black; box-shadow: 0 0 12px rgba(0,255,128,0.6); }
.plus { font-size: 1.5rem; }

/* Kudos Section */
.kudos-title {
  display: flex; align-items: center; gap: 0.4rem;
  font-family: "Pixel Operator Bold", monospace; color: var(--geeko-green);
  text-shadow: 0 0 8px rgba(0, 255, 100, 0.4);
}
.arrow-prompt {
  display: inline-block; font-size: 1.2rem; letter-spacing: 2px;
  animation: arrow-sweep 1.6s infinite steps(4, start); margin-left: 0.5rem;
}
@keyframes arrow-sweep {
  0% { opacity: 0.3; transform: translateX(-5px); }
  20% { opacity: 1; transform: translateX(0); }
  60% { opacity: 0.7; transform: translateX(5px); }
  100% { opacity: 0.3; transform: translateX(-5px); }
}

/* Kudos List (one-liner) */
.kudos-feed { display: flex; flex-direction: column; gap: 0.25rem; margin-top: 1rem; }
.kudo-line {
  font-family: "Pixel Operator", monospace; color: #b4ffb4; text-decoration: none;
  display: flex; align-items: center; justify-content: space-between;
  padding: 4px 8px; border-bottom: 1px solid rgba(0,255,0,0.05); transition: color 0.2s ease;
}
.kudo-line:hover { color: #9cff9c; }
.icon { margin-right: 0.4rem; }
.user { color: var(--geeko-green); margin-right: 0.4rem; }
.message { flex: 1; margin: 0 0.4rem; color: #caffca; }
.timestamp { opacity: 0.6; font-size: 0.9rem; }

/* CRT flicker effect */
.flicker { position: relative; animation: flicker 2.5s infinite steps(2, start); }
@keyframes flicker { 0%,19%,21%,23%,25%,54%,56%,100% { opacity: 1; } 20%,24%,55% { opacity: 0.9; } }
</style>
