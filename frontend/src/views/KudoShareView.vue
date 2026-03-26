<!--
Copyright © 2025–present Lubos Kocman
and openSUSE contributors
SPDX-License-Identifier: Apache-2.0
-->

<template>
  <main class="share-view" v-if="slug">
    <section class="share-shell">
      <section class="image-shell">
        <img :src="imageUrl" alt="Kudos share card" class="preview-image" />
      </section>

      <div class="actions">
        <button class="btn btn-icon-label" @click="copyShareLink" title="Copy share link">
          <img :src="socialIconUrl('link.png')" alt="Copy link" />
          <span>Copy</span>
        </button>
        <a class="btn btn-icon-label" :href="linkedinShareUrl" target="_blank" rel="noopener" title="Share on LinkedIn">
          <img :src="socialIconUrl('linkedin.png')" alt="LinkedIn" />
          <span>LinkedIn</span>
        </a>
        <a class="btn btn-icon-label" :href="fosstodonShareUrl" target="_blank" rel="noopener" title="Share on Fosstodon">
          <img :src="socialIconUrl('fosstodon.png')" alt="Fosstodon" />
          <span>Fosstodon</span>
        </a>
        <button class="btn btn-icon-label" @click="shareToMatrix" title="Share to Matrix room">
          <img :src="socialIconUrl('matrix.png')" alt="Matrix" />
          <span>Matrix</span>
        </button>
        <a class="btn btn-icon-label" :href="xShareUrl" target="_blank" rel="noopener" title="Share on X">
          <img :src="socialIconUrl('x.png')" alt="X" />
          <span>X</span>
        </a>
        <a class="btn btn-icon-label" :href="telegramShareUrl" target="_blank" rel="noopener" title="Share on Telegram">
          <img :src="socialIconUrl('telegram.png')" alt="Telegram" />
          <span>Telegram</span>
        </a>
        <a class="btn btn-icon-label" :href="redditShareUrl" target="_blank" rel="noopener" title="Share on Reddit">
          <img :src="socialIconUrl('reddit.png')" alt="Reddit" />
          <span>Reddit</span>
        </a>
        <a class="btn btn-icon-label" :href="whatsappShareUrl" target="_blank" rel="noopener" title="Share on WhatsApp">
          <img :src="socialIconUrl('whatsapp.png')" alt="WhatsApp" />
          <span>WhatsApp</span>
        </a>
        <a class="btn btn-icon-label" :href="threadsShareUrl" target="_blank" rel="noopener" title="Share on Threads">
          <img :src="socialIconUrl('meta.png')" alt="Threads" />
          <span>Threads</span>
        </a>
      </div>

      <div class="footer">
        <RouterLink :to="`/kudo/${slug}`" class="back-link">
          ← Back
        </RouterLink>
      </div>
    </section>
  </main>
</template>

<script setup>
import { useI18n } from "vue-i18n"
import { computed } from "vue"
import { useRoute } from "vue-router"
import { RouterLink } from "vue-router"

const { t } = useI18n()
const route = useRoute()
const slug = computed(() => route.params.slug)
const socialIconUrl = (fileName) => `${import.meta.env.BASE_URL}social/${fileName}`
const imageUrl = computed(() => `${window.location.origin}/api/kudos/${slug.value}/image`)
const permalinkUrl = computed(() => `${window.location.origin}/kudo/${slug.value}`)
const sharePageUrl = computed(() => `${window.location.origin}/kudo/${slug.value}/share`)
const encodedSharePageUrl = computed(() => encodeURIComponent(sharePageUrl.value))

const shareText = computed(() =>
  encodeURIComponent("Hey, I just got kudos. Check it out! #openSUSE #KUDOS")
)

const linkedinShareUrl = computed(() =>
  `https://www.linkedin.com/sharing/share-offsite/?url=${encodedSharePageUrl.value}`
)

const fosstodonShareUrl = computed(() =>
  `https://fosstodon.org/share?text=${shareText.value}%20${encodedSharePageUrl.value}`
)

const matrixRoomUrl = computed(() =>
  "https://matrix.to/#/#chat:opensuse.org"
)

const xShareUrl = computed(() =>
  `https://x.com/intent/post?text=${shareText.value}&url=${encodedSharePageUrl.value}`
)

const telegramShareUrl = computed(() =>
  `https://t.me/share/url?url=${encodedSharePageUrl.value}&text=${shareText.value}`
)

const redditShareUrl = computed(() =>
  `https://reddit.com/submit?url=${encodedSharePageUrl.value}&title=${shareText.value}`
)

const whatsappShareUrl = computed(() =>
  `https://wa.me/?text=${shareText.value}%20${encodedSharePageUrl.value}`
)

const threadsShareUrl = computed(() =>
  `https://www.threads.net/intent/post?text=${shareText.value}%20${encodedSharePageUrl.value}`
)

function copyShareLink() {
  navigator.clipboard.writeText(sharePageUrl.value)
  alert(t('kudo_print.copy_link_alert') + ' ✅')
}

async function shareToMatrix() {
  const message = `Hey, I just got kudos. Check it out! #openSUSE #KUDOS ${sharePageUrl.value}`

  try {
    await navigator.clipboard.writeText(message)
    alert('Matrix message copied to clipboard ✅')
  } catch {
    alert('Could not copy the Matrix message automatically. Please copy manually.')
  }

  window.open(matrixRoomUrl.value, '_blank', 'noopener,noreferrer')
}
</script>

<style scoped>
.share-view {
  display: flex;
  justify-content: center;
  padding: 1.5rem;
}

.share-shell {
  width: min(100%, 800px);
}

.image-shell {
  width: 100%;
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

.actions {
  margin-top: 1.1rem;
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.btn {
  background: transparent;
  border: 1px dashed var(--geeko-green);
  color: var(--geeko-green);
  border-radius: 8px;
  padding: 0.4rem 0.8rem;
  font-family: "Pixel Operator", monospace;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 1rem;
}

.btn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
}

.btn-icon-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  width: auto;
  height: auto;
  padding: 0.5rem 0.6rem;
}

.btn-icon img,
.btn-icon-label img {
  width: 28px;
  height: 28px;
  object-fit: contain;
}

.btn-icon-label span {
  font-size: 0.75rem;
  line-height: 1;
  color: var(--geeko-green);
}

.btn-primary {
  background: transparent;
  border: 1px dashed var(--geeko-green);
  color: var(--geeko-green);
}

.btn:hover,
.btn-primary:hover,
.btn-icon-label:hover {
  background: var(--geeko-green);
  color: black;
}

.btn-icon:hover img,
.btn-icon-label:hover img {
  opacity: 0.8;
}

.btn-icon-label:hover span {
  color: black;
}

.footer {
  text-align: center;
  margin-top: 1.4rem;
}

.back-link {
  display: inline-block;
  color: var(--butterfly-blue);
  text-decoration: none;
  transition: color 0.2s ease;
  font-family: "Pixel Operator", monospace;
  font-size: 1rem;
}

.back-link:hover {
  color: var(--geeko-green);
}

@media (max-width: 720px) {
  .share-view {
    padding: 0.9rem;
  }
}
</style>
