#!/usr/bin/env bash
set -euo pipefail

# =========================
# CONFIG (EDIT IF NEEDED)
# =========================
SESSION="hopscotch"

# Your repo root (contains app_chat.py, app.py, hopscotch-ui/)
ROOT="$HOME/hopscotch"

# Your python venv folder (from your screenshot tree)
VENV="$ROOT/hopscotchenv"

BACKEND_HOST="0.0.0.0"
BACKEND_PORT="8000"

FRONTEND_HOST="0.0.0.0"
FRONTEND_PORT="5173"

# Cloudflare tunnel log
CF_LOG="$ROOT/cloudflared_tunnel.log"

# =========================
# HELPERS
# =========================
activate_venv="source \"$VENV/bin/activate\""

# --- Port helpers ---
# Returns 0 (true) if the port is free, 1 if in use.
is_port_free() {
  local port="$1"
  if ss -tlnp "sport = :$port" 2>/dev/null | grep -q "LISTEN"; then
    return 1  # in use
  fi
  return 0  # free
}

# Finds a free port starting from $1, trying up to 20 ports.
# Prints the first available port to stdout.
find_free_port() {
  local port="$1"
  local max_attempts=20
  for (( i=0; i<max_attempts; i++ )); do
    if is_port_free "$port"; then
      echo "$port"
      return 0
    fi
    port=$((port + 1))
  done
  echo ""
  return 1
}

# If tmux session already exists, attach and exit
if tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "[INFO] tmux session '$SESSION' already running. Attaching..."
  tmux attach -t "$SESSION"
  exit 0
fi

# sanity checks
if [ ! -d "$ROOT" ]; then
  echo "[ERROR] ROOT folder not found: $ROOT"
  exit 1
fi
if [ ! -f "$VENV/bin/activate" ]; then
  echo "[ERROR] venv activate not found: $VENV/bin/activate"
  echo "        Fix VENV path in this script."
  exit 1
fi
if [ ! -d "$ROOT/hopscotch-ui" ]; then
  echo "[ERROR] UI folder not found: $ROOT/hopscotch-ui"
  exit 1
fi

# =========================
# PORT AVAILABILITY CHECKS
# =========================
echo "[INFO] Checking if required ports are free..."

if ! is_port_free "$BACKEND_PORT"; then
  old_port="$BACKEND_PORT"
  BACKEND_PORT=$(find_free_port "$BACKEND_PORT")
  if [ -z "$BACKEND_PORT" ]; then
    echo "[ERROR] Could not find a free port for Backend (tried $old_port-$((old_port+19))). Exiting."
    exit 1
  fi
  echo "[INFO] Backend port $old_port is busy -> using port $BACKEND_PORT instead."
else
  echo "[INFO] Backend port $BACKEND_PORT is free."
fi

if ! is_port_free "$FRONTEND_PORT"; then
  old_port="$FRONTEND_PORT"
  FRONTEND_PORT=$(find_free_port "$FRONTEND_PORT")
  if [ -z "$FRONTEND_PORT" ]; then
    echo "[ERROR] Could not find a free port for Frontend (tried $old_port-$((old_port+19))). Exiting."
    exit 1
  fi
  echo "[INFO] Frontend port $old_port is busy -> using port $FRONTEND_PORT instead."
else
  echo "[INFO] Frontend port $FRONTEND_PORT is free."
fi

echo "[INFO] Launching with Backend=$BACKEND_PORT, Frontend=$FRONTEND_PORT"

# =========================
# START TMUX LAYOUT (2x2)
# =========================
tmux new-session -d -s "$SESSION" -c "$ROOT"

# split into 4 panes
tmux split-window -h -t "$SESSION"         # pane 1 right
tmux split-window -v -t "$SESSION:0.0"     # pane 2 bottom-left
tmux split-window -v -t "$SESSION:0.1"     # pane 3 bottom-right

# Pane indexes:
# 0 = top-left
# 1 = top-right
# 2 = bottom-left
# 3 = bottom-right

# =========================
# PANE 0: OLLAMA CHECK + WARMUP
# =========================
tmux send-keys -t "$SESSION:0.0" "echo '== OLLAMA =='; ollama ps || true; echo; echo 'If Ollama is already running, do NOT run serve again.'; echo 'Warming model...'; ollama pull llama3.1:8b; ollama run llama3.1:8b 'ready' --keepalive 60m" C-m

# =========================
# PANE 1: BACKEND (FASTAPI)
# =========================
tmux send-keys -t "$SESSION:0.1" "cd \"$ROOT\" && $activate_venv && python -V && echo 'Starting backend...' && uvicorn app_chat:app --host $BACKEND_HOST --port $BACKEND_PORT --reload" C-m

# =========================
# PANE 2: FRONTEND (VITE)
# =========================
tmux send-keys -t "$SESSION:0.2" "cd \"$ROOT/hopscotch-ui\" && echo 'Starting UI...' && npm install && npm run dev -- --host $FRONTEND_HOST --port $FRONTEND_PORT" C-m

# =========================
# PANE 3: CLOUDFLARED NAMED TUNNEL
# =========================
tmux send-keys -t "$SESSION:0.3" "echo 'Starting Cloudflare named tunnel...'; \
echo 'Frontend: https://hopscotchai.us'; \
echo 'Backend API: https://api.hopscotchai.us'; \
echo; \
cloudflared tunnel run hopscotch" C-m

# make panes readable
tmux select-layout -t "$SESSION" tiled

# attach
tmux attach -t "$SESSION"