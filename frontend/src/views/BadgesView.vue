<template>
  <main class="badges-view">
    <header class="header">
      <h1>🏅 Community Badges</h1>
      <p class="subtitle">
        Browse all openSUSE Kudos badges — celebrating contributions and milestones!
      </p>
    </header>

    <section v-if="loading" class="loading">
      <p>Loading badges...</p>
    </section>

    <!-- 🧩 Sticker Album Grid -->
    <section v-else class="badges-grid">
      <router-link
        v-for="badge in badges"
        :key="badge.slug"
        class="badge-card"
        :to="`/badge/${badge.slug}`"
        :aria-label="`View details for ${badge.title} badge`"
      >
        <img
          :src="badge.picture"
          :alt="badge.title"
          class="badge-image"
        />
      </router-link>
    </section>

    <section v-if="!loading && badges.length === 0" class="empty">
      <p>No badges found yet. Be the first to earn one!</p>
    </section>
  </main>
</template>

<script setup>
import { ref, onMounted } from "vue"

const badges = ref([])
const loading = ref(true)

async function fetchBadges() {
  try {
    const res = await fetch("/api/badges")
    if (!res.ok) throw new Error("Failed to fetch badges")
    badges.value = await res.json()
  } catch (err) {
    console.error("💥 Failed to load badges:", err)
  } finally {
    loading.value = false
  }
}

onMounted(fetchBadges)
</script>
