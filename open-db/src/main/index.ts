/**
 * OpenDB Studio — Electron Main Process
 *
 * Follows VS Code's architecture:
 *   1. Initialize services (storage, docker)
 *   2. Register IPC handlers
 *   3. Create BrowserWindow with preload bridge
 *   4. Load renderer (React app)
 */
import { app, BrowserWindow, shell } from 'electron'
import path from 'path'
import { registerAllHandlers } from './ipc'
import { dockerService } from './services/docker.service'
import { storageService } from './services/storage.service'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#0d0d0d',
    autoHideMenuBar: true,
    title: 'OpenDB Studio',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  })

  // Smooth window reveal (same technique as VS Code)
  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  // Open external links in OS browser
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Dev mode: load Vite dev server  |  Prod: load built files
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

// ── Bootstrap ──
app.whenReady().then(async () => {
  // 1. Initialize services before anything else
  await storageService.initialize()
  await dockerService.initialize()

  // 2. Register all IPC handlers
  registerAllHandlers(mainWindow)

  // 3. Create window
  createWindow()

  // macOS: re-create window when dock icon clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed (except macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
