<!--
Copyright © 2025–present Lubos Kocman
and openSUSE contributors
SPDX-License-Identifier: Apache-2.0
-->

<template>
  <main class="share-view">
    <section v-if="loading" class="loading section-box">
      <p>{{ t('kudo_view.loading') }}</p>
    </section>

    <section v-else-if="kudo" class="share-shell">
      <section class="image-shell">
        <img :src="imageUrl" :alt="imageAlt" class="preview-image" />
      </section>

      <div class="actions section-box">
        <p class="share-title">{{ t('kudo_view.share_moment') }}</p>
        <div class="action-grid">
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
      </div>

      <div class="footer">
        <RouterLink to="/kudos" class="back-link">
          ← {{ t('kudo_view.back_to_kudos') }}
        </RouterLink>
      </div>
    </section>

    <section v-else class="loading section-box">
      <p>{{ t('kudo_view.failed_to_load') }}</p>
      <div class="footer">
        <RouterLink to="/kudos" class="back-link">
          ← {{ t('kudo_view.back_to_kudos') }}
        </RouterLink>
      </div>
    </section>
  </main>
</template>

<script setup>
import { computed, onMounted, ref } from "vue"
import { useI18n } from "vue-i18n"
import { RouterLink, useRoute } from "vue-router"

const { t } = useI18n()
const route = useRoute()
const kudo = ref(null)
const loading = ref(true)

const slug = computed(() => route.params.slug ?? route.params.id)
const imageUrl = computed(() => `${window.location.origin}/api/kudos/${slug.value}/image`)
const sharePageUrl = computed(() => `${window.location.origin}/kudo/${slug.value}`)
const encodedSharePageUrl = computed(() => encodeURIComponent(sharePageUrl.value))

const recipientHandles = computed(() => {
  const usernames = kudo.value?.recipients
    ?.map((recipient) => recipient.user?.username)
    .filter(Boolean) ?? []

  return usernames.map((username) => `@${username}`).join(", ")
})

const shareTextRaw = computed(() =>
  t("kudo_print.share_text", {
    fromUser: kudo.value?.fromUser?.username,
    toUser: recipientHandles.value,
    message: kudo.value?.message,
  })
)

const shareText = computed(() =>
  encodeURIComponent(shareTextRaw.value)
)

const imageAlt = computed(() => shareTextRaw.value)

const socialIconUrl = (fileName) => `${import.meta.env.BASE_URL}social/${fileName}`

const linkedinShareUrl = computed(() =>
  `https://www.linkedin.com/sharing/share-offsite/?url=${encodedSharePageUrl.value}`
)

const fosstodonShareUrl = computed(() =>
  `https://fosstodon.org/share?text=${shareText.value}%20${encodedSharePageUrl.value}`
)

const matrixRoomUrl = computed(() => "https://matrix.to/#/#chat:opensuse.org")

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

async function fetchKudo() {
  try {
    const res = await fetch(`/api/kudos/${slug.value}`)
    if (!res.ok) throw new Error(t("kudo_view.failed_to_load"))
    kudo.value = await res.json()
  } finally {
    loading.value = false
  }
}

function copyShareLink() {
  navigator.clipboard.writeText(sharePageUrl.value)
  alert(`${t("kudo_print.copy_link_alert").trim()} ✅`)
}

async function shareToMatrix() {
  const message = `${decodeURIComponent(shareText.value)} ${sharePageUrl.value}`

  try {
    await navigator.clipboard.writeText(message)
    alert("Matrix message copied to clipboard ✅")
  } catch {
    alert("Could not copy the Matrix message automatically. Please copy manually.")
  }

  window.open(matrixRoomUrl.value, "_blank", "noopener,noreferrer")
}

onMounted(fetchKudo)
</script>

<style scoped>
.share-view {
  display: flex;
  justify-content: center;
  padding: 1.5rem;
}

.share-shell,
.loading {
  width: min(100%, 900px);
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
  height: auto;
}

.actions {
  margin-top: 1rem;
  padding: 1rem;
}

.share-title {
  margin: 0 0 1rem;
  text-align: center;
}

.action-grid {
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
  padding: 0.5rem 0.6rem;
  font-family: "Pixel Operator", monospace;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 1rem;
}

.btn-icon-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  min-width: 88px;
}

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

.btn:hover {
  background: var(--geeko-green);
  color: black;
}

.btn:hover span {
  color: black;
}

.btn:hover img {
  opacity: 0.8;
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

  .action-grid {
    gap: 0.6rem;
  }

  .btn-icon-label {
    min-width: 78px;
  }
}
</style>

