/**
 * Preload script – secure IPC bridge between main and renderer
 *
 * Exposes a typed API at window.electronAPI using contextBridge.
 * Follows Electron security best practices:
 *   - contextIsolation: true
 *   - nodeIntegration: false
 *   - Only specific IPC channels exposed (no blanket access)
 */
import { contextBridge, ipcRenderer } from 'electron'

export const electronAPI = {
  // ── Docker ──
  docker: {
    getStatus: (): Promise<{ available: boolean }> =>
      ipcRenderer.invoke('docker:status'),

    listContainers: (): Promise<unknown[]> =>
      ipcRenderer.invoke('docker:list-containers'),

    createContainer: (opts: {
      name: string
      type: string
      port?: number
      password?: string
    }): Promise<unknown> =>
      ipcRenderer.invoke('docker:create-container', opts),

    startContainer: (id: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('docker:start-container', id),

    stopContainer: (id: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('docker:stop-container', id),

    removeContainer: (id: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('docker:remove-container', id),

    getLogs: (id: string, tail?: number): Promise<string> =>
      ipcRenderer.invoke('docker:logs', id, tail)
  },

  // ── Terminal ──
  terminal: {
    create: (opts: {
      id: string
      type: 'local' | 'docker'
      cwd?: string
      containerId?: string
      cmd?: string[]
    }): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('terminal:create', opts),

    write: (id: string, data: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('terminal:write', id, data),

    resize: (id: string, cols: number, rows: number): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('terminal:resize', id, cols, rows),

    close: (id: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('terminal:close', id),

    /** Subscribe to terminal output from main process */
    onData: (callback: (id: string, data: string) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, id: string, data: string) =>
        callback(id, data)
      ipcRenderer.on('terminal:data', handler)
      return () => ipcRenderer.removeListener('terminal:data', handler)
    },

    /** Subscribe to terminal exit events */
    onExit: (callback: (id: string) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, id: string) => callback(id)
      ipcRenderer.on('terminal:exit', handler)
      return () => ipcRenderer.removeListener('terminal:exit', handler)
    }
  },

  // ── Database ──
  database: {
    connect: (
      connectionId: string,
      host: string,
      port: number,
      user: string,
      password: string,
      database: string
    ): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('db:connect', connectionId, host, port, user, password, database),

    disconnect: (connectionId: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('db:disconnect', connectionId),

    executeQuery: (connectionId: string, sql: string): Promise<unknown> =>
      ipcRenderer.invoke('db:execute-query', connectionId, sql),

    testConnection: (
      host: string,
      port: number,
      user: string,
      password: string,
      database: string
    ): Promise<boolean> =>
      ipcRenderer.invoke('db:test-connection', host, port, user, password, database),

    getConnections: (): Promise<unknown[]> =>
      ipcRenderer.invoke('db:get-connections'),

    saveConnection: (connection: unknown): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('db:save-connection', connection),

    deleteConnection: (id: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('db:delete-connection', id),

    getQueryHistory: (connectionId: string, limit?: number): Promise<unknown[]> =>
      ipcRenderer.invoke('db:get-query-history', connectionId, limit),

    // Introspection
    getDatabases: (connectionId: string): Promise<string[]> =>
      ipcRenderer.invoke('db:get-databases', connectionId),

    switchDatabase: (connectionId: string, newDatabase: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('db:switch-database', connectionId, newDatabase),

    getSchemas: (connectionId: string): Promise<{ name: string }[]> =>
      ipcRenderer.invoke('db:get-schemas', connectionId),

    getTables: (connectionId: string, schema: string): Promise<{ schema: string; name: string; type: 'table' | 'view'; rowEstimate: number }[]> =>
      ipcRenderer.invoke('db:get-tables', connectionId, schema),

    getColumns: (connectionId: string, schema: string, table: string): Promise<{ name: string; dataType: string; nullable: boolean; defaultValue: string | null; isPrimaryKey: boolean }[]> =>
      ipcRenderer.invoke('db:get-columns', connectionId, schema, table)
  }
}

// Expose to renderer
contextBridge.exposeInMainWorld('electronAPI', electronAPI)
