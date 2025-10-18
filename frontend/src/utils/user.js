// Copyright © 2025–present Lubos Kocman and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * Generate a safe avatar URL for the frontend.
 * Priority:
 *  1. user.avatarUrl (if non-empty)
 *  2. DiceBear fallback (no Gravatar / email)
 */
export function getAvatarUrl(user) {
  if (!user) return "/avatars/default.png";

  if (user.avatarUrl && user.avatarUrl.trim() !== "") {
    return user.avatarUrl;
  }

  return `https://api.dicebear.com/9.x/identicon/svg?seed=${encodeURIComponent(
    user.username || "unknown"
  )}`;
}

/**
 * Handle image load errors by switching to DiceBear.
 */
export function handleAvatarError(event, user) {
  const fallback = getAvatarUrl(user);
  if (event?.target?.src !== fallback) {
    event.target.src = fallback;
  }
}
