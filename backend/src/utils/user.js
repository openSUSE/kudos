// backend/src/utils/user.js
// Copyright © 2025–present Lubos Kocman and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0

import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

/**
 * Generate a valid avatar URL for a user.
 * Order of preference:
 *  1. user.avatarUrl (custom/local)
 *  2. Gravatar (if email present)
 *  3. Dicebear identicon fallback
 */
export function getAvatarUrl(user) {
  if (!user) return "/avatars/default.png";

  if (user.avatarUrl && user.avatarUrl.trim() !== "") {
    return user.avatarUrl;
  }

  if (user.email) {
    const hash = crypto
      .createHash("md5")
      .update(user.email.trim().toLowerCase())
      .digest("hex");
    return `https://www.gravatar.com/avatar/${hash}?d=identicon`;
  }

  return `https://api.dicebear.com/9.x/identicon/svg?seed=${encodeURIComponent(
    user.username || "unknown"
  )}`;
}

/**
 * Remove sensitive fields and ensure avatar URL fallback.
 */
export function sanitizeUser(user) {
  if (!user) return null;
  const { email, passwordHash, botSecret, ...safe } = user;
  return { ...safe, avatarUrl: getAvatarUrl(user) };
}

/**
 * Check if a username or email is listed as an admin in .env
 * (case-insensitive).
 */
export function isAdminUser(identifier) {
  if (!identifier) return false;

  const adminList = (process.env.ADMIN_USERS || "")
    .split(",")
    .map((u) => u.trim().toLowerCase())
    .filter(Boolean);

  const normalized = identifier.trim().toLowerCase();
  return adminList.includes(normalized);
}
