<!--
Copyright © 2025–present Lubos Kocman and openSUSE contributors
SPDX-License-Identifier: Apache-2.0
-->

<template>
  <main class="board-view">
    <div class="breadcrumb">
      <router-link :to="`/user/${username}`" class="back-link">
        ← {{ t('badge_board.back_to_profile', { user: `@${username}` }) }}
      </router-link>
    </div>

    <div v-if="fromShare" class="from-share-banner">
      🔗 You followed a shared badge board link — you are now in the openSUSE Kudos app.
      <button class="dismiss" @click="fromShare = false">✕</button>
    </div>

    <section v-if="loading" class="loading section-box">
      <p>{{ t('badge_board.loading') }}</p>
    </section>

    <section v-else-if="!boardData" class="loading section-box">
      <p>{{ t('badge_board.not_found') }}</p>
    </section>

    <div v-else class="board-shell">
      <!-- User Profile Header -->
      <header class="board-header section-box">
        <img
          :src="userAvatar"
          :alt="boardData.user?.username || 'user avatar'"
          class="board-avatar"
        />
        <div class="board-meta">
          <h1>{{ boardTitle }}</h1>
          <p class="subtitle">
            <router-link :to="`/user/${boardData.user?.username}`" class="user-link">
              @{{ boardData.user?.username }}
            </router-link>
            ·
            <span class="badge-count-pill">
              🏅 {{ t('badge_board.badge_count', boardData.badgeCount) }}
            </span>
          </p>
        </div>
      </header>

      <!-- Visual Badge Board Grid -->
      <section class="section-box board-card-section">
        <div class="section-heading-row">
          <h2>🎨 {{ t('badge_board.title') }}</h2>
          <button class="btn-toggle-preview" @click="toggleSvgPreview">
            {{ showSvgPreview ? t('badge_board.hide_preview') : t('badge_board.preview_embed') }}
          </button>
        </div>

        <!-- Embedded SVG Direct Preview (when toggled) -->
        <div v-if="showSvgPreview" class="svg-embed-preview">
          <img :src="svgEmbedUrl" alt="openSUSE Kudos Badge Board SVG Preview" class="svg-preview-img" />
        </div>

        <!-- Interactive Sticker Board Grid -->
        <div v-if="boardData.badges?.length" class="board-grid">
          <div
            v-for="b in boardData.badges"
            :key="b.slug"
            class="badge-sticker"
          >
            <router-link
              :to="`/badge/${b.slug}/earned-by/${boardData.user?.username}`"
              class="badge-link"
              :title="badgeTitle(b)"
            >
              <img :src="getBadgeImageUrl(b.picture)" :alt="badgeTitle(b)" class="sticker-img" />
              <span class="sticker-title">{{ badgeTitle(b) }}</span>
            </router-link>
          </div>
        </div>

        <div v-else class="quiet">
          <p>🌱 {{ t('badge_board.no_badges') }}</p>
        </div>
      </section>

      <!-- Embed on GitHub Profile / Blog (like Holopin) -->
      <section class="section-box embed-section">
        <div class="embed-header">
          <h2>📌 {{ t('badge_board.embed_title') }}</h2>
          <p class="embed-desc">{{ t('badge_board.embed_description') }}</p>
        </div>

        <div class="embed-tabs">
          <button
            class="tab-btn"
            :class="{ active: selectedEmbedTab === 'markdown' }"
            @click="selectedEmbedTab = 'markdown'"
          >
            {{ t('badge_board.markdown_label') }}
          </button>
          <button
            class="tab-btn"
            :class="{ active: selectedEmbedTab === 'html' }"
            @click="selectedEmbedTab = 'html'"
          >
            {{ t('badge_board.html_label') }}
          </button>
          <button
            class="tab-btn"
            :class="{ active: selectedEmbedTab === 'url' }"
            @click="selectedEmbedTab = 'url'"
          >
            {{ t('badge_board.svg_url_label') }}
          </button>
        </div>

        <div class="code-box-wrapper">
          <pre class="code-snippet"><code>{{ currentSnippet }}</code></pre>
          <button class="btn btn-copy" @click="copySnippet">
            {{ copied ? t('badge_board.copied') : t('badge_board.copy_code') }}
          </button>
        </div>
      </section>

      <!-- Social Share Grid -->
      <section class="section-box actions">
        <h2 class="share-title">{{ t('badge_board.share_title') }}</h2>
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
      </section>
    </div>
  </main>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { useBadgeText } from "../composables/useBadgeText.js";

const { t } = useI18n();
const { badgeTitle } = useBadgeText();
const route = useRoute();

const username = computed(() => route.params.username || "");
const boardData = ref(null);
const loading = ref(true);
const fromShare = ref(route.query.from === "share");
const showSvgPreview = ref(false);
const selectedEmbedTab = ref("markdown");
const copied = ref(false);

const socialIconUrl = (fileName) => `${import.meta.env.BASE_URL}social/${fileName}`;

const userAvatar = computed(() => {
  return boardData.value?.user?.avatarUrl || `${import.meta.env.BASE_URL}opensuse.svg`;
});

const boardTitle = computed(() => {
  const name = boardData.value?.user?.fullName || boardData.value?.user?.username || username.value;
  return `${name}'s Badge Board`;
});

const shareUrl = computed(() => {
  if (boardData.value?.shareUrl) return boardData.value.shareUrl;
  return `${window.location.origin}/user/${username.value}/board/share`;
});

const boardPermalink = computed(() => {
  if (boardData.value?.permalink) return boardData.value.permalink;
  return `${window.location.origin}/user/${username.value}/board`;
});

const svgEmbedUrl = computed(() => {
  if (boardData.value?.svgUrl) return boardData.value.svgUrl;
  return `${window.location.origin}/api/badges/user/${username.value}/board.svg`;
});

const currentSnippet = computed(() => {
  const permalink = boardPermalink.value;
  const svg = svgEmbedUrl.value;
  const alt = `${boardTitle.value}`;

  if (selectedEmbedTab.value === "markdown") {
    return `[![${alt}](${svg})](${permalink})`;
  }
  if (selectedEmbedTab.value === "html") {
    return `<a href="${permalink}"><img src="${svg}" alt="${alt}" /></a>`;
  }
  return svg;
});

const shareText = computed(() => {
  const count = boardData.value?.badgeCount || 0;
  return `Check out my ${count} openSUSE Kudos badges! 🦎✨`;
});

const encodedShareUrl = computed(() => encodeURIComponent(shareUrl.value));
const encodedShareText = computed(() => encodeURIComponent(shareText.value));

const linkedinShareUrl = computed(() =>
  `https://www.linkedin.com/sharing/share-offsite/?url=${encodedShareUrl.value}`
);

const fosstodonShareUrl = computed(() =>
  `https://fosstodon.org/share?text=${encodedShareText.value}%20${encodedShareUrl.value}`
);

const xShareUrl = computed(() =>
  `https://x.com/intent/post?text=${encodedShareText.value}&url=${encodedShareUrl.value}`
);

const telegramShareUrl = computed(() =>
  `https://t.me/share/url?url=${encodedShareUrl.value}&text=${encodedShareText.value}`
);

const redditShareUrl = computed(() =>
  `https://reddit.com/submit?url=${encodedShareUrl.value}&title=${encodedShareText.value}`
);

const whatsappShareUrl = computed(() =>
  `https://wa.me/?text=${encodedShareText.value}%20${encodedShareUrl.value}`
);

const threadsShareUrl = computed(() =>
  `https://www.threads.net/intent/post?text=${encodedShareText.value}%20${encodedShareUrl.value}`
);

function getBadgeImageUrl(pictureUrl) {
  if (pictureUrl) {
    return pictureUrl.replace("/badges/", "/badges/previews/200/");
  }
  return `${import.meta.env.BASE_URL}opensuse.svg`;
}

function toggleSvgPreview() {
  showSvgPreview.value = !showSvgPreview.value;
}

async function copySnippet() {
  try {
    await navigator.clipboard.writeText(currentSnippet.value);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2500);
  } catch {
    window.prompt("Copy snippet:", currentSnippet.value);
  }
}

async function copyShareLink() {
  try {
    await navigator.clipboard.writeText(shareUrl.value);
    alert(`${t("badge_board.copied")}`);
  } catch {
    window.prompt("Copy link:", shareUrl.value);
  }
}

async function shareToMatrix() {
  const message = `${shareText.value} ${shareUrl.value}`;
  try {
    await navigator.clipboard.writeText(message);
    alert("Matrix message copied to clipboard ✅");
  } catch {
    window.prompt("Copy Matrix message:", message);
  }
}

async function loadBoard(userParam) {
  if (!userParam) return;
  loading.value = true;
  try {
    // 1. Try dedicated board API endpoint
    const res = await fetch(`/api/badges/user/${userParam}/board`);
    if (res.ok) {
      boardData.value = await res.json();
      return;
    }

    // 2. Fallback: if backend hasn't been restarted yet, fetch user & badges directly
    const [userRes, badgesRes] = await Promise.all([
      fetch(`/api/users/${userParam}`).catch(() => null),
      fetch(`/api/badges/user/${userParam}`).catch(() => null),
    ]);

    if (userRes && userRes.ok) {
      const user = await userRes.json();
      const badges = (badgesRes && badgesRes.ok) ? await badgesRes.json() : [];
      const origin = window.location.origin;
      const permalink = `${origin}/user/${user.username}/board`;
      const shareUrl = `${origin}/user/${user.username}/board/share`;
      const svgUrl = `${origin}/api/badges/user/${user.username}/board.svg`;
      const displayName = user.fullName || user.username;

      boardData.value = {
        user,
        badgeCount: badges.length,
        badges,
        permalink,
        shareUrl,
        svgUrl,
        embedMarkdown: `[![${displayName}'s openSUSE Kudos Badge Board](${svgUrl})](${permalink})`,
        embedHtml: `<a href="${permalink}"><img src="${svgUrl}" alt="${displayName}'s openSUSE Kudos Badge Board" /></a>`,
      };
      return;
    }

    boardData.value = null;
  } catch (err) {
    console.error("Failed to load badge board:", err);
    boardData.value = null;
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadBoard(route.params.username);
});

watch(
  () => route.params.username,
  (newUser) => {
    loadBoard(newUser);
  }
);
</script>

<style scoped>
.board-view {
  max-width: 960px;
  margin: 0 auto;
  padding: 1.5rem 1rem 3rem;
}

.breadcrumb {
  margin-bottom: 1rem;
}

.back-link {
  font-family: "Pixel Operator", monospace;
  color: var(--geeko-green);
  text-decoration: none;
  font-size: 1.05rem;
}

.back-link:hover {
  text-decoration: underline;
}

.from-share-banner {
  margin-bottom: 1.25rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  background: color-mix(in srgb, var(--plum-purple) 20%, transparent);
  border: 1px dashed var(--plum-purple);
  color: var(--text-primary);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.from-share-banner .dismiss {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 1.1rem;
  cursor: pointer;
}

.board-shell {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.board-header {
  display: flex;
  align-items: center;
  gap: 1.25rem;
}

.board-avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  border: 2px solid var(--geeko-green);
  object-fit: cover;
  background: color-mix(in srgb, var(--card-bg) 80%, black 20%);
}

.board-meta h1 {
  margin: 0 0 0.25rem;
  font-size: clamp(1.4rem, 2.5vw, 2rem);
  font-family: "Pixel Operator Bold", monospace;
  color: var(--text-primary);
}

.board-meta .subtitle {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  font-family: "Pixel Operator", monospace;
  font-size: 1rem;
  color: var(--text-secondary);
}

.user-link {
  color: var(--geeko-green);
  text-decoration: none;
  font-weight: bold;
}

.user-link:hover {
  text-decoration: underline;
}

.badge-count-pill {
  color: var(--plum-purple);
  font-weight: bold;
}

.section-heading-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
}

.section-heading-row h2 {
  margin: 0;
}

.btn-toggle-preview {
  background: transparent;
  border: 1px dashed var(--plum-purple);
  color: var(--plum-purple);
  border-radius: 6px;
  padding: 0.35rem 0.75rem;
  font-family: "Pixel Operator", monospace;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s ease;
}

.btn-toggle-preview:hover {
  background: color-mix(in srgb, var(--plum-purple) 15%, transparent);
}

.svg-embed-preview {
  margin-bottom: 1.5rem;
  padding: 1rem;
  border-radius: 12px;
  border: 1px solid var(--card-border);
  background: color-mix(in srgb, var(--card-bg) 90%, black 10%);
  display: flex;
  justify-content: center;
}

.svg-preview-img {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  box-shadow: var(--card-shadow);
}

.board-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 1rem;
}

.badge-sticker {
  border: 1px solid var(--card-border);
  border-radius: 12px;
  background: var(--card-bg);
  padding: 0.75rem 0.5rem;
  text-align: center;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
  box-shadow: var(--card-shadow);
}

.badge-sticker:hover {
  transform: translateY(-3px) scale(1.02);
  border-color: var(--geeko-green);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.25);
}

.badge-link {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-decoration: none;
  color: var(--text-primary);
  height: 100%;
}

.sticker-img {
  width: 90px;
  height: 70px;
  object-fit: contain;
  margin-bottom: 0.5rem;
}

.sticker-title {
  font-size: 0.82rem;
  font-family: "Pixel Operator", monospace;
  line-height: 1.2;
  word-break: break-word;
}

.embed-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.embed-header h2 {
  margin: 0 0 0.25rem;
}

.embed-desc {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.95rem;
}

.embed-tabs {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.tab-btn {
  background: transparent;
  border: 1px solid var(--card-border);
  color: var(--text-secondary);
  border-radius: 6px;
  padding: 0.4rem 0.8rem;
  font-family: "Pixel Operator", monospace;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s ease;
}

.tab-btn.active {
  background: var(--geeko-green);
  color: #111;
  border-color: var(--geeko-green);
  font-weight: bold;
}

.code-box-wrapper {
  position: relative;
  background: color-mix(in srgb, var(--card-bg) 60%, black 40%);
  border: 1px solid var(--card-border);
  border-radius: 8px;
  padding: 1rem;
}

.code-snippet {
  margin: 0;
  overflow-x: auto;
  font-family: monospace;
  font-size: 0.85rem;
  color: var(--geeko-green);
  white-space: pre-wrap;
  word-break: break-all;
  padding-right: 5rem;
}

.btn-copy {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  background: transparent;
  border: 1px solid var(--geeko-green);
  color: var(--geeko-green);
  border-radius: 6px;
  padding: 0.35rem 0.65rem;
  font-family: "Pixel Operator", monospace;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-copy:hover {
  background: var(--geeko-green);
  color: #111;
}

.actions {
  text-align: center;
}

.share-title {
  margin: 0 0 1.25rem;
}

.action-grid {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.85rem;
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
  font-size: 0.95rem;
}

.btn-icon-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  min-width: 84px;
}

.btn-icon-label img {
  width: 26px;
  height: 26px;
  object-fit: contain;
}

.btn-icon-label span {
  font-size: 0.75rem;
  line-height: 1;
  color: var(--geeko-green);
}

.btn:hover {
  background: color-mix(in srgb, var(--geeko-green) 15%, transparent);
  border-style: solid;
  transform: translateY(-2px);
}

.quiet {
  color: var(--text-muted);
  text-align: center;
  padding: 2rem 1rem;
}

@media (max-width: 600px) {
  .board-header {
    flex-direction: column;
    text-align: center;
  }
  .board-meta .subtitle {
    justify-content: center;
  }
  .code-snippet {
    padding-right: 0;
    margin-bottom: 2.5rem;
  }
  .btn-copy {
    top: auto;
    bottom: 0.75rem;
    right: 0.75rem;
  }
}
</style>
