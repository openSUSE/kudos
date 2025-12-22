import { createI18n } from 'vue-i18n';

// Create a placeholder for messages and loaded languages
const messages = {};
const loadedLanguages = [];

// Dynamically import all locale files
const localeModules = import.meta.glob('./locales/strings.*.json');

async function loadLocaleMessages(locale) {
  if (loadedLanguages.includes(locale)) {
    return; // Already loaded
  }
  const path = `./locales/strings.${locale}.json`;
  if (localeModules[path]) {
    const { default: messagesData } = await localeModules[path]();
    i18n.global.setLocaleMessage(locale, messagesData);
    loadedLanguages.push(locale);
  }
}

const savedLanguage = localStorage.getItem('language') || 'en';

const i18n = createI18n({
  locale: savedLanguage, // set locale
  fallbackLocale: 'en', // set fallback locale
  messages, // set locale messages
  // If you need to support legacy falsey values, set this to 'legacy'
  // legacy: false,
});

// Load the saved language by default
loadLocaleMessages(savedLanguage);

export { i18n, loadLocaleMessages, localeModules };

