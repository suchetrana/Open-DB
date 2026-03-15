import { BrowserWindow, ipcMain } from 'electron'

const MIN_ZOOM = 0.7
const MAX_ZOOM = 1.6

function clampZoom(factor: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, factor))
}

function getSenderWindow(sender: Electron.WebContents): BrowserWindow | null {
  return BrowserWindow.fromWebContents(sender)
}

export function registerWindowHandlers(): void {
  ipcMain.handle('window:toggle-maximize', (event) => {
    const win = getSenderWindow(event.sender)
    if (!win) return { isMaximized: false }

    if (win.isMaximized()) {
      win.unmaximize()
    } else {
      win.maximize()
    }

    return { isMaximized: win.isMaximized() }
  })

  ipcMain.handle('window:is-maximized', (event) => {
    const win = getSenderWindow(event.sender)
    return { isMaximized: win?.isMaximized() ?? false }
  })

  ipcMain.handle('window:get-zoom', (event) => {
    const win = getSenderWindow(event.sender)
    const zoomFactor = win?.webContents.getZoomFactor() ?? 1
    return { zoomFactor }
  })

  ipcMain.handle('window:set-zoom', (event, factor: number) => {
    const win = getSenderWindow(event.sender)
    if (!win) return { zoomFactor: 1 }

    const nextZoom = clampZoom(Number.isFinite(factor) ? factor : 1)
    win.webContents.setZoomFactor(nextZoom)
    return { zoomFactor: nextZoom }
  })
}