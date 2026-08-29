#!/usr/bin/env bash
# Starts the full stack (frontend + all 5 backend services) for a demo /
# presentation, with debug mode off (no Werkzeug debugger exposed on the
# shared network, no stack traces leaked to other devices on a live class).
#
# Safe to re-run: skips any service whose port is already listening rather
# than starting a second copy. PIDs are tracked in .run/ so stop-all.sh can
# shut down exactly what this script started, by PID - not by matching a
# process name pattern (a pattern match can catch someone else's process
# with the same command, e.g. "node index.js" run from a different repo).

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT_DIR/.run"
mkdir -p "$RUN_DIR"

"$ROOT_DIR/scripts/set-lan-ip.sh"
echo ""

is_listening() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

# Backgrounds ( cd dir; exec "$@" ) as ONE subshell that immediately execs
# into the real command - exec replaces the subshell's process image rather
# than forking a child, so $! (read right after, in THIS shell) is
# guaranteed to be the real service's PID, not a wrapper's. Using eval or
# a "VAR=val cmd" string here instead (an earlier version of this script
# did) let bash background an intermediate shell, so stop-all.sh ended up
# killing that wrapper while the actual node/python process kept running,
# orphaned but still bound to the port - exactly the bug this avoids.
start_service() {
  local name="$1" port="$2" dir="$3"
  shift 3
  if is_listening "$port"; then
    echo "  [skip] $name already running on :$port"
    return
  fi
  ( cd "$dir" && exec "$@" ) > "$RUN_DIR/$name.log" 2>&1 &
  echo $! > "$RUN_DIR/$name.pid"
  echo "  [start] $name -> :$port (log: .run/$name.log)"
}

echo "Starting services (debug mode off)..."
start_service backend            3001 "$ROOT_DIR/backend" \
  node index.js
start_service emotion-service    5002 "$ROOT_DIR/emotion-service" \
  env EMOTION_SERVICE_DEBUG=false .venv/bin/python flask_api.py
start_service emotion-backend    8000 "$ROOT_DIR/emotion-backend" \
  env DEBUG=false .venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
start_service adaptive-learning  5005 "$ROOT_DIR/adaptive-learning/backend" \
  env FLASK_DEBUG=false .venv/bin/python app.py
start_service analytics-service 5010 "$ROOT_DIR/analytics-service" \
  env ANALYTICS_SERVICE_DEBUG=false .venv/bin/python app.py
start_service frontend           3002 "$ROOT_DIR/frontend" \
  "$ROOT_DIR/node_modules/.bin/vite" dev

echo ""
echo "Waiting for services to come up (emotion-service's model load is the slow one)..."
sleep 12

echo ""
echo "Health check:"
check() {
  local name="$1" url="$2"
  if curl -sS -m 3 -o /dev/null -w "" "$url" 2>/dev/null; then
    echo "  [ok]   $name"
  else
    echo "  [FAIL] $name - $url (check .run/$name.log)"
  fi
}
check backend            "http://localhost:3001/api/health"
check emotion-service    "http://localhost:5002/health"
check emotion-backend    "http://localhost:8000/health"
check adaptive-learning  "http://localhost:5005/api/health"
check analytics-service  "http://localhost:5010/health"
check frontend           "http://localhost:3002/"

IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "127.0.0.1")"
echo ""
echo "Present at: http://$IP:3002"
echo "Stop everything with: ./scripts/stop-all.sh"
