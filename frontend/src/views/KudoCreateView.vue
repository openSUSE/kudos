<template>
  <div class="modal-backdrop">
    <div class="kudo-dialog">
      <h2>💚 {{ t('kudo_create.title') }}</h2>

      <form @submit.prevent="sendKudo">
        <!-- � Recipients Search (multiple) -->
        <div class="form-group">
          <label for="recipient">{{ t('kudo_create.to_label') }}</label>
          
          <!-- Selected recipients as chips -->
          <div v-if="selectedUsers.length" class="recipients-chips">
            <div v-for="user in selectedUsers" :key="user.username" class="chip">
              <img :src="user.avatarUrl" :alt="user.username" class="chip-avatar" />
              <span>{{ user.username }}</span>
              <button type="button" @click.stop="removeUser(user.username)" class="chip-close">✕</button>
            </div>
          </div>

          <!-- Input + Add button -->
          <div class="recipient-input-group">
            <input
              id="recipient"
              v-model="query"
              type="text"
              :placeholder="t('kudo_create.to_placeholder')"
              @input="searchUsers"
              @keydown.enter.prevent="addUser"
              autocomplete="off"
            />
            <button type="button" @click.prevent="addUser" class="btn-add" :disabled="!query.trim()">
              + {{ t('kudo_create.add_button') || 'Add' }}
            </button>
          </div>

          <ul v-if="suggestions.length" class="suggestions">
            <li
              v-for="user in suggestions"
              :key="user.username"
              @click="selectAndAdd(user)"
            >
              <img :src="user.avatarUrl" class="avatar" />
              <span>{{ user.username }}</span>
            </li>
          </ul>
        </div>

        <div class="form-group">
          <label for="category">{{ t('kudo_create.category_label') }}</label>
          <select id="category" v-model="selectedCategory" @change="onCategoryChange">
            <option disabled value="">{{ t('kudo_create.category_placeholder') }}</option>
            <option v-for="c in categories" :key="c.code" :value="c.code">
              {{ c.icon ? c.icon + ' ' : '' }}{{ c.label }}
            </option>
          </select>
        </div>

        <div class="form-group">
          <label for="message">{{ t('kudo_create.message_label') }}</label>
          <textarea
            id="message"
            v-model="message"
            :placeholder="t('kudo_create.message_placeholder')"
            rows="3"
          />
          <p class="emoji-hint">Available emojis: 🌈 💪 ⚙️ 🧑‍💻 💬 🦸 💚 � �🙌 🎨 💻 🛡️</p>
        </div>

        <div class="actions">
          <button type="submit" class="btn highlight">💚 {{ t('kudo_create.send_button') }}</button>
          <button type="button" class="btn" @click="goBack">✖ {{ t('kudo_create.cancel_button') }}</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from "vue-i18n";
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useNotifications } from "../composables/useNotifications";

const { t } = useI18n();
const { addNotification } = useNotifications();
const router = useRouter();
const query = ref("");
const suggestions = ref([]);
const selectedUsers = ref([]);
const categories = ref([]);
const selectedCategory = ref("");
const message = ref("");

let allUsers = [];

// 🔍 Live user search
onMounted(async () => {
  const res = await fetch("/api/users");
  if (res.ok) {
    allUsers = await res.json();
    const auth = JSON.parse(localStorage.getItem("user"));
    if (auth?.username)
      allUsers = allUsers.filter(u => u.username !== auth.username);
  }
});

function searchUsers() {
  const q = query.value.trim().toLowerCase();
  suggestions.value = q
    ? allUsers.filter(u =>
        (u.username || "").toLowerCase().includes(q)
      )
    : [];
}

function addUser() {
  if (!query.value.trim()) return;
  
  const username = query.value.trim();
  // Avoid duplicates
  if (selectedUsers.value.some(u => u.username === username)) {
    query.value = "";
    suggestions.value = [];
    return;
  }

  const matchedUser = allUsers.find(u => u.username === username);
  if (matchedUser) {
    selectedUsers.value.push(matchedUser);
  } else {
    // Allow manual entry if not found in system
    selectedUsers.value.push({ username });
  }
  query.value = "";
  suggestions.value = [];
}

function selectAndAdd(user) {
  if (selectedUsers.value.some(u => u.username === user.username)) {
    query.value = "";
    suggestions.value = [];
    return;
  }
  selectedUsers.value.push(user);
  query.value = "";
  suggestions.value = [];
}

function removeUser(username) {
  selectedUsers.value = selectedUsers.value.filter(u => u.username !== username);
}

async function fetchCategories() {
  try {
    const res = await fetch("/api/kudos/categories");
    if (!res.ok) throw new Error("Failed to fetch categories");
    const list = await res.json();
    categories.value = list;
  } catch (err) {
    console.error("Category fetch failed:", err);
    categories.value = [];
  }
}

async function sendKudo() {
  if (selectedUsers.value.length === 0 || !selectedCategory.value || !message.value.trim()) {
    addNotification({
      title: 'Error',
      message: t('kudo_create.alert_fill_all_fields'),
      type: 'error'
    });
    return;
  }

  const payload = {
    to: selectedUsers.value.map(u => u.username),
    category: selectedCategory.value,
    message: message.value,
  };

  try {
    const res = await fetch("/api/kudos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const recipientNames = selectedUsers.value.map(u => u.username).join(", ");
      const isGroup = selectedUsers.value.length > 1;
      addNotification({
        title: isGroup ? '👥 Group Kudos Sent!' : 'Kudos Sent',
        message: isGroup 
          ? t('kudo_create.alert_group_kudos_sent', { recipients: recipientNames })
          : t('kudo_create.alert_kudos_sent', { username: selectedUsers.value[0].username }),
        type: 'success'
      });
      router.push("/");
    } else {
      const err = await res.text();
      addNotification({
        title: 'Error',
        message: t('kudo_create.alert_failed_to_send', { error: err }),
        type: 'error'
      });
    }
  } catch (err) {
    addNotification({
      title: 'Network Error',
      message: t('kudo_create.alert_network_error', { message: err.message }),
      type: 'error'
    });
  }
}

function goBack() {
  router.push("/");
}

function onCategoryChange() {
  const cat = categories.value.find(c => c.code === selectedCategory.value);
  if (cat?.defaultMsg) {
    message.value = cat.defaultMsg; // auto-fill suggestion
  }
}

onMounted(fetchCategories);
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.kudo-dialog {
  background: var(--tile-bg);
  color: var(--text);
  border: 2px solid var(--divider);
  border-radius: 10px;
  padding: 1.8rem;
  width: 420px;
  max-width: 90%;
  box-shadow: 0 0 15px rgba(0, 255, 128, 0.3);
  animation: fadeInUp 0.25s ease-out;
  position: relative;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

h2 {
  text-align: center;
  font-family: "VT323", monospace;
  font-size: 1.8rem;
  margin-bottom: 1rem;
  color: var(--geeko-green);
}

.form-group {
  margin-bottom: 1rem;
  position: relative;
}

label {
  display: block;
  font-weight: bold;
  margin-bottom: 0.3rem;
  font-size: 1rem;
  color: var(--text-secondary);
}

label .hint {
  font-weight: normal;
  font-size: 0.85rem;
  opacity: 0.8;
  margin-left: 0.3rem;
}

/* 👥 Recipients input with Add button */
.recipient-input-group {
  display: flex;
  gap: 0.4rem;
  margin-bottom: 0.4rem;
}

.recipient-input-group input {
  flex: 1;
}

.btn-add {
  background: transparent;
  border: 1px solid var(--divider);
  color: var(--text);
  padding: 0.5rem 0.8rem;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  font-family: inherit;
  font-size: 0.95rem;
}

.btn-add:hover:not(:disabled) {
  border-color: var(--geeko-green);
  color: var(--geeko-green);
  background: rgba(115, 186, 37, 0.1);
}

.btn-add:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

input,
select,
textarea {
  width: 100%;
  padding: 0.5rem;
  background: var(--input-bg);
  border: 1px solid var(--divider);
  border-radius: 6px;
  color: var(--text);
  font-family: inherit;
}

.emoji-hint {
  margin: 0.4rem 0 0;
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-style: italic;
}

/* 🔽 User dropdown */
.suggestions {
  position: absolute;
  background: var(--tile-bg);
  border: 1px solid var(--divider);
  border-radius: 6px;
  width: 100%;
  top: calc(100% + 4px);
  left: 0;
  z-index: 1000;
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 200px;
  overflow-y: auto;
}

.suggestions li {
  padding: 6px 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.suggestions li:hover {
  background: rgba(115, 186, 37, 0.1);
}

.suggestions .avatar {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 1px solid var(--divider);
}

/* 👥 Recipients chips */
.recipients-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 0.8rem;
  padding: 0.4rem 0;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: rgba(115, 186, 37, 0.15);
  border: 1px solid var(--geeko-green);
  border-radius: 16px;
  font-size: 0.9rem;
  color: var(--text);
}

.chip-avatar {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 1px solid var(--divider);
}

.chip-close {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.9rem;
  padding: 0;
  margin-left: 2px;
  transition: color 0.2s;
  line-height: 1;
}

.chip-close:hover {
  color: var(--geeko-green);
}

.actions {
  display: flex;
  justify-content: space-between;
  margin-top: 1.4rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  min-width: 110px;
  padding: 0 12px;
  border: 1px solid var(--divider);
  background: transparent;
  color: var(--text);
  font-size: 16px;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 6px;
}

.btn:hover {
  border-color: var(--geeko-green);
  color: var(--geeko-green);
}

.btn.highlight {
  border-color: var(--accent, #00aaff);
  color: var(--accent, #00aaff);
  box-shadow: 0 0 8px rgba(0, 170, 255, 0.4);
  animation: pulseAccent 2s infinite;
}

@keyframes pulseAccent {
  0% {
    box-shadow: 0 0 8px rgba(0, 170, 255, 0.4);
  }
  50% {
    box-shadow: 0 0 16px rgba(0, 170, 255, 0.8);
  }
  100% {
    box-shadow: 0 0 8px rgba(0, 170, 255, 0.4);
  }
}
</style>
