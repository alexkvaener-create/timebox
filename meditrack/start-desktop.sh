#!/bin/bash
# MediTrack CDSS - Desktop launcher
# Runs the app as a native desktop window (no browser needed)
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== MediTrack CDSS Desktop ==="

# ---- Check Node.js ----
if ! command -v node &>/dev/null; then
  echo "ERROR: Node.js is required. Download at https://nodejs.org"
  exit 1
fi

# ---- Check Python ----
if ! command -v python3 &>/dev/null && ! command -v python &>/dev/null; then
  echo "ERROR: Python 3 is required. Download at https://python.org"
  exit 1
fi
PYTHON=$(command -v python3 || command -v python)

# ---- Backend: venv + deps ----
echo "[1/3] Setting up Python backend..."
cd backend
if [ ! -d "venv" ]; then
  $PYTHON -m venv venv
fi
venv/bin/pip install -q -r requirements.txt 2>/dev/null || \
  venv/Scripts/pip install -q -r requirements.txt 2>/dev/null || true
cd ..

# ---- Frontend: npm deps ----
echo "[2/3] Setting up frontend..."
cd frontend
if [ ! -d "node_modules" ]; then
  npm install --silent
fi
cd ..

# ---- Desktop: Electron deps ----
echo "[3/3] Setting up desktop app..."
cd desktop
if [ ! -d "node_modules" ]; then
  npm install --silent
fi

echo ""
echo "Launching MediTrack CDSS..."
echo "(A native window will open in a few seconds)"
echo ""
npm start
