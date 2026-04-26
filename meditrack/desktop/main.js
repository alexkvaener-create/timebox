const { app, BrowserWindow, shell } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const fs = require('fs');

const API_PORT  = 8765;   // Use non-standard ports to avoid conflicts
const WEB_PORT  = 3765;

let mainWindow;
let apiProcess;
let webProcess;

// ---- Resolve resource paths (works both in dev and packaged) ----
function resourcePath(...parts) {
  const base = app.isPackaged
    ? path.join(process.resourcesPath)
    : path.join(__dirname, '..');
  return path.join(base, ...parts);
}

// ---- Find Python executable ----
function findPython() {
  const candidates = [
    resourcePath('backend', 'venv', 'bin', 'python3'),
    resourcePath('backend', 'venv', 'Scripts', 'python.exe'),  // Windows
    'python3',
    'python',
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {}
  }
  return 'python3'; // fallback
}

// ---- Wait until a port is accepting connections ----
function waitForPort(port, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      const req = http.get(`http://127.0.0.1:${port}/health`, (res) => {
        if (res.statusCode === 200) return resolve();
        retry();
      });
      req.on('error', retry);
      req.end();
    };
    const retry = () => {
      if (Date.now() - start > timeout) return reject(new Error(`Port ${port} not ready`));
      setTimeout(check, 500);
    };
    check();
  });
}

// ---- Start FastAPI backend ----
async function startBackend() {
  const python = findPython();
  const backendDir = resourcePath('backend');
  const dbPath = path.join(app.getPath('userData'), 'meditrack.db');

  const env = {
    ...process.env,
    DATABASE_URL: `sqlite+aiosqlite:///${dbPath}`,
    SECRET_KEY: 'meditrack_desktop_secret_key_32chr',
    PORT: String(API_PORT),
  };

  // Seed database on first run
  const seedScript = path.join(backendDir, 'seed.py');
  if (fs.existsSync(seedScript)) {
    await new Promise((resolve) => {
      const seeder = spawn(python, [seedScript], { cwd: backendDir, env });
      seeder.on('close', resolve);
    });
  }

  // Start uvicorn
  apiProcess = spawn(python, [
    '-m', 'uvicorn', 'app.main:app',
    '--host', '127.0.0.1',
    '--port', String(API_PORT),
  ], { cwd: backendDir, env });

  apiProcess.stdout.on('data', d => console.log('[API]', d.toString().trim()));
  apiProcess.stderr.on('data', d => console.log('[API]', d.toString().trim()));

  await waitForPort(API_PORT);
  console.log('Backend ready on port', API_PORT);
}

// ---- Start Next.js frontend ----
async function startFrontend() {
  const frontendDir = resourcePath('frontend');
  const env = {
    ...process.env,
    NEXT_PUBLIC_API_URL: `http://127.0.0.1:${API_PORT}/api`,
    PORT: String(WEB_PORT),
  };

  webProcess = spawn('node', [
    path.join(frontendDir, 'node_modules', '.bin', 'next'),
    'dev', '--port', String(WEB_PORT),
  ], { cwd: frontendDir, env });

  webProcess.stdout.on('data', d => console.log('[Web]', d.toString().trim()));
  webProcess.stderr.on('data', d => console.log('[Web]', d.toString().trim()));

  // Wait for Next.js to be ready
  await new Promise((resolve) => {
    webProcess.stdout.on('data', (d) => {
      if (d.toString().includes('Ready') || d.toString().includes('ready')) resolve();
    });
    setTimeout(resolve, 15000); // fallback timeout
  });
  console.log('Frontend ready on port', WEB_PORT);
}

// ---- Create the app window ----
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'MediTrack CDSS',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    // Show a loading screen while servers start
    show: false,
  });

  mainWindow.loadURL(`http://127.0.0.1:${WEB_PORT}/dashboard`);

  mainWindow.once('ready-to-show', () => mainWindow.show());

  // Open external links in the system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// ---- App lifecycle ----
app.whenReady().then(async () => {
  // Show a loading window while servers boot
  const loader = new BrowserWindow({
    width: 400, height: 200, frame: false, alwaysOnTop: true,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  loader.loadURL(`data:text/html,
    <body style="background:#0f4c81;color:white;font-family:sans-serif;
      display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
      <div style="text-align:center">
        <div style="font-size:32px;font-weight:bold;color:#00a896">MT</div>
        <div style="font-size:18px;margin-top:8px">MediTrack CDSS</div>
        <div style="font-size:13px;margin-top:16px;opacity:0.7">Starting services...</div>
      </div>
    </body>`);

  try {
    await startBackend();
    await startFrontend();
  } catch (err) {
    console.error('Startup error:', err);
  }

  loader.close();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  if (apiProcess) apiProcess.kill();
  if (webProcess) webProcess.kill();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
