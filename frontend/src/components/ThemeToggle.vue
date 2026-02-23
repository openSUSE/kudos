<!--───────────────────────────────────────────────────────────────
 🦎 ThemeToggle.vue — Final Clean Version
───────────────────────────────────────────────────────────────
Copyright © 2025–present Lubos Kocman and openSUSE contributors
Copyright © 2023–2025 Jay Michalska (LCP color system design)
SPDX-License-Identifier: Apache-2.0
───────────────────────────────────────────────────────────────-->
<template>
  <button
    class="theme-toggle"
    @click="cycleTheme"
    :title="`Current theme: ${theme}`"
  >
    {{ themeIcons[theme] }}
  </button>
</template>

<script setup>
import { ref, watch } from "vue";

// ───────────────────────────────────────────────
// 🎨 Theme definitions (explicit, predictable)
// ───────────────────────────────────────────────
import "../assets/themes/theme-opensuse.css";
import "../assets/themes/theme-dark.css";
import "../assets/themes/theme-light.css";

const themes = ["opensuse", "dark", "light"];
const themeIcons = {
  opensuse: "🦎",
  dark: "🌙",
  light: "☀️",
};

// ───────────────────────────────────────────────
// 🍪 Persistence helpers
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
const theme = ref(themes.includes(getSavedTheme()) ? getSavedTheme() : "dark");

// Apply the theme by changing <html> class
function applyTheme(name) {
  if (!themes.includes(name)) name = "dark";
  document.documentElement.className = name;
  saveTheme(name);
  console.log(`🎨 Theme applied: ${name}`);
}

// Cycle to the next theme in sequence
function cycleTheme() {
  const i = themes.indexOf(theme.value);
  theme.value = themes[(i + 1) % themes.length];
  // watcher applies immediately
}

// Apply on startup and whenever it changes
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
