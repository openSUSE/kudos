<script setup>
import { ref, onMounted } from "vue";
import { useAuthStore } from "./store/auth";
import Header from "./components/Header.vue";
import Footer from "./components/Footer.vue";
import NotificationCenter from "./components/NotificationCenter.vue";
import { createSparkles } from "./utils/sparkles.js";

const bgm = ref(null);
const auth = useAuthStore();

// 🎵 Background music unmute
function unmuteOnFirstInteraction() {
  const unmute = () => {
    if (bgm.value) {
      bgm.value.muted = false;
      bgm.value.play().catch(() => {}); // try to play after unmuting
    }
    window.removeEventListener("click", unmute);
  };
  window.addEventListener("click", unmute);
}


onMounted(async () => {
  if (bgm.value) bgm.value.volume = 0.05; // loudness could be 0.25
  await auth.fetchWhoAmI();

  // ✨ Sparkles: create and update when theme changes
  createSparkles();
  const observer = new MutationObserver(() => createSparkles());
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
});
</script>

<template>
  <div class="app">
    <Header />

    <audio
      ref="bgm"
      class="bgm-player"
      src="/audio/retro-funk.ogg"
      loop
      autoplay
      muted
      @canplay="unmuteOnFirstInteraction"
    />


    <main class="main-container">
      <router-view />
    </main>

    <Footer />
    <NotificationCenter />
  </div>
</template>

<style scoped>
.bgm-player {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
}
</style>
