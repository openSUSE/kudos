<!--───────────────────────────────────────────────────────────────
 🦎 Header.vue – Global App Header
───────────────────────────────────────────────────────────────
Copyright © 2025–present Lubos Kocman and openSUSE contributors
SPDX-License-Identifier: Apache-2.0
───────────────────────────────────────────────────────────────-->
<template>
  <header class="header">
    <!-- 🦎 Brand Logo -->
    <router-link to="/" class="brand-link">
      <img src="/logo.svg" alt="openSUSE logo" class="logo" />
      <span class="brand">openSUSE Kudos</span>
    </router-link>



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
      <div v-if="user" class="user-chip" @click="logout" title="Logout">
        <img :src="user.avatarUrl || '/avatars/default.png'" class="avatar" />
        {{ user.username }}
      </div>

      <!-- 🔑 Login button -->
      <router-link v-else to="/login" class="btn">Login</router-link>
    </nav>
  </header>
</template>

<script setup>
import { computed } from "vue";
import { useAuthStore } from "../store/auth.js";
import ThemeToggle from "./ThemeToggle.vue";
import AudioToggle from "./AudioToggle.vue";

const auth = useAuthStore();
const user = computed(() => auth.user);

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

.btn-give-kudos::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: -100%;
  width: 100%;
  height: 3px;
  background: linear-gradient(90deg, transparent, #00ffc6, transparent);
  animation: kudosPulse 2s linear infinite;
  opacity: 0.9;
}

.btn-give-kudos:hover {
  transform: translateY(-1px) scale(1.05);
  box-shadow: 0 0 12px rgba(0, 255, 200, 0.6);
}

@keyframes kudosPulse {
  0% {
    left: -100%;
  }
  50% {
    left: 100%;
  }
  100% {
    left: -100%;
  }
}

</style>