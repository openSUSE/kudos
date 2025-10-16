<!-- Copyright © 2025–present Lubos Kocman and openSUSE contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<template>
  <main class="kudo-view">
    <div class="panel">
      <header class="panel-head">
        <span class="dot"></span>
        <span class="title">Kudo permalink</span>
      </header>

      <section class="meta">
        <div class="row">
          <span>💚 From:</span>
          <b>{{ kudo?.fromUser?.username || "unknown" }}</b>
        </div>
        <div class="row">
          <span>➡️ To:</span>
          <b>{{ kudo?.recipients?.[0]?.user?.username || "unknown" }}</b>
        </div>
        <div class="row">
          <span>🕓</span>
          <span>{{ formatDate(kudo?.createdAt) }}</span>
        </div>
      </section>

      <section class="message">
        <div v-if="!typedMessage" class="typing">_</div>
        <pre v-else class="typed">{{ typedMessage }}</pre>
      </section>

      <footer class="panel-foot">
        <router-link to="/" class="back-link">⬅ Back to Feed</router-link>
      </footer>
    </div>
  </main>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();
const kudo = ref(null);
const typedMessage = ref("");

function getParamSlug() {
  // Be defensive: support /kudo/:slug and /kudo/:id
  return route.params.slug ?? route.params.id;
}

async function fetchKudo() {
  const slug = getParamSlug();
  if (!slug) {
    typedMessage.value = "💥 Missing kudo identifier in the URL.";
    return;
  }

  try {
    const res = await fetch(`/api/kudos/${slug}`);
    if (!res.ok) {
      typedMessage.value = "💥 Kudo moved or deleted.";
      return;
    }
    kudo.value = await res.json();
    typeOutMessage(kudo.value?.message || "(no message)");
  } catch (e) {
    console.error(e);
    typedMessage.value = "💥 Failed to load this kudo.";
  }
}

function typeOutMessage(text) {
  let i = 0;
  typedMessage.value = "";
  const interval = setInterval(() => {
    typedMessage.value = text.slice(0, i++);
    if (i > text.length) clearInterval(interval);
  }, 35);
}

function formatDate(dateStr) {
  if (!dateStr) return "unknown";
  return new Date(dateStr).toLocaleString();
}

onMounted(fetchKudo);
</script>

<style scoped>
.kudo-view {
  min-height: 100vh;
  padding: 3rem 1rem;
  display: grid;
  place-items: center;

  /* dim the background slightly */
  background:
    radial-gradient(1200px 700px at 50% -10%, color-mix(in srgb, var(--accent, #42cd42) 18%, transparent), transparent 60%),
    var(--bg);
}

/* Big glassy panel */
.panel {
  width: min(900px, 92vw);
  border-radius: 16px;
  border: 1px solid color-mix(in srgb, var(--accent, #42cd42) 35%, black);
  background:
    linear-gradient(180deg,
      color-mix(in srgb, #000 75%, var(--accent, #42cd42) 5%) 0%,
      color-mix(in srgb, #000 70%, var(--accent, #42cd42) 8%) 100%);
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--accent, #42cd42) 15%, transparent) inset,
    0 10px 30px rgba(0, 0, 0, 0.45),
    0 0 40px color-mix(in srgb, var(--accent, #42cd42) 25%, transparent);
  color: var(--text-primary, #e8e8f0);
  overflow: hidden;
}

/* Header bar */
.panel-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid color-mix(in srgb, var(--accent, #42cd42) 25%, black);
  background: linear-gradient(180deg,
    color-mix(in srgb, #111 90%, var(--accent, #42cd42) 6%),
    color-mix(in srgb, #090909 92%, var(--accent, #42cd42) 8%));
}
.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  box-shadow: 0 0 8px var(--accent, #42cd42), 0 0 2px var(--accent, #42cd42) inset;
  background: var(--accent, #42cd42);
}
.title {
  font-weight: 600;
  letter-spacing: 0.5px;
  color: var(--text-primary, #e8e8f0);
}

/* Meta */
.meta {
  display: grid;
  gap: 6px;
  padding: 14px 16px 8px;
  border-bottom: 1px dashed color-mix(in srgb, var(--accent, #42cd42) 25%, black);
  color: color-mix(in srgb, var(--text-primary, #e8e8f0) 85%, white 15%);
  font-size: 1.05rem;
}
.meta .row {
  display: flex;
  gap: 8px;
  align-items: baseline;
}
.meta b {
  color: var(--accent, #42cd42);
  text-shadow: 0 0 6px color-mix(in srgb, var(--accent, #42cd42) 60%, transparent);
}

/* Message area */
.message {
  padding: 18px 16px 10px 16px;
  min-height: 180px;
}

/* Typewriter caret */
.typing::after {
  content: "_";
  margin-left: 4px;
  color: var(--accent, #42cd42);
  animation: blink 1s step-start infinite;
}
@keyframes blink { 50% { opacity: 0; } }

/* Message text */
.typed {
  margin: 0;
  white-space: pre-wrap;
  color: color-mix(in srgb, var(--text-primary, #e8e8f0) 92%, var(--accent, #42cd42) 8%);
  text-shadow:
    0 0 4px color-mix(in srgb, var(--accent, #42cd42) 50%, transparent),
    0 0 14px color-mix(in srgb, var(--accent, #42cd42) 25%, transparent);
  line-height: 1.55;
  font-size: 1.2rem;
}

/* Footer */
.panel-foot {
  padding: 14px 16px 18px;
  display: flex;
  justify-content: flex-end;
}
.back-link {
  color: var(--accent, #42cd42);
  text-decoration: none;
  position: relative;
  font-weight: 500;
}
.back-link::after {
  content: "";
  position: absolute;
  left: 0; right: 0; bottom: -2px;
  height: 2px;
  background: linear-gradient(90deg,
    color-mix(in srgb, var(--accent, #42cd42) 0%, transparent),
    var(--accent, #42cd42),
    color-mix(in srgb, var(--accent, #42cd42) 0%, transparent));
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 220ms ease;
  border-radius: 2px;
  box-shadow: 0 0 6px var(--accent, #42cd42);
}
.back-link:hover::after { transform: scaleX(1); }
</style>
