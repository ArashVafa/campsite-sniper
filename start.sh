#!/usr/bin/env bash
# Starts the poller in the background, then runs the web server in the foreground.
# Used as the single start command on Render so both processes share one service
# (and therefore one persistent disk / SQLite file).
set -e

echo "[start] Ensuring data directory exists..."
mkdir -p "${DATA_DIR:-data}"

echo "[start] Launching poller in background..."
python poller.py &
POLLER_PID=$!

echo "[start] Poller PID: $POLLER_PID"
echo "[start] Starting web server..."
exec uvicorn api:app --host 0.0.0.0 --port "${PORT:-8000}"
