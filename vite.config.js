// frontend/vite.config.js
// Copyright © 2025–present Lubos Kocman and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0

import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import fs from "fs";
import path from "path";

export default defineConfig(({ mode }) => {
  // 🧩 Load .env variables (both VITE_ and unprefixed)
  const env = loadEnv(mode, process.cwd(), "");

  // 🔒 Required environment variables
  const requiredVars = [
    "VITE_DEV_SERVER",
    "VITE_API_BASE",
    "BACKEND_ORIGIN",
    "CERT_KEY_PATH",
    "CERT_CRT_PATH",
  ];

  for (const key of requiredVars) {
    if (!env[key]) {
      throw new Error(`❌ Missing required environment variable: ${key}`);
    }
  }

  const FRONTEND_ORIGIN = env.VITE_DEV_SERVER;   // e.g. https://localhost:5173
  const API_BASE = env.VITE_API_BASE;            // e.g. /api
  const BACKEND_ORIGIN = env.BACKEND_ORIGIN;     // e.g. https://localhost:3000
  const APP_TITLE = env.VITE_APP_TITLE || "openSUSE Kudos";

  console.log(`🌍 Frontend Origin: ${FRONTEND_ORIGIN}`);
  console.log(`🔗 Proxying ${API_BASE} → ${BACKEND_ORIGIN}`);

  // ✅ Load HTTPS certs for local dev
  const certKeyPath = path.resolve(process.cwd(), env.CERT_KEY_PATH);
  const certCrtPath = path.resolve(process.cwd(), env.CERT_CRT_PATH);

  if (!fs.existsSync(certKeyPath) || !fs.existsSync(certCrtPath)) {
    throw new Error(
      `❌ HTTPS certificates not found at:\n  ${certKeyPath}\n  ${certCrtPath}`
    );
  }

  const httpsOptions = {
    key: fs.readFileSync(certKeyPath),
    cert: fs.readFileSync(certCrtPath),
  };

  return {
    root: "./frontend",
    plugins: [vue()],

    server: {
      https: httpsOptions,
      host: "0.0.0.0",
      port: 5173,

      cors: {
        origin: FRONTEND_ORIGIN,
        credentials: true,
      },

      proxy: {
        [API_BASE]: {
          target: BACKEND_ORIGIN,
          changeOrigin: true,
          secure: false,
          ws: false,
          cookieDomainRewrite: "",
          headers: {
            "X-Forwarded-Proto": "https",
          },
          configure: (proxy) => {
            proxy.on("proxyRes", (proxyRes) => {
              const cookies = proxyRes.headers["set-cookie"];
              if (cookies) {
                console.log("🍪 Backend Set-Cookie:", cookies);
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
      __APP_TITLE__: JSON.stringify(APP_TITLE),
    },
  };
});
