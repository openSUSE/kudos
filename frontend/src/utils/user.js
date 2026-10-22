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

/**
 * Find the first social handle (GitHub, Telegram, …) matching a lowercased
 * search query, so people known only by a handle can still be looked up.
 * A leading "@" is ignored on both sides. Returns { network, handle } or null.
 */
export function matchSocialHandle(user, query) {
  const needle = String(query || "").replace(/^@/, "");
  if (!needle) return null;
  return (
    (user?.socialHandles || []).find((entry) =>
      String(entry.handle || "").toLowerCase().replace(/^@/, "").includes(needle)
    ) || null
  );
}
