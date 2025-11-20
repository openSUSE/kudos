<script setup>
import { ref, onMounted } from "vue";
import { useAuthStore } from "./store/auth";
import Header from "./components/Header.vue";
import Footer from "./components/Footer.vue";
import NotificationCenter from "./components/NotificationCenter.vue";
import { createSparkles } from "./utils/sparkles.js";

const bgm = ref(null);
const auth = useAuthStore();

onMounted(async () => {
  if (bgm.value) bgm.value.volume = 0.5;
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

    <!-- 🎵 Background music (starts only when user clicks AudioToggle) -->
    <audio
      ref="bgm"
      class="bgm-player"
      src="/audio/what_does_chameleon_say_parody.ogg"
      loop
      muted
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
