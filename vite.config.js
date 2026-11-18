// vite.config.js
// Copyright © 2025–present Lubos Kocman and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0

import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import fs from "fs";
import path from "path";

export default defineConfig(({ mode }) => {
  const rootDir = path.resolve(__dirname, ".");
  const env = loadEnv(mode, rootDir, ""); // load .env

  Object.assign(process.env, env);

  // Auto-fill missing vars in Netlify or local builds
  process.env.VITE_DEV_SERVER ??= process.env.DEPLOY_PRIME_URL || process.env.URL || "http://localhost:5173";
  process.env.VITE_API_BASE ??= "/api";
  process.env.BACKEND_ORIGIN ??= process.env.VITE_BACKEND_URL || "http://localhost:3000";
  process.env.CERT_KEY_PATH ??= "certs/localhost-key.pem";
  process.env.CERT_CRT_PATH ??= "certs/localhost.pem";

  // Strict check after fallback
  const requiredVars = [
    "VITE_DEV_SERVER",
    "VITE_API_BASE",
    "BACKEND_ORIGIN",
    "CERT_KEY_PATH",
    "CERT_CRT_PATH",
  ];
  for (const key of requiredVars) {
    if (!process.env[key]) throw new Error(`❌ Missing required variable: ${key}`);
  }

  const FRONTEND_ORIGIN = process.env.VITE_DEV_SERVER;
  const API_BASE = process.env.VITE_API_BASE;
  const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN;
  const APP_TITLE = process.env.VITE_APP_TITLE || "openSUSE Kudos";

  console.log(`🌍 Frontend Origin: ${FRONTEND_ORIGIN}`);
  console.log(`🔗 Proxying ${API_BASE} → ${BACKEND_ORIGIN}`);

  // HTTPS support (local only)
  const certKeyPath = path.resolve(rootDir, process.env.CERT_KEY_PATH);
  const certCrtPath = path.resolve(rootDir, process.env.CERT_CRT_PATH);

  let httpsOptions = false;
  if (fs.existsSync(certKeyPath) && fs.existsSync(certCrtPath)) {
    httpsOptions = {
      key: fs.readFileSync(certKeyPath),
      cert: fs.readFileSync(certCrtPath),
    };
  } else {
    console.warn(`⚠️ Certificates not found at:
  ${certKeyPath}
  ${certCrtPath}
→ Using HTTP.`);
  }

  const proxyTarget = httpsOptions
    ? BACKEND_ORIGIN
    : BACKEND_ORIGIN.replace(/^https:\/\//, "http://");

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
          target: proxyTarget,
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            proxy.on("error", (err, req) => {
              console.error(`💥 Vite proxy error for ${req.url}:`, err.message);
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
      "process.env": process.env,
    },
  };
});
