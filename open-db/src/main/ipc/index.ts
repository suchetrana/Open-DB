/**
 * Register all IPC handlers – called once from main/index.ts
 */
import { BrowserWindow } from 'electron'
import { registerDockerHandlers } from './docker.handlers'
import { registerTerminalHandlers } from './terminal.handlers'
import { registerDatabaseHandlers } from './database.handlers'
import { registerFilesystemHandlers } from './filesystem.handlers'
import { registerWindowHandlers } from './window.handlers'

export function registerAllHandlers(_mainWindow?: BrowserWindow | null): void {
  registerDockerHandlers()
  registerTerminalHandlers()
  registerDatabaseHandlers()
  registerFilesystemHandlers()
  registerWindowHandlers()
}
