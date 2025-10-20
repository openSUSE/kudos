// frontend/src/store/auth.js
// Copyright © 2025–present Lubos Kocman and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0

import { defineStore } from "pinia";
import { ref } from "vue";
import { useNotifications } from "../composables/useNotifications";

// In development, Vite proxies /api → backend, so don’t double-prefix
const API_BASE =
  import.meta.env.MODE === "development"
    ? "" // ✅ Vite proxy handles /api automatically
    : import.meta.env.VITE_API_BASE || "/api";

// 🧩 Shared reactive value for auth mode
export const authMode = ref(sessionStorage.getItem("authMode") || "LOCAL");

export const useAuthStore = defineStore("auth", {
  state: () => ({
    user: null,
  }),

  getters: {
    isAuthenticated: (state) => !!state.user,
  },

  actions: {
    // 🧭 Detect auth mode from backend
    async fetchAuthMode() {
      try {
        const res = await fetch(`${API_BASE}/api/auth-mode`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          authMode.value = data.mode || "LOCAL";
          sessionStorage.setItem("authMode", authMode.value);
          console.log(`🔐 Detected auth mode: ${authMode.value}`);
        }
      } catch (err) {
        console.warn("⚠️ Failed to fetch auth mode, defaulting to LOCAL", err);
        authMode.value = "LOCAL";
      }
    },

    // 🧍 Fetch currently logged-in user
    async fetchWhoAmI() {
      try {
        const res = await fetch(`${API_BASE}/api/whoami`, {
          credentials: "include", // 👈 send session cookie
        });

        if (res.ok) {
          const data = await res.json();

          if (data?.authenticated) {
            this.user = data;
            await this.loadUnreadNotifications();

            // 🔁 Poll for new notifications every 30s
            setInterval(() => this.loadUnreadNotifications(), 30_000);
          } else {
            this.user = null;
          }
        } else {
          this.user = null;
        }
      } catch (err) {
        console.error("Failed to fetch user:", err);
        this.user = null;
      }
    },

    // 🚪 Logout (API + local state)
    async logout() {
      try {
        await fetch(`${API_BASE}/api/auth/logout`, {
          method: "POST",
          credentials: "include",
        });
      } catch (err) {
        console.warn("Logout request failed:", err);
      }
      this.user = null;
    },

    // 🔔 Load unread notifications
    async loadUnreadNotifications() {
      if (!this.user) return;

      try {
        const res = await fetch(`${API_BASE}/api/notifications/unread`, {
          credentials: "include",
        });

        if (!res.ok) return;

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
