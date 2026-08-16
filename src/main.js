'use strict';

/**
 * DeepSeek Harness desktop shell.
 *
 * Boots the bundled `dsh web` profile on a loopback port chosen by the OS,
 * then hosts the resulting Web GUI in a native macOS window. The harness child
 * is always terminated together with the app.
 */

const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('node:path');
const os = require('node:os');
const { launchHarness } = require('./harness');

const SMOKE_TEST = process.env.DSH_DESKTOP_SMOKE_TEST === '1';
const FIXED_URL = process.env.DSH_DESKTOP_URL; // optional override for debugging

let harness = null; // { url, child, shutdown }
let mainWindow = null;
let quitting = false;

// Keep all runtime writes inside a single data directory (also lets the
// sandboxed test harness redirect them into the workspace).
if (process.env.DSH_DESKTOP_USER_DATA) {
  app.setPath('userData', process.env.DSH_DESKTOP_USER_DATA);
}

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 900,
    minHeight: 600,
    title: 'DeepSeek Harness',
    backgroundColor: '#0f1115',
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    if (mainWindow) mainWindow.show();
  });

  // Any target="_blank"/window.open link goes to the user's browser instead.
  mainWindow.webContents.setWindowOpenHandler(({ url: u }) => {
    if (/^https?:/i.test(u)) shell.openExternal(u);
    return { action: 'deny' };
  });

  // Keep in-app navigation on the harness origin; push everything else out.
  mainWindow.webContents.on('will-navigate', (event, targetUrl) => {
    if (!targetUrl.startsWith(url)) {
      event.preventDefault();
      if (/^https?:/i.test(targetUrl)) shell.openExternal(targetUrl);
    }
  });

  mainWindow.webContents.on('did-finish-load', () => {
    if (SMOKE_TEST) {
      console.log('[smoke] did-finish-load OK');
      app.quit();
    }
  });

  mainWindow.webContents.on('did-fail-load', (_event, code, description) => {
    if (SMOKE_TEST) {
      console.error(`[smoke] did-fail-load ${code} ${description}`);
      app.exit(1);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.loadURL(url);
}

function buildMenu() {
  const template = [
    ...(process.platform === 'darwin'
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          },
        ]
      : []),
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'zoom' }, { role: 'close' }],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function boot() {
  const binPath = path.join(
    __dirname,
    '..',
    'node_modules',
    '@deepseek-ai',
    'dsh',
    'lib',
    'bin.js'
  );
  const workspace = process.env.DSH_WORKSPACE || os.homedir();

  const env = {};
  if (process.env.DSH_DESKTOP_HOME) {
    env.DSH_HOME = process.env.DSH_DESKTOP_HOME;
  }

  harness = await launchHarness({
    binPath,
    workspace,
    port: 0,
    env,
    onExit: (code, signal) => {
      if (!quitting && code !== null && code !== 0) {
        console.error(`[harness] exited unexpectedly (code=${code}, signal=${signal})`);
      }
    },
  });

  if (SMOKE_TEST) console.log(`[smoke] harness url=${harness.url}`);

  createWindow(FIXED_URL || harness.url);
}

function shutdown() {
  if (quitting) return;
  quitting = true;
  if (harness) {
    try {
      harness.shutdown();
    } catch {}
    harness = null;
  }
}

// Single instance: a second launch focuses the existing window instead of
// starting a second harness/server.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    buildMenu();
    boot().catch((err) => {
      console.error('[fatal]', err);
      if (SMOKE_TEST) {
        app.exit(1);
      } else {
        dialog.showErrorBox(
          'DeepSeek Harness failed to start',
          String((err && err.stack) || err)
        );
        app.exit(1);
      }
    });
  });

  app.on('window-all-closed', () => {
    shutdown();
    app.quit();
  });

  app.on('before-quit', () => shutdown());
  process.on('exit', () => shutdown());
}
