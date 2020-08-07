'use strict';
const path = require('path');
const { app, BrowserWindow, ipcMain } = require('electron');
const { is } = require('electron-util');
const unhandled = require('electron-unhandled');
const debug = require('electron-debug');
const contextMenu = require('electron-context-menu');
const childProcess = require('child_process');

unhandled();
// debug();
contextMenu();

let mainWindow;

const createMainWindow = async () => {
  const win = new BrowserWindow({
    title: app.name,
    show: false,
    width: 1000,
    height: 800,
    minHeight: 300,
    minWidth: 450,
    webPreferences: {
      nodeIntegration: true
    }
  });

  win.on('ready-to-show', () => {
    win.show();
  });

  win.on('closed', () => {
    mainWindow = undefined;
  });

  await win.loadFile(path.join(__dirname, 'app.html'));

  return win;
};

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }

    mainWindow.show();
  }
});

app.on('window-all-closed', () => {
  if (!is.macos) {
    app.quit();
  }
});

app.on('activate', async () => {
  if (!mainWindow) {
    mainWindow = await createMainWindow();
  }
});

(async () => {
  await app.whenReady();
  mainWindow = await createMainWindow();
})();

ipcMain.on('run', (event, arg) => {
  var thread = childProcess.fork(path.join(__dirname, 'index.js'), [ arg[0], app.getPath('temp') ]);

  thread.on('exit', code => {
    mainWindow.loadFile(path.join(app.getPath('temp'), 'index.html'));
  });
})
