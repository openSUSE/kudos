<script setup>
import { ref, onMounted, provide } from "vue";
import { useAuthStore } from "./store/auth";
import Header from "./components/Header.vue";
import Footer from "./components/Footer.vue";
import NotificationCenter from "./components/NotificationCenter.vue";
import { createSparkles } from "./utils/sparkles.js";

const bgm = ref(null);
const auth = useAuthStore();

// ✅ Provide bgmRef so Header (and LyricsDisplay) can inject it
provide("bgmRef", bgm);

onMounted(async () => {
  if (!bgm.value) {
    console.warn("⚠️ BGM element not found yet!");
    return;
  }

  bgm.value.volume = 0.1;
  console.log("🎧 BGM element ready:", bgm.value);

  // 🔁 Force reactivity update so injected components (like Header) see the audio element
  bgm.value = bgm.value;
  console.log("🔁 Reassigned bgmRef to trigger reactive update");

  // ✅ Start playback immediately if already loaded
  if (bgm.value.readyState >= 1) {
    try {
      await bgm.value.play();
      console.log("▶️ BGM playback started (already ready)");
    } catch (err) {
      console.warn("⚠️ Autoplay blocked, waiting for user gesture");
    }
  } else {
    // ✅ Otherwise wait for metadata
    bgm.value.addEventListener(
      "loadedmetadata",
      async () => {
        try {
          await bgm.value.play();
          console.log("▶️ BGM playback started (after metadata)");
        } catch (err) {
          console.warn("⚠️ Autoplay blocked, waiting for user gesture");
        }
      },
      { once: true }
    );
  }

  // 🔐 Auth and ✨ Sparkles setup
  await auth.fetchWhoAmI();
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

    <!-- 🎵 Background music (controlled via AudioToggle) -->
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
