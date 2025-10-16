<template>
  <div class="modal-backdrop" @click.self="goBack">
    <div class="kudo-dialog">
      <h2>💚 Give Kudos</h2>

      <form @submit.prevent="sendKudo">
        <!-- 👤 Recipient Search -->
        <div class="form-group">
          <label for="recipient">To:</label>
          <input
            id="recipient"
            v-model="query"
            type="text"
            placeholder="Start typing a username..."
            @input="searchUsers"
            @keydown.enter.prevent="confirmUser"
            autocomplete="off"
          />

          <!-- 🔽 Dropdown -->
          <ul v-if="suggestions.length" class="suggestions">
            <li
              v-for="user in suggestions"
              :key="user.username"
              @click="selectUser(user)"
            >
              <img :src="user.avatarUrl" class="avatar" />
              {{ user.username }}
            </li>
          </ul>
        </div>

        <!-- 🏷️ Category -->
        <div class="form-group">
          <label for="category">Category:</label>
          <select id="category" v-model="selectedCategory" @change="onCategoryChange">
            <option disabled value="">Select category...</option>
            <option v-for="c in categories" :key="c.code" :value="c.code">
              {{ c.icon ? c.icon + ' ' : '' }}{{ c.label }}
            </option>
          </select>
        </div>

        <!-- 💬 Message -->
        <div class="form-group">
          <label for="message">Message:</label>
          <textarea
            id="message"
            v-model="message"
            placeholder="Write a short message of appreciation..."
            rows="3"
          />
        </div>

        <!-- ✅ Buttons -->
        <div class="actions">
          <button type="submit" class="btn highlight">💚 Send Kudos</button>
          <button type="button" class="btn" @click="goBack">✖ Cancel</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";

const router = useRouter();
const query = ref("");
const suggestions = ref([]);
const selectedUser = ref(null);
const categories = ref([]);
const selectedCategory = ref(""); // ✅ FIXED missing variable
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

function selectUser(user) {
  selectedUser.value = user;
  query.value = user.username;
  suggestions.value = [];
}

function confirmUser() {
  if (!selectedUser.value && query.value) {
    selectedUser.value = { username: query.value };
    suggestions.value = [];
  }
}

// 🏷️ Fetch categories (no fallback)
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

// 💚 Send kudos
async function sendKudo() {
  if (!selectedUser.value?.username || !selectedCategory.value || !message.value.trim()) {
    alert("Please fill all fields.");
    return;
  }

  const payload = {
    to: selectedUser.value.username,
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
      alert(`💚 Kudos sent to ${selectedUser.value.username}!`);
      router.push("/kudos");
    } else {
      const err = await res.text();
      alert("Failed to send kudos: " + err);
    }
  } catch (err) {
    alert("Network error: " + err.message);
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

/* ✅ Buttons */
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

/* 💚 Highlighted send button */
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
