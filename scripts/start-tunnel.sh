#!/usr/bin/env bash
# Gives the running platform one public HTTPS link (a free Cloudflare quick
# tunnel), so it can be opened from another laptop on any network.
#
# Run ./scripts/start-all.sh first. This script then:
#   1. builds the frontend so it calls every service through /svc/<name> on
#      its own address (see serviceProxy in frontend/vite.config.js),
#   2. serves that build on 127.0.0.1:3003,
#   3. opens the tunnel to it and prints the public link.
#
# The LAN setup on :3002 is untouched and keeps working at the same time.
# Nothing is hosted elsewhere: this machine stays the server, so the link
# works only while it is on and these processes run. The link changes every
# time. Stop with ./scripts/stop-tunnel.sh.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT_DIR/.run"
mkdir -p "$RUN_DIR"
PREVIEW_PORT=3003

is_listening() { lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }

command -v cloudflared >/dev/null || { echo "cloudflared is not installed. Install it with: brew install cloudflared"; exit 1; }
for port in 3001 5002 8000 5005 5010; do
  is_listening "$port" || { echo "Nothing is running on port $port. Start the platform first: ./scripts/start-all.sh"; exit 1; }
done
"$ROOT_DIR/scripts/stop-tunnel.sh" >/dev/null 2>&1 || true

echo "Building the frontend for single-address use..."
( cd "$ROOT_DIR/frontend" && \
  VITE_API_URL=/svc/auth/api \
  VITE_EMOTION_API_BASE_URL=/svc/emotion \
  VITE_ANALYTICS_API_URL=/svc/class \
  VITE_EMOTION_API_URL=/svc/class \
  VITE_ADAPTIVE_API_URL=/svc/learn/api \
  VITE_STUDENT_PROFILE_API_URL=/svc/analytics \
  npx vite build --outDir dist-tunnel --emptyOutDir ) > "$RUN_DIR/tunnel-build.log" 2>&1 \
  || { echo "Build failed - see .run/tunnel-build.log"; exit 1; }

( cd "$ROOT_DIR/frontend" && exec npx vite preview --outDir dist-tunnel --port "$PREVIEW_PORT" --strictPort ) > "$RUN_DIR/tunnel-preview.log" 2>&1 &
echo $! > "$RUN_DIR/tunnel-preview.pid"
for _ in $(seq 1 30); do is_listening "$PREVIEW_PORT" && break; sleep 0.5; done
is_listening "$PREVIEW_PORT" || { echo "The preview server did not start - see .run/tunnel-preview.log"; exit 1; }

( exec cloudflared tunnel --no-autoupdate --url "http://127.0.0.1:$PREVIEW_PORT" ) > "$RUN_DIR/tunnel.log" 2>&1 &
echo $! > "$RUN_DIR/tunnel.pid"

URL=""
for _ in $(seq 1 60); do
  URL="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$RUN_DIR/tunnel.log" | head -1 || true)"
  [ -n "$URL" ] && break
  sleep 0.5
done
[ -n "$URL" ] || { echo "No public link yet - see .run/tunnel.log"; exit 1; }
echo "$URL" > "$RUN_DIR/tunnel.url"

echo ""
echo "Public link: $URL"
echo ""
echo "It can take up to a minute before the link answers."
echo "Keep this machine awake and online. Stop with: ./scripts/stop-tunnel.sh"
