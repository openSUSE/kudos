<!--
Copyright © 2025–present Lubos Kocman and openSUSE contributors
SPDX-License-Identifier: Apache-2.0
-->

<template>
  <div class="kudos-feed" :class="{ 'kudos-feed--compact': compact, flicker }">
    <router-link
      v-for="k in kudos"
      :key="k.id"
      class="kudo-line"
      :class="{ 'group-kudo': isGroupKudo(k) }"
      :to="`/kudo/${k.slug}`"
    >
      <span class="bubble">
        <span class="bubble-head">
          <span class="category">
            <span class="icon">{{ k.category?.icon || "💚" }}</span>
            <span class="category-label">{{ k.category?.label || t("kudo_print.general_category") }}</span>
          </span>

          <template v-if="showRecipient">
            <span aria-hidden="true" class="arrow">→</span>

            <template v-if="isGroupKudo(k)">
              <span class="users-group">
                <template v-for="(r, idx) in k.recipients" :key="r.userId || idx">
                  <router-link v-if="linkUsers" :to="`/user/${r.user.username}`" class="user" @click.stop>
                    @{{ r.user.username }}
                  </router-link>
                  <span v-else class="user">@{{ r.user.username }}</span>
                  <span v-if="idx < k.recipients.length - 1" class="separator">, </span>
                </template>
              </span>
              <span class="group-badge">👥</span>
            </template>
            <template v-else>
              <router-link v-if="linkUsers" :to="`/user/${k.recipients[0]?.user.username}`" class="user" @click.stop>
                @{{ k.recipients[0]?.user.username }}
              </router-link>
              <span v-else class="user">@{{ k.recipients[0]?.user.username }}</span>
            </template>
          </template>
        </span>

        <span class="message">"{{ k.message }}"</span>
      </span>

      <span class="sender">
        <router-link v-if="linkUsers" :to="`/user/${k.fromUser.username}`" class="user" @click.stop>
          @{{ k.fromUser.username }}
        </router-link>
        <span v-else class="user">@{{ k.fromUser.username }}</span>

        <span class="timestamp">
          <template v-if="k.internal">{{ t("user_profile.team_kudos_internal") }} · </template>
          {{ formatTime(k.createdAt) }}
        </span>
      </span>
    </router-link>
  </div>
</template>

<script setup>
import { useI18n } from "vue-i18n";

const props = defineProps({
  kudos: { type: Array, required: true },
  compact: { type: Boolean, default: false },
  flicker: { type: Boolean, default: false },
  showRecipient: { type: Boolean, default: true },
  linkUsers: { type: Boolean, default: false },
  relativeTime: { type: Boolean, default: false },
});

const { t } = useI18n();

function isGroupKudo(kudo) {
  return kudo.recipients?.length > 1;
}

function formatTime(dateStr) {
  const d = new Date(dateStr);
  if (props.relativeTime) {
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return "now";
    if (diff < 3600) return `${Math.floor(diff / 60)} m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
    return `${Math.floor(diff / 86400)} d ago`;
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}
</script>

<style scoped>
/* Chat-bubble styling. The base .kudos-feed / .kudo-line rules live in
   base.css; these scoped rules override the flat single-line layout. */
.kudo-line {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 0;
  margin: 0.35rem 0;
  border-bottom: none;
  color: var(--text-primary);
}

.kudo-line:hover {
  color: var(--text-primary);
}

.kudo-line::after,
.kudo-line .user::after {
  display: none;
}

.bubble {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  width: fit-content;
  max-width: 100%;
  min-width: 0;
  padding: 0.6rem 0.9rem;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 16px;
  border-bottom-left-radius: 4px;
  box-shadow: var(--card-shadow);
  transition: box-shadow 0.15s ease, transform 0.15s ease;
}

.bubble::before {
  content: "";
  position: absolute;
  left: 18px;
  bottom: -5px;
  width: 10px;
  height: 10px;
  background: inherit;
  border-right: 1px solid var(--card-border);
  border-bottom: 1px solid var(--card-border);
  transform: rotate(45deg);
}

.kudo-line:hover .bubble {
  box-shadow: 0 4px 12px color-mix(in srgb, var(--geeko-green) 20%, transparent);
  transform: translateY(-1px);
}

.bubble-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.9em;
}

.kudo-line .icon {
  margin-right: 0;
  font-size: 1.15em;
  line-height: 1;
}

.category {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--text-muted);
  font-size: 0.9em;
}

.category-label {
  letter-spacing: 0.02em;
}

.kudo-line .user {
  color: var(--geeko-green);
  font-weight: bold;
  margin-right: 0;
}

.arrow {
  color: var(--text-muted);
}

.kudo-line .message {
  flex: none;
  margin: 0;
  color: var(--text-primary);
  line-height: 1.4;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.sender {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.6rem;
  margin: 0.4rem 0 0 1.4rem;
  font-size: 0.85rem;
}

.sender .user {
  color: var(--geeko-green);
  font-weight: bold;
  font-size: 1rem;
}

.kudo-line .timestamp {
  opacity: 0.75;
  font-size: 0.72rem;
  color: var(--text-muted);
}

.kudo-line.group-kudo {
  background: transparent;
}

.kudo-line.group-kudo .bubble {
  background: color-mix(in srgb, var(--geeko-green) 10%, var(--card-bg));
}

.users-group {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0;
  align-items: center;
  min-width: 0;
}

.users-group .user {
  margin-right: 0;
  color: var(--geeko-green);
}

.separator {
  margin-right: 0.4rem;
}

.group-badge {
  display: inline-block;
  margin: 0 0.6rem;
  padding: 0 0.4rem;
  color: var(--geeko-green);
  font-weight: bold;
  animation: pulse 1.5s infinite;
}

.kudos-feed--compact .bubble {
  padding: 0.4rem 0.6rem;
}

.kudos-feed--compact .kudo-line .message {
  font-size: 0.9rem;
}

@media (max-width: 720px) {
  .bubble {
    padding: 0.5rem 0.7rem;
    border-radius: 14px;
    border-bottom-left-radius: 4px;
  }

  .bubble-head {
    font-size: 0.82em;
  }

  .sender {
    margin-left: 1.1rem;
    font-size: 0.8rem;
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}
</style>
