// Copyright © 2025–present Lubos Kocman and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0

import { createApp } from "vue";
import { createPinia } from "pinia";
import { createGettext } from "vue3-gettext";
import "vue3-gettext/dist/vue3-gettext.css";
import App from "./App.vue";
import { createAppRouter } from "./router/index.js";
import { ref, watch } from "vue";

import "./assets/themes/pixel-background.css";

// ───────────────────────────────────────────────
// Dynamic gettext translations
// ───────────────────────────────────────────────
const availableLanguages = {};
const localeModules = import.meta.glob("../locale/*.json", { eager: true });
const translations = {};

for (const [path, content] of Object.entries(localeModules)) {
  const match = path.match(/locale\/([a-zA-Z_-]+)\.json$/);
  if (match) {
    const code = match[1];
    translations[code] = content.default || content;
    const langName =
      content.meta?.LanguageName ||
      new Intl.DisplayNames([code], { type: "language" }).of(code) ||
      code;
    availableLanguages[code] = langName;
  }
}

const defaultLanguage =
  navigator.language?.split("-")[0] || "en";

console.log("🌐 Available languages:", availableLanguages);

// ───────────────────────────────────────────────
// Auto-discover themes
// ───────────────────────────────────────────────
const themeModules = import.meta.glob("./assets/themes/theme-*.css");
const availableThemes = Object.keys(themeModules).map((path) =>
  path.match(/theme-(.+)\.css$/)[1]
);
console.log("🎨 Discovered themes:", availableThemes);

const theme = ref(getSavedTheme());
async function loadTheme(name) {
  if (!availableThemes.includes(name)) name = "dark";
  await themeModules[`./assets/themes/theme-${name}.css`]?.();
  document.documentElement.className = name;
  saveTheme(name);
}
watch(theme, loadTheme, { immediate: true });
window.toggleTheme = () => {
  const i = availableThemes.indexOf(theme.value);
  theme.value = availableThemes[(i + 1) % availableThemes.length];
};

function getSavedTheme() {
  const match = document.cookie.match(/theme=([^;]+)/);
  return match ? match[1] : localStorage.getItem("theme") || "dark";
}
function saveTheme(name) {
  document.cookie = `theme=${name}; path=/; max-age=31536000`;
  localStorage.setItem("theme", name);
}

// ───────────────────────────────────────────────
// App startup
// ───────────────────────────────────────────────
const app = createApp(App);
app.use(createPinia());

// 🗣️ Gettext plugin registration
const gettext = createGettext({
  availableLanguages,
  defaultLanguage,
  translations,
  silent: false,
});

app.use(gettext);

// Start router + mount
(async () => {
  const router = await createAppRouter();
  app.use(router);
  app.mount("#app");
})();
