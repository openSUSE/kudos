// backend/src/services/notify.js
// Copyright © 2025–present Lubos Kocman and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0

// In-app notifications only. Email is sent by kudos-notify (notify/index.cjs),
// which reads the same events off /api/now/stream.
//
// This used to send an HTML email as well, but it never worked in production:
// its templates were resolved against the working directory, which is `/`
// under kudos.service, so every send threw after the row was written. Had it
// worked, every kudos and badge mail would have gone out twice.

/**
 * Reduce a link to an in-app path. Permalinks are built from BASE_URL, which
 * in development points at the backend rather than the Vite server, so the
 * origin is dropped and the frontend router resolves the rest.
 */
export function appPath(link) {
  if (!link) return null;
  try {
    const url = new URL(link, "http://kudos.invalid");
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export async function sendNotification(prisma, { userId, message, type = "info", link = null }) {
  return prisma.notification.create({
    data: { userId, message, type, link: appPath(link) },
  });
}
