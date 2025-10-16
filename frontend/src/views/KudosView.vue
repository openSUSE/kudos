<!--
Copyright © 2025–present Lubos Kocman, and openSUSE contributors
SPDX-License-Identifier: Apache-2.0
-->

<template>
  <div class="kudos container">
    <header>
      <h1>💚 All Kudos</h1>
      <p>Every thank-you shared across the openSUSE community — filter, browse, and celebrate!</p>
    </header>

    <!-- 🧭 Filter bar -->
    <div class="filters">
      <select v-model="category" @change="loadKudos">
        <option value="">All Categories</option>
        <option v-for="cat in categories" :key="cat.code" :value="cat.code">
          {{ cat.label }}
        </option>
      </select>

      <input v-model="filterFrom" @keyup.enter="loadKudos" placeholder="From user…" />
      <input v-model="filterTo" @keyup.enter="loadKudos" placeholder="To user…" />

      <button class="btn" @click="loadKudos">Filter</button>
    </div>

    <!-- 📦 Kudos table -->
    <div class="board">
      <div class="row header">
        <div>#</div>
        <div>From</div>
        <div>To</div>
        <div>Category</div>
        <div>Message</div>
      </div>

      <div v-for="(k, i) in kudos" :key="k.id" class="row">
        <div>{{ (page - 1) * limit + i + 1 }}</div>

        <div class="from">
          <img :src="k.fromUser.avatarUrl" alt="" class="avatar-small" />
          <router-link :to="`/users/${k.fromUser.username}`">
            {{ k.fromUser.username }}
          </router-link>
        </div>

        <div class="to">
          <img :src="k.recipients[0].user.avatarUrl" alt="" class="avatar-small" />
          <router-link :to="`/users/${k.recipients[0].user.username}`">
            {{ k.recipients[0].user.username }}
          </router-link>
        </div>

        <div class="category">{{ k.category.icon }} {{ k.category.label }}</div>

        <div class="message">{{ k.message }}</div>
      </div>
    </div>

    <!-- 📑 Pagination controls -->
    <div class="pagination">
      <button class="btn" :disabled="page <= 1" @click="prevPage">← Prev</button>
      <span>Page {{ page }} of {{ totalPages }}</span>
      <button class="btn" :disabled="page >= totalPages" @click="nextPage">Next →</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";

const kudos = ref([]);
const page = ref(1);
const totalPages = ref(1);
const limit = 50;

const category = ref("");
const categories = ref([]);
const filterFrom = ref("");
const filterTo = ref("");

// Load categories (for dropdown)
async function loadCategories() {
  const res = await fetch("/api/kudos/categories"); // or a new /api/kudos/categories route
  if (res.ok) categories.value = await res.json();
}

// Load kudos with filters
async function loadKudos() {
  const params = new URLSearchParams({
    page: page.value.toString(),
    limit: limit.toString(),
  });
  if (category.value) params.append("category", category.value);
  if (filterFrom.value) params.append("from", filterFrom.value);
  if (filterTo.value) params.append("to", filterTo.value);

  const res = await fetch(`/api/kudos?${params.toString()}`);
  const data = await res.json();
  kudos.value = data.kudos || data.items;
  totalPages.value = data.pages || Math.ceil(data.total / limit);
}

function nextPage() {
  if (page.value < totalPages.value) {
    page.value++;
    loadKudos();
  }
}

function prevPage() {
  if (page.value > 1) {
    page.value--;
    loadKudos();
  }
}

onMounted(() => {
  loadCategories();
  loadKudos();
});
</script>

<style scoped>
.kudos header {
  margin-bottom: 1rem;
}

.filters {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.filters select,
.filters input {
  background: var(--tile-bg);
  color: var(--text);
  border: 1px solid var(--divider);
  padding: 0.3rem 0.5rem;
  font-family: "VT323", monospace;
  font-size: 1rem;
}

.filters select:hover,
.filters input:focus {
  border-color: var(--geeko-green);
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.board .row.header {
  background: var(--panel-bg);
  font-weight: bold;
  border-bottom: 2px solid var(--divider);
}
</style>
