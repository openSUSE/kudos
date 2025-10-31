<!--───────────────────────────────────────────────────────────────
🦎 Header.vue – Global App Header
───────────────────────────────────────────────────────────────
Copyright © 2025–present Lubos Kocman
and openSUSE contributors
SPDX-License-Identifier: Apache-2.0
───────────────────────────────────────────────────────────────-->

<script setup>
import { computed, inject, watchEffect } from "vue"; // ✅ watchEffect added here
import { useAuthStore, authMode } from "../store/auth.js";
import ThemeToggle from "./ThemeToggle.vue";
import AudioToggle from "./AudioToggle.vue";
import LyricsDisplay from "./LyricsDisplay.vue";
import { getAvatarUrl, handleAvatarError } from "../utils/user.js";

// ✅ Receive the bgmRef provided in App.vue
const bgmRef = inject("bgmRef");
console.log("🧩 Injected bgmRef in Header.vue:", bgmRef);
watchEffect(() => {
  console.log("🔍 Header sees bgmRef.value:", bgmRef?.value);
});

// 🧩 Environment sanity check
const apiBase = import.meta.env.VITE_API_BASE;
if (!apiBase) {
  console.error("❌ Missing VITE_API_BASE — check your .env configuration!");
  throw new Error("Missing VITE_API_BASE");
}

console.log("🌐 API Base URL:", apiBase);
console.log("🔐 authMode:", authMode.value);

// 🔑 Build login URL based on auth mode
const backendLoginUrl =
  authMode.value === "OIDC"
    ? `${apiBase}/login`
    : `${apiBase}/auth/login`;

const auth = useAuthStore();
const user = computed(() => auth.user);
const avatarSrc = computed(() => getAvatarUrl(user.value));

async function logout() {
  await auth.logout();
}
</script>

<template>
  <header class="header">
    <!-- 🦎 Brand Logo -->
    <router-link to="/" class="brand-link">
      <img src="/logo.svg" alt="openSUSE logo" class="logo" />
      <span class="brand">openSUSE Kudos</span>
    </router-link>

    <!-- 🎶 Live lyrics -->
    <LyricsDisplay
      :audio-ref="computed(() => bgmRef?.value)"
      src="/audio/what_does_chameleon_say_parody.json"
    />

    <!-- 🧭 Navigation -->
    <nav>
      <!-- 💚 Give Kudos -->
      <router-link
        v-if="user"
        to="/kudos/new"
        class="btn btn-give-kudos"
      >
        ＋ Kudos
      </router-link>

      <router-link to="/" class="btn">Home</router-link>
      <router-link to="/kudos" class="btn">All Kudos</router-link>
      <router-link to="/badges" class="btn">All Badges</router-link>

      <!-- 🧑‍💻 My Stuff -->
      <router-link
        v-if="user"
        :to="`/user/${user.username}`"
        class="btn"
      >
        My Stuff
      </router-link>

      <router-link
        v-if="user?.role === 'ADMIN'"
        to="/admin"
        class="btn"
      >
        Admin
      </router-link>

      <!-- 🌗 Theme toggle -->
      <ThemeToggle />

      <!-- 🎵 Audio control -->
      <AudioToggle />

      <!-- 👤 User info -->
      <div
        v-if="user"
        class="user-chip"
        @click="logout"
        title="Logout"
      >
        <img
          :src="avatarSrc"
          :alt="user.username"
          class="avatar"
          @error="(e) => handleAvatarError(e, user)"
        />
        {{ user.username }}
      </div>

      <!-- 🔑 Login button -->
      <template v-else>
        <template v-if="authMode === 'OIDC'">
          <a :href="backendLoginUrl" class="btn">Login</a>
        </template>
        <template v-else>
          <router-link to="/login" class="btn">Login</router-link>
        </template>
      </template>
    </nav>
  </header>
</template>

<style scoped>
.lyrics-container {
  flex: 1;
  max-width: 300px;
}

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
  .user-chip {
    min-width: unset;
    font-size: 14px;
    padding: 4px 8px;
  }

  .brand {
    font-size: 18px;
  }
}
</style>
