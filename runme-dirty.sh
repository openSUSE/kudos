#!/bin/bash
# Copyright © 2025–present Lubos Kocman and openSUSE contributors
# SPDX-License-Identifier: Apache-2.0

set -e
trap 'echo "🧹 Shutting down..."; kill 0 2>/dev/null || true' EXIT

echo "───────────────────────────────────────────────"
echo " 💚 openSUSE Kudos — just the service"
echo "───────────────────────────────────────────────"

# --- Launch app ---
echo "🚀 Launching app (backend + frontend with logging enabled)"

# Force development mode and Prisma debug logging
export NODE_ENV=development
export DEBUG=express:*,app:*
export PRISMA_CLIENT_LOG_LEVEL=debug

# --- Start backend and frontend concurrently ---
npm run dev &
APP_PID=$!

# --- Handle cleanup ---
trap 'echo "🧹 Stopping app..."; kill $APP_PID 2>/dev/null || true' EXIT

wait
