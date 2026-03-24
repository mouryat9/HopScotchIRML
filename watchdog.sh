#!/usr/bin/env bash
# Hopscotch Watchdog — checks HTTP health of backend & frontend
# and restarts via PM2 if they are unresponsive.
# Also kills orphan processes on the expected ports and detects crash loops.
# Designed to run via cron every 2 minutes.

export PATH="/usr/local/bin:/usr/bin:/bin:$HOME/.local/bin:$PATH"

LOG="/home/aietlab/hopscotch/watchdog.log"
ECOSYSTEM="/home/aietlab/hopscotch/ecosystem.config.cjs"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

BACKEND_PORT=9580
FRONTEND_PORT=9581

# Trim log to last 500 lines to prevent unbounded growth
if [ -f "$LOG" ] && [ "$(wc -l < "$LOG")" -gt 500 ]; then
  tail -300 "$LOG" > "${LOG}.tmp" && mv "${LOG}.tmp" "$LOG"
fi

# ── Helper: kill any process on a port that is NOT managed by PM2 ──
kill_orphan_on_port() {
  local port="$1"
  local expected_name="$2"
  local pid
  pid=$(ss -tlnp "sport = :$port" 2>/dev/null | grep -oP 'pid=\K[0-9]+' | head -1)
  [ -z "$pid" ] && return 0

  # Check if this PID belongs to a PM2-managed process
  local pm2_pid
  pm2_pid=$(pm2 pid "$expected_name" 2>/dev/null)
  if [ -n "$pm2_pid" ] && [ "$pid" = "$pm2_pid" ]; then
    return 0  # PM2 owns it, all good
  fi

  echo "[$TIMESTAMP] WARN: Orphan process PID=$pid on port $port (not PM2 $expected_name). Killing..." >> "$LOG"
  kill "$pid" 2>/dev/null
  sleep 2
  # Force kill if still alive
  if kill -0 "$pid" 2>/dev/null; then
    kill -9 "$pid" 2>/dev/null
    echo "[$TIMESTAMP] WARN: Force-killed orphan PID=$pid on port $port." >> "$LOG"
  fi
}

# ── Helper: restart a PM2 app (prefer restart, fall back to ecosystem start) ──
pm2_restart_app() {
  local name="$1"
  if pm2 restart "$name" --update-env >> "$LOG" 2>&1; then
    echo "[$TIMESTAMP] INFO: $name restarted via PM2." >> "$LOG"
  else
    echo "[$TIMESTAMP] INFO: $name not in PM2, starting from ecosystem config..." >> "$LOG"
    pm2 start "$ECOSYSTEM" --only "$name" --update-env >> "$LOG" 2>&1
  fi
}

# ── Helper: HTTP health check with retries ──
check_and_restart() {
  local name="$1"
  local url="$2"
  local timeout=10
  local max_retries=2

  for attempt in $(seq 1 $max_retries); do
    http_code=$(curl -s -o /dev/null -w '%{http_code}' --max-time "$timeout" "$url" 2>/dev/null)
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 500 ] 2>/dev/null; then
      return 0  # healthy
    fi
    sleep 3
  done

  # All retries failed — restart
  echo "[$TIMESTAMP] WARN: $name unresponsive (last HTTP $http_code). Restarting..." >> "$LOG"
  pm2_restart_app "$name"
}

# ── Step 1: Kill any orphan processes squatting on our ports ──
kill_orphan_on_port "$BACKEND_PORT" "hopscotch-backend"
kill_orphan_on_port "$FRONTEND_PORT" "hopscotch-frontend"

# ── Step 2: HTTP health checks ──
check_and_restart "hopscotch-backend" "http://localhost:${BACKEND_PORT}/docs"
check_and_restart "hopscotch-frontend" "http://localhost:${FRONTEND_PORT}"

# ── Step 3: Check PM2 status for all three services (including tunnel) ──
for app in hopscotch-backend hopscotch-frontend hopscotch-tunnel; do
  status=$(pm2 jlist 2>/dev/null | python3 -c "
import sys, json
try:
    procs = json.load(sys.stdin)
    for p in procs:
        if p['name'] == '$app':
            print(p['pm2_env']['status'])
            break
    else:
        print('not_found')
except:
    print('error')
" 2>/dev/null)

  restarts=$(pm2 jlist 2>/dev/null | python3 -c "
import sys, json
try:
    procs = json.load(sys.stdin)
    for p in procs:
        if p['name'] == '$app':
            print(p['pm2_env']['restart_time'])
            break
    else:
        print('0')
except:
    print('0')
" 2>/dev/null)

  if [ "$status" = "stopped" ] || [ "$status" = "errored" ] || [ "$status" = "launching" ]; then
    echo "[$TIMESTAMP] WARN: $app status=$status. Restarting..." >> "$LOG"
    pm2_restart_app "$app"
  elif [ "$status" = "not_found" ] || [ "$status" = "error" ]; then
    echo "[$TIMESTAMP] WARN: $app status=$status. Starting from ecosystem config..." >> "$LOG"
    pm2 start "$ECOSYSTEM" --only "$app" --update-env >> "$LOG" 2>&1
  fi

  # Detect crash loops: if restarts > 40, delete and re-add fresh
  if [ "$restarts" -gt 40 ] 2>/dev/null; then
    echo "[$TIMESTAMP] WARN: $app has $restarts restarts (crash loop). Deleting and re-adding..." >> "$LOG"
    pm2 delete "$app" >> "$LOG" 2>&1
    sleep 2
    pm2 start "$ECOSYSTEM" --only "$app" --update-env >> "$LOG" 2>&1
    pm2 save >> "$LOG" 2>&1
    echo "[$TIMESTAMP] INFO: $app re-added fresh from ecosystem config." >> "$LOG"
  fi
done
