// frontend/src/store/badges.js
// Copyright © 2025–present Lubos Kocman and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0

import { ref } from "vue"

export const badges = ref([])

export async function fetchUserBadges(username) {
  try {
    const res = await fetch(`/api/badges/user/${username}`)
    if (!res.ok) throw new Error(`Failed to fetch badges for ${username}`)
    badges.value = await res.json()
  } catch (err) {
    console.error("💥 Error fetching user badges:", err)
    badges.value = []
  }
}
