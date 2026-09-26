// Copyright © 2025–present Lubos Kocman and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0
//
// Translated badge titles and descriptions.
//
// Badge strings ship with the kudos-badges package, not with this app, so they
// are fetched at runtime from /badges/locales/<lang>.json instead of being
// bundled like strings.*.json. The API's English text is the fallback, so a
// missing translation (or an older kudos-badges) still shows something.
// See docs/badges.md.

import { reactive } from "vue";
import { useI18n } from "vue-i18n";

const strings = reactive({}); // { [locale]: { [slug]: { title, description } } }
const requested = new Set();

export async function loadBadgeStrings(locale) {
  if (!locale || locale === "en" || requested.has(locale)) return;
  requested.add(locale);
  try {
    const res = await fetch(`/badges/locales/${locale}.json`);
    // An unknown path under /badges falls back to the SPA's index.html.
    if (!res.ok || !res.headers.get("content-type")?.includes("json")) return;
    strings[locale] = await res.json();
  } catch {
    // Keep the English fallback.
  }
}

export function useBadgeText() {
  const { locale } = useI18n();

  const lookup = (badge, key) => strings[locale.value]?.[badge?.slug]?.[key] || badge?.[key] || "";

  return {
    badgeTitle: (badge) => lookup(badge, "title"),
    badgeDescription: (badge) => lookup(badge, "description"),
  };
}
