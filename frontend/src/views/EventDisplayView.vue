<!--
Copyright © 2025–present Lubos Kocman
and openSUSE contributors
SPDX-License-Identifier: Apache-2.0
-->

<!--
  The event QR code, full screen, for the booth monitor or a laptop on the
  stage (see docs/events.md). Needs no login, so the booth machine never holds
  an admin session: anyone who can see this page can scan it anyway.
-->
<template>
  <main class="display-view" @click="enterFullscreen">
    <p v-if="!event && !loading" class="missing">{{ t('event_claim.not_found') }}</p>

    <template v-else-if="event">
      <section class="badge-side">
        <img
          v-if="event.badge.picture"
          :src="event.badge.picture.replace('/badges/', '/badges/previews/800/')"
          :alt="badgeTitle(event.badge)"
          class="badge-image"
        />
        <h1>{{ badgeTitle(event.badge) }}</h1>
        <p class="event-name">{{ event.name }}</p>
        <p class="counter">{{ t('event_claim.display_claimed', event.claims) }}</p>
      </section>

      <section class="qr-side">
        <p class="scan">📱 {{ t('event_claim.display_scan') }}</p>
        <!-- The SVG brings its own white background and quiet zone. -->
        <img :src="`/api/events/${token}/qr.svg`" alt="" class="qr" />
        <p class="url">{{ shortUrl }}</p>
        <p v-if="event.state !== 'open'" class="state">
          {{ event.state === 'upcoming'
            ? t('event_claim.upcoming', { start: formatDate(event.startsAt) })
            : event.state === 'closed'
              ? t('event_claim.closed')
              : t('event_claim.ended', { end: formatDate(event.endsAt) }) }}
        </p>
      </section>
    </template>
  </main>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { useBadgeText } from "../composables/useBadgeText.js";

// Often a few minutes of no one scanning; conference wifi also drops. A poll
// recovers from both without any reconnect logic.
const POLL_MS = 10_000;

const { t, locale } = useI18n();
const { badgeTitle } = useBadgeText();
const route = useRoute();

const event = ref(null);
const loading = ref(true);
const token = computed(() => String(route.params.token).toLowerCase());
// Shown for people who would rather type than scan.
const shortUrl = computed(() => event.value?.url.replace(/^https?:\/\//, "") || "");

let timer = null;
let wakeLock = null;

function formatDate(value) {
  return new Date(value).toLocaleString(locale.value, {
    // Spelled out: Intl throws if dateStyle/timeStyle meet timeZoneName.
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

async function load() {
  try {
    const res = await fetch(`/api/events/${token.value}?display`);
    if (res.ok) event.value = await res.json();
    else if (res.status === 404) event.value = null;
  } catch {
    // Keep showing the last good state until the network is back.
  } finally {
    loading.value = false;
  }
}

function enterFullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
}

// Keep the booth screen from going to sleep while this page is up.
async function keepAwake() {
  try {
    wakeLock = await navigator.wakeLock?.request("screen");
  } catch {
    // Not supported, or the tab is hidden; the screen may dim.
  }
}

function onVisibility() {
  if (document.visibilityState === "visible") keepAwake();
}

onMounted(() => {
  load();
  timer = setInterval(load, POLL_MS);
  keepAwake();
  document.addEventListener("visibilitychange", onVisibility);
});

onUnmounted(() => {
  clearInterval(timer);
  wakeLock?.release?.();
  document.removeEventListener("visibilitychange", onVisibility);
});
</script>

<style scoped>
.display-view {
  box-sizing: border-box;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5vw;
  padding: 4vh 4vw;
  background: var(--bg);
  color: var(--text-primary);
  cursor: default;
}

.badge-side {
  flex: 1 1 0;
  max-width: 40vw;
  text-align: center;
}

.badge-image {
  width: min(28vw, 45vh);
  height: auto;
}

h1 {
  margin: 2vh 0 1vh;
  font-size: clamp(1.5rem, 3.5vw, 4rem);
}

.event-name {
  margin: 0;
  font-size: clamp(1rem, 2vw, 2.2rem);
  color: var(--text-secondary);
}

.counter {
  margin-top: 3vh;
  font-size: clamp(1rem, 2vw, 2.2rem);
  color: var(--geeko-green);
}

.qr-side {
  flex: 1 1 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.scan {
  margin: 0 0 2vh;
  font-size: clamp(1.2rem, 2.5vw, 3rem);
}

/* As big as the screen allows: the back row has to be able to scan it. */
.qr {
  width: min(45vw, 70vh);
  height: auto;
  image-rendering: pixelated;
}

.url {
  margin: 2vh 0 0;
  font-family: "Pixel Operator", monospace;
  font-size: clamp(1rem, 2.2vw, 2.6rem);
  letter-spacing: 0.05em;
}

.state,
.missing {
  margin-top: 2vh;
  font-size: clamp(1rem, 2vw, 2.2rem);
  color: var(--yarrow-yellow);
}

/* Portrait screens and phones: stack, QR code first. */
@media (orientation: portrait) {
  .display-view {
    flex-direction: column-reverse;
  }

  .badge-side {
    max-width: none;
  }

  .badge-image {
    width: min(35vw, 20vh);
  }

  .qr {
    width: min(85vw, 55vh);
  }
}
</style>
