<template>
  <main :class="['badge-terminal', { 'print-mode': printMode }]">
    <div v-if="loading" class="loading">> Connecting to GeekoDB...</div>

    <!-- 🖥️ Terminal Mode -->
    <div v-else-if="!printMode" class="badge-terminal-content">
      <div class="badge-miniature">
        <img :src="badge.picture" :alt="badge.title" />
      </div>

      <pre class="terminal-output" v-html="typedOutput"></pre>

      <div class="actions">
        <router-link to="/badges" class="back-link">← Back to Badges</router-link>
        <template v-if="ownsBadge">
          <button @click="togglePrintMode">🖨️ Print View</button>
          <button @click="saveAsImage">🖼️ Export JPEG</button>
        </template>
      </div>
    </div>

   <!-- 🏆 Printable Certificate -->
    <div v-else class="badge-certificate">
    <header class="certificate-header">
        <img src="/logo.svg" alt="openSUSE Kudos Logo" class="certificate-logo" />
    </header>

    <section class="certificate-body">
        <h2>Congratulations, {{ currentUser.username }}!</h2>
        <p class="subtitle">
        You have earned the <strong>{{ badge.title }}</strong> badge.
        </p>
        <p class="description">{{ badge.description }}</p>

        <img :src="badge.picture" :alt="badge.title" class="badge-large" />

        <p class="meta">
        Awarded for your contributions to the openSUSE community.<br />
        Badge color:
        <span :style="{ color: badge.color }">{{ badge.color }}</span>
        </p>

        <div class="qr">
        <img :src="qrUrl" alt="QR code" />
        <p>Scan to verify authenticity</p>
        </div>
    </section>

    <footer>
        <p>
        Issued by <strong>openSUSE Kudos System</strong> |
        {{ new Date().toLocaleDateString() }}
        </p>
    </footer>

    <div class="print-actions">
        <button @click="togglePrintMode">← Back</button>
        <button @click="window.print()">🖨️ Print</button>
    </div>
    </div>

  </main>
</template>

<script setup>
import { ref, onMounted } from "vue"
import { useRoute, RouterLink } from "vue-router"
import html2canvas from "html2canvas"

const route = useRoute()
const badge = ref({})
const loading = ref(true)
const typedOutput = ref("")
const printMode = ref(false)
const ownsBadge = ref(false)

const currentUser = JSON.parse(localStorage.getItem("user") || "{}")

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function typeLine(line, speed = 25) {
  for (const char of line) {
    typedOutput.value += char
    await delay(speed)
  }
  typedOutput.value += "<br/>"
  await delay(250)
}

async function startTyping() {
  await typeLine("> Connecting to GeekoDB...")
  await delay(800)
  await typeLine(`> SELECT * FROM badges WHERE slug = '${badge.value.slug}';`)
  await delay(500)
  await typeLine("> 1 record found.<br/>")

  const meta = [
    `title: ${badge.value.title}`,
    `description: ${badge.value.description}`,
    `color: ${badge.value.color}`,
    `picture: ${badge.value.picture}`,
  ]
  for (const m of meta) await typeLine(m)

  await delay(600)
  await typeLine(`> SELECT * FROM user_badges WHERE badge = '${badge.value.slug}';`)
  await delay(400)

  if (badge.value.users && badge.value.users.length) {
    await typeLine(`> ${badge.value.users.length} users found.`)
    for (const user of badge.value.users) {
      const isCurrent = user.username === currentUser?.username
      const linkHTML = `<a href="/user/${user.username}" class="terminal-user-link${isCurrent ? ' current-user' : ''}" data-router-link>${user.username}</a>`
      typedOutput.value += `- ${linkHTML}<br/>`
      await delay(120)

      if (isCurrent) {
        await delay(200)
        typedOutput.value += `<span class="ultracool">> ULTRASUPERCOOL: you have the badge! 🦎🔥</span><br/>`
        ownsBadge.value = true
      }
    }
  } else {
    await typeLine("> no users found.")
  }

  await delay(300)
  await typeLine("> query complete.")
}

async function fetchBadge() {
  const res = await fetch(`/api/badges/${route.params.slug}`)
  badge.value = await res.json()
  loading.value = false
  startTyping()
}

function togglePrintMode() {
  printMode.value = !printMode.value
}

async function saveAsImage() {
  const el = document.querySelector(".badge-print-view") || document.querySelector(".badge-terminal-content")
  const canvas = await html2canvas(el)
  const link = document.createElement("a")
  link.download = `${badge.value.slug}.jpg`
  link.href = canvas.toDataURL("image/jpeg", 0.9)
  link.click()
}

onMounted(fetchBadge)
</script>

<style scoped>

pre {
    font-family: "VT323", monospace;
}
.badge-terminal {
  font-family: "VT323", monospace;
  color: #b4ffb4;
  background: #0b0f0b;
  padding: 2rem;
  border-radius: 10px;
  box-shadow: inset 0 0 15px rgba(0, 255, 0, 0.2);
}

.badge-miniature img {
  width: 180px;
  margin-bottom: 1.2rem;
}

.terminal-output {
  line-height: 1.4;
  font-size: 1.1rem;
  white-space: pre-wrap;
  min-height: 300px;
}

/* 💚 Terminal Links (like HomeView) */
.terminal-user-link {
  color: var(--geeko-green);
  text-decoration: none;
  transition: color 0.2s ease;
}
.terminal-user-link:hover {
  color: #9cff9c;
  text-decoration: underline;
}

/* 🦎 Highlight current user */
.current-user {
  font-weight: bold;
  color: #00ff88;
  text-shadow: 0 0 8px #00ff88;
}

.ultracool {
  color: #00ff00;
  font-weight: bold;
  text-shadow: 0 0 10px #00ff00, 0 0 20px #00ff00;
  animation: pulse 1.5s infinite alternate;
}

@keyframes pulse {
  from {
    opacity: 0.8;
  }
  to {
    opacity: 1;
    text-shadow: 0 0 12px #00ff00, 0 0 24px #00ff00;
  }
}

/* 🖨️ Print View */
.certificate-header {
  text-align: center;
  margin-bottom: 1rem;
}

.certificate-logo {
  width: 200px;
  height: auto;
  image-rendering: pixelated; /* makes it look 8-bit */
  filter: drop-shadow(0 0 6px rgba(0, 255, 128, 0.4));
  margin-bottom: 0.5rem;
}

@media screen {
  .certificate-logo {
    animation: glowPulse 2.8s ease-in-out infinite alternate;
  }

  @keyframes glowPulse {
    from {
      filter: drop-shadow(0 0 4px rgba(0, 255, 128, 0.2))
              drop-shadow(0 0 8px rgba(0, 255, 128, 0.3));
    }
    to {
      filter: drop-shadow(0 0 10px rgba(0, 255, 128, 0.6))
              drop-shadow(0 0 20px rgba(0, 255, 128, 0.4));
    }
  }
}

@media print {
  .certificate-logo {
    animation: none !important;
    filter: none !important;
  }
}


</style>
