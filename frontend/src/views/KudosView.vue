<!--
Copyright © 2025–present Lubos Kocman,
and openSUSE contributors
SPDX-License-Identifier: Apache-2.0
-->

<template>
  <div class="kudos container">
    <header>
      <h1 class="kudos-title">
        💚 All Kudos
        <span class="arrow-prompt" aria-hidden="true">&gt;&gt;&gt;</span>
      </h1>
      <p class="subtitle">
        Every thank-you ever shared in the openSUSE community — live, heartfelt, and forever Geeko.
      </p>
    </header>

    <!-- 🔔 New kudos banner -->
    <transition name="fade">
      <div v-if="hasNewKudos" class="new-kudos-banner" @click="refreshFeed">
        💚 New kudos just arrived — click to refresh!
      </div>
    </transition>

    <!-- 🧭 Filter toggle -->
    <button class="toggle-filter" @click="showFilters = !showFilters">
      🔍 {{ showFilters ? "Hide Filters" : "Show Filters" }}
    </button>

    <!-- 🧭 Filter bar -->
    <div v-if="showFilters" class="filters">
      <select v-model="category" @change="reload">
        <option value="">All Categories</option>
        <option v-for="cat in categories" :key="cat.code" :value="cat.code">
          {{ cat.label }}
        </option>
      </select>

      <input v-model="filterFrom" @keyup.enter="reload" placeholder="From user…" />
      <input v-model="filterTo" @keyup.enter="reload" placeholder="To user…" />

      <button class="btn" @click="reload">Filter</button>
    </div>

    <!-- 💚 Kudos Feed -->
    <section class="section-box flicker">
      <div v-if="kudos.length" class="kudos-feed">
        <router-link
          v-for="(k, i) in kudos"
          :key="k.id"
          class="kudo-line"
          :to="`/kudo/${k.slug}`"
        >
          <span class="icon">{{ k.category?.icon || "💚" }}</span>
          <span class="user">@{{ k.fromUser.username }}</span>
          →
          <span class="user">@{{ k.recipients[0]?.user.username }}</span>
          <span class="message">"{{ k.message }}"</span>
          <span class="timestamp">{{ formatTime(k.createdAt) }}</span>
        </router-link>
      </div>

      <div v-else class="quiet">
        <p>🦎 It’s quiet in Geeko Land… send some kudos!</p>
      </div>
    </section>

    <!-- 🪩 Load More -->
    <div class="load-more" v-if="!endOfFeed">
      <button class="btn-glow" @click="loadMore">→ Load More Kudos</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";

const kudos = ref([]);
const categories = ref([]);
const category = ref("");
const filterFrom = ref("");
const filterTo = ref("");
const showFilters = ref(false);

const limit = 50;
const offset = ref(0);
const endOfFeed = ref(false);

const hasNewKudos = ref(false);
let autoRefreshTimer = null;
let lastTimestamp = null;

function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

async function loadCategories() {
  const res = await fetch("/api/kudos/categories");
  if (res.ok) categories.value = await res.json();
}

async function loadKudos(reset = false) {
  const params = new URLSearchParams({
    page: Math.floor(offset.value / limit) + 1,
    limit: limit.toString(),
  });
  if (category.value) params.append("category", category.value);
  if (filterFrom.value) params.append("from", filterFrom.value);
  if (filterTo.value) params.append("to", filterTo.value);

  const res = await fetch(`/api/kudos?${params.toString()}`);
  const data = await res.json();
  const items = data.kudos || data.items || [];

  if (reset) kudos.value = [];
  kudos.value.push(...items);

  if (items.length < limit) endOfFeed.value = true;
  if (kudos.value.length) {
    lastTimestamp = new Date(kudos.value[0].createdAt);
  }
}

function loadMore() {
  offset.value += limit;
  loadKudos();
}

async function checkForNewKudos() {
  try {
    const res = await fetch(`/api/kudos?page=1&limit=5`);
    if (!res.ok) return;
    const data = await res.json();
    const latest = data.kudos?.[0];
    if (latest && new Date(latest.createdAt) > lastTimestamp) {
      hasNewKudos.value = true;
    }
  } catch (e) {
    console.error("💥 Failed to check for new kudos:", e);
  }
}

function refreshFeed() {
  offset.value = 0;
  endOfFeed.value = false;
  hasNewKudos.value = false;
  loadKudos(true);
}

function reload() {
  offset.value = 0;
  endOfFeed.value = false;
  loadKudos(true);
}

onMounted(() => {
  loadCategories();
  loadKudos(true);
  autoRefreshTimer = setInterval(checkForNewKudos, 30000);
});

onUnmounted(() => {
  if (autoRefreshTimer) clearInterval(autoRefreshTimer);
});
</script>

<style scoped>
.kudos-title {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-family: "Pixel Operator Bold", monospace;
  color: var(--geeko-green);
  text-shadow: 0 0 8px rgba(0, 255, 100, 0.4);
}

.arrow-prompt {
  display: inline-block;
  font-size: 1.2rem;
  letter-spacing: 2px;
  animation: arrow-sweep 1.6s infinite steps(4, start);
}
@keyframes arrow-sweep {
  0%   { opacity: 0.3; transform: translateX(-5px); }
  20%  { opacity: 1; transform: translateX(0); }
  60%  { opacity: 0.7; transform: translateX(5px); }
  100% { opacity: 0.3; transform: translateX(-5px); }
}

.subtitle {
  font-family: "Pixel Operator", monospace;
  color: #b4ffb4;
  margin-top: 0.25rem;
  margin-bottom: 1.5rem;
}

/* New kudos banner */
.new-kudos-banner {
  background: var(--geeko-green);
  color: black;
  font-family: "Pixel Operator Bold", monospace;
  text-align: center;
  padding: 0.5rem;
  border-radius: 8px;
  margin-bottom: 1rem;
  cursor: pointer;
  animation: glow 1.6s infinite alternate;
}
@keyframes glow {
  from { box-shadow: 0 0 4px var(--geeko-green); }
  to { box-shadow: 0 0 12px rgba(0,255,128,0.8); }
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.4s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.toggle-filter {
  font-family: "Pixel Operator", monospace;
  color: var(--geeko-green);
  background: transparent;
  border: 1px dashed var(--geeko-green);
  padding: 0.4rem 0.8rem;
  margin-bottom: 0.5rem;
  border-radius: 6px;
  cursor: pointer;
}
.toggle-filter:hover {
  background: var(--geeko-green);
  color: black;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}
.filters select,
.filters input {
  background: var(--card-bg);
  color: var(--text-primary);
  border: 1px solid var(--card-border);
  padding: 0.3rem 0.5rem;
  font-family: "Pixel Operator", monospace;
  font-size: 1rem;
  border-radius: 6px;
}
.filters select:hover,
.filters input:focus {
  border-color: var(--geeko-green);
}

.kudos-feed {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-top: 1rem;
}
.kudo-line {
  font-family: "Pixel Operator", monospace;
  color: #b4ffb4;
  text-decoration: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  border-bottom: 1px solid rgba(0,255,0,0.05);
  transition: color 0.2s ease;
}
.kudo-line:hover { color: #9cff9c; }

.icon { margin-right: 0.4rem; }
.user { color: var(--geeko-green); margin-right: 0.4rem; }
.timestamp { opacity: 0.6; font-size: 0.9rem; }

.load-more {
  text-align: center;
  margin-top: 1.5rem;
}
.btn-glow {
  font-family: "Pixel Operator Bold", monospace;
  border: 2px dashed var(--geeko-green);
  color: var(--geeko-green);
  background: transparent;
  padding: 0.6rem 1.4rem;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.btn-glow:hover {
  background: var(--geeko-green);
  color: black;
  box-shadow: 0 0 12px rgba(0,255,128,0.6);
}

.flicker {
  position: relative;
  animation: flicker 2.5s infinite steps(2, start);
}
@keyframes flicker {
  0%, 19%, 21%, 23%, 25%, 54%, 56%, 100% { opacity: 1; }
  20%, 24%, 55% { opacity: 0.9; }
}
</style>
