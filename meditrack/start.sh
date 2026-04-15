#!/usr/bin/env bash
# MediTrack CDSS - One-command startup script
# Usage: bash start.sh
set -e

echo "=== MediTrack CDSS Startup ==="

# ---- 1. Check dependencies ----
for cmd in python3 node psql; do
  command -v $cmd >/dev/null 2>&1 || { echo "ERROR: '$cmd' is required but not installed."; exit 1; }
done

# ---- 2. Database setup ----
echo "Setting up database..."
psql -U postgres -tc "SELECT 1 FROM pg_roles WHERE rolname='meditrack'" | grep -q 1 || \
  psql -U postgres -c "CREATE USER meditrack WITH PASSWORD 'meditrack';"
psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='meditrack_db'" | grep -q 1 || \
  psql -U postgres -c "CREATE DATABASE meditrack_db OWNER meditrack;"

psql -U postgres -d meditrack_db -f "$(dirname "$0")/database/init.sql" >/dev/null 2>&1 || true

psql -U postgres -d meditrack_db -c "
  GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO meditrack;
  GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO meditrack;
  GRANT USAGE ON SCHEMA public TO meditrack;
" >/dev/null 2>&1

# ---- 3. Backend setup ----
echo "Setting up Python backend..."
cd "$(dirname "$0")/backend"
[ ! -d venv ] && python3 -m venv venv
venv/bin/pip install -q -r requirements.txt

# Fix seed user passwords
HASH=$(venv/bin/python3 -c "import bcrypt; print(bcrypt.hashpw(b'password123', bcrypt.gensalt(12)).decode())")
psql -U postgres -d meditrack_db -c "UPDATE users SET hashed_password='$HASH';" >/dev/null 2>&1

# Start backend in background
DATABASE_URL=postgresql+asyncpg://meditrack:meditrack@localhost:5432/meditrack_db \
SECRET_KEY=meditrack_dev_secret_key_32chars_min \
venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 > /tmp/meditrack-api.log 2>&1 &
API_PID=$!
echo "Backend started (PID $API_PID)"

# Wait for API to be ready
for i in {1..15}; do
  curl -s http://localhost:8000/health >/dev/null 2>&1 && break
  sleep 1
done

# ---- 4. Frontend setup ----
echo "Setting up frontend..."
cd "$(dirname "$0")/frontend"
[ ! -d node_modules ] && npm install --silent

NEXT_PUBLIC_API_URL=http://localhost:8000/api npm run dev &
FRONTEND_PID=$!
echo "Frontend started (PID $FRONTEND_PID)"

# ---- 5. Wait and show status ----
sleep 6
echo ""
echo "====================================="
echo " MediTrack CDSS is running!"
echo "====================================="
echo " Frontend:  http://localhost:3000"
echo " API docs:  http://localhost:8000/docs"
echo " Login:     dr.sharma@meditrack.dev"
echo " Password:  password123"
echo "====================================="
echo ""
echo "Press Ctrl+C to stop all servers."

# Keep running, kill children on exit
trap "kill $API_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
