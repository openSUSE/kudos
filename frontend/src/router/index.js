// Copyright © 2025–present Lubos Kocman and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0

import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../store/auth.js";

// 🧭 Lazy-loaded route components
const HomeView = () => import("../views/HomeView.vue");
const KudosView = () => import("../views/KudosView.vue");
const BadgesView = () => import("../views/BadgesView.vue");
const AdminView = () => import("../views/AdminView.vue");

const routesBase = [
  { path: "/", name: "home", component: HomeView, meta: { title: "Home · openSUSE Kudos" } },
  { path: "/kudos", name: "kudos", component: KudosView, meta: { title: "All Kudos · openSUSE Kudos" } },
  { path: "/kudo/:id", name: "KudoView", component: () => import("../views/KudoView.vue") },
  { path: "/kudo/:slug/print", name: "KudoPrintPreview", component: () => import("../views/KudoPrintView.vue"), meta: { title: "openSUSE Kudos Certificate" } },
  { path: "/kudos/new", name: "KudoCreate", component: () => import("../views/KudoCreateView.vue") },
  { path: "/badges", name: "badges", component: BadgesView, meta: { title: "Badges · openSUSE Kudos" } },
  { path: "/badge/:slug", name: "BadgeView", component: () => import("../views/BadgeView.vue") },
  { path: "/admin", name: "admin", component: AdminView, meta: { title: "Admin · openSUSE Kudos", requiresAdmin: true } },
  { path: "/user/:username", name: "UserProfile", component: () => import("../views/UserProfileView.vue") },
  { path: "/:pathMatch(.*)*", redirect: "/" },
];

/**
 * Creates the router *after* fetching auth mode from backend.
 */
export async function createAppRouter() {
  const auth = useAuthStore();
  const routes = [...routesBase];

  console.log("🔐 Using OIDC authentication mode in frontend router");
  const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes,
    scrollBehavior() {
      return { top: 0 };
    },
  });

  // 🔐 Simple route guard for admin routes
  router.beforeEach((to, from, next) => {
    const auth = useAuthStore();
    document.title = to.meta.title || "openSUSE Kudos";

    if (to.meta.requiresAdmin && (!auth.user || (auth.user.role !== "ADMIN" && auth.user.role !== "BOT"))) {
      return next("/login");
    }
    next();
  });

  return router;
}
