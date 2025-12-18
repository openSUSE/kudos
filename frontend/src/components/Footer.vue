<!--───────────────────────────────────────────────────────────────
 🦶 Footer.vue – Global App Footer
───────────────────────────────────────────────────────────────
Copyright © 2025–present Lubos Kocman and openSUSE contributors
SPDX-License-Identifier: Apache-2.0
───────────────────────────────────────────────────────────────-->
<template>
  <footer class="footer-extension">
    <div class="footer-message">
       {{ t('footer.motto') }} 💚
    </div>


    <div class="footer-links">
      <a href="https://github.com/lkocman/kudos" target="_blank" rel="noopener">
        {{ t('footer.source') }}
      </a>
      <a href="https://www.opensuse.org/" target="_blank" rel="noopener">
        openSUSE.org
      </a>
      <a href="https://www.apache.org/licenses/LICENSE-2.0" target="_blank" rel="noopener">
        {{ t('footer.license') }}
      </a>
      <div class="language-selector">
        <select v-model="selectedLanguage" @change="switchLanguage">
          <option v-for="lang in availableLanguages" :key="lang" :value="lang">
            {{ lang.toUpperCase() }}
          </option>
        </select>
      </div>
    </div>
  </footer>
</template>

<script setup>
import { useI18n } from "vue-i18n";
import { ref, onMounted } from "vue";
import { localeModules, loadLocaleMessages } from "../i18n.js";
const { t, locale } = useI18n();

// 🌐 Language switching
const availableLanguages = Object.keys(localeModules).map(path => 
  path.match(/.\/locales\/(.*).json/)[1]
);
const selectedLanguage = ref(locale.value);

function switchLanguage() {
  loadLocaleMessages(selectedLanguage.value);
  locale.value = selectedLanguage.value;
  localStorage.setItem('language', selectedLanguage.value);
}
</script>

<style scoped>

.footer-extension {
  margin-top: 24px;
  border-top: 1px solid var(--footer-divider);
  background: var(--footer-bg);
  padding: 16px 0;
  text-align: center;
  color: var(--text);
  font-size: 16px;
  transition: background 0.3s ease, color 0.3s ease;
}

/* 💬 Footer message */
.footer-message {
  padding: 10px 12px;
  color: var(--geeko-green);
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
}

/* 🔗 Footer links */
.footer-links {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 4px;
}

.footer-links a {
  color: var(--text);
  text-decoration: none;
  border-bottom: 1px dotted transparent;
  transition: color 0.2s ease, border-color 0.2s ease;
}

.footer-links a:hover {
  color: var(--geeko-green);
  border-color: var(--geeko-green);
}

/* 🌐 Language selector */
.language-selector select {
  padding: 0.5rem;
  background: var(--input-bg);
  border: 1px solid var(--divider);
  border-radius: 6px;
  color: var(--text);
  font-family: inherit;
  cursor: pointer;
}


</style>
