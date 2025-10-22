// frontend/src/store/auth.js
// Copyright © 2025–present Lubos Kocman and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0

import { defineStore } from "pinia";
import { ref } from "vue";
import { useNotifications } from "../composables/useNotifications";

const API_BASE = "/api"; // Always call backend; Vite proxy handles this in dev

// 🧩 Shared reactive value for authentication mode
export const authMode = ref(sessionStorage.getItem("authMode") || null);

export const useAuthStore = defineStore("auth", {
  state: () => ({
    user: null,
  }),

  getters: {
    isAuthenticated: (state) => !!state.user,
  },

  actions: {
    /**
     * 🧭 Detect authentication mode from backend
     * - Never silently defaults to LOCAL
     * - Throws if backend fails or returns invalid mode
     */
    async fetchAuthMode() {
      // Avoid re-fetch if already cached in sessionStorage
      if (authMode.value) {
        return authMode.value;
      }

      let data;
      try {
        const res = await fetch(`${API_BASE}/auth-mode`, {
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error(`Backend returned HTTP ${res.status}`);
        }

        data = await res.json();
      } catch (err) {
        console.error("❌ Failed to fetch /api/auth-mode:", err);
        throw new Error("Cannot determine authentication mode from backend.");
      }

      if (!data?.mode || !["LOCAL", "OIDC"].includes(data.mode)) {
        console.error("❌ Invalid auth mode from backend:", data);
        throw new Error("Backend returned invalid auth mode response.");
      }

      authMode.value = data.mode;
      sessionStorage.setItem("authMode", authMode.value);
      console.log(`🔐 Auth mode detected from backend: ${authMode.value}`);

      return authMode.value;
    },

    /**
     * 🧍 Fetch currently logged-in user
     */
    async fetchWhoAmI() {
      try {
        const res = await fetch(`${API_BASE}/whoami`, {
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error(`whoami failed with ${res.status}`);
        }

        const data = await res.json();
        console.log("🧩 whoami response:", data);

        // ✅ Accept either `authenticated` flag or plain user object
        if (data?.authenticated || (data?.id && data?.username)) {
          this.user = data;
          console.log("✅ Authenticated user:", this.user);

          await this.loadUnreadNotifications();

          // 🔁 Poll for new notifications every 30s
          setInterval(() => this.loadUnreadNotifications(), 30_000);
        } else {
          this.user = null;
          console.log("🚫 No active session.");
        }
      } catch (err) {
        console.error("Failed to fetch user:", err);
        this.user = null;
      }
    },

    /**
     * 🚪 Logout the user
     */
    async logout() {
      try {
        const res = await fetch(`${API_BASE}/auth/logout`, {
          method: "POST",
          credentials: "include",
        });
        if (!res.ok) {
          throw new Error(`Logout failed with ${res.status}`);
        }
      } catch (err) {
        console.warn("Logout request failed:", err);
      } finally {
        this.user = null;
      }
    },

    /**
     * 🔔 Load unread notifications
     */
    async loadUnreadNotifications() {
      if (!this.user) return;

      try {
        const res = await fetch(`${API_BASE}/notifications/unread`, {
          credentials: "include",
        });

        if (!res.ok) {
          console.warn("Unread notifications request failed:", res.status);
          return;
        }

        const list = await res.json();
        const { notify } = useNotifications();

        for (const n of list) {
          notify(n.message, n.type || "info");
        }
      } catch (err) {
        console.error("Failed to load unread notifications:", err);
      }
    },
  },
});
