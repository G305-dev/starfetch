#!/bin/sh
set -eu

# Updates signatures inside the approved Nigerian environment. Failure to update
# signatures is fatal; the worker cannot start using stale/absent definitions.
freshclam --stdout --verbose

# Start clamd without exposing its protocol outside the container.
clamd --config-file=/etc/clamav/clamd.conf &
clamd_pid=$!
trap 'kill "$clamd_pid" 2>/dev/null || true' EXIT INT TERM

ready=0
for _ in $(seq 1 60); do
  if clamdscan --config-file=/etc/clamav/clamd.conf --ping 1 >/dev/null 2>&1; then
    ready=1
    break
  fi
  if ! kill -0 "$clamd_pid" 2>/dev/null; then
    echo 'clamd exited before becoming ready' >&2
    exit 1
  fi
  sleep 1
done
[ "$ready" -eq 1 ] || { echo 'clamd readiness timed out' >&2; exit 1; }

exec node /app/dist/individual-kyc-scanner-worker/main.js
