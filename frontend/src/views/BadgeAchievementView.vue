<template>
  <main class="share-view">
    <section v-if="loading" class="loading section-box">
      <p>{{ t('badge.loading') }}</p>
    </section>

    <section v-else-if="achievement" class="share-shell">
      <div v-if="fromShare" class="from-share-banner">
        🔗 You followed a shared achievement link — you are now in the openSUSE Kudos app.
        <button class="dismiss" @click="fromShare = false">✕</button>
      </div>

      <section class="image-shell section-box">
        <div class="badge-preview">
          <img
            v-if="achievement.badge.picture"
            :src="getBadgeImageUrl(achievement.badge.picture)"
            :alt="achievement.badge.title"
            class="preview-image"
          />
          <div class="preview-copy">
            <h1>@{{ achievement.user.username }} earned {{ achievement.badge.title }}</h1>
            <p class="summary">{{ achievement.shareText }}</p>
            <p class="description">{{ achievement.badge.description }}</p>
            <p class="meta">Awarded {{ timeAgo(achievement.grantedAt) }}</p>
          </div>
        </div>
      </section>

      <div class="actions section-box">
        <p class="share-title">{{ t('kudo_view.share_moment') }}</p>
        <div class="action-grid">
          <button class="btn btn-icon-label" @click="copyPermalink" title="Copy share link">
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
      </div>

      <div class="footer">
        <router-link to="/badges/recent" class="back-link">← Back to recent achievements</router-link>
      </div>
    </section>

    <section v-else class="loading section-box">
      <p>Badge achievement not found.</p>
      <div class="footer">
        <router-link to="/badges/recent" class="back-link">← Back to recent achievements</router-link>
      </div>
    </section>
  </main>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";

const { t } = useI18n();
const route = useRoute();
const achievement = ref(null);
const loading = ref(true);
const fromShare = ref(route.query.from === 'share');

const shareText = computed(() => achievement.value?.shareText || "");
const shareUrl = computed(() => achievement.value?.shareUrl || `${window.location.href}/share`);
const encodedShareUrl = computed(() => encodeURIComponent(shareUrl.value));
const encodedShareText = computed(() => encodeURIComponent(shareText.value));
const matrixRoomUrl = computed(() => "https://matrix.to/#/#chat:opensuse.org");

const socialIconUrl = (fileName) => `${import.meta.env.BASE_URL}social/${fileName}`;

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
    return pictureUrl.replace("/badges/", "/badges/previews/800/");
  }
  return "";
}

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  return `${Math.floor(diff / 86400)} d ago`;
}

async function copyPermalink() {
  await navigator.clipboard.writeText(shareUrl.value);
  alert(`${t("kudo_print.copy_link_alert").trim()} ✅`);
}

async function shareToMatrix() {
  const message = `${decodeURIComponent(shareText.value)} ${shareUrl.value}`;

  try {
    await navigator.clipboard.writeText(message);
    alert("Matrix message copied to clipboard ✅");
  } catch {
    alert("Could not copy the Matrix message automatically. Please copy manually.");
  }

  window.open(matrixRoomUrl.value, "_blank", "noopener,noreferrer");
}

onMounted(async () => {
  try {
    const { slug, username } = route.params;
    const res = await fetch(`/api/badges/achievement/${slug}/${username}`);
    if (!res.ok) throw new Error("Badge achievement not found");
    achievement.value = await res.json();
  } catch (err) {
    console.error("Failed to fetch badge achievement:", err);
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.share-view {
  display: flex;
  justify-content: center;
  padding: 1.5rem;
}

.share-shell,
.loading {
  width: min(100%, 900px);
}

.image-shell {
  padding: 1rem;
}

.badge-preview {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  gap: 1rem;
  align-items: center;
}

.preview-image {
  display: block;
  width: 100%;
  height: auto;
  border: 1px solid var(--card-border);
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.16);
}

.preview-copy h1 {
  margin: 0;
}

.summary {
  margin: 0.65rem 0 0;
  color: var(--geeko-green);
}

.description,
.meta {
  margin: 0.35rem 0 0;
  color: var(--text-secondary);
}

.actions {
  margin-top: 1rem;
  padding: 1rem;
}

.share-title {
  margin: 0 0 1rem;
  text-align: center;
}

.action-grid {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 1rem;
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
  font-size: 1rem;
}

.btn-icon-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  min-width: 88px;
}

.btn-icon-label img {
  width: 28px;
  height: 28px;
  object-fit: contain;
}

.btn-icon-label span {
  font-size: 0.75rem;
  line-height: 1;
  color: var(--geeko-green);
}

.btn:hover {
  background: var(--geeko-green);
  color: black;
}

.btn:hover span {
  color: black;
}

.btn:hover img {
  opacity: 0.8;
}

.footer {
  text-align: center;
  margin-top: 1.4rem;
}

.back-link {
  display: inline-block;
  color: var(--butterfly-blue);
  text-decoration: none;
  transition: color 0.2s ease;
  font-family: "Pixel Operator", monospace;
  font-size: 1rem;
}

.back-link:hover {
  color: var(--geeko-green);
}

.from-share-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.65rem 1rem;
  margin-bottom: 0.75rem;
  border: 1px solid rgba(143, 90, 214, 0.4);
  border-radius: 10px;
  background: rgba(143, 90, 214, 0.1);
  color: var(--text-secondary, #dacdee);
  font-size: 0.9rem;
  line-height: 1.4;
}

.from-share-banner .dismiss {
  background: transparent;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 1rem;
  padding: 0;
  flex-shrink: 0;
  opacity: 0.7;
}

.from-share-banner .dismiss:hover {
  opacity: 1;
}

@media (max-width: 760px) {
  .badge-preview {
    grid-template-columns: 1fr;
  }

  .share-view {
    padding: 0.9rem;
  }

  .action-grid {
    gap: 0.6rem;
  }

  .btn-icon-label {
    min-width: 78px;
  }
}
</style>
