<!--───────────────────────────────────────────────────────────────
 🦎 ThemeToggle.vue
───────────────────────────────────────────────────────────────
Copyright © 2025–present Lubos Kocman and openSUSE contributors
Copyright © 2023–2025 Jay Michalska (LCP color system design)
SPDX-License-Identifier: Apache-2.0
───────────────────────────────────────────────────────────────-->
<template>
  <button class="theme-toggle" @click="cycleTheme" :title="`Switch theme (${theme})`">
    <span v-if="theme === 'light'">☀️</span>
    <span v-else-if="theme === 'dark'">🌙</span>
    <span v-else-if="theme === 'dark-red'">❤️</span>
    <span v-else>🦎</span>
  </button>
</template>

<script setup>
import { ref, watch } from "vue";

// ───────────────────────────────────────────────
// 🎨 Auto-discover available themes
// ───────────────────────────────────────────────
const themeModules = import.meta.glob("../assets/themes/theme-*.css");
const availableThemes = Object.keys(themeModules).map((path) =>
  path.match(/theme-(.+)\.css$/)[1]
);

// Log available themes for debugging
console.log("🎨 ThemeToggle discovered themes:", availableThemes);

// ───────────────────────────────────────────────
// 🍪 Helpers
// ───────────────────────────────────────────────
function getSavedTheme() {
  const match = document.cookie.match(/theme=([^;]+)/);
  return match ? match[1] : localStorage.getItem("theme") || "dark";
}

function saveTheme(name) {
  document.cookie = `theme=${name}; path=/; max-age=31536000`;
  localStorage.setItem("theme", name);
}

// ───────────────────────────────────────────────
// 🦎 Reactive theme state
// ───────────────────────────────────────────────
const theme = ref(getSavedTheme());

const themeIcons = {
  light: "☀️",
  dark: "🌙",
  "dark-red": "❤️",
  hackweek: "🧠",
  christmas: "🎄"
};

// Dynamically import and apply theme
async function applyTheme(name) {
  if (!availableThemes.includes(name)) name = "dark";
  await themeModules[`../assets/themes/theme-${name}.css`]?.();
  document.documentElement.className = name;
  saveTheme(name);
}

// Cycle through discovered themes
async function cycleTheme() {
  const currentIndex = availableThemes.indexOf(theme.value);
  const nextIndex = (currentIndex + 1) % availableThemes.length;
  theme.value = availableThemes[nextIndex];
  await applyTheme(theme.value);
}

// Watch for changes & apply immediately on load
watch(theme, applyTheme, { immediate: true });
</script>

<style scoped>
.theme-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  width: 48px;
  border: 1px solid var(--divider);
  background: transparent;
  color: var(--text);
  font-size: 18px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.theme-toggle:hover {
  border-color: var(--geeko-green);
  color: var(--geeko-green);
}
</style>
