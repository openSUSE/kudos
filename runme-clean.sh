#!/bin/bash
# Copyright © 2025–present Lubos Kocman and openSUSE contributors
# SPDX-License-Identifier: Apache-2.0

set -e
trap 'echo "🧹 Shutting down..."; kill 0 2>/dev/null || true' EXIT

echo "───────────────────────────────────────────────"
echo " 💚 openSUSE Kudos — Full Clean Run"
echo "───────────────────────────────────────────────"

# --- Ensure dependencies are installed ---
if [ ! -d node_modules ]; then
  echo "📦 node_modules not found — installing dependencies..."
  npm install
else
  echo "✅ node_modules present, skipping npm install."
fi

# --- Always use dot_env.dev for local runs ---
if [ ! -f .env ]; then
  if [ -f dot_env.dev ]; then
    cp dot_env.dev .env
    echo "📄 Copied dot_env.dev → .env"
  else
    echo "❌ Missing dot_env.dev! Please add it before running."
    exit 1
  fi
else
  echo "✅ Existing .env preserved."  
fi

# Frontend requires .env in the dir too
if [ ! -f frontend/.env ]; then
	ln -sf ../.env frontend/.env
fi
# --- Sanity check for duplicate databases ---
echo "🔍 Checking for duplicate Prisma databases..."
FOUND_DUPES=$(find backend/prisma -type f -name "dev.db" | grep -v "^backend/prisma/dev.db" || true)
if [ -n "$FOUND_DUPES" ]; then
  echo "⚠️ Found stray Prisma DB files:"
  echo "$FOUND_DUPES"
  echo "🧨 Removing duplicates to prevent confusion..."
  echo "$FOUND_DUPES" | xargs -r rm -f
else
  echo "✅ No duplicate dev.db files found."
fi

# --- Reset + rebuild database ---
echo "💥 Resetting Prisma DB..."
rm -f backend/prisma/dev.db

echo "🧹 Cleaning old session files..."
rm -f backend/prisma/sessions.sqlite

if ! npx prisma -v >/dev/null 2>&1; then
  echo "❌ Prisma CLI not found — installing..."
  npm install prisma --save-dev
fi

# --- Initialize and sync badge submodule ---
echo "🔄 Initializing and syncing badge submodule..."
if [ ! -d frontend/public/badges/.git ]; then
  echo "📥 Initializing submodule..."
  git submodule update --init --recursive frontend/public/badges
fi

echo "🔄 Updating badge submodule to latest commit..."
git submodule update --recursive --remote frontend/public/badges
echo "✅ Badge submodule synchronized successfully."

# --- Create database schema ---
echo "🔧 Creating database schema from backend/prisma/schema.prisma..."
npx prisma db push --force-reset --schema=backend/prisma/schema.prisma

# --- Seed database ---
echo "🌱 Seeding database..."
node backend/prisma/seed.js || { echo "❌ Seeding failed."; exit 1; }

# --- Verify DB presence ---
DB_PATH="backend/prisma/dev.db"
if [ -f "$DB_PATH" ]; then
  echo "✅ Database file ready: $DB_PATH"
else
  echo "❌ Database file missing — creating an empty one."
  mkdir -p "$(dirname "$DB_PATH")"
  sqlite3 "$DB_PATH" "VACUUM;"
fi

# --- Launch Prisma Studio in background ---
echo "🧭 Starting Prisma Studio in background..."
BROWSER=none npx prisma studio --schema=backend/prisma/schema.prisma >/dev/null 2>&1 &
STUDIO_PID=$!
echo "🧩 Prisma Studio running (PID: $STUDIO_PID) → http://localhost:5555"

CERT_DIR="./certs"
CERT_KEY="${CERT_DIR}/localhost-key.pem"
CERT_CRT="${CERT_DIR}/localhost.pem"

mkdir -p "$CERT_DIR"

if [ ! -f "$CERT_KEY" ] || [ ! -f "$CERT_CRT" ]; then
  echo "🔐 Generating local HTTPS certificates with mkcert..."
  if ! command -v mkcert >/dev/null 2>&1; then
    echo "❌ mkcert not found! zypper in mkcert"
    exit 1
  fi
  mkcert -install
  mkcert -key-file "$CERT_KEY" -cert-file "$CERT_CRT" localhost
else
  echo "✅ Existing HTTPS certificates found in $CERT_DIR"
fi

# --- Launch app ---
echo "🚀 Launching app (backend + frontend with logging enabled)"

# Force development mode and Prisma debug logging
export NODE_ENV=development
export DEBUG=express:*,app:*
export PRISMA_CLIENT_LOG_LEVEL=debug

# --- Start backend and frontend concurrently ---
npm run backend:dev &
BACK_PID=$!

npm run frontend &
FRONT_PID=$!

# --- Handle cleanup ---
trap 'echo "🧹 Stopping backend (PID $BACK_PID) and frontend (PID $FRONT_PID)..."; kill $BACK_PID $FRONT_PID 2>/dev/null || true' EXIT

# --- Wait for both ---
wait
