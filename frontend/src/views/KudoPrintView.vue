<!--
Copyright © 2025–present Lubos Kocman
and openSUSE contributors
SPDX-License-Identifier: Apache-2.0
-->

<template>
  <div class="certificate-container" v-if="kudo">
    <div class="certificate">
      <!-- 🦎 Watermark -->
      <img
        src="/logo-watermark.svg"
        :alt="t('kudo_print.watermark_alt')"
        class="watermark"
      />

      <!-- 👤 Header -->
      <header class="header">
        <img
          :src="getAvatarUrl(kudo.fromUser)"
          :alt="kudo.fromUser.username"
          class="avatar"
        />
        <h1>{{ t('kudo_print.certificate_title') }}</h1>
        <p class="subtitle">
          {{ t('kudo_print.certifies_that') }}
          <strong>@{{ kudo.recipients[0]?.user.username }}</strong>
          <br />
          {{ t('kudo_print.received_kudos_from') }}
          <strong>@{{ kudo.fromUser.username }}</strong>
        </p>
      </header>

      <!-- 💬 Message -->
      <main class="message">
        <blockquote>{{ kudo.message }}</blockquote>
      </main>

      <!-- 🏷️ Category + Date -->
      <section class="meta">
        <p>
          {{ t('kudo_print.category') }}
          {{ kudo.category?.label || t('kudo_print.general_category') }}
        </p>
        <p>{{ t('kudo_print.sent_on') }} {{ formatDate(kudo.createdAt) }}</p>
      </section>

      <!-- 💚 Footer -->
      <footer class="footer">
        <p>{{ t('kudo_print.footer_title') }}</p>
        <p class="small">
          https://kudos.opensuse.org/kudo/{{ kudo.slug }}
        </p>

        <div class="actions">
          <button class="btn" @click="copyShareLink">
            {{ t('kudo_print.copy_share_link') }}
          </button>

          <a
            class="btn"
            :href="linkedinShareUrl"
            target="_blank"
            rel="noopener"
          >
            {{ t('kudo_print.share_on_linkedin') }}
          </a>

          <a
            class="btn"
            :href="mastodonShareUrl"
            target="_blank"
            rel="noopener"
          >
            {{ t('kudo_print.share_on_mastodon') }}
          </a>
        </div>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { ref, onMounted, computed } from "vue"
import { useRoute } from "vue-router"
import { getAvatarUrl } from "../utils/user.js"

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
  const shareUrl = `${window.location.origin}/kudo/${kudo.value.slug}`
  navigator.clipboard.writeText(shareUrl)
  alert(t('kudo_print.copy_link_alert'))
}

const shareText = computed(() =>
  encodeURIComponent(
    t('kudo_print.share_text', {
      fromUser: kudo.value?.fromUser.username,
      toUser: kudo.value?.recipients[0]?.user.username,
      message: kudo.value?.message,
    })
  )
)

const shareUrl = computed(() =>
  encodeURIComponent(`${window.location.origin}/kudo/${kudo.value?.slug}`)
)

const linkedinShareUrl = computed(() =>
  `https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl.value}`
)

const mastodonShareUrl = computed(() =>
  `https://mastodon.social/share?text=${shareText.value}%20${shareUrl.value}`
)
</script>

<style scoped>
.actions {
  margin-top: 1rem;
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.btn {
  background: #42cd42;
  color: black;
  border: none;
  border-radius: 6px;
  padding: 0.4rem 0.8rem;
  cursor: pointer;
  font-family: "Pixel Operator Bold", monospace;
  transition: background 0.2s ease;
}

.btn:hover {
  background: #70e570;
}

.certificate-container {
  display: flex;
  justify-content: center;
  align-items: center;
  background: white;
  color: #111;
  min-height: 100vh;
  padding: 2rem;
  font-family: "Pixel Operator", monospace;
}

/*───────────────────────────────────────────────────────────────
 📜 Certificate Frame
───────────────────────────────────────────────────────────────*/
.certificate {
  position: relative;
  background: #fdfdfd;
  border: 6px double #42cd42;
  border-radius: 20px;
  padding: 2.5rem;
  width: 900px;
  max-width: 100%;
  box-shadow: 0 0 25px rgba(0, 255, 100, 0.25);
  text-align: center;
  overflow: hidden;
}

/* 🦎 Watermark */
.watermark {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0.07;
  object-fit: contain;
  pointer-events: none;
  filter: grayscale(100%);
  z-index: 0;
}

/*───────────────────────────────────────────────────────────────
 👤 Header
───────────────────────────────────────────────────────────────*/
.header {
  position: relative;
  z-index: 1;
  margin-bottom: 2rem;
}

.avatar {
  width: 110px;
  height: 110px;
  border-radius: 50%;
  border: 3px solid #42cd42;
  object-fit: cover;
  image-rendering: pixelated;
  margin-bottom: 1rem;
}

h1 {
  color: #222;
  font-size: 1.8rem;
  margin-bottom: 0.4rem;
  letter-spacing: 1px;
}

.subtitle {
  color: #333;
  font-size: 1.1rem;
  line-height: 1.5;
}

/*───────────────────────────────────────────────────────────────
 💬 Message Block
───────────────────────────────────────────────────────────────*/
.message {
  position: relative;
  z-index: 1;
  background: #fff;
  border: 1px solid #b4eeb4;
  border-radius: 12px;
  padding: 1.5rem;
  margin: 1.5rem 0;
  box-shadow: inset 0 0 8px rgba(0, 255, 100, 0.1);
}

blockquote {
  font-size: 1.2rem;
  color: #222;
  line-height: 1.6;
  font-style: italic;
  margin: 0;
}

/*───────────────────────────────────────────────────────────────
 🏷️ Metadata
───────────────────────────────────────────────────────────────*/
.meta {
  color: #444;
  font-size: 1rem;
  margin-bottom: 1rem;
}

/*───────────────────────────────────────────────────────────────
 💚 Footer
───────────────────────────────────────────────────────────────*/
.footer {
  border-top: 1px solid #ccc;
  padding-top: 0.8rem;
  font-size: 0.95rem;
  color: #222;
}

.footer .small {
  font-size: 0.8rem;
  color: #555;
}

/*───────────────────────────────────────────────────────────────
 🖨️ Print optimization
───────────────────────────────────────────────────────────────*/
@media print {
  body {
    background: white !important;
  }
  .certificate-container {
    padding: 0;
  }
  .certificate {
    box-shadow: none;
    border-color: #000;
  }
}
</style>
