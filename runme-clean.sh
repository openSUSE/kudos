#!/bin/bash
set -e
trap 'echo "🧹 Shutting down..."; kill 0' EXIT

echo "🧹 Resetting database and environment..."

# --- Ensure dependencies are installed ---
if [ ! -d node_modules ]; then
  echo "📦 node_modules not found — installing dependencies..."
  npm install
else
  echo "✅ node_modules present, skipping npm install."
fi

# --- Copy .env only if missing ---
if [ ! -f .env ]; then
  cp .env.example .env
  echo "📄 Copied .env.example → .env"
else
  echo "✅ Existing .env preserved."
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
rm -f prisma/dev.db

# Check if Prisma is available
if ! npx prisma -v >/dev/null 2>&1; then
  echo "❌ Prisma CLI not found in node_modules — installing..."
  npm install @prisma/cli --save-dev
fi

echo "🔧 Creating database schema from prisma/schema.prisma..."
npx prisma db push --force-reset

# --- Seed database ---
echo "🌱 Seeding database..."
node prisma/seed.js || { echo "❌ Seeding failed."; exit 1; }

# --- Verify DB presence ---
DB_PATH="prisma/dev.db"
if [ -f "$DB_PATH" ]; then
  echo "✅ Database file ready: $DB_PATH"
else
  echo "❌ Database file missing — creating an empty one."
  mkdir -p "$(dirname "$DB_PATH")"
  sqlite3 "$DB_PATH" "VACUUM;"
fi

# --- Launch Prisma Studio in background ---
echo "🧭 Starting Prisma Studio in background..."
BROWSER=none npx prisma studio >/dev/null 2>&1 &
STUDIO_PID=$!
echo "🧩 Prisma Studio running (PID: $STUDIO_PID) → http://localhost:5555"

# --- Launch app ---
echo "🚀 Launching app on http://localhost:3000"
npm run dev
