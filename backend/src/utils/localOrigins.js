// Copyright © 2025–present Lubos Kocman and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

/** Downgrade HTTPS only for local origins when their development certs are absent. */
export function normalizeLocalUrl(value, { hasCertificates = false } = {}) {
  const url = new URL(value);
  if (!hasCertificates && url.protocol === "https:" && LOCAL_HOSTS.has(url.hostname)) {
    url.protocol = "http:";
  }
  return url.toString();
}

/** Resolve the small set of origin placeholders used by dot_env.dev. */
export function expandEnvironment(value, variables) {
  return value.replace(/\$\{(BACKEND_ORIGIN|VITE_DEV_SERVER)\}/g, (match, name) => variables[name] ?? match);
}
