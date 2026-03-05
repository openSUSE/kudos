<!--───────────────────────────────────────────────────────────────
🦎 Header.vue – Global App Header
───────────────────────────────────────────────────────────────
Copyright © 2025–present Lubos Kocman
and openSUSE contributors
SPDX-License-Identifier: Apache-2.0
───────────────────────────────────────────────────────────────-->
<template>
  <header class="header">
    <!-- 🦎 Brand Logo -->
    <router-link to="/" class="brand-link">
      <img src="/logo.svg" alt="openSUSE logo" class="logo" />
      <span class="brand">openSUSE Kudos</span> <span class="tech-preview">Tech Preview</span>
    </router-link>

    <!-- 🧭 Navigation -->
    <nav>
      <!-- 💚 Give Kudos -->
      <router-link
        v-if="user"
        to="/kudos/new"
        class="btn btn-give-kudos"
      >
        ＋ {{ t('nav.give_kudos') }}
      </router-link>

      <router-link to="/" class="btn">{{ t('nav.home') }}</router-link>
      <router-link to="/kudos" class="btn">{{ t('nav.all_kudos') }}</router-link>
      <router-link to="/badges" class="btn">{{ t('nav.all_badges') }}</router-link>

      <!-- 🧑‍💻 My Stuff -->
      <router-link
        v-if="user"
        :to="`/user/${user.username}`"
        class="btn"
      >{{ t('nav.my_stuff') }}</router-link>

      <router-link
        v-if="user?.role === 'ADMIN'"
        to="/admin"
        class="btn"
      >
        {{ t('nav.admin') }}
      </router-link>

      <!-- 🌗 Theme toggle -->
      <ThemeToggle />

      <!-- 🎵 Audio control -->
      <AudioToggle />

      <!-- 👤 User info / Login button -->
      <template v-if="user">
        <router-link
          :to="`/user/${user.username}`"
          class="user-chip"
          :title="t('nav.my_profile')"
        >
          <img
            :src="avatarSrc"
            :alt="user.username"
            class="avatar"
            @error="(e) => handleAvatarError(e, user)"
          />
          {{ user.username }}
        </router-link>
        <button
          class="btn btn-logout"
          @click="logout"
          :title="t('nav.logout')"
          :aria-label="t('nav.logout')"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          <span class="logout-label">{{ t('nav.logout') }}</span>
        </button>
      </template>
      <template v-else>
        <a :href="backendLoginUrl" class="btn">{{ t('nav.login') }}</a>
      </template>
    
    </nav>
  </header>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { computed } from "vue";
import { useAuthStore } from "../store/auth.js";
import ThemeToggle from "./ThemeToggle.vue";
import AudioToggle from "./AudioToggle.vue";
import { getAvatarUrl, handleAvatarError } from "../utils/user.js";

const { t } = useI18n();

// 🧩 Environment sanity check
const apiBase = import.meta.env.VITE_API_BASE;
if (!apiBase) {
  console.error("❌ Missing VITE_API_BASE — check your .env configuration!");
  throw new Error("Missing VITE_API_BASE");
}

console.log("🌐 API Base URL:", apiBase);

// 🔑 Build login URL based on auth mode
const backendLoginUrl = `${apiBase}/login`;

const auth = useAuthStore();
const user = computed(() => auth.user);
const avatarSrc = computed(() => getAvatarUrl(user.value));

async function logout() {
  await auth.logout();
}
</script>

<style scoped>
/*───────────────────────────────────────────────────────────────
  🧭 Header & Navigation
───────────────────────────────────────────────────────────────*/
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 3px solid var(--divider);
  background: var(--tile-bg);
  box-shadow: var(--shadow-small);
}

.brand-link {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  text-decoration: none;
  color: var(--text);
  font-weight: 600;
  font-size: 22px;
}

.brand-link .logo {
  width: 32px;
  height: 32px;
  object-fit: contain;
  display: block;
}

nav {
  display: flex;
  align-items: center;
  gap: 8px;
}

/*───────────────────────────────────────────────────────────────
👤 User chip & Buttons
───────────────────────────────────────────────────────────────*/
.user-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  min-width: 110px;
  padding: 0 12px;
  color: var(--text);
  font-size: 16px;
  border: 1px solid var(--divider);
  background: transparent;
  cursor: pointer;
  transition: all 0.2s ease;
  text-decoration: none;
}

.user-chip:hover {
  border-color: var(--geeko-green);
  color: var(--geeko-green);
}

.user-chip .avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1px solid var(--divider);
  margin-right: 8px;
  object-fit: cover;
  image-rendering: pixelated;
}

/*───────────────────────────────────────────────────────────────
🚪 Logout button
───────────────────────────────────────────────────────────────*/
.btn-logout {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 36px;
  min-width: unset;
  padding: 0 10px;
  border: 1px solid var(--divider);
  background: transparent;
  color: var(--text);
  font-size: 14px;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-logout:hover {
  border-color: #e05252;
  color: #e05252;
}

.btn-logout svg {
  flex-shrink: 0;
}

/*───────────────────────────────────────────────────────────────
🧩 Buttons
───────────────────────────────────────────────────────────────*/
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  min-width: 110px;
  padding: 0 12px;
  border: 1px solid var(--divider);
  background: transparent;
  color: var(--text);
  font-size: 16px;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn:hover {
  border-color: var(--geeko-green);
  color: var(--geeko-green);
}

/*───────────────────────────────────────────────────────────────
💚 Special "Give Kudos" button
───────────────────────────────────────────────────────────────*/
.btn-give-kudos {
  position: relative;
  margin-left: 1rem;
  background: linear-gradient(90deg, #00e0a8 0%, #00ffcc 100%);
  color: #000;
  border: none;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  overflow: hidden;
  transition: transform 0.25s ease, box-shadow 0.3s ease;
  box-shadow: 0 0 8px rgba(0, 255, 200, 0.4);
}

.btn-give-kudos:hover {
  transform: translateY(-1px) scale(1.05);
  box-shadow: 0 0 12px rgba(0, 255, 200, 0.6);
}

/*───────────────────────────────────────────────────────────────
📱 Responsive layout
───────────────────────────────────────────────────────────────*/
@media (max-width: 720px) {
  nav {
    flex-wrap: wrap;
    gap: 4px;
  }

  .btn,
  .user-chip,
  .btn-logout {
    min-width: unset;
    font-size: 14px;
    padding: 4px 8px;
  }

  .logout-label {
    display: none;
  }

  .brand {
    font-size: 18px;
  }
}
</style>
