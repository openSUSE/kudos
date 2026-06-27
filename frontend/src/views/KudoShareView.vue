<!--
Copyright © 2025–present Lubos Kocman
and openSUSE contributors
SPDX-License-Identifier: Apache-2.0
-->

<template>
  <main class="certificate-container" v-if="kudo">
    <section class="certificate section-box">
      <img
        src="/logo-watermark.svg"
        :alt="t('kudo_print.watermark_alt')"
        class="watermark"
      />

      <header class="header">
        <img
          :src="getAvatarUrl(kudo.fromUser)"
          :alt="kudo.fromUser.username"
          class="avatar"
        />
        <h1>{{ t('kudo_print.certificate_title') }}</h1>
        <p class="subtitle">
          {{ t('kudo_print.certifies_that') }}
          <strong>{{ recipientHandles }}</strong>
          <br />
          {{ t('kudo_print.received_kudos_from') }}
          <strong>@{{ kudo.fromUser.username }}</strong>
        </p>
      </header>

      <section class="message">
        <blockquote>{{ kudo.message }}</blockquote>
      </section>

      <section class="meta">
        <p>
          {{ t('kudo_print.category') }}
          {{ kudo.category?.label || t('kudo_print.general_category') }}
        </p>
        <p>{{ t('kudo_print.sent_on') }} {{ formatDate(kudo.createdAt) }}</p>
      </section>

      <footer class="footer">
        <p>{{ t('kudo_print.footer_title') }}</p>
        <p class="small">https://kudos.opensuse.org/kudo/{{ kudo.slug }}</p>

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

        <RouterLink :to="`/kudo/${kudo.slug}`" class="back-link">
          ← {{ t('kudo_view.back_to_kudos') }}
        </RouterLink>
      </footer>
    </section>
  </main>
</template>

<script setup>
import { computed, onMounted, ref } from "vue"
import { useI18n } from "vue-i18n"
import { RouterLink, useRoute } from "vue-router"
import { getAvatarUrl } from "../utils/user.js"

const { t } = useI18n()
const route = useRoute()
const kudo = ref(null)

const recipientHandles = computed(() => {
  const usernames = kudo.value?.recipients
    ?.map((recipient) => recipient.user?.username)
    .filter(Boolean) ?? []

  return usernames.map((username) => `@${username}`).join(", ")
})

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString([], { dateStyle: "medium" })
}

async function fetchKudo() {
  const slug = route.params.slug
  const res = await fetch(`/api/kudos/${slug}`)
  if (res.ok) {
    kudo.value = await res.json()
  }
}

function copyShareLink() {
  navigator.clipboard.writeText(`${window.location.origin}/kudo/${kudo.value.slug}/share`)
  alert(t("kudo_print.copy_link_alert"))
}

const shareText = computed(() =>
  encodeURIComponent(
    t("kudo_print.share_text", {
      fromUser: kudo.value?.fromUser.username,
      toUser: recipientHandles.value,
      message: kudo.value?.message,
    })
  )
)

const shareUrl = computed(() =>
  encodeURIComponent(`${window.location.origin}/kudo/${kudo.value?.slug}/share`)
)

const linkedinShareUrl = computed(() =>
  `https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl.value}`
)

const mastodonShareUrl = computed(() =>
  `https://mastodon.social/share?text=${shareText.value}%20${shareUrl.value}`
)

onMounted(fetchKudo)
</script>

<style scoped>
.certificate-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 2rem;
  color: var(--text-primary);
}

.certificate {
  position: relative;
  width: min(100%, 900px);
  overflow: hidden;
  text-align: center;
  padding: 2.5rem;
}

.watermark {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  opacity: 0.06;
  pointer-events: none;
}

.header,
.message,
.meta,
.footer {
  position: relative;
  z-index: 1;
}

.header {
  margin-bottom: 2rem;
}

.avatar {
  width: 110px;
  height: 110px;
  border-radius: 50%;
  border: 3px solid var(--geeko-green);
  object-fit: cover;
  image-rendering: pixelated;
  margin-bottom: 1rem;
}

h1 {
  margin: 0 0 0.4rem;
}

.subtitle {
  line-height: 1.6;
  font-size: 1.05rem;
}

.message {
  margin: 2rem 0;
}

blockquote {
  margin: 0;
  padding: 1.5rem;
  border-left: 4px solid var(--geeko-green);
  background: color-mix(in srgb, var(--card-bg) 88%, white 12%);
  font-size: 1.2rem;
  line-height: 1.6;
}

.meta {
  color: var(--text-secondary);
}

.small {
  font-size: 0.95rem;
  word-break: break-all;
}

.actions {
  margin-top: 1rem;
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.btn {
  background: var(--geeko-green);
  color: black;
  border: none;
  border-radius: 6px;
  padding: 0.5rem 0.8rem;
  cursor: pointer;
  text-decoration: none;
  font-family: "Pixel Operator Bold", monospace;
  transition: background 0.2s ease;
}

.btn:hover {
  background: #70e570;
}

.back-link {
  display: inline-block;
  margin-top: 1.2rem;
  color: var(--butterfly-blue);
  text-decoration: none;
}

.back-link:hover {
  color: var(--geeko-green);
}

@media print {
  .actions,
  .back-link {
    display: none;
  }

  .certificate-container {
    padding: 0;
    min-height: auto;
  }

  .certificate {
    width: 100%;
    box-shadow: none;
    border: none;
  }
}

@media (max-width: 720px) {
  .certificate-container {
    padding: 1rem;
  }

  .certificate {
    padding: 1.4rem;
  }

  blockquote {
    font-size: 1rem;
  }
}
</style>
