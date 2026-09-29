<!--
Copyright © 2025–present Lubos Kocman
and openSUSE contributors
SPDX-License-Identifier: Apache-2.0
-->

<!--
  Where the event QR code leads (see docs/events.md). Most people scanning it
  have no openSUSE account yet, so the page is built around the round trip
  through login and sign-up: it sends them straight off with ?returnTo
  pointing back here, and claims the badge by itself once they return logged
  in.
-->
<template>
  <main class="claim-view">
    <section v-if="loading" class="claim-card section-box">
      <p>{{ t('event_claim.loading') }}</p>
    </section>

    <section v-else-if="!event" class="claim-card section-box">
      <p>{{ t('event_claim.not_found') }}</p>
    </section>

    <section v-else class="claim-card section-box">
      <img
        v-if="event.badge.picture"
        :src="badgeImageUrl(event.badge.picture)"
        :alt="badgeTitle(event.badge)"
        class="badge-image"
        :class="{ dimmed: !event.claimed && !event.claimable }"
      />
      <p class="event-name">{{ t('event_claim.at_event', { event: event.name }) }}</p>
      <h1>{{ badgeTitle(event.badge) }}</h1>
      <p class="description">{{ badgeDescription(event.badge) }}</p>

      <!-- Earned -->
      <template v-if="event.claimed">
        <p class="earned">🎉 {{ t('event_claim.earned', { badge: badgeTitle(event.badge) }) }}</p>
        <p class="hint">{{ t('event_claim.earned_hint') }}</p>
        <div class="actions">
          <router-link class="btn primary" :to="achievementPath">{{ t('event_claim.share_button') }}</router-link>
          <router-link class="btn" :to="`/user/${auth.user.username}`">{{ t('event_claim.profile_link') }}</router-link>
        </div>
      </template>

      <!-- Open, not logged in: the path most people take -->
      <template v-else-if="event.claimable && !auth.user">
        <p>{{ t('event_claim.login_intro') }}</p>
        <div class="actions">
          <a class="btn primary" :href="loginUrl">{{ t('event_claim.login_button') }}</a>
        </div>
        <p class="hint">{{ t('event_claim.keeps_working', { end: formatDate(event.endsAt) }) }}</p>
      </template>

      <!-- Open, logged in: claiming happens on its own -->
      <template v-else-if="event.claimable">
        <p v-if="claiming">{{ t('event_claim.claiming') }}</p>
        <template v-else-if="failed">
          <p class="error">{{ failed }}</p>
          <div class="actions">
            <button class="btn primary" @click="claim">{{ t('event_claim.retry') }}</button>
          </div>
        </template>
      </template>

      <p v-else-if="event.state === 'upcoming'" class="hint">
        {{ t('event_claim.upcoming', { start: formatDate(event.startsAt) }) }}
      </p>
      <p v-else-if="event.state === 'closed'" class="hint">{{ t('event_claim.closed') }}</p>
      <p v-else class="hint">{{ t('event_claim.ended', { end: formatDate(event.endsAt) }) }}</p>
    </section>
  </main>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { useAuthStore } from "../store/auth.js";
import { useBadgeText } from "../composables/useBadgeText.js";

const { t, locale } = useI18n();
const { badgeTitle, badgeDescription } = useBadgeText();
const route = useRoute();
const auth = useAuthStore();

const event = ref(null);
const loading = ref(true);
const claiming = ref(false);
const failed = ref("");

const token = computed(() => String(route.params.token).toLowerCase());
// Set before sending someone to login. If they come back still logged out
// (login abandoned, or the session cookie was lost), show the button instead
// of bouncing them between here and id.opensuse.org forever.
const loginTriedKey = computed(() => `kudos-event-login:${token.value}`);
const loginUrl = computed(() =>
  `${import.meta.env.VITE_API_BASE}/login?returnTo=${encodeURIComponent(`/c/${token.value}`)}`
);
const achievementPath = computed(() =>
  `/badge/${event.value.badge.slug}/earned-by/${auth.user.username}`
);

function badgeImageUrl(picture) {
  return picture.replace("/badges/", "/badges/previews/800/");
}

// Attendees read this on their own phone, so their own time zone is right;
// the zone name makes it unambiguous for anyone who travelled in.
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
  const res = await fetch(`/api/events/${token.value}`, { credentials: "include" });
  event.value = res.ok ? await res.json() : null;
}

async function claim() {
  claiming.value = true;
  failed.value = "";
  try {
    const res = await fetch(`/api/events/${token.value}/claim`, {
      method: "POST",
      credentials: "include",
    });
    if (res.ok) {
      event.value.claimed = true;
    } else if (res.status === 403) {
      // The window closed while the page was open; show why.
      await load();
    } else {
      failed.value = t("event_claim.failed");
    }
  } catch {
    failed.value = t("event_claim.failed");
  } finally {
    claiming.value = false;
  }
}

// Scanning the code is the intent: go to login without asking for a tap.
// Returns true when the page is on its way out.
function goToLogin() {
  try {
    if (sessionStorage.getItem(loginTriedKey.value)) return false;
    sessionStorage.setItem(loginTriedKey.value, "1");
  } catch {
    // Storage blocked (some private modes): no loop guard, so show the button.
    return false;
  }
  window.location.replace(loginUrl.value);
  return true;
}

onMounted(async () => {
  try {
    await load();
  } catch {
    event.value = null;
  }
  if (event.value?.claimable && !auth.user && goToLogin()) return; // stay on "loading"
  loading.value = false;

  if (auth.user) {
    try { sessionStorage.removeItem(loginTriedKey.value); } catch { /* ignore */ }
  }
  // Scanning the code is the intent; don't make people tap twice.
  if (event.value?.claimable && !event.value.claimed && auth.user) await claim();
});
</script>

<style scoped>
.claim-view {
  display: flex;
  justify-content: center;
  padding: 1.5rem 1rem;
}

.claim-card {
  width: min(100%, 520px);
  padding: 1.5rem;
  text-align: center;
}

.badge-image {
  width: min(70vw, 240px);
  height: auto;
}

.badge-image.dimmed {
  filter: grayscale(1);
  opacity: 0.6;
}

.event-name {
  margin: 0.75rem 0 0;
  color: var(--text-muted);
}

h1 {
  margin: 0.25rem 0 0.5rem;
}

.description {
  color: var(--text-secondary);
}

.earned {
  font-size: 1.3rem;
  color: var(--geeko-green);
}

.hint {
  color: var(--text-muted);
  font-size: 0.95rem;
}

.error {
  color: var(--radish-red);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.75rem;
  margin: 1.25rem 0;
}

/* Big enough to hit with a thumb while holding a coffee. */
.btn {
  display: inline-block;
  min-width: 12rem;
  padding: 0.8rem 1.2rem;
  border: 1px dashed var(--geeko-green);
  border-radius: 8px;
  background: transparent;
  color: var(--geeko-green);
  font-family: "Pixel Operator", monospace;
  font-size: 1.1rem;
  text-decoration: none;
  cursor: pointer;
}

.btn.primary,
.btn:hover {
  background: var(--geeko-green);
  color: var(--maple-maroon);
}
</style>
