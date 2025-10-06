#!/bin/bash
set -e
trap 'echo "🧹 Shutting down..."; kill 0' EXIT

# --- Prevent accidental execution inside prisma/ ---
if [[ "$(basename "$(pwd)")" == "prisma" ]]; then
  echo "🚫 ERROR: Do not run this script from inside the prisma/ directory!"
  echo "   Run it from the project root instead: ./runme-clean.sh"
  exit 1
fi

echo "🧹 Resetting database and environment..."

# --- Copy .env only if missing ---
if [ ! -f .env ]; then
  cp .env.example .env
  echo "📄 Copied .env.example → .env"
else
  echo "✅ Existing .env preserved"
fi

# --- Sanity check for duplicate databases ---
echo "🔍 Checking for duplicate Prisma databases..."
FOUND_DUPES=$(find prisma -type f -name "dev.db" | grep -v "^prisma/dev.db" || true)
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
npx prisma migrate reset --force --skip-seed

echo "🔧 Applying migrations..."
# Apply existing migrations without creating new ones
npx prisma migrate deploy

# --- Seed database ---
echo "🌱 Seeding database..."
node prisma/seed.js

# --- Verify DB presence ---
if [ -f "$DB_PATH" ]; then
  echo "✅ Database file ready: $DB_PATH"
else
  echo "❌ Database file missing — creating an empty one."
  mkdir -p "$(dirname "$DB_PATH")"
  sqlite3 "$DB_PATH" "VACUUM;"
fi

# --- Launch Prisma Studio in background ---
echo "🧭 Starting Prisma Studio in background..."
npx prisma studio >/dev/null 2>&1 &
STUDIO_PID=$!
echo "🧩 Prisma Studio running (PID: $STUDIO_PID) → http://localhost:5555"

# --- Launch app ---
echo "🚀 Launching app on http://localhost:3000"
npm run dev
