<!--───────────────────────────────────────────────────────────────
🦎 Header.vue – Global App Header
───────────────────────────────────────────────────────────────
Copyright © 2025–present Lubos Kocman
and openSUSE contributors
SPDX-License-Identifier: Apache-2.0
───────────────────────────────────────────────────────────────-->
<template>
  <header class="header" ref="headerRef">
    <div class="header-left">
      <!-- 🍔 Mobile menu toggle, left of the logo -->
      <button
        type="button"
        class="menu-toggle"
        :aria-expanded="isMenuOpen"
        aria-controls="primary-nav"
        :aria-label="isMenuOpen ? 'Close menu' : 'Open menu'"
        :title="isMenuOpen ? 'Close menu' : 'Open menu'"
        @click="toggleMenu"
      >
        <span class="menu-icon" aria-hidden="true"></span>
      </button>

      <!-- 🦎 Brand Logo -->
      <router-link to="/" class="brand-link">
        <img src="/logo.svg" alt="openSUSE KUDOS logo" class="logo" />
        <!--<span class="brand">openSUSE Kudos</span> <span class="tech-preview">Tech Preview</span>-->
      </router-link>
    </div>

    <div class="header-right">
      <!-- 🧭 Navigation -->
      <nav id="primary-nav" :class="{ 'is-open': isMenuOpen }">
      <!-- 💚 Give Kudos -->
      <router-link
        v-if="user"
        to="/kudos/new"
        class="btn btn-give-kudos"
      >
        ＋ {{ t('nav.give_kudos') }}
      </router-link>

      <!-- 👥 Join Team, or My Teams once you are on one. It beats while
           something waits for you there (an invite, a request to approve).
           Logged out it is a teaser: login, then back to /teams. -->
      <router-link
        v-if="user"
        to="/teams"
        class="btn btn-join-team"
        :class="{ 'is-member': teamStatus.inTeam, 'has-waiting': waitingCount > 0 }"
        :title="waitingCount ? t('nav.teams_waiting', waitingCount) : undefined"
      >
        <img src="/heart.svg" alt="" class="join-heart" />
        {{ teamStatus.inTeam ? t('nav.my_teams') : t('nav.join_team') }}
        <span v-if="waitingCount" class="join-count">{{ waitingCount }}</span>
      </router-link>
      <a
        v-else
        :href="joinTeamLoginUrl"
        class="btn btn-join-team"
      >
        <img src="/heart.svg" alt="" class="join-heart" />
        {{ t('nav.join_team') }}
      </a>

      <router-link to="/" class="btn">{{ t('nav.home') }}</router-link>
      <router-link to="/kudos" class="btn">{{ t('nav.all_kudos') }}</router-link>
      <router-link to="/badges" class="btn">{{ t('nav.all_badges') }}</router-link>

      <div v-if="user" class="person-search" ref="searchRoot">
        <button
          type="button"
          class="btn btn-search"
          :title="isSearchOpen ? 'Close user search' : 'Find people'"
          :aria-label="isSearchOpen ? 'Close user search' : 'Find people'"
          :aria-expanded="isSearchOpen"
          @click="toggleSearch"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>

        <div class="search-popover" :class="{ 'is-open': isSearchOpen }" @keydown.esc="closeSearch">
          <input
            ref="searchInput"
            v-model="searchQuery"
            class="search-input"
            type="text"
            placeholder="Search by name or username"
            autocomplete="off"
            @focus="loadUsers"
            @input="onSearchInput"
          />

          <ul v-if="searchResults.length" class="search-results">
            <li v-for="person in searchResults" :key="person.username">
              <button type="button" class="search-result" @click="goToProfile(person.username)">
                <img :src="person.avatarUrl" :alt="person.username" class="search-avatar" />
                <span class="search-meta">
                  <strong>{{ getPersonDisplayName(person) || `@${person.username}` }}</strong>
                  <small>@{{ person.username }}</small>
                  <small v-if="person.email">{{ person.email }}</small>
                </span>
              </button>
            </li>
          </ul>

          <p v-else-if="searchQuery.trim()" class="search-empty">No users found.</p>
          <p v-else class="search-empty">Type at least 2 characters.</p>
        </div>
      </div>

      <router-link
        v-if="user?.role === 'ADMIN' || user?.role === 'STEWARD'"
        to="/events"
        class="btn"
      >
        {{ t('nav.events') }}
      </router-link>
      </nav>

      <!-- 🌗 Theme + 🎵 sound always sit in the same spot, for everyone. -->
      <div class="header-controls">
        <ThemeToggle />
        <AudioToggle />
      </div>

      <!-- 🚪 Login for visitors -->
      <a v-if="!user" :href="backendLoginUrl" class="btn btn-login">
        {{ t('nav.login') }}
      </a>

      <!-- 👤 Profile menu -->
      <div v-if="user" class="profile-menu" ref="profileRoot">
        <button
          type="button"
          class="profile-trigger"
          :aria-expanded="isProfileOpen"
          aria-controls="profile-panel"
          :aria-label="t('nav.my_profile')"
          :title="user.username"
          @click="toggleProfile"
        >
          <img
            :src="avatarSrc"
            :alt="user.username"
            class="profile-avatar"
            @error="(e) => handleAvatarError(e, user)"
          />
        </button>

        <div
          v-if="isProfileOpen"
          id="profile-panel"
          class="profile-panel"
          @keydown.esc="closeProfile"
        >
          <router-link
            :to="`/user/${user.username}`"
            class="profile-item profile-user"
            @click="closeProfile"
          >
            <img
              :src="avatarSrc"
              :alt="user.username"
              class="profile-avatar-small"
              @error="(e) => handleAvatarError(e, user)"
            />
            <span class="profile-user-text">
              <strong>{{ user.username }}</strong>
              <small>{{ t('nav.my_profile') }}</small>
            </span>
          </router-link>

          <router-link
            v-if="user?.role === 'ADMIN'"
            to="/admin"
            class="profile-item"
            @click="closeProfile"
          >
            {{ t('nav.admin') }}
          </router-link>

          <button type="button" class="profile-item profile-logout" @click="logout">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            <span>{{ t('nav.logout') }}</span>
          </button>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
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
const joinTeamLoginUrl = `${backendLoginUrl}?returnTo=${encodeURIComponent("/teams")}`;

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const user = computed(() => auth.user);
const avatarSrc = computed(() => getAvatarUrl(user.value));
const users = ref([]);
const searchQuery = ref("");
const isSearchOpen = ref(false);
const searchRoot = ref(null);
const searchInput = ref(null);
const isMenuOpen = ref(false);
const headerRef = ref(null);
const isProfileOpen = ref(false);
const profileRoot = ref(null);

const searchResults = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (query.length < 2) return [];

  return users.value
    .filter((entry) => {
      const username = String(entry.username || "").toLowerCase();
      const fullName = String(entry.fullName || "").toLowerCase();
      const givenName = String(entry.givenName || "").toLowerCase();
      const familyName = String(entry.familyName || "").toLowerCase();
      const combinedName = `${givenName} ${familyName}`.trim();
      const email = String(entry.email || "").toLowerCase();
      const emailLocalPart = email.split("@")[0] || "";
      return (
        username.includes(query) ||
        fullName.includes(query) ||
        givenName.includes(query) ||
        familyName.includes(query) ||
        combinedName.includes(query) ||
        email.includes(query) ||
        emailLocalPart.includes(query)
      );
    })
    .slice(0, 8);
});

function onSearchInput() {
  // Computed search results react to query updates; make sure the people
  // list is loaded for the always-visible mobile input.
  loadUsers();
}

function getPersonDisplayName(person) {
  if (person?.fullName) return String(person.fullName).trim();
  const combined = [person?.givenName, person?.familyName]
    .filter(Boolean)
    .map((part) => String(part).trim())
    .filter(Boolean)
    .join(" ");
  return combined || "";
}

async function loadUsers() {
  if (users.value.length) return;

  try {
    const response = await fetch("/api/users", { credentials: "include" });
    if (!response.ok) throw new Error("Failed to fetch users");
    users.value = await response.json();
  } catch (error) {
    console.error("Failed to load users for header search:", error);
    users.value = [];
  }
}

async function toggleSearch() {
  isSearchOpen.value = !isSearchOpen.value;

  if (isSearchOpen.value) {
    // Search lives inside the mobile drawer, so keep the drawer open —
    // closing it here would hide the input. Only dismiss the profile menu.
    closeProfile();
    await loadUsers();
    await nextTick();
    searchInput.value?.focus();
  }
}

function closeSearch() {
  isSearchOpen.value = false;
}

// 🍔 The mobile hamburger: at most one overlay is open at a time.
function toggleMenu() {
  isMenuOpen.value = !isMenuOpen.value;
  if (isMenuOpen.value) {
    closeSearch();
    closeProfile();
  }
}

function closeMenu() {
  isMenuOpen.value = false;
}

// 👤 The avatar dropdown: same rule, only one overlay open at a time.
function toggleProfile() {
  isProfileOpen.value = !isProfileOpen.value;
  if (isProfileOpen.value) {
    closeSearch();
    closeMenu();
  }
}

function closeProfile() {
  isProfileOpen.value = false;
}

async function goToProfile(username) {
  closeSearch();
  searchQuery.value = "";
  await router.push(`/user/${username}`);
}

// 👥 "Join Team" for people not on a team yet, "My Teams" for members, and
// a count of invites and join requests waiting on you
const teamStatus = ref({ inTeam: false, invites: 0, requests: 0 });
const waitingCount = computed(() => teamStatus.value.invites + teamStatus.value.requests);

async function loadMembership() {
  if (!user.value) {
    teamStatus.value = { inTeam: false, invites: 0, requests: 0 };
    return;
  }
  try {
    const res = await fetch("/api/teams/me/status", { credentials: "include" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    teamStatus.value = await res.json();
  } catch (error) {
    console.error("Failed to load team status for header:", error);
  }
}

watch(() => user.value?.username, loadMembership, { immediate: true });

// Joining and leaving happen on the teams pages, so re-check on the way out
// and whenever the teams page reloads its list.
watch(
  () => route.path,
  (to, from) => {
    closeMenu();
    closeProfile();
    if (from?.startsWith("/teams")) loadMembership();
  }
);

function handleClickOutside(event) {
  if (searchRoot.value && !searchRoot.value.contains(event.target)) {
    closeSearch();
  }
  if (profileRoot.value && !profileRoot.value.contains(event.target)) {
    closeProfile();
  }
  if (headerRef.value && !headerRef.value.contains(event.target)) {
    closeMenu();
  }
}

function handleKeydown(event) {
  if (event.key === "Escape") {
    closeSearch();
    closeMenu();
    closeProfile();
  }
}

// The desktop nav is always visible; drop the mobile overlay once we cross back.
function handleResize() {
  if (window.innerWidth > 720) closeMenu();
}

onMounted(() => {
  document.addEventListener("click", handleClickOutside);
  document.addEventListener("keydown", handleKeydown);
  window.addEventListener("resize", handleResize);
  window.addEventListener("kudos:teams-changed", loadMembership);
});

onBeforeUnmount(() => {
  document.removeEventListener("click", handleClickOutside);
  document.removeEventListener("keydown", handleKeydown);
  window.removeEventListener("resize", handleResize);
  window.removeEventListener("kudos:teams-changed", loadMembership);
});

async function logout() {
  closeProfile();
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
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 3px solid var(--divider);
  background: var(--tile-bg);
  box-shadow: var(--shadow-small);
  position: relative;
  z-index: 30;
}

.header-left,
.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-right {
  min-width: 0;
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
  /*width: 32px;*/
  height: 40px;
  object-fit: contain;
  display: block;
}

/*───────────────────────────────────────────────────────────────
🍔 Mobile menu toggle (hidden on desktop)
───────────────────────────────────────────────────────────────*/
.menu-toggle {
  display: none;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 36px;
  padding: 0;
  border: 1px solid var(--divider);
  background: transparent;
  color: var(--text);
  cursor: pointer;
  transition: all 0.2s ease;
}

.menu-toggle:hover {
  border-color: var(--geeko-green);
  color: var(--geeko-green);
}

.menu-icon,
.menu-icon::before,
.menu-icon::after {
  display: block;
  width: 18px;
  height: 2px;
  background: currentColor;
  transition: transform 0.25s ease, top 0.25s ease, opacity 0.2s ease;
}

.menu-icon {
  position: relative;
}

.menu-icon::before,
.menu-icon::after {
  content: "";
  position: absolute;
  left: 0;
}

.menu-icon::before {
  top: -6px;
}

.menu-icon::after {
  top: 6px;
}

/* Morph the three bars into an X while the menu is open. */
.menu-toggle[aria-expanded="true"] .menu-icon {
  background: transparent;
}

.menu-toggle[aria-expanded="true"] .menu-icon::before {
  top: 0;
  transform: rotate(45deg);
}

.menu-toggle[aria-expanded="true"] .menu-icon::after {
  top: 0;
  transform: rotate(-45deg);
}

/*───────────────────────────────────────────────────────────────
👤 Profile menu (avatar trigger + dropdown)
───────────────────────────────────────────────────────────────*/
.header-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.btn-login {
  min-width: unset;
  padding: 0 14px;
}

.profile-menu {
  position: relative;
  flex-shrink: 0;
}

.profile-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  padding: 0;
  border: 1px solid var(--divider);
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
  overflow: hidden;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.profile-trigger:hover,
.profile-trigger[aria-expanded="true"] {
  border-color: var(--geeko-green);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--geeko-green) 30%, transparent);
}

.profile-avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
  image-rendering: pixelated;
}

.profile-panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: min(280px, 85vw);
  padding: 8px;
  background: var(--tile-bg);
  border: 1px solid var(--divider);
  box-shadow: var(--shadow-small);
  z-index: 40;
}

.profile-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: 15px;
  text-align: left;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.profile-item:hover {
  border-color: var(--geeko-green);
  color: var(--geeko-green);
}

.profile-avatar-small {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid var(--divider);
  object-fit: cover;
  image-rendering: pixelated;
  flex-shrink: 0;
}

.profile-user-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.profile-user-text strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-user-text small {
  opacity: 0.7;
  font-size: 12px;
}

.profile-logout svg {
  flex-shrink: 0;
}

.profile-logout:hover {
  border-color: #e05252;
  color: #e05252;
}

nav {
  display: flex;
  align-items: center;
  gap: 8px;
}

.person-search {
  position: relative;
}

.btn-search {
  min-width: 40px;
  width: 40px;
  padding: 0;
}

.search-popover {
  display: none;
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: min(330px, 85vw);
  background: var(--tile-bg);
  border: 1px solid var(--divider);
  box-shadow: var(--shadow-small);
  padding: 10px;
  z-index: 20;
}

.search-popover.is-open {
  display: block;
}

.search-input {
  width: 100%;
  border: 1px solid var(--divider);
  background: transparent;
  color: var(--text);
  padding: 8px 10px;
  font: inherit;
}

.search-results {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  max-height: 300px;
  overflow: auto;
}

.search-result {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text);
  padding: 6px;
  text-align: left;
  cursor: pointer;
}

.search-result:hover {
  border-color: var(--geeko-green);
  color: var(--geeko-green);
}

.search-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
}

.search-meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.search-meta small {
  opacity: 0.75;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.search-empty {
  margin: 10px 2px 4px;
  opacity: 0.75;
  font-size: 13px;
}

.tech-preview {
  color: var(--radish-red);
  font-size: 32px;
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

/* Sibling CTA to Give Kudos, dressed as the Kudos heart: Bagel Beige face, black
   outline and the red heart itself. The heart beats every few seconds with a
   Radish Red glow to draw the eye. */
.btn-join-team {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  white-space: nowrap;
  margin-left: 0.5rem;
  background: var(--bagel-beige);
  color: #000;
  border: 2px solid #000;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  transition: transform 0.25s ease, box-shadow 0.3s ease, border-color 0.25s ease;
  box-shadow: 0 0 6px color-mix(in srgb, var(--radish-red) 35%, transparent);
  animation: join-team-glow 6s ease-in-out 2s infinite;
}

.join-heart {
  width: 1.2em;
  height: 1.2em;
  animation: join-heart-beat 6s ease-in-out 2s infinite;
}

.btn-join-team:hover {
  color: #000;
  border-color: var(--radish-red);
  transform: translateY(-1px) scale(1.05);
  box-shadow: 0 0 12px color-mix(in srgb, var(--radish-red) 60%, transparent);
  animation: none;
}

/* Members already found their way in: keep the look, drop the heartbeat
   unless something is waiting for them. */
.btn-join-team.is-member:not(.has-waiting),
.btn-join-team.is-member:not(.has-waiting) .join-heart {
  animation: none;
}

.join-count {
  min-width: 1.4em;
  padding: 0 0.35em;
  border-radius: 999px;
  background: var(--radish-red);
  color: #000;
  font-size: 0.8em;
  line-height: 1.4em;
  text-align: center;
}

.btn-join-team:hover .join-heart {
  animation: none;
  transform: scale(1.15);
}

@keyframes join-team-glow {
  0%, 80%, 100% {
    box-shadow: 0 0 6px color-mix(in srgb, var(--radish-red) 35%, transparent);
  }
  88% {
    box-shadow: 0 0 20px 4px color-mix(in srgb, var(--radish-red) 80%, transparent);
  }
}

/* Two quick beats, like a heart. */
@keyframes join-heart-beat {
  0%, 80%, 94%, 100% { transform: scale(1); }
  84% { transform: scale(1.3); }
  87% { transform: scale(1.05); }
  90% { transform: scale(1.25); }
}

@media (prefers-reduced-motion: reduce) {
  .btn-join-team,
  .join-heart {
    animation: none;
  }
}

/*───────────────────────────────────────────────────────────────
📱 Responsive layout — hamburger drawer under 720px
───────────────────────────────────────────────────────────────*/
@media (max-width: 720px) {
  .menu-toggle {
    display: inline-flex;
  }

  /* Collapse the nav into a full-width panel that drops from the header. */
  nav {
    display: none;
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    padding: 12px 16px 16px;
    background: var(--tile-bg);
    border-bottom: 3px solid var(--divider);
    box-shadow: var(--shadow-small);
    max-height: calc(100vh - 70px);
    overflow-y: auto;
    z-index: 25;
  }

  nav.is-open {
    display: flex;
  }

  /* Every link and control gets its own full-width row. */
  nav > .btn {
    width: 100%;
    min-width: unset;
    flex: 1 1 100%;
    justify-content: flex-start;
    font-size: 14px;
    padding: 8px 12px;
  }

  nav .btn-give-kudos,
  nav .btn-join-team {
    margin-left: 0;
  }

  /* 🔎 Search sits at the very top of the drawer. */
  .person-search {
    position: static;
    order: -1;
    width: 100%;
    flex: 1 1 100%;
  }

  /* No toggle button on mobile — the field is always visible. */
  .btn-search {
    display: none;
  }

  /* Strip the floating-popover chrome so it reads as a plain input. */
  .search-popover {
    display: block;
    position: static;
    width: 100%;
    margin-top: 0;
    padding: 0;
    border: none;
    background: transparent;
    box-shadow: none;
  }

  /* 👤 The profile dropdown stays anchored to the avatar. */
  .profile-panel {
    width: min(280px, calc(100vw - 24px));
  }

  /* Theme + sound stay compact in the header row. */
  .header-controls {
    gap: 6px;
  }

  .btn-login {
    font-size: 14px;
    padding: 0 10px;
  }

  .brand {
    font-size: 18px;
  }
}
</style>
