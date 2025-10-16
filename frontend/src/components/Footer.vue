<!--───────────────────────────────────────────────────────────────
 🦶 Footer.vue – Global App Footer
───────────────────────────────────────────────────────────────
Copyright © 2025–present Lubos Kocman and openSUSE contributors
SPDX-License-Identifier: Apache-2.0
───────────────────────────────────────────────────────────────-->
<template>
  <footer class="footer-extension">
    <!-- 💬 Live ticker (optional) -->
    <div class="ticker">
      <span v-if="tickerMessage">{{ tickerMessage }}</span>
      <span v-else>💚 Together we build openSUSE.</span>
    </div>

    <!-- 🔗 Footer links -->
    <div class="footer-links">
      <a href="https://github.com/lkocman/kudos" target="_blank" rel="noopener">
        Source
      </a>
      <a href="https://www.opensuse.org/" target="_blank" rel="noopener">
        openSUSE.org
      </a>
      <a href="https://www.apache.org/licenses/LICENSE-2.0" target="_blank" rel="noopener">
        License
      </a>
    </div>
  </footer>
</template>

<script setup>
import { ref, onMounted } from "vue";

// 🪄 Optional ticker text rotation (future enhancement)
const messages = [
  "💚 Together we build openSUSE.",
  "🦎 Thank your peers — send a Kudo today!",
  "🌍 openSUSE — for developers, sysadmins, and creators.",
  "🎉 Celebrate contributions, big or small!"
];

const tickerMessage = ref(messages[0]);

onMounted(() => {
  let i = 0;
  setInterval(() => {
    i = (i + 1) % messages.length;
    tickerMessage.value = messages[i];
  }, 8000);
});
</script>

<style scoped>
/*───────────────────────────────────────────────────────────────
  🦶 Footer Styles
───────────────────────────────────────────────────────────────*/
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

/* 💬 Ticker area */
.ticker {
  padding: 10px 12px;
  color: var(--geeko-green);
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  animation: fadeIn 0.5s ease;
}

/* 🔗 Footer links */
.footer-links {
  display: flex;
  justify-content: center;
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

/* 🌀 Fade animation */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
