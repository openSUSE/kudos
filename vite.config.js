// vite.config.js
// Copyright © 2025–present Lubos Kocman and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0

import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLocalUrl } from "./backend/src/utils/localOrigins.js";

export default defineConfig(({ mode }) => {
  const rootDir = path.dirname(fileURLToPath(import.meta.url));
  const env = { ...process.env, ...loadEnv(mode, rootDir, "") };

  env.VITE_DEV_SERVER ??= env.DEPLOY_PRIME_URL || env.URL || "http://localhost:5173";
  env.VITE_API_BASE ??= "/api";
  env.BACKEND_ORIGIN ??= env.VITE_BACKEND_URL || "http://localhost:3000";
  env.CERT_KEY_PATH ??= "certs/localhost-key.pem";
  env.CERT_CRT_PATH ??= "certs/localhost.pem";

  const certKeyPath = path.resolve(rootDir, env.CERT_KEY_PATH);
  const certCrtPath = path.resolve(rootDir, env.CERT_CRT_PATH);
  const hasCertificates = fs.existsSync(certKeyPath) && fs.existsSync(certCrtPath);
  const configuredFrontend = new URL(env.VITE_DEV_SERVER);
  const configuredBackend = new URL(env.BACKEND_ORIGIN);
  const frontendUrl = new URL(normalizeLocalUrl(env.VITE_DEV_SERVER, { hasCertificates }));
  const backendUrl = new URL(normalizeLocalUrl(env.BACKEND_ORIGIN, { hasCertificates }));
  const FRONTEND_ORIGIN = frontendUrl.origin;
  const BACKEND_ORIGIN = backendUrl.origin;
  const API_BASE = env.VITE_API_BASE;
  const APP_TITLE = env.VITE_APP_TITLE || "openSUSE Kudos";

  if (configuredFrontend.protocol === "https:" && frontendUrl.protocol === "http:") {
    console.warn("⚠️ Local frontend certificates are missing; using HTTP for the Vite server.");
  }
  if (configuredBackend.protocol === "https:" && backendUrl.protocol === "http:") {
    console.warn("⚠️ Local backend certificates are missing; proxying to HTTP.");
  }

  console.log(`🌍 Frontend Origin: ${FRONTEND_ORIGIN}`);
  console.log(`🔗 Proxying ${API_BASE} → ${BACKEND_ORIGIN}`);

  const httpsOptions = hasCertificates
    ? { key: fs.readFileSync(certKeyPath), cert: fs.readFileSync(certCrtPath) }
    : false;

  return {
    root: "./frontend",
    envDir: rootDir,
    plugins: [vue()],
    server: {
      https: frontendUrl.protocol === "https:" ? httpsOptions : false,
      host: "0.0.0.0",
      port: Number(frontendUrl.port || 5173),
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
      "import.meta.env.VITE_API_BASE": JSON.stringify(API_BASE),
    },
  };
});
