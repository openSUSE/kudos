#!/bin/bash
# Script to install pre-downloaded Prisma engines for offline builds (e.g., OBS)
# This avoids the need to fetch engines from binaries.prisma.sh during build

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENGINES_SOURCE="$PROJECT_ROOT/prisma-engines"
ENGINES_DEST="$PROJECT_ROOT/node_modules/@prisma/engines"

echo "Installing pre-downloaded Prisma engines..."

# Check if source engines exist
if [ ! -f "$ENGINES_SOURCE/libquery_engine.so.node" ]; then
    echo "Error: libquery_engine.so.node not found in $ENGINES_SOURCE"
    exit 1
fi

if [ ! -f "$ENGINES_SOURCE/schema-engine" ]; then
    echo "Error: schema-engine not found in $ENGINES_SOURCE"
    exit 1
fi

# Create destination directory if it doesn't exist
mkdir -p "$ENGINES_DEST"

# Copy engines with correct names for debian-openssl-3.0.x target
cp "$ENGINES_SOURCE/libquery_engine.so.node" "$ENGINES_DEST/libquery_engine-debian-openssl-3.0.x.so.node"
cp "$ENGINES_SOURCE/schema-engine" "$ENGINES_DEST/schema-engine-debian-openssl-3.0.x"

# Make schema-engine executable
chmod +x "$ENGINES_DEST/schema-engine-debian-openssl-3.0.x"

echo "✓ Prisma engines installed successfully to $ENGINES_DEST"
ls -la "$ENGINES_DEST"
