/**
 * Filesystem IPC Handlers
 *
 * Provides VS Code-like folder/file open capabilities:
 *   - Open folder dialog
 *   - Read directory tree
 *   - Read file content
 *   - Watch for changes (basic)
 */
import { ipcMain, dialog, BrowserWindow } from 'electron'
import fs from 'fs'
import path from 'path'

export interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileTreeNode[]
  extension?: string
}

/** Recursively read a directory tree (max depth to avoid huge trees) */
function readDirTree(dirPath: string, depth = 0, maxDepth = 6): FileTreeNode[] {
  if (depth > maxDepth) return []

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })

    // Sort: directories first, then files, both alphabetic
    const sorted = entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1
      if (!a.isDirectory() && b.isDirectory()) return 1
      return a.name.localeCompare(b.name)
    })

    // Skip hidden and common ignored directories
    const IGNORED = new Set([
      'node_modules', '.git', '.next', 'dist', 'out', '.cache',
      '__pycache__', '.vscode', '.idea', 'coverage', 'build',
      '.DS_Store', 'Thumbs.db'
    ])

    return sorted
      .filter((entry) => !IGNORED.has(entry.name) && !entry.name.startsWith('.'))
      .map((entry): FileTreeNode => {
        const fullPath = path.join(dirPath, entry.name)
        if (entry.isDirectory()) {
          return {
            name: entry.name,
            path: fullPath,
            type: 'directory',
            children: readDirTree(fullPath, depth + 1, maxDepth),
          }
        }
        return {
          name: entry.name,
          path: fullPath,
          type: 'file',
          extension: path.extname(entry.name).toLowerCase(),
        }
      })
  } catch {
    return []
  }
}

export function registerFilesystemHandlers(): void {
  // Open folder dialog and return the directory tree
  ipcMain.handle('fs:open-folder', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openDirectory'],
      title: 'Open Folder',
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true, rootPath: null, tree: [] }
    }

    const rootPath = result.filePaths[0]
    const tree = readDirTree(rootPath)
    return { canceled: false, rootPath, tree }
  })

  // Read a directory's full recursive tree (for refresh)
  ipcMain.handle('fs:read-dir', async (_e, dirPath: string) => {
    return readDirTree(dirPath)
  })

  // Read file contents
  ipcMain.handle('fs:read-file', async (_e, filePath: string) => {
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      const stat = fs.statSync(filePath)
      return {
        content,
        size: stat.size,
        modified: stat.mtime.toISOString(),
      }
    } catch (err) {
      throw new Error(`Failed to read file: ${filePath}`)
    }
  })

  // Save file contents
  ipcMain.handle('fs:save-file', async (_e, filePath: string, content: string) => {
    try {
      fs.writeFileSync(filePath, content, 'utf-8')
      return { ok: true }
    } catch (err) {
      throw new Error(`Failed to save file: ${filePath}`)
    }
  })

  // Open file dialog
  ipcMain.handle('fs:open-file', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openFile'],
      title: 'Open File',
      filters: [
        { name: 'SQL Files', extensions: ['sql'] },
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true, filePath: null, content: null }
    }

    const filePath = result.filePaths[0]
    const content = fs.readFileSync(filePath, 'utf-8')
    return {
      canceled: false,
      filePath,
      fileName: path.basename(filePath),
      content,
    }
  })

  // Create a new folder
  ipcMain.handle('fs:create-folder', async (_e, parentPath: string, folderName: string) => {
    const fullPath = path.join(parentPath, folderName)
    try {
      fs.mkdirSync(fullPath, { recursive: true })
      return { ok: true, path: fullPath }
    } catch (err) {
      throw new Error(`Failed to create folder: ${fullPath}`)
    }
  })

  // Create a new file
  ipcMain.handle('fs:create-file', async (_e, parentPath: string, fileName: string) => {
    const fullPath = path.join(parentPath, fileName)
    try {
      // Check if file already exists
      if (fs.existsSync(fullPath)) {
        throw new Error(`File already exists: ${fullPath}`)
      }
      fs.writeFileSync(fullPath, '', 'utf-8')
      return { ok: true, path: fullPath }
    } catch (err) {
      const msg = err instanceof Error ? err.message : `Failed to create file: ${fullPath}`
      throw new Error(msg)
    }
  })

  // Delete a file or folder
  ipcMain.handle('fs:delete', async (_e, itemPath: string) => {
    try {
      const stat = fs.statSync(itemPath)
      if (stat.isDirectory()) {
        fs.rmSync(itemPath, { recursive: true, force: true })
      } else {
        fs.unlinkSync(itemPath)
      }
      return { ok: true }
    } catch (err) {
      throw new Error(`Failed to delete: ${itemPath}`)
    }
  })
}
