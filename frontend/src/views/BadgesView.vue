<!--
Copyright © 2025–present Lubos Kocman
and openSUSE contributors
SPDX-License-Identifier: Apache-2.0
-->

<template>
  <main class="badges-view">
    <header class="header">
      <h1>🏅 openSUSE Badges</h1>
      <p class="subtitle">
        Browse all openSUSE Kudos badges — celebrating contributions and milestones!
      </p>

      <!-- 🎚️ Toggle -->
      <div class="toggle-row">
        <button class="btn" @click="toggleColor">
          <span>
            {{
              showFullColor
                ? "🦎 Default view — only your badges in color"
                : "⚡ Show all badges in full color"
            }}
          </span>
        </button>
      </div>
    </header>

    <section v-if="loading" class="loading">
      <p>Loading badges...</p>
    </section>

    <!-- ✅ wrapped grid inside section-box -->
    <section v-else class="section-box">
      <div class="badges-grid">
        <div
          v-for="badge in badges"
          :key="badge.slug"
          class="badge-wrapper"
        >
          <div
            class="badge-card"
            :class="{ locked: !showFullColor && !badge.owned }"
          >
            <router-link
              :to="`/badge/${badge.slug}`"
              :aria-label="`View details for ${badge.title} badge`"
            >
              <img
                :src="badge.picture"
                :alt="badge.title"
                class="badge-image"
              />
            </router-link>

            <div v-if="!badge.owned && !showFullColor" class="lock-overlay">
              <span class="lock-icon">🔒</span>
            </div>
          </div>
          <div class="badge-title">{{ badge.title }}</div>
        </div>
      </div>
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
const showFullColor = ref(false)

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

function toggleColor() {
  showFullColor.value = !showFullColor.value
}

onMounted(fetchBadges)
</script>

<style scoped>
.badges-view {
  text-align: center;
  padding: 2rem;
}

.header {
  margin-bottom: 1.5rem;
}

.subtitle {
  color: var(--text-secondary);
  margin-bottom: 1rem;
}

.toggle-row {
  margin-top: 1rem;
  margin-bottom: 2rem;
}

.btn {
  background: var(--geeko-green);
  color: #000;
  border: none;
  border-radius: 6px;
  padding: 0.4rem 1rem;
  font-family: "Pixel Operator", monospace;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.2s ease;
}
.btn:hover {
  background: color-mix(in srgb, var(--geeko-green) 85%, white 15%);
  transform: translateY(-1px);
}

/* 🧩 Badge layout tweaks */
.badge-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  width: 140px;
  border: none;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(4px) brightness(1.05);
  box-shadow:
    inset 0 0 6px rgba(255, 255, 255, 0.08),
    0 2px 8px rgba(0, 0, 0, 0.4);
  overflow: hidden;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  cursor: pointer;
  padding-bottom: 0.5rem; /* space for title */
}

.badge-image {
  width: 85%;
  height: auto;
  margin-top: 0.5rem;
  object-fit: contain;
  image-rendering: pixelated;
  z-index: 1;
  filter: drop-shadow(0 0 4px rgba(0, 255, 128, 0.4));
  transition: transform 0.3s ease, filter 0.3s ease;
}

.badge-card.locked img {
  filter: grayscale(1) brightness(0.8);
  opacity: 0.75;
}

.badge-card.locked {
  filter: grayscale(1) brightness(0.7);
  opacity: 0.8;
  pointer-events: auto; /* 👈 allow click-through to router-link */
}

.badge-card.locked:hover img {
  transform: none;
  filter: grayscale(1) brightness(0.7);
}
</style>
