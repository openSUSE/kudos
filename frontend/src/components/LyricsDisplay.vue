<template>
  <div class="lyrics-container hint" v-if="currentLine">
    <span class="lyrics-text">
      {{ currentLine.text }}
    </span>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, inject } from "vue";

const bgmRef = inject("bgmRef");

const lyrics = ref([]);
const currentLine = ref(null);
let intervalId = null;

async function loadLyrics() {
  console.log("🎵 Loading lyrics from:", "/audio/what_does_chameleon_say_parody.json");
  try {
    const res = await fetch("/audio/what_does_chameleon_say_parody.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    lyrics.value = await res.json();
    console.log("✅ Lyrics loaded:", lyrics.value.length, "entries");
    console.table(lyrics.value.slice(0, 5));
  } catch (err) {
    console.error("❌ Failed to load lyrics:", err);
  }
}

function updateLyric() {
  const audio = bgmRef?.value;
  if (!audio) {
    console.warn("⚠️ Audio element not yet available");
    return;
  }

  const t = audio.currentTime;
  if (!lyrics.value.length) return;

  const match = lyrics.value.find((l) => t >= parseFloat(l.start) && t <= parseFloat(l.end));
  if (match && currentLine.value !== match) {
    console.log(`🕒 ${t.toFixed(2)}s → ${match.text}`);
    currentLine.value = match;
  } else if (!match && currentLine.value) {
    currentLine.value = null;
  }
}

onMounted(async () => {
  console.log("🎬 LyricsDisplay mounted");
  await loadLyrics();

  const checkReady = setInterval(() => {
    if (bgmRef?.value) {
      console.log("🎧 Audio element detected in LyricsDisplay:", bgmRef.value);
      clearInterval(checkReady);
      intervalId = setInterval(updateLyric, 300);
    }
  }, 500);
});

onUnmounted(() => {
  if (intervalId) clearInterval(intervalId);
  console.log("🧹 LyricsDisplay unmounted, interval cleared");
});
</script>

<style scoped>
.lyrics-container {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  margin-left: 1rem;
  min-width: 240px;
  overflow: hidden;
}

.lyrics-text {
  white-space: nowrap;
  text-overflow: ellipsis;
  animation: fadeSlide 0.3s ease;
  font-style: italic;
  font-size: 0.6em;
}

@keyframes fadeSlide {
  from {
    opacity: 0;
    transform: translateY(-3px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pulse {
  from {
    opacity: 0.6;
    transform: scale(1);
  }
  to {
    opacity: 1;
    transform: scale(1.2);
  }
}
</style>
