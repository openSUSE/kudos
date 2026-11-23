<template>
  <section class="notifications-view" aria-labelledby="notifications-title">
    <header class="page-heading">
      <div>
        <h1 id="notifications-title">{{ t("notifications.title") }}</h1>
        <p>{{ t("notifications.intro") }}</p>
      </div>
      <button v-if="unreadCount" class="btn" type="button" :disabled="busyId !== null" @click="markAllRead">
        {{ t("notifications.mark_all_read") }}
      </button>
    </header>

    <p v-if="loading" class="state-message" role="status" aria-live="polite">{{ t("notifications.loading") }}</p>
    <div v-else-if="loadError" class="state-message error" role="alert">
      <p>{{ t("notifications.load_error") }}</p>
      <button class="btn" type="button" @click="loadNotifications">{{ t("notifications.retry") }}</button>
    </div>
    <p v-else-if="notifications.length === 0" class="state-message" role="status">{{ t("notifications.empty") }}</p>

    <ol v-else class="notification-list" :aria-label="t('notifications.list_label')">
      <li v-for="notification in notifications" :key="notification.id">
        <article class="notification-card" :class="{ unread: !notification.read }">
          <div class="notification-copy">
            <p class="message">{{ notification.message }}</p>
            <p class="meta">
              <span class="status" :class="notification.read ? 'is-read' : 'is-unread'">{{ notification.read ? t("notifications.read") : t("notifications.unread") }}</span>
              <time :datetime="notification.createdAt">{{ formatDate(notification.createdAt) }}</time>
            </p>
          </div>
          <div class="actions">
            <router-link v-if="safeNotificationPath(notification.link)" class="btn" :to="safeNotificationPath(notification.link)" @click="markRead(notification)">
              {{ t("notifications.open") }}
            </router-link>
            <button v-if="!notification.read" class="btn" type="button" :disabled="busyId === notification.id" @click="markRead(notification)">
              {{ busyId === notification.id ? t("notifications.saving") : t("notifications.mark_read") }}
            </button>
          </div>
        </article>
      </li>
    </ol>

    <p v-if="actionError" class="action-error" role="alert">{{ t("notifications.update_error") }}</p>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { safeNotificationPath } from "../utils/notificationLink.js";

const { t } = useI18n();
const notifications = ref([]);
const loading = ref(true);
const loadError = ref(false);
const actionError = ref(false);
const busyId = ref(null);
const unreadCount = computed(() => notifications.value.filter((item) => !item.read).length);

async function loadNotifications() {
  loading.value = true;
  loadError.value = false;
  try {
    const response = await fetch("/api/notifications", { credentials: "include" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    notifications.value = await response.json();
  } catch (error) {
    console.error("Failed to load notification history:", error);
    loadError.value = true;
  } finally {
    loading.value = false;
  }
}

async function markRead(notification) {
  if (notification.read || busyId.value !== null) return;
  busyId.value = notification.id;
  actionError.value = false;
  try {
    const response = await fetch(`/api/notifications/${notification.id}/read`, {
      method: "PATCH",
      credentials: "include",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    notification.read = true;
  } catch (error) {
    console.error("Failed to mark notification read:", error);
    actionError.value = true;
  } finally {
    busyId.value = null;
  }
}

async function markAllRead() {
  for (const notification of notifications.value) {
    if (!notification.read) await markRead(notification);
    if (actionError.value) break;
  }
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

onMounted(loadNotifications);
</script>

<style scoped>
.notifications-view {
  max-width: 960px;
  margin: 0 auto;
  padding: 1.5rem;
}

.page-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.page-heading h1 { margin: 0; }
.page-heading p { color: var(--text-secondary); }

.notification-list {
  display: grid;
  gap: 0.75rem;
  list-style: none;
  margin: 0;
  padding: 0;
}

.notification-card {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid var(--divider);
  border-left: 4px solid var(--divider);
  background: var(--card-bg);
  box-shadow: var(--card-shadow);
}

.notification-card.unread {
  border-left-color: var(--butterfly-blue);
  background: var(--card-hover-bg);
}

.notification-copy { min-width: 0; }
.message { margin: 0 0 0.5rem; white-space: pre-wrap; overflow-wrap: anywhere; }
.meta { display: flex; flex-wrap: wrap; gap: 0.75rem; margin: 0; color: var(--text-muted); font-size: 0.9rem; }
.status { font-weight: 700; }
.status.is-unread { color: var(--butterfly-blue); }
.status.is-read { color: var(--text-secondary); }
.actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 0.5rem; }

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  padding: 0.35rem 0.75rem;
  border: 1px solid var(--divider);
  background: var(--card-bg);
  color: var(--text-primary);
  font: inherit;
  cursor: pointer;
}

.btn:hover:not(:disabled) { border-color: var(--geeko-green); color: var(--geeko-green); }
.btn:disabled { cursor: wait; opacity: 0.65; }
.state-message { padding: 1.25rem; border: 1px solid var(--divider); background: var(--card-bg); }
.error, .action-error { color: var(--radish-red); }
.action-error { margin-top: 1rem; }

@media (max-width: 600px) {
  .notifications-view { padding: 1rem; }
  .page-heading, .notification-card { flex-direction: column; }
  .actions { width: 100%; justify-content: flex-start; }
}
</style>
