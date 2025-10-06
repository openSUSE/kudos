#!/usr/bin/env bash
set -euo pipefail
API_URL="${API_URL:-http://localhost:3000/api/bot/stats-run}"
BOT_TOKEN="${BOT_TOKEN:-$BOT_API_TOKEN}"
if [[ -z "${BOT_TOKEN:-}" ]]; then echo "Error: BOT_TOKEN or BOT_API_TOKEN required" >&2; exit 1; fi
echo "[$(date '+%F %T')] Running stats-bot at ${API_URL}"
curl -s -X POST -H "x-api-token: ${BOT_TOKEN}" "${API_URL}" | tee /dev/stderr
