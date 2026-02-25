/**
 * Terminal IPC Handlers
 *
 * Data flow (same as VS Code terminal backend):
 *   Renderer xterm.js  →  terminal:write  →  Main TerminalService  →  child_process / docker exec
 *   Main stdout/stderr  →  terminal:data   →  Renderer xterm.js
 */
import { ipcMain } from 'electron'
import { terminalService } from '../services/terminal.service'

export interface CreateTerminalOpts {
  id: string
  type: 'local' | 'docker'
  cwd?: string
  containerId?: string
  cmd?: string[]
}

export function registerTerminalHandlers(): void {
  ipcMain.handle('terminal:create', async (_e, opts: CreateTerminalOpts) => {
    if (opts.type === 'local') {
      terminalService.createLocal(opts.id, opts.cwd)
    } else if (opts.type === 'docker' && opts.containerId) {
      await terminalService.createDocker(opts.id, opts.containerId, opts.cmd)
    }
    return { ok: true }
  })

  ipcMain.handle('terminal:write', (_e, id: string, data: string) => {
    terminalService.write(id, data)
    return { ok: true }
  })

  ipcMain.handle('terminal:resize', (_e, id: string, cols: number, rows: number) => {
    terminalService.resize(id, cols, rows)
    return { ok: true }
  })

  ipcMain.handle('terminal:close', (_e, id: string) => {
    terminalService.close(id)
    return { ok: true }
  })
}
