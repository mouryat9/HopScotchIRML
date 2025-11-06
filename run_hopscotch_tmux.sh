#!/bin/bash

# -------------------------------
# CONFIGURATION
# -------------------------------
SESSION="hopscotch"
ENV_PATH="$HOME/hopscotchenv"           # path to your Python venv
SERVER_DIR="$HOME/hopscotch"            # directory with app.py
UI_DIR="$HOME/hopscotch/hopscotch-ui"   # directory with your React app
API_PORT=8000
UI_PORT=5173

# -------------------------------
# Create / attach to tmux session
# -------------------------------
tmux has-session -t $SESSION 2>/dev/null
if [ $? != 0 ]; then
  echo "Creating new tmux session: $SESSION"
  tmux new-session -d -s $SESSION

  # --------- Window 1: Backend (FastAPI) ---------
  tmux rename-window -t $SESSION:0 'backend'
  tmux send-keys -t $SESSION "cd $SERVER_DIR" C-m
  tmux send-keys -t $SESSION "source $ENV_PATH/bin/activate" C-m
  tmux send-keys -t $SESSION "uvicorn app:app --reload --port $API_PORT" C-m

  # --------- Window 2: Frontend (Vite) ----------
  tmux new-window -t $SESSION -n 'frontend'
  tmux send-keys -t $SESSION:1 "cd $UI_DIR" C-m
  tmux send-keys -t $SESSION:1 "npm run dev -- --host" C-m
fi

# -------------------------------
# Attach to the session
# -------------------------------
echo "Attaching to tmux session: $SESSION"
tmux attach -t $SESSION
