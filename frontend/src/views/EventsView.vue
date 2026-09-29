<!--
Copyright © 2025–present Lubos Kocman
and openSUSE contributors
SPDX-License-Identifier: Apache-2.0
-->

<!--
  Event links for stewards and admins (see docs/events.md). Read-only: the
  people running the booth need the booth display, the link and the QR code,
  often from a phone at the booth. Setting events up stays in Admin → Events.
-->
<template>
  <div class="events-view container">
    <section class="section-box">
      <h2>🎟️ {{ t('events.title') }}</h2>
      <p class="hint">{{ t('events.intro') }}</p>

      <p v-if="loading">{{ t('events.loading') }}</p>
      <p v-else-if="failed" class="error">{{ t('events.failed') }}</p>
      <p v-else-if="!events.length" class="hint">{{ t('events.empty') }}</p>

      <div v-else class="event-list">
        <article
          v-for="e in events"
          :key="e.token"
          class="event-card"
          :class="{ past: e.state === 'ended' || e.state === 'closed' }"
        >
          <img
            v-if="e.badge.picture"
            :src="e.badge.picture.replace('/badges/', '/badges/previews/800/')"
            :alt="badgeTitle(e.badge)"
            class="badge-image"
          />
          <div class="event-body">
            <h3>{{ e.name }}</h3>
            <p class="event-badge">{{ badgeTitle(e.badge) }}</p>
            <p class="meta">
              <span class="state" :class="e.state">{{ t(`events.state_${e.state}`) }}</span>
              · {{ t('events.claims', e.claims) }}
            </p>
            <p class="meta">{{ t('events.window', { start: formatDate(e.startsAt), end: formatDate(e.endsAt) }) }}</p>
            <p class="url">{{ e.url.replace(/^https?:\/\//, '') }}</p>

            <div class="actions">
              <a class="btn primary" :href="`/c/${e.token}/display`" target="_blank" rel="noopener">
                🖥️ {{ t('events.booth_display') }}
              </a>
              <button class="btn" @click="copyLink(e.url)">🔗 {{ t('events.copy_link') }}</button>
              <a class="btn" :href="`/api/events/${e.token}/qr.svg?download`">🔳 {{ t('events.qr_download') }}</a>
            </div>
          </div>
        </article>
      </div>

      <p class="hint">{{ t('events.admin_hint') }}</p>
    </section>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useBadgeText } from "../composables/useBadgeText.js";
import { useNotifications } from "../composables/useNotifications.js";

const { t, locale } = useI18n();
const { badgeTitle } = useBadgeText();
const { addNotification } = useNotifications();

const events = ref([]);
const loading = ref(true);
const failed = ref(false);

// Spelled out: Intl throws if dateStyle/timeStyle meet timeZoneName.
function formatDate(value) {
  return new Date(value).toLocaleString(locale.value, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

async function copyLink(url) {
  try {
    await navigator.clipboard.writeText(url);
    addNotification({ message: t("events.copied") });
  } catch {
    addNotification({ message: t("events.copy_failed"), type: "error" });
  }
}

onMounted(async () => {
  try {
    const res = await fetch("/api/events", { credentials: "include" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    events.value = await res.json();
  } catch {
    failed.value = true;
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.event-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin: 1rem 0;
}

.event-card {
  display: flex;
  gap: 1.25rem;
  align-items: flex-start;
  padding: 1rem;
  border: 1px dashed var(--geeko-green);
  border-radius: 8px;
}

.event-card.past {
  opacity: 0.6;
}

.badge-image {
  width: 120px;
  height: auto;
  flex-shrink: 0;
}

.event-body {
  flex: 1;
  min-width: 0;
}

h3 {
  margin: 0;
}

.event-badge,
.meta {
  margin: 0.25rem 0;
  color: var(--text-secondary);
}

.state.open {
  color: var(--geeko-green);
}

.state.upcoming {
  color: var(--yarrow-yellow);
}

.state.ended,
.state.closed {
  color: var(--text-muted);
}

.url {
  margin: 0.5rem 0;
  font-family: "Pixel Operator", monospace;
  overflow-wrap: anywhere;
}

.error {
  color: var(--radish-red);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.btn {
  display: inline-block;
  padding: 0.6rem 1rem;
  border: 1px dashed var(--geeko-green);
  border-radius: 8px;
  background: transparent;
  color: var(--geeko-green);
  font-family: "Pixel Operator", monospace;
  font-size: 1rem;
  text-decoration: none;
  cursor: pointer;
}

.btn.primary,
.btn:hover {
  background: var(--geeko-green);
  color: var(--maple-maroon);
}

/* Phones at the booth: badge on top, buttons full width for thumbs. */
@media (max-width: 600px) {
  .event-card {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .actions {
    flex-direction: column;
  }

  .btn {
    width: 100%;
    text-align: center;
  }
}
</style>
