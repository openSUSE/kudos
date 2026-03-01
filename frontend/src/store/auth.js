// frontend/src/store/auth.js
// Copyright © 2025–present Lubos Kocman and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0

import { defineStore } from "pinia";
import { ref } from "vue";
import { useNotifications } from "../composables/useNotifications";

const API_BASE = "/api"; // Always call backend; Vite proxy handles this in dev

export const useAuthStore = defineStore("auth", {
  state: () => ({
    user: null,
    notificationTimer: null,
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

          // 🧹 Clear any existing timer before starting a new one
          if (this.notificationTimer) clearInterval(this.notificationTimer);

          // 🔁 Poll for new notifications every 30s
          this.notificationTimer = setInterval(() => this.loadUnreadNotifications(), 30_000);
        } else {
          if (this.notificationTimer) clearInterval(this.notificationTimer);
          this.notificationTimer = null;
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
        const res = await fetch(`${API_BASE}/logout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            post_logout_redirect_uri: window.location.origin,
          }),
          credentials: "include",
        });

        // If the response is an opaque redirect, the browser is handling it.
        // We don't need to do anything else. The page will be unloaded.
        if (res.type === "opaque") {
          return;
        }

        if (!res.ok) {
          throw new Error(`Logout failed with ${res.status}`);
        }

        const data = await res.json();

        if (data.redirect) {
          window.location.href = data.redirect;
          return;
        } else {
          this.user = null;
        }
      } catch (err) {
        console.warn("Logout request failed:", err);
        // On failure, always clear local session as a fallback
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
        const { addNotification } = useNotifications();

        for (const n of list) {
          addNotification({ message: n.message, type: n.type || "info" });
        }
      } catch (err) {
        console.error("Failed to load unread notifications:", err);
      }
    },
  },
});
