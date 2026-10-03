<!--───────────────────────────────────────────────────────────────
 🦶 Footer.vue – Global App Footer
───────────────────────────────────────────────────────────────
Copyright © 2025–present Lubos Kocman and openSUSE contributors
SPDX-License-Identifier: Apache-2.0
───────────────────────────────────────────────────────────────-->
<template>
  <footer class="footer">
    <div class="footer-inner">
      <!-- Tier 1: warm motto -->
      <p class="footer-motto">
        <span class="heart" aria-hidden="true">💚</span>
        <span>{{ t('footer.motto') }}</span>
      </p>

      <!-- Tier 2: links as friendly chips -->
      <nav class="footer-links" aria-label="Footer">
        <a class="footer-link" href="/api/now/stream" target="_blank" rel="noopener noreferrer">
          {{ t('footer.live_stream') }}
        </a>
        <a
          class="footer-link"
          href="https://github.com/openSUSE/kudos"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span class="icon" aria-hidden="true">💻</span>{{ t('footer.source') }}
        </a>
        <a
          class="footer-link"
          href="https://www.opensuse.org/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span class="icon" aria-hidden="true">🦎</span>openSUSE.org
        </a>
        <a
          class="footer-link"
          href="https://www.apache.org/licenses/LICENSE-2.0"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span class="icon" aria-hidden="true">📜</span>{{ t('footer.license') }}
        </a>
      </nav>

      <!-- Tier 3: meta bar -->
      <div class="footer-bottom">
        <span class="copyright">
          © {{ currentYear }}–present openSUSE contributors
        </span>

        <label class="language-selector">
          <span class="icon" aria-hidden="true">🌐</span>
          <select v-model="selectedLanguage" @change="switchLanguage" aria-label="Language">
            <option v-for="lang in availableLanguages" :key="lang.code" :value="lang.code">
              {{ lang.icon }} {{ lang.label }}
            </option>
          </select>
        </label>
      </div>
    </div>
  </footer>
</template>

<script setup>
import { useI18n } from "vue-i18n";
import { ref, computed } from "vue";
import { localeModules, loadLocaleMessages } from "../i18n.js";
import languages from "../locales/languages.json";
const { t, locale } = useI18n();

const currentYear = new Date().getFullYear();

// 🌐 Language switching
const availableLanguages = computed(() => {
  return Object.keys(localeModules).map(path => {
    const code = path.match(/.\/locales\/strings\.(.*)\.json/)[1];
    const langData = languages[code];
    return {
      code,
      label: langData ? langData.label : code.toUpperCase(),
      icon: langData ? langData.icon : '🌐'
    };
  });
});

const selectedLanguage = ref(locale.value);

function switchLanguage() {
  loadLocaleMessages(selectedLanguage.value);
  locale.value = selectedLanguage.value;
  localStorage.setItem('language', selectedLanguage.value);
}
</script>

<style scoped>
.footer {
  margin-top: 24px;
  background: var(--footer-bg);
  color: var(--text);
  font-size: 16px;
  transition: background 0.3s ease, color 0.3s ease;
}

/* 🌈 Gradient top edge instead of a hard rule */
.footer::before {
  content: "";
  display: block;
  height: 3px;
  background: linear-gradient(
    90deg,
    transparent,
    var(--geeko-green),
    var(--butterfly-blue),
    transparent
  );
  opacity: 0.6;
}

.footer-inner {
  max-width: 1400px;
  margin: 0 auto;
  padding: 1.5rem 1.25rem 1rem;
  text-align: center;
}

/* 💬 Footer message */
.footer-motto {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin: 0 0 1rem;
  color: var(--geeko-green);
  font-size: 1.05rem;
  line-height: 1.4;
}

.heart {
  display: inline-block;
  animation: heart-beat 1.8s ease-in-out infinite;
}

@keyframes heart-beat {
  0%, 100% { transform: scale(1); }
  15%      { transform: scale(1.25); }
  30%      { transform: scale(1); }
}

/* 🔗 Footer links */
.footer-links {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
}

.footer-link {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.85rem;
  border-radius: 999px;
  color: var(--text);
  text-decoration: none;
  transition: background 0.2s ease, color 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease;
}

/* Neutralize the global glowing underline + nudge */
.footer-link::after { content: none; }

.footer-link:hover,
.footer-link:focus-visible {
  color: var(--geeko-green);
  background: color-mix(in srgb, var(--geeko-green) 14%, transparent);
  box-shadow: 0 0 10px color-mix(in srgb, var(--geeko-green) 25%, transparent);
  transform: translateY(-1px);
}

.footer-link:focus-visible {
  outline: 2px solid var(--geeko-green);
  outline-offset: 2px;
}

.icon { line-height: 1; }

/* 🧾 Meta bar */
.footer-bottom {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: 1.25rem;
  padding-top: 0.9rem;
  border-top: 1px solid var(--footer-divider);
}

.copyright {
  color: var(--text-secondary);
  font-size: 0.85rem;
}

/* 🌐 Language selector */
.language-selector {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.6rem;
  border: 1px solid var(--divider);
  border-radius: 999px;
  background: var(--input-bg);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.language-selector:hover,
.language-selector:focus-within {
  border-color: var(--geeko-green);
  box-shadow: 0 0 8px color-mix(in srgb, var(--geeko-green) 25%, transparent);
}

.language-selector select {
  appearance: none;
  background: transparent;
  border: none;
  color: var(--text);
  font: inherit;
  cursor: pointer;
  padding: 0.15rem 0.2rem;
}

.language-selector select:focus { outline: none; }

@media (max-width: 640px) {
  .footer-bottom {
    justify-content: center;
    text-align: center;
  }
}

@media (prefers-reduced-motion: reduce) {
  .heart { animation: none; }
  .footer-link { transition: none; }
}
</style>
