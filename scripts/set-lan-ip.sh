#!/usr/bin/env bash
# Detects this machine's current LAN IP and rewrites every place that
# hardcodes it, so a live-class / presentation demo (other devices on the
# same network hitting this laptop by IP) keeps working after a Wi-Fi
# reconnect changes the address.
#
# Run this BEFORE starting the stack (start-all.sh calls it automatically).
# After running it manually, restart backend/emotion-backend/frontend for
# the change to take effect (Node/Vite/pydantic-settings only read these
# values at process startup).

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

IP="$(ipconfig getifaddr en0 2>/dev/null || true)"
if [ -z "$IP" ]; then
  IP="$(ipconfig getifaddr en1 2>/dev/null || true)"
fi
if [ -z "$IP" ]; then
  echo "Could not detect a LAN IP on en0/en1. Are you connected to Wi-Fi/Ethernet?" >&2
  exit 1
fi

IP_PATTERN='[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*'

echo "Detected LAN IP: $IP"

# frontend/.env - 6 VITE_* URLs
sed -i '' -E "s#http://${IP_PATTERN}:#http://${IP}:#g" "$ROOT_DIR/frontend/.env"
echo "  updated frontend/.env"

# root .env - FRONTEND_URL (Node backend CORS allowlist)
sed -i '' -E "s#http://${IP_PATTERN}:3002#http://${IP}:3002#g" "$ROOT_DIR/.env"
echo "  updated .env (FRONTEND_URL)"

# emotion-backend CORS allowlist default
sed -i '' -E "s#http://${IP_PATTERN}:3002#http://${IP}:3002#g" "$ROOT_DIR/emotion-backend/app/config.py"
echo "  updated emotion-backend/app/config.py (ALLOWED_ORIGINS)"

echo ""
echo "Done. Restart backend, emotion-backend, and frontend for this to take effect"
echo "(./scripts/start-all.sh does this from scratch if you'd rather just re-run everything)."
echo ""
echo "Present at: http://$IP:3002"
