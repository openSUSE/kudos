<template>
  <div class="notification-center">
    <div
      v-for="msg in notifications"
      :key="msg.id"
      class="notification"
      :class="[msg.type, { linked: msg.link }]"
      :role="msg.link ? 'link' : undefined"
      @click="open(msg)"
    >
      <span class="text">{{ msg.text }}</span>
      <span v-if="msg.link" class="go" aria-hidden="true">→</span>
      <button
        v-if="!msg.timeout"
        class="close"
        type="button"
        :aria-label="t('notifications.dismiss')"
        @click.stop="dismiss(msg.id)"
      >✕</button>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useNotifications } from "../composables/useNotifications";
const { state, dismiss } = useNotifications();
const notifications = state.messages;
const router = useRouter();
const { t } = useI18n();

// A notification is about something; clicking it should take you there.
function open(msg) {
  dismiss(msg.id);
  if (msg.link) router.push(msg.link);
}
</script>

<style scoped>
.notification-center {
  position: fixed;
  top: calc(var(--header-height, 4rem) + 1rem);
  right: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  z-index: 9999;
}

/* Shared base */
.notification {
  background: var(--card-bg);
  color: var(--text-primary);
  border: 1px solid var(--divider);
  border-left: 4px solid var(--geeko-green); /* default accent */
  border-radius: 8px;
  padding: 0.7rem 1rem;
  min-width: 240px;
  box-shadow: var(--card-shadow);
  cursor: pointer;
  transition: transform 0.25s ease, opacity 0.25s ease, border-color 0.3s ease;
  font-family: inherit;
  font-size: 1rem;
  opacity: 0.96;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  max-width: 380px;
}

.notification .text {
  flex: 1;
}

.notification .go {
  color: var(--text-muted);
  transition: transform 0.2s ease, color 0.2s ease;
}

.notification.linked:hover .go {
  color: var(--geeko-green);
  transform: translateX(3px);
}

.notification .close {
  background: none;
  border: none;
  padding: 0 0.1rem;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 0.9rem;
}

.notification .close:hover {
  color: var(--text-primary);
}

.notification:hover {
  transform: translateY(-2px);
  opacity: 1;
  border-color: var(--geeko-green);
  background: var(--card-hover-bg);
}

/* Variants use your defined theme variables */
.notification.success {
  border-left-color: var(--geeko-green);
}

.notification.error {
  border-left-color: var(--radish-red);
}

.notification.info {
  border-left-color: var(--butterfly-blue);
}

.notification.warning {
  border-left-color: var(--yarrow-yellow);
}

/* Team invites and join requests wait on you, so they carry the same accent
   as invitation cards on /teams. */
.notification.team_invite,
.notification.team_join_request {
  border-left-color: var(--butterfly-blue);
}
</style>
