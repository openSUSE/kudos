<!--
Copyright © 2025–present Lubos Kocman
and openSUSE contributors
SPDX-License-Identifier: Apache-2.0
-->

<template>
  <main class="share-view" v-if="slug">
    <section class="image-shell">
      <img :src="imageUrl" alt="Kudos share card" class="preview-image" />
    </section>
  </main>
</template>

<script setup>
import { computed } from "vue"
import { useRoute } from "vue-router"

const route = useRoute()
const slug = computed(() => route.params.slug)
const imageUrl = computed(() => `${window.location.origin}/api/kudos/${slug.value}/image`)
</script>

<style scoped>
.share-view {
  display: flex;
  justify-content: center;
  padding: 1.5rem;
}

.image-shell {
  width: min(100%, 800px);
  overflow: hidden;
  border: 1px solid var(--card-border);
  background: var(--card-bg);
  box-shadow: 0 20px 40px color-mix(in srgb, var(--bg) 72%, black 28%);
}

.preview-image {
  display: block;
  width: 100%;
  max-width: 800px;
  height: auto;
}

@media (max-width: 720px) {
  .share-view {
    padding: 0.9rem;
  }
}
</style>
