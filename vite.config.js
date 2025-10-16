// frontend/vite.config.js
// Copyright © 2025–present Lubos Kocman and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0

import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import fs from "fs";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const backend = env.VITE_API_BASE || "https://localhost:3000";

  console.log(`🔗 Proxying /api → ${backend}`);

  // ⚠️ Sanity check for HTTPS backend
  if (!backend.startsWith("https://")) {
    console.warn(
      "⚠️ Backend is not using HTTPS! Secure cookies may fail (cross-origin cookies need SameSite=None; Secure)."
    );
  }

  // ✅ Enable HTTPS for local dev so Secure cookies work
  const httpsOptions = {
    key: fs.readFileSync(path.resolve(process.cwd(), "certs/localhost-key.pem")),
    cert: fs.readFileSync(path.resolve(process.cwd(), "certs/localhost.pem")),
  };

  return {
    root: "./frontend",
    plugins: [vue()],

    server: {
      https: httpsOptions,
      port: 5173,
      host: "0.0.0.0",

      cors: {
        origin: "https://localhost:5173",
        credentials: true,
      },

      proxy: {
        "/api": {
          target: backend,
          changeOrigin: true,
          secure: false,
          ws: false,
          cookieDomainRewrite: "",
          headers: { "X-Forwarded-Proto": "https" }, // 👈 tell Express request is HTTPS
          configure: (proxy) => {
            proxy.on("proxyRes", (proxyRes) => {
              if (proxyRes.headers["set-cookie"]) {
                console.log("🍪 Set-Cookie from backend:", proxyRes.headers["set-cookie"]);
              }
            });
          },
        },
      },
    },

    build: {
      outDir: "../backend/public",
      emptyOutDir: true,
    },

    define: {
      __APP_TITLE__: JSON.stringify(env.VITE_APP_TITLE || "openSUSE Kudos"),
    },
  };
});
