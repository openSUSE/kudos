<!--
Copyright © 2025–present Lubos Kocman
and openSUSE contributors
SPDX-License-Identifier: Apache-2.0
-->

<template>
  <main class="badge-view">
    <section v-if="loading" class="loading">
      <p>{{ t('badge.loading') }}</p>
    </section>

    <section v-else class="badge-card-detailed">
      <div class="badge-header">
        <img :src="badge.picture" :alt="t('badge.' + badge.slug + '.title')" class="badge-image-large" />
        <div class="badge-meta">
          <h1 class="badge-title">{{ t('badge.' + badge.slug + '.title') }}</h1>
          <p class="badge-description">{{ t('badge.' + badge.slug + '.description') }}</p>

          <div class="badge-stats">
            <span v-if="ownsBadge" class="stat owned">✅ {{ t('badge.youOwnThis') }}</span>
          </div>

          <router-link to="/badges" class="back-link">← {{ t('badge.backToBadges') }}</router-link>
        </div>
      </div>

      <div v-if="badge.users.length" class="badge-holders">
        <h2>👥 {{ t('badge.badgeHolders', { count: badge.users.length }) }}</h2>
        <div class="holder-avatars">
          <router-link
            v-for="u in badge.users"
            :key="u.username"
            :to="`/user/${u.username}`"
            class="holder"
            :title="u.username"
          >
            <img :src="u.avatarUrl" :alt="u.username" />
          </router-link>
        </div>
      </div>

      <div v-else class="no-holders">
        <p>{{ t('badge.noHolders') }}</p>
      </div>
    </section>
  </main>
</template>

<script setup>
import { ref, computed, onMounted } from "vue"
import { useRoute } from "vue-router"
import { useI18n } from "vue-i18n"
import { useNotifications } from "../composables/useNotifications.js"

const { t } = useI18n()
const route = useRoute()
const badge = ref(null)
const loading = ref(true)
const ownsBadge = ref(false)
const currentUser = JSON.parse(localStorage.getItem("user") || "{}")
const { addNotification } = useNotifications()

onMounted(async () => {
  try {
    const res = await fetch(`/api/badges/${route.params.slug}`)
    if (!res.ok) throw new Error(t('badge.notFound'))
    badge.value = await res.json()
    ownsBadge.value = badge.value.users.some(u => u.username === currentUser?.username)
  } catch (err) {
    console.error("💥 Failed to load badge:", err)
    addNotification({
      title: 'Error',
      message: err.message,
      type: 'error'
    })
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>

.badge-view {
  text-align: center;
  padding: 2rem;
  font-family: "Pixel Operator", monospace;
  color: var(--text-primary);
}

.loading {
  font-size: 1.2rem;
  color: var(--geeko-green);
}

.badge-card-detailed {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 0 20px rgba(0, 255, 100, 0.1);
  max-width: 800px;
  margin: 0 auto;
}

.badge-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.badge-image-large {
  width: 200px;
  height: 200px;
  object-fit: contain;
  image-rendering: pixelated;
  filter: drop-shadow(0 0 10px rgba(0, 255, 128, 0.4));
  transition: transform 0.2s ease;
}

.badge-image-large:hover {
  transform: scale(1.05);
}

.badge-meta {
  text-align: center;
  margin-top: 1rem;
}

.badge-title {
  white-space: normal;
  overflow: visible;
  text-overflow: unset;
  text-align: center;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
  line-height: 1.2;
  margin-top: 0.5rem;
  font-size: 1rem;
  color: var(--text-secondary);
  max-width: 90%;
  margin-left: auto;
  margin-right: auto;
}


.badge-description {
  color: var(--text-secondary);
  font-size: 1rem;
  margin-bottom: 1rem;
}

.badge-rarity {
  margin-bottom: 0.5rem;
  font-size: 1rem;
}

.badge-stats {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  color: var(--text-secondary);
  margin-bottom: 1rem;
}

.badge-stats .owned {
  color: var(--geeko-green);
  font-weight: bold;
}

.holder-avatars {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.6rem;
  margin-top: 1rem;
}

.holder img {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 2px solid var(--geeko-green);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  image-rendering: pixelated;
}

.holder:hover img {
  transform: scale(1.1);
  box-shadow: 0 0 10px rgba(66, 205, 66, 0.4);
}

.back-link {
  display: inline-block;
  margin-top: 1rem;
  color: var(--butterfly-blue);
  text-decoration: none;
  transition: color 0.2s ease;
}

.back-link:hover {
  color: var(--geeko-green);
}

.badge-image-large {
  width: 90%;
  max-width: min(720px, 90vw);
  aspect-ratio: 4 / 3;
  height: auto;
  display: block;
  margin: 1rem auto 2rem;
  object-fit: contain;
  image-rendering: pixelated;
  filter: drop-shadow(0 0 12px rgba(0, 255, 128, 0.45));
  border-radius: 12px;
  transition: transform 0.25s ease, filter 0.25s ease;
}

.badge-image-large:hover {
  transform: scale(1.02);
  filter: drop-shadow(0 0 18px rgba(0, 255, 128, 0.8));
}

/* Fine-tune for smaller screens */
@media (max-width: 768px) {
  .badge-image-large {
    width: 100%;
    max-width: 100%;
    border-radius: 8px;
  }
}
</style>
