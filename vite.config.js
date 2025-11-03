// vite.config.js
// Copyright © 2025–present Lubos Kocman and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0

import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import fs from "fs";
import path from "path";

export default defineConfig(({ mode }) => {
  // Absolute path to the project root (where .env lives)
  const rootDir = path.resolve(__dirname, ".");
  const env = loadEnv(mode, rootDir, "");  // load all vars

  // Make sure Vite sees .env from one level up
  Object.assign(process.env, env);

  // 🔒 Required variables
  const requiredVars = [
    "VITE_DEV_SERVER",
    "VITE_API_BASE",
    "BACKEND_ORIGIN",
    "CERT_KEY_PATH",
    "CERT_CRT_PATH",
  ];
  for (const key of requiredVars) {
    if (!env[key]) throw new Error(`❌ Missing required variable: ${key}`);
  }

  const FRONTEND_ORIGIN = env.VITE_DEV_SERVER;
  const API_BASE = env.VITE_API_BASE;
  const BACKEND_ORIGIN = env.BACKEND_ORIGIN;
  const APP_TITLE = env.VITE_APP_TITLE || "openSUSE Kudos";

  console.log(`🌍 Frontend Origin: ${FRONTEND_ORIGIN}`);
  console.log(`🔗 Proxying ${API_BASE} → ${BACKEND_ORIGIN}`);

  // HTTPS options
  const certKeyPath = path.resolve(rootDir, env.CERT_KEY_PATH);
  const certCrtPath = path.resolve(rootDir, env.CERT_CRT_PATH);

  let httpsOptions = false;
  if (fs.existsSync(certKeyPath) && fs.existsSync(certCrtPath)) {
    httpsOptions = {
      key: fs.readFileSync(certKeyPath),
      cert: fs.readFileSync(certCrtPath),
    };
  } else {
    console.warn(
      `⚠️ Certificates not found at:\n  ${certKeyPath}\n  ${certCrtPath}\n→ Using HTTP.`
    );
  }

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
        },
      },
    },

    build: {
      outDir: "../backend/public",
      emptyOutDir: true,
    },

    define: {
      __APP_TITLE__: JSON.stringify(APP_TITLE),
      "process.env": env, // Important! makes import.meta.env.VITE_* available in browser
    },
  };
});
