#!/usr/bin/env bash
# Stops the public link started by start-tunnel.sh (the tunnel and the
# preview server on :3003), by PID. The platform itself keeps running.
set -uo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT_DIR/.run"
for name in tunnel tunnel-preview; do
  pid_file="$RUN_DIR/$name.pid"
  if [ -f "$pid_file" ]; then
    pid="$(cat "$pid_file")"
    if kill -0 "$pid" 2>/dev/null; then
      pkill -P "$pid" 2>/dev/null || true
      kill "$pid" 2>/dev/null && echo "  stopped $name (pid $pid)"
    fi
    rm -f "$pid_file"
  fi
done
rm -f "$RUN_DIR/tunnel.url"
echo "Public link closed."
