<!--───────────────────────────────────────────────
🌍 LanguageToggle.vue — Change UI language
───────────────────────────────────────────────-->
<template>
  <button
    class="lang-toggle"
    @click="cycleLanguage"
    :title="`Change language (${currentLangLabel})`"
  >
    <img
      src="/language.svg"
      alt="Language"
      class="icon"
    />
  </button>
</template>

<script setup>
import { computed, getCurrentInstance } from "vue";

const app = getCurrentInstance().appContext.config.globalProperties;
const available = app.$language.available;
const current = app.$language;

const languages = Object.keys(available);
const currentLangLabel = computed(() => available[current.current] || current.current);

function cycleLanguage() {
  const index = languages.indexOf(current.current);
  current.current = languages[(index + 1) % languages.length];
}
</script>

<style scoped>
.lang-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  width: 36px;
  padding: 4px;
  background: transparent;
  border: 1px solid var(--divider);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.lang-toggle:hover {
  border-color: var(--geeko-green);
  background: rgba(115, 186, 37, 0.1);
}

.icon {
  width: 20px;
  height: 20px;
  filter: var(--icon-filter, invert(80%));
  pointer-events: none;
}
</style>
