<!--───────────────────────────────────────────────────────────────
 🎵 AudioToggle.vue – Music Control Button
───────────────────────────────────────────────────────────────-->
<template>
  <div class="audio-toggle" @click="toggleAudio" :title="isPlaying ? 'Mute music' : 'Play music'">
    <div v-if="isPlaying" class="bars">
      <div class="bar" v-for="i in 3" :key="i"></div>
    </div>
    <div v-else class="muted-icon">🔇</div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";

const isPlaying = ref(false);

function toggleAudio() {
  const audio = document.querySelector(".bgm-player");
  if (!audio) return;

  if (isPlaying.value) {
    audio.pause();
  } else {
    audio.play().catch(() => {
      console.warn("Autoplay blocked until user interaction");
    });
  }
  isPlaying.value = !isPlaying.value;
}

onMounted(() => {
  const audio = document.querySelector(".bgm-player");
  if (audio && !audio.paused) isPlaying.value = true;
});
</script>

<style scoped>
.audio-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  width: 36px;
  border: 1px solid var(--divider);
  background: transparent;
  color: var(--text);
  cursor: pointer;
  transition: all 0.25s ease;
}

.audio-toggle:hover {
  border-color: var(--geeko-green);
  color: var(--geeko-green);
}

.bars {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  width: 14px;
  height: 14px;
}

.bar {
  width: 3px;
  background: var(--geeko-green);
  animation: bounce 0.8s infinite ease-in-out;
  border-radius: 1px;
}

.bar:nth-child(1) { animation-delay: 0s; }
.bar:nth-child(2) { animation-delay: 0.2s; }
.bar:nth-child(3) { animation-delay: 0.4s; }

@keyframes bounce {
  0%, 100% { height: 4px; opacity: 0.6; }
  50% { height: 14px; opacity: 1; }
}

.muted-icon {
  font-size: 16px;
}
</style>
