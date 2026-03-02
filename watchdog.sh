#!/usr/bin/env bash
# Hopscotch Watchdog — checks HTTP health of backend & frontend
# and restarts via PM2 if they are unresponsive.
# Designed to run via cron every 2 minutes.

LOG="/home/aietlab/hopscotch/watchdog.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Trim log to last 500 lines to prevent unbounded growth
if [ -f "$LOG" ] && [ "$(wc -l < "$LOG")" -gt 500 ]; then
  tail -300 "$LOG" > "${LOG}.tmp" && mv "${LOG}.tmp" "$LOG"
fi

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
  pm2 restart "$name" --update-env >> "$LOG" 2>&1
  echo "[$TIMESTAMP] INFO: $name restart triggered." >> "$LOG"
}

# Check backend (FastAPI health or docs endpoint)
check_and_restart "hopscotch-backend" "http://localhost:8000/docs"

# Check frontend (Vite dev server)
check_and_restart "hopscotch-frontend" "http://localhost:5173"

# Check that PM2 processes are actually in 'online' status
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

  if [ "$status" = "stopped" ] || [ "$status" = "errored" ] || [ "$status" = "not_found" ]; then
    echo "[$TIMESTAMP] WARN: $app status=$status. Starting..." >> "$LOG"
    pm2 start "$app" --update-env >> "$LOG" 2>&1
  fi
done
