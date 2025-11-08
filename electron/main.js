const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let phpServer;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    },
    icon: path.join(__dirname, '../assets/icon.png')
  });

  // Iniciar servidor PHP local
  startPHPServer();

  // Carregar aplicação após servidor iniciar
  setTimeout(() => {
    mainWindow.loadURL('http://localhost:8080/frontend/');
  }, 2000);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startPHPServer() {
  // Usar PHP built-in server
  const phpPath = process.platform === 'win32' 
    ? 'php' 
    : '/usr/bin/php';
  
  phpServer = spawn(phpPath, [
    '-S',
    'localhost:8080',
    '-t',
    path.join(__dirname, '..')
  ]);

  phpServer.stdout.on('data', (data) => {
    console.log(`PHP: ${data}`);
  });

  phpServer.stderr.on('data', (data) => {
    console.error(`PHP Error: ${data}`);
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (phpServer) {
    phpServer.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  if (phpServer) {
    phpServer.kill();
  }
});
