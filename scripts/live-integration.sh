#!/usr/bin/env bash
# Mobile ↔ API live integration check: builds and starts the API locally (mock provider,
# dev inbox), runs the Flutter live test through the app's real API clients, then stops the API.
# Requires a migrated database (DATABASE_URL in api/.env) and Flutter.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${LIVE_PORT:-3100}"
cd "$ROOT/api"
npm run -s build >/dev/null
PORT="$PORT" PUBLIC_BASE_URL="http://localhost:$PORT" EMAIL_TRANSPORT=dev-inbox WORKER_MODE=inline LOG_LEVEL=warn \
  node dist/main.js > "${TMPDIR:-/tmp}/xendirekt-live-api.log" 2>&1 &
API_PID=$!
trap 'kill "$API_PID" 2>/dev/null || true' EXIT
for _ in $(seq 1 30); do
  curl -sf "http://localhost:$PORT/health/ready" >/dev/null && break
  sleep 0.5
done
cd "$ROOT/android-ios"
XD_LIVE_API="http://localhost:$PORT" flutter test test/integration/live_api_test.dart
