#!/usr/bin/env bash
# Stops exactly what start-all.sh started, by the PIDs it recorded in
# .run/ - not by pattern-matching process names (which can accidentally
# kill an unrelated process with a similar command line).

set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT_DIR/.run"

if [ ! -d "$RUN_DIR" ]; then
  echo "No .run/ directory - nothing tracked to stop."
  exit 0
fi

for pidfile in "$RUN_DIR"/*.pid; do
  [ -e "$pidfile" ] || continue
  name="$(basename "$pidfile" .pid)"
  pid="$(cat "$pidfile")"
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null
    echo "  stopped $name (pid $pid)"
  else
    echo "  $name (pid $pid) was already stopped"
  fi
  rm -f "$pidfile"
done

echo "Done."
