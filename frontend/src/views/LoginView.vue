<!-- frontend/src/views/LoginView.vue -->
<!-- Copyright © 2025–present Lubos Kocman and openSUSE contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<template>
  <div class="login-container">
    <div class="login-card">
      <img src="/logo.svg" alt="openSUSE Kudos Logo" class="logo" />
      <h1>openSUSE Kudos</h1>

      <p v-if="authError" class="error">{{ authError }}</p>

      <!-- 🔐 LOCAL AUTH FORM -->
      <form v-if="authMode === 'LOCAL'" @submit.prevent="loginLocal">
        <div class="form-group">
          <label for="username">Username</label>
          <input
            id="username"
            v-model="username"
            type="text"
            placeholder="e.g. klocman"
            required
          />
        </div>

        <div class="form-group">
          <label for="password">Password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            placeholder="••••••••"
            required
          />
        </div>

        <button type="submit" class="login-button" :disabled="loading">
          <span v-if="!loading">Login</span>
          <span v-else>Logging in...</span>
        </button>

        <div class="hint">
          <p>💡 Tip: Use <code>opensuse</code> as password for seeded users.</p>
        </div>
      </form>

      <!-- 🌐 OIDC LOGIN BUTTON -->
      <div v-else-if="authMode === 'OIDC'">
        <p>
          Sign in using the trusted <strong>openSUSE OIDC provider</strong>.
        </p>
        <button class="login-button" @click="loginOIDC">Login with OIDC</button>
      </div>

      <!-- ⏳ LOADING STATE -->
      <div v-else>
        <p>Detecting authentication mode...</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore, authMode } from "../store/auth.js";

const router = useRouter();
const auth = useAuthStore();

const username = ref("");
const password = ref("");
const loading = ref(false);
const authError = ref("");

/**
 * 🧠 Detect authentication mode from backend
 */
onMounted(async () => {
  try {
    await auth.fetchAuthMode();
  } catch (err) {
    authError.value = err.message || "Cannot determine authentication mode";
  }
});

/**
 * 🔐 Local username/password login
 */
async function loginLocal() {
  loading.value = true;
  authError.value = "";

  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        username: username.value,
        password: password.value,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Login failed");
    }

    await auth.fetchWhoAmI(); // updates Pinia store
    router.push("/"); // redirect after login
  } catch (err) {
    authError.value = err.message || "Authentication error";
  } finally {
    loading.value = false;
  }
}

/**
 * 🌐 Trigger OIDC redirect flow
 */
function loginOIDC() {
  window.location.href = "/api/login"; // backend OIDC entrypoint
}
</script>

<style scoped>
.login-container {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: var(--bg, #f8f9fa);
}

.login-card {
  background: white;
  padding: 2.5rem;
  border-radius: 1rem;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);
  text-align: center;
  width: 360px;
}

.logo {
  width: 80px;
  margin-bottom: 1rem;
}

h1 {
  margin-bottom: 1rem;
  color: #73ba25;
}

.form-group {
  text-align: left;
  margin-bottom: 1rem;
}

label {
  display: block;
  font-size: 0.9rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
}

input {
  width: 100%;
  padding: 0.6rem;
  border: 1px solid #ccc;
  border-radius: 0.5rem;
  font-size: 1rem;
}

.login-button {
  width: 100%;
  padding: 0.7rem;
  border: none;
  border-radius: 0.5rem;
  font-weight: 600;
  background: #73ba25;
  color: white;
  cursor: pointer;
  transition: background 0.2s;
}

.login-button:hover {
  background: #5fa41f;
}

.error {
  color: #d9534f;
  margin-bottom: 1rem;
}

.hint {
  margin-top: 1rem;
  font-size: 0.85rem;
  color: #555;
}
</style>
