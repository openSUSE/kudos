<!--
Copyright © 2025–present Lubos Kocman
and openSUSE contributors
SPDX-License-Identifier: Apache-2.0
-->

<template>
  <main class="kudo-view">
    <section v-if="loading" class="loading">
      <p>Loading kudo...</p>
    </section>

    <section v-else class="kudo-section section-box">
      <!-- 👥 Intro -->
      <div class="intro">
        <img
          :src="getAvatarUrl(kudo.fromUser)"
          :alt="kudo.fromUser.username"
          class="avatar-large"
        />
        <h1 class="intro-text">
          <template v-if="isRecipient">
            <router-link :to="`/user/${kudo.fromUser.username}`" class="link">
              @{{ kudo.fromUser.username }}
            </router-link>
            thinks you’re special and sent you kudos!
          </template>
          <template v-else>
            <router-link :to="`/user/${kudo.fromUser.username}`" class="link">
              @{{ kudo.fromUser.username }}
            </router-link>
            sent kudos to
            <router-link
              :to="`/user/${kudo.recipients[0]?.user.username}`"
              class="link"
            >
              @{{ kudo.recipients[0]?.user.username }}
            </router-link>
            💚
          </template>
        </h1>
      </div>

      <!-- 🏷️ Category -->
      <p class="category">
        <strong>Category:</strong>
        <span>{{ kudo.category?.label || kudo.category?.code || "General" }}</span>
      </p>

      <!-- 💬 Message -->
      <div class="message-box">
        <p v-if="typedMessage" class="typed">{{ typedMessage }}</p>
        <span v-else class="typing-cursor">_</span>
      </div>

      <!-- 🕓 Metadata -->
      <p class="timestamp">
        Sent on {{ formatDate(kudo.createdAt) }}
      </p>

      <!-- 🌐 Share section -->
      <div class="share">
        <p>✨ Share this moment with others:</p>
        <div class="share-buttons">
          <button @click="copyPermalink" class="btn-copy">📋 Copy Permalink</button>
          <router-link
            :to="`/kudo/${kudo.slug}/print`"
            class="btn-print"
          >
            🖨️ Print View
          </router-link>
        </div>
        <p v-if="copied" class="copied">✅ Permalink copied!</p>
      </div>

      <!-- 🔙 Back -->
      <div class="footer">
        <router-link to="/kudos" class="back-link">← Back to Kudos</router-link>
      </div>
    </section>
  </main>
</template>

<script setup>
import { ref, onMounted, computed } from "vue"
import { useRoute } from "vue-router"
import { getAvatarUrl } from "../utils/user.js"

const route = useRoute()
const kudo = ref(null)
const loading = ref(true)
const typedMessage = ref("")
const copied = ref(false)
const currentUser = JSON.parse(localStorage.getItem("user") || "{}")

const isRecipient = computed(() => {
  const recipient = kudo.value?.recipients?.[0]?.user?.username
  return recipient && currentUser?.username && recipient === currentUser.username
})

function formatDate(dateStr) {
  if (!dateStr) return "unknown"
  return new Date(dateStr).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
}

async function fetchKudo() {
  try {
    const slug = route.params.slug ?? route.params.id
    const res = await fetch(`/api/kudos/${slug}`)
    if (!res.ok) throw new Error("Kudo not found")
    kudo.value = await res.json()
    typeOutMessage(kudo.value.message)
  } catch (e) {
    typedMessage.value = "💥 Failed to load this kudo."
  } finally {
    loading.value = false
  }
}

function typeOutMessage(text) {
  let i = 0
  typedMessage.value = ""
  const interval = setInterval(() => {
    typedMessage.value = text.slice(0, i++)
    if (i > text.length) clearInterval(interval)
  }, 35)
}

function copyPermalink() {
  const permalink = `${window.location.origin}/kudo/${kudo.value.slug}`
  navigator.clipboard.writeText(permalink)
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}

onMounted(fetchKudo)
</script>

<style scoped>
.kudo-view {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 2rem;
  color: var(--text-primary);
  font-family: "Pixel Operator", monospace;
}

.loading {
  color: var(--geeko-green);
  font-size: 1.2rem;
  text-align: center;
}

.kudo-section {
  max-width: 800px;
  width: 100%;
  text-align: center;
  border-radius: 12px;
  padding: 2rem;
}

/*───────────────────────────────────────────────────────────────
 💚 Intro
───────────────────────────────────────────────────────────────*/
.intro {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 1rem;
}

.avatar-large {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  border: 2px solid var(--geeko-green);
  object-fit: cover;
  image-rendering: pixelated;
  margin-bottom: 0.8rem;
}

.intro-text {
  font-size: 1.3rem;
  color: var(--text-primary);
  max-width: 90%;
  line-height: 1.4;
}

.link {
  color: var(--geeko-green);
  text-decoration: none;
  transition: color 0.2s ease;
}

.link:hover {
  color: var(--butterfly-blue);
}

/*───────────────────────────────────────────────────────────────
 🏷️ Category
───────────────────────────────────────────────────────────────*/
.category {
  margin: 0.5rem 0 1.5rem;
  color: var(--text-secondary);
  font-size: 1rem;
}

/*───────────────────────────────────────────────────────────────
 💬 Message
───────────────────────────────────────────────────────────────*/
.message-box {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(0, 255, 100, 0.1);
  border-radius: 10px;
  padding: 1.5rem;
  color: var(--text-primary);
  font-size: 1.1rem;
  line-height: 1.6;
  white-space: pre-wrap;
  box-shadow: inset 0 0 8px rgba(0, 255, 128, 0.05);
  margin-bottom: 1rem;
}

.typed {
  animation: fadeIn 0.6s ease-in;
}

.typing-cursor {
  display: inline-block;
  color: var(--geeko-green);
  animation: blink 1s step-start infinite;
}
@keyframes blink {
  50% { opacity: 0; }
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

/*───────────────────────────────────────────────────────────────
 🕓 Timestamp
───────────────────────────────────────────────────────────────*/
.timestamp {
  margin-top: 0.3rem;
  font-size: 0.95rem;
  color: var(--text-secondary);
}

/*───────────────────────────────────────────────────────────────
 🌐 Share Section
───────────────────────────────────────────────────────────────*/
.share {
  margin-top: 1.5rem;
  text-align: center;
}

.share-buttons {
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-top: 0.5rem;
}

.btn-copy,
.btn-print {
  background: transparent;
  border: 1px dashed var(--geeko-green);
  color: var(--geeko-green);
  border-radius: 8px;
  padding: 0.4rem 0.8rem;
  font-family: "Pixel Operator", monospace;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-copy:hover,
.btn-print:hover {
  background: var(--geeko-green);
  color: black;
}

.copied {
  color: var(--geeko-green);
  margin-top: 0.4rem;
  font-size: 0.9rem;
}

/*───────────────────────────────────────────────────────────────
 🔙 Footer
───────────────────────────────────────────────────────────────*/
.footer {
  text-align: center;
  margin-top: 2rem;
}

.back-link {
  display: inline-block;
  color: var(--butterfly-blue);
  text-decoration: none;
  transition: color 0.2s ease;
}

.back-link:hover {
  color: var(--geeko-green);
}
</style>
