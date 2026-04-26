@echo off
echo === MediTrack CDSS Desktop ===

where node >nul 2>&1 || (echo ERROR: Node.js required. Download at https://nodejs.org & pause & exit /b 1)
where python >nul 2>&1 || (echo ERROR: Python required. Download at https://python.org & pause & exit /b 1)

echo [1/3] Setting up Python backend...
cd backend
if not exist venv python -m venv venv
venv\Scripts\pip install -q -r requirements.txt
cd ..

echo [2/3] Setting up frontend...
cd frontend
if not exist node_modules npm install --silent
cd ..

echo [3/3] Setting up desktop app...
cd desktop
if not exist node_modules npm install --silent

echo.
echo Launching MediTrack CDSS...
echo (A native window will open in a few seconds)
echo.
npm start
