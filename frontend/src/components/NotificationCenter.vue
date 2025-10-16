<template>
  <div class="notification-center">
    <div
      v-for="msg in notifications"
      :key="msg.id"
      class="notification"
      :class="msg.type"
      @click="dismiss(msg.id)"
    >
      {{ msg.text }}
    </div>
  </div>
</template>

<script setup>
import { useNotifications } from "../composables/useNotifications";
const { state, dismiss } = useNotifications();
const notifications = state.messages;
</script>

<style scoped>
.notification-center {
  position: fixed;
  top: 1rem;
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
</style>
