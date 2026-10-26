<!--
Copyright © 2025–present Lubos Kocman
and openSUSE contributors
SPDX-License-Identifier: Apache-2.0
-->

<template>
  <div class="preferences-view">
    <section class="section-box preferences-card">
      <header class="preferences-header">
        <h1>⚙️ {{ t('preferences.title') }}</h1>
        <p class="muted">{{ t('preferences.intro') }}</p>
      </header>

      <!-- Preferences are tied to an account, so there is nothing to show
           (or save) until the visitor logs in. -->
      <div v-if="!loggedIn" class="login-note">
        <p>{{ t('preferences.login_required') }}</p>
        <a :href="loginUrl" class="login-button">{{ t('nav.login') }}</a>
      </div>

      <template v-else>
        <div class="preference-row">
          <div class="preference-text">
            <h2>📧 {{ t('preferences.email_title') }}</h2>
            <p>{{ t('preferences.email_help') }}</p>
            <p v-if="email" class="email-target">
              {{ t('preferences.email_target', { email }) }}
            </p>
            <p v-else class="email-missing">
              ⚠️ {{ t('preferences.email_missing') }}
            </p>
          </div>

          <label class="switch">
            <input
              type="checkbox"
              :checked="emailNotifications"
              :disabled="loading || saving"
              :aria-label="t('preferences.email_title')"
              @change="updateEmailNotifications($event.target.checked)"
            />
            <span class="switch-track" aria-hidden="true">
              <span class="switch-thumb"></span>
            </span>
            <span class="switch-label">
              {{ emailNotifications ? t('preferences.enabled') : t('preferences.disabled') }}
            </span>
          </label>
        </div>

        <p v-if="loading" class="status">{{ t('preferences.loading') }}</p>
        <p v-else-if="saving" class="status">{{ t('preferences.saving') }}</p>
        <p v-else-if="status" class="status" :class="{ error: statusIsError }">
          {{ status }}
        </p>
      </template>
    </section>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useAuthStore } from "../store/auth.js";

const { t } = useI18n();
const auth = useAuthStore();
const { isAuthenticated: loggedIn } = storeToRefs(auth);

const apiBase = import.meta.env.VITE_API_BASE || "/api";
const loginUrl = computed(
  () => `${apiBase}/login?returnTo=${encodeURIComponent("/preferences")}`
);

const email = ref(auth.user?.email || "");
const emailNotifications = ref(true);
const loading = ref(false);
const saving = ref(false);
const status = ref("");
const statusIsError = ref(false);
let statusTimer = null;

function showStatus(message, isError = false) {
  if (statusTimer) clearTimeout(statusTimer);
  status.value = message;
  statusIsError.value = isError;
  statusTimer = setTimeout(() => {
    status.value = "";
    statusIsError.value = false;
  }, 3000);
}

async function loadPreferences() {
  if (!loggedIn.value) return;

  loading.value = true;

  try {
    const response = await fetch(`${apiBase}/users/me/preferences`, {
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`preferences request failed with ${response.status}`);
    }

    const data = await response.json();
    email.value = data.email || "";
    emailNotifications.value = data.emailNotifications !== false;
  } catch (err) {
    console.error("Failed to load preferences:", err);
    showStatus(t("preferences.load_failed"), true);
  } finally {
    loading.value = false;
  }
}

async function updateEmailNotifications(value) {
  const previous = emailNotifications.value;
  emailNotifications.value = value;
  saving.value = true;
  status.value = "";

  try {
    const response = await fetch(`${apiBase}/users/me/preferences`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ emailNotifications: value }),
    });

    if (!response.ok) {
      throw new Error(`preferences update failed with ${response.status}`);
    }

    const data = await response.json();
    emailNotifications.value = data.emailNotifications !== false;
    showStatus(t("preferences.saved"));
  } catch (err) {
    console.error("Failed to save preferences:", err);
    // Put the switch back where it was: the server still has the old value.
    emailNotifications.value = previous;
    showStatus(t("preferences.save_failed"), true);
  } finally {
    saving.value = false;
  }
}

onMounted(loadPreferences);

onBeforeUnmount(() => {
  if (statusTimer) clearTimeout(statusTimer);
});
</script>

<style scoped>
.preferences-view {
  max-width: 760px;
  margin: 2rem auto;
  padding: 0 1rem;
}

.preferences-card {
  text-align: left;
}

.preferences-header h1 {
  margin: 0 0 0.4rem;
  color: var(--geeko-green);
  font-family: "Pixel Operator Bold", monospace;
  font-size: 1.8rem;
}

.muted {
  margin: 0;
  color: var(--text-muted);
}

.login-note {
  margin-top: 1.5rem;
}

.login-button {
  display: inline-block;
  margin-top: 0.5rem;
  padding: 0.45rem 1rem;
  border: 1px solid var(--geeko-green);
  border-radius: 6px;
  color: var(--geeko-green);
  font-family: "Pixel Operator", monospace;
  text-decoration: none;
}

.login-button:hover {
  background: var(--geeko-green);
  color: var(--bg);
}

.preference-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.5rem;
  margin-top: 1.5rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--card-border);
}

.preference-text h2 {
  margin: 0 0 0.35rem;
  color: var(--text-primary);
  font-size: 1.15rem;
}

.preference-text p {
  margin: 0.25rem 0;
  color: var(--text-secondary);
}

.email-target {
  font-size: 0.9rem;
  color: var(--text-muted) !important;
}

.email-missing {
  font-size: 0.9rem;
  color: var(--yarrow-yellow) !important;
}

/* A checkbox styled as a switch: the real input stays focusable and
   screen-reader friendly, the track and thumb only paint it. */
.switch {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  flex-shrink: 0;
  cursor: pointer;
  user-select: none;
}

.switch input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.switch-track {
  position: relative;
  width: 52px;
  height: 28px;
  border: 1px solid var(--card-border);
  border-radius: 999px;
  background: var(--card-border);
  transition: background 0.2s ease, border-color 0.2s ease;
}

.switch-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--text-muted);
  transition: transform 0.2s ease, background 0.2s ease;
}

.switch input:checked + .switch-track {
  border-color: var(--geeko-green);
  background: color-mix(in srgb, var(--geeko-green) 70%, black 30%);
}

.switch input:checked + .switch-track .switch-thumb {
  transform: translateX(24px);
  background: var(--card-bg);
}

.switch input:focus-visible + .switch-track {
  outline: 2px solid var(--butterfly-blue);
  outline-offset: 2px;
}

.switch input:disabled + .switch-track {
  opacity: 0.55;
  cursor: not-allowed;
}

.switch-label {
  min-width: 4.5rem;
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.status {
  margin: 1rem 0 0;
  color: var(--geeko-green);
}

.status.error {
  color: var(--radish-red);
}

@media (max-width: 560px) {
  .preference-row {
    flex-direction: column;
  }
}
</style>
