// Preload script — exposes a minimal safe API to the renderer
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('meditrackDesktop', {
  version: process.env.npm_package_version || '0.1.0',
  platform: process.platform,
});
