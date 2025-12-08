#!/usr/bin/env bash

SESSION="dojo"

# kill old session if it exists
tmux has-session -t $SESSION 2>/dev/null
if [ $? -eq 0 ]; then
  tmux kill-session -t $SESSION
fi

# Start new tmux session
tmux new-session -d -s $SESSION

# ------------------------------
# Pane 1: Frontend
# ------------------------------
tmux rename-window "dev"
tmux send-keys "cd frontend && npm run dev" C-m

# ------------------------------
# Pane 2: Backend
# ------------------------------
tmux split-window -v
tmux send-keys "cd backend && npm run dev" C-m

# ------------------------------
# Pane 3: Caddy
# ------------------------------
tmux split-window -h
tmux send-keys "caddy run --config ./Caddyfile" C-m

# ------------------------------
# Pane 4: Docker
# ------------------------------
tmux split-window -v
tmux send-keys "sudo docker compose up" C-m

# Adjust layout
tmux select-layout tiled

# Attach session
tmux attach-session -t $SESSION
