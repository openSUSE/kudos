<template>
  <main class="recent-achievements container">
    <section class="section-box">
      <h2>🏅 Recently earned badges</h2>
      <p class="hint">
        Timeline of badge awards grouped by badge and award window. Bulk runs appear as a single entry.
      </p>

      <div v-if="loading" class="quiet">
        <p>Loading recent badge achievements...</p>
      </div>

      <div v-else-if="timeline.length" class="timeline-list">
        <article
          v-for="(entry, idx) in timeline"
          :key="`${entry.badge.slug}-${entry.grantedAt}-${idx}`"
          class="timeline-entry"
        >
          <div class="entry-head">
            <img
              v-if="entry.badge.picture"
              :src="getBadgeImageUrl(entry.badge.picture)"
              :alt="entry.badge.title"
              class="badge-image"
            />
            <div>
              <h3>
                <router-link :to="`/badge/${entry.badge.slug}`">{{ entry.badge.title }}</router-link>
                <span class="count">· {{ entry.awardedCount }} awarded</span>
              </h3>
              <p class="description">{{ entry.badge.description }}</p>
              <p class="meta">{{ timeAgo(entry.grantedAt) }}</p>
            </div>
          </div>

          <div class="user-grid">
            <router-link
              v-for="user in entry.users"
              :key="`${entry.badge.slug}-${user.username}`"
              :to="`/badge/${entry.badge.slug}/earned-by/${user.username}`"
              class="user-pill"
              :title="`Open achievement permalink for @${user.username}`"
            >
              <img :src="user.avatarUrl" :alt="user.username" />
              <span>@{{ user.username }}</span>
            </router-link>
          </div>
        </article>
      </div>

      <div v-else class="quiet">
        <p>No recent badge achievements yet.</p>
      </div>

      <div class="view-all">
        <router-link to="/badges" class="view-link">→ View all badge definitions</router-link>
      </div>
    </section>
  </main>
</template>

<script setup>
import { onMounted, ref } from "vue";

const timeline = ref([]);
const loading = ref(true);

function getBadgeImageUrl(pictureUrl) {
  if (pictureUrl) {
    return pictureUrl.replace("/badges/", "/badges/previews/200/");
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

onMounted(async () => {
  try {
    const res = await fetch("/api/badges/recent-achievements?limit=30&groupWindowMinutes=5");
    if (!res.ok) throw new Error("Failed to fetch recent badge achievements");
    const data = await res.json();
    timeline.value = data.timeline || [];
  } catch (err) {
    console.error("Failed to fetch recent badge timeline:", err);
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.recent-achievements {
  padding-top: 1rem;
}

.timeline-list {
  display: grid;
  gap: 1rem;
  margin-top: 1rem;
}

.timeline-entry {
  border: 1px solid rgba(66, 205, 66, 0.2);
  border-radius: 14px;
  padding: 0.85rem;
  background: rgba(0, 0, 0, 0.14);
}

.entry-head {
  display: grid;
  gap: 0.8rem;
  grid-template-columns: 96px minmax(0, 1fr);
  align-items: center;
}

.badge-image {
  width: 96px;
  height: 96px;
  object-fit: contain;
  image-rendering: pixelated;
}

.entry-head h3 {
  margin: 0;
}

.entry-head h3 a {
  color: var(--geeko-green);
  text-decoration: none;
}

.entry-head h3 a:hover {
  text-decoration: underline;
}

.count,
.meta,
.description {
  color: var(--text-secondary);
}

.description {
  margin: 0.4rem 0 0;
}

.meta {
  margin: 0.35rem 0 0;
  font-size: 0.92rem;
}

.user-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 0.9rem;
}

.user-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  border: 1px solid rgba(66, 205, 66, 0.2);
  border-radius: 999px;
  padding: 0.2rem 0.5rem 0.2rem 0.25rem;
  text-decoration: none;
  color: var(--text-primary);
}

.user-pill img {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1px solid rgba(66, 205, 66, 0.4);
}

.user-pill:hover {
  border-color: var(--geeko-green);
  color: var(--geeko-green);
}

@media (max-width: 700px) {
  .entry-head {
    grid-template-columns: 1fr;
  }
}
</style>
