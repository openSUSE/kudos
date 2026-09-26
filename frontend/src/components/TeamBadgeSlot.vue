<!--───────────────────────────────────────────────────────────────
🏅 TeamBadgeSlot.vue – A team's membership badge, or the empty slot for one
───────────────────────────────────────────────────────────────
Copyright © 2025–present Lubos Kocman
and openSUSE contributors
SPDX-License-Identifier: Apache-2.0
───────────────────────────────────────────────────────────────

Every team shows this slot, bound or not. An unbound badge renders as a dashed
"TBD" placeholder rather than disappearing: the teams that have a badge to claim
are precisely the ones that would never discover an invisible optional field.
Binding is an admin action — see docs/teams.md for why.
-->
<template>
  <router-link
    v-if="badge"
    :to="`/badge/${badge.slug}`"
    class="badge-slot is-bound"
    :title="badge.title"
  >
    <img :src="previewUrl(badge.picture)" :alt="badge.title" class="badge-art" />
    <span class="badge-title">{{ badge.title }}</span>
  </router-link>

  <div v-else class="badge-slot is-empty" :title="t('teams.badge_tbd_hint')">
    <span class="badge-art placeholder">🏅</span>
    <span class="badge-title">{{ t('teams.badge_tbd') }}</span>
  </div>
</template>

<script setup>
import { useI18n } from "vue-i18n";

const { t } = useI18n();

defineProps({
  badge: { type: Object, default: null },
});

// Only the rendered previews are served, not the original /badges/ files.
function previewUrl(pictureUrl) {
  return pictureUrl.replace("/badges/", "/badges/previews/200/");
}
</script>

<style scoped>
.badge-slot {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0.5rem 0;
  padding: 0.25rem 0.6rem 0.25rem 0.3rem;
  border-radius: 999px;
  font-size: 0.82rem;
  text-decoration: none;
}

.badge-slot.is-bound {
  border: 1px solid var(--card-border);
  background: var(--card-bg);
  color: var(--text-primary);
}

.badge-slot.is-bound:hover {
  border-color: var(--butterfly-blue);
}

.badge-slot.is-empty {
  border: 1px dashed var(--card-border);
  color: var(--text-muted);
}

.badge-art {
  width: 22px;
  height: 22px;
  object-fit: contain;
  border-radius: 50%;
}

.badge-art.placeholder {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  opacity: 0.5;
}

.badge-title {
  white-space: nowrap;
}
</style>
