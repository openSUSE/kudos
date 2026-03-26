<!--
Copyright © 2025–present Lubos Kocman
and openSUSE contributors
SPDX-License-Identifier: Apache-2.0
-->

<template>
  <main class="share-view" v-if="kudo">
    <section class="share-card section-box">
      <p class="eyebrow">openSUSE Kudos Share</p>
      <!--
      <h1>@{{ kudo.fromUser.username }} → @{{ kudo.recipients[0]?.user.username }}</h1>
      <p class="summary">
        {{ kudo.category?.label || t('kudo_print.general_category') }} · {{ formatDate(kudo.createdAt) }}
      </p>
      -->
      <p class="hint">Preview shown at native width. Scroll horizontally on smaller screens.</p>

      <div class="preview-scroll">
        <a class="preview-frame" :href="imageDownloadUrl" target="_blank" rel="noopener">
          <img :src="imageDownloadUrl" :alt="shareTitle" class="preview-image" />
        </a>
      </div>

      <div class="actions">
        <button class="btn btn-primary" @click="copyShareLink">
          {{ t('kudo_print.copy_share_link') }}
        </button>
        <a class="btn" :href="permalinkUrl">
          Open recognition
        </a>
        <a class="btn" :href="linkedinShareUrl" target="_blank" rel="noopener">
          {{ t('kudo_print.share_on_linkedin') }}
        </a>
        <a class="btn" :href="mastodonShareUrl" target="_blank" rel="noopener">
          {{ t('kudo_print.share_on_mastodon') }}
        </a>
        <a class="btn" :href="xShareUrl" target="_blank" rel="noopener">
          Share on X
        </a>
        <a class="btn" :href="imageDownloadUrl" target="_blank" rel="noopener">
          Download share image
        </a>
      </div>
    </section>
  </main>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { ref, onMounted, computed } from "vue"
import { useRoute } from "vue-router"

const { t } = useI18n();
const route = useRoute()
const kudo = ref(null)

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString([], { dateStyle: "medium" })
}

onMounted(async () => {
  const slug = route.params.slug
  const res = await fetch(`/api/kudos/${slug}`)
  if (res.ok) {
    kudo.value = await res.json()
  }
})

function copyShareLink() {
  navigator.clipboard.writeText(sharePageUrl.value)
  alert(t('kudo_print.copy_link_alert') + ' ✅');
}

const shareTitle = computed(() =>
  `${kudo.value?.fromUser.username} sent kudos to ${kudo.value?.recipients[0]?.user.username}`
)

const shareText = computed(() =>
  encodeURIComponent(
    t('kudo_print.share_text', {
      fromUser: kudo.value?.fromUser.username,
      toUser: kudo.value?.recipients[0]?.user.username,
      message: kudo.value?.message,
    })
  )
)

const permalinkUrl = computed(() => `${window.location.origin}/kudo/${kudo.value?.slug}`)
const sharePageUrl = computed(() => `${window.location.origin}/kudo/${kudo.value?.slug}/share`)
const encodedSharePageUrl = computed(() => encodeURIComponent(sharePageUrl.value))

const imageDownloadUrl = computed(() => `${window.location.origin}/api/kudos/${kudo.value?.slug}/image`)

const linkedinShareUrl = computed(() =>
  `https://www.linkedin.com/sharing/share-offsite/?url=${encodedSharePageUrl.value}`
)

const mastodonShareUrl = computed(() =>
  `https://mastodon.social/share?text=${shareText.value}%20${encodedSharePageUrl.value}`
)

const xShareUrl = computed(() =>
  `https://x.com/intent/post?text=${shareText.value}&url=${encodedSharePageUrl.value}`
)
</script>

<style scoped>
.share-view {
  display: flex;
  justify-content: center;
  padding: 2rem;
}

.share-card {
  max-width: min(1280px, 100%);
  width: 100%;
  text-align: center;
}

.eyebrow {
  margin: 0;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

h1 {
  margin: 0.35rem 0 0;
  font-size: clamp(2rem, 5vw, 3.6rem);
  line-height: 0.95;
}

.summary {
  margin: 0.75rem 0 1.5rem;
  color: var(--text-secondary);
}

.hint {
  margin: 0 0 0.8rem;
  color: var(--text-muted);
  font-family: "Source Sans Pro", sans-serif;
}

.preview-scroll {
  display: flex;
  justify-content: center;
  overflow-x: auto;
  padding-bottom: 0.6rem;
  scrollbar-width: thin;
  scrollbar-color: var(--accent, var(--geeko-green)) transparent;
}

.preview-frame {
  display: inline-block;
  max-width: none;
  overflow: hidden;
  border-radius: 18px;
  border: 1px solid var(--card-border);
  background: var(--card-bg);
  box-shadow: 0 20px 40px color-mix(in srgb, var(--bg) 72%, black 28%);
}

.preview-image {
  display: block;
  width: auto;
  height: auto;
}

.message {
  margin: 1.2rem auto 0;
  max-width: 52rem;
  color: var(--text-primary);
  font-size: 1.2rem;
}

.link-text {
  margin: 0.9rem 0 0;
  color: var(--text-muted);
  word-break: break-all;
}

.actions {
  margin-top: 1.3rem;
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.65rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.6rem;
  padding: 0.45rem 1rem;
  border-radius: 999px;
  border: 1px solid var(--card-border);
  background: color-mix(in srgb, var(--card-bg) 88%, var(--bg) 12%);
  color: var(--text-primary);
  text-decoration: none;
  cursor: pointer;
  font-family: "Pixel Operator", monospace;
  font-size: 1rem;
}

.btn-primary {
  background: var(--accent, var(--geeko-green));
  border-color: transparent;
  color: color-mix(in srgb, var(--bg) 22%, white 78%);
}

.btn:hover {
  border-color: var(--accent, var(--geeko-green));
}

@media (max-width: 720px) {
  .share-view {
    padding: 1rem;
  }

  .share-card {
    padding: 1.25rem;
  }
}
</style>
