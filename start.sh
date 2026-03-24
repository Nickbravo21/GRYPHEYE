#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────────────
#  GRYPHEYE version 0.02 - local dev launcher
#  Usage:  ./start.sh
# ────────────────────────────────────────────────────────────────────────────
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║      GRYPHEYE version 0.02               ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── 1. Python venv ────────────────────────────────────────────────────────
if [ ! -d "$BACKEND/.venv" ]; then
    echo "[1/4] Creating Python virtual environment..."
    python3 -m venv "$BACKEND/.venv"
fi

source "$BACKEND/.venv/bin/activate"

# ── 2. Python deps ────────────────────────────────────────────────────────
echo "[2/4] Installing / verifying Python dependencies..."
pip install --quiet --upgrade pip
pip install --quiet -r "$BACKEND/requirements.txt"

# ── 3. Node deps ──────────────────────────────────────────────────────────
if [ ! -d "$FRONTEND/node_modules" ]; then
    echo "[3/4] Installing Node dependencies..."
    (cd "$FRONTEND" && npm install)
else
    echo "[3/4] Node modules already installed."
fi

# ── 4. Launch both servers ────────────────────────────────────────────────
echo "[4/4] Starting backend (port 8000) and frontend (port 3000)..."
echo ""
echo "  Backend  →  http://localhost:8000"
echo "  Frontend →  http://localhost:3000"
echo ""
echo "  Press Ctrl+C to stop both servers."
echo ""

# Run backend in background, capture its PID
(cd "$BACKEND" && source .venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8000) &
BACKEND_PID=$!

# Run frontend in foreground so Ctrl+C kills everything cleanly
trap "kill $BACKEND_PID 2>/dev/null; exit 0" INT TERM
(cd "$FRONTEND" && npm start)

wait $BACKEND_PID
