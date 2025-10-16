// Copyright © 2025–present Lubos Kocman and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0

import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router/index.js";
import { ref, watch } from "vue";
import "./assets/themes/pixel-background.css";

// ───────────────────────────────────────────────
// 🎨 Auto-discover themes using Vite's glob
// ───────────────────────────────────────────────
const themeModules = import.meta.glob("./assets/themes/theme-*.css");
const availableThemes = Object.keys(themeModules).map((path) =>
  path.match(/theme-(.+)\.css$/)[1]
);

// Log discovered themes for debugging
console.log("🎨 Discovered themes:", availableThemes);

// ───────────────────────────────────────────────
// 🦎 Theme management
// ───────────────────────────────────────────────
const theme = ref(getSavedTheme());

async function loadTheme(name) {
  if (!availableThemes.includes(name)) name = "dark";

  // Import only the selected theme’s CSS dynamically
  await themeModules[`./assets/themes/theme-${name}.css`]?.();

  document.documentElement.className = name;
  saveTheme(name);
}

// Apply immediately & react to changes
watch(theme, loadTheme, { immediate: true });

// Global dev helper
window.toggleTheme = () => {
  const currentIndex = availableThemes.indexOf(theme.value);
  theme.value = availableThemes[(currentIndex + 1) % availableThemes.length];
};

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
// 🚀 Vue app boot
// ───────────────────────────────────────────────
const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount("#app");
