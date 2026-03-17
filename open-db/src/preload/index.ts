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

  // ── Filesystem ──
  filesystem: {
    openFolder: (): Promise<{ canceled: boolean; rootPath: string | null; tree: unknown[] }> =>
      ipcRenderer.invoke('fs:open-folder'),

    readDir: (dirPath: string): Promise<unknown[]> =>
      ipcRenderer.invoke('fs:read-dir', dirPath),

    readFile: (filePath: string): Promise<{ content: string; size: number; modified: string }> =>
      ipcRenderer.invoke('fs:read-file', filePath),

    saveFile: (filePath: string, content: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('fs:save-file', filePath, content),

    openFile: (): Promise<{ canceled: boolean; filePath: string | null; fileName: string | null; content: string | null }> =>
      ipcRenderer.invoke('fs:open-file'),

    createFolder: (parentPath: string, folderName: string): Promise<{ ok: boolean; path: string }> =>
      ipcRenderer.invoke('fs:create-folder', parentPath, folderName),

    createFile: (parentPath: string, fileName: string): Promise<{ ok: boolean; path: string }> =>
      ipcRenderer.invoke('fs:create-file', parentPath, fileName),

    deleteItem: (itemPath: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('fs:delete', itemPath),
  },

  // ── Database ──
  database: {
    connect: (
      connectionId: string,
      type: 'postgres' | 'mysql',
      host: string,
      port: number,
      user: string,
      password: string,
      database: string
    ): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('db:connect', connectionId, type, host, port, user, password, database),

    disconnect: (connectionId: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('db:disconnect', connectionId),

    executeQuery: (connectionId: string, sql: string): Promise<unknown> =>
      ipcRenderer.invoke('db:execute-query', connectionId, sql),

    testConnection: (
      type: 'postgres' | 'mysql',
      host: string,
      port: number,
      user: string,
      password: string,
      database: string
    ): Promise<boolean> =>
      ipcRenderer.invoke('db:test-connection', type, host, port, user, password, database),

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
      ipcRenderer.invoke('db:get-columns', connectionId, schema, table),

    getIndexes: (connectionId: string, schema: string, table: string): Promise<{ name: string; columns: string[]; isUnique: boolean; isPrimary: boolean; type: string; definition: string }[]> =>
      ipcRenderer.invoke('db:get-indexes', connectionId, schema, table),

    getRelations: (connectionId: string, schema: string, table: string): Promise<{ name: string; sourceColumn: string; targetSchema: string; targetTable: string; targetColumn: string; onUpdate: string; onDelete: string }[]> =>
      ipcRenderer.invoke('db:get-relations', connectionId, schema, table),

    getTriggers: (connectionId: string, schema: string, table: string): Promise<{ name: string; event: string; timing: string; definition: string }[]> =>
      ipcRenderer.invoke('db:get-triggers', connectionId, schema, table)
  },

  // ── Mongo (Docker exec) ──
  mongo: {
    execute: (containerId: string, query: string): Promise<{ documents: Record<string, unknown>[]; count: number; executionTimeMs: number }> =>
      ipcRenderer.invoke('mongo:execute', containerId, query),

    getDatabases: (containerId: string): Promise<string[]> =>
      ipcRenderer.invoke('mongo:get-databases', containerId),

    getCollections: (containerId: string, database?: string): Promise<Array<{ name: string; count: number }>> =>
      ipcRenderer.invoke('mongo:get-collections', containerId, database),

    getFields: (containerId: string, collection: string, database?: string): Promise<Array<{ name: string; type: string }>> =>
      ipcRenderer.invoke('mongo:get-fields', containerId, collection, database)
  },

  // ── Redis (Docker exec) ──
  redis: {
    getInfo: (containerId: string, password?: string): Promise<Record<string, string>> =>
      ipcRenderer.invoke('redis:info', containerId, password),

    getDatabases: (containerId: string, password?: string): Promise<Array<{ index: number; keys: number }>> =>
      ipcRenderer.invoke('redis:get-databases', containerId, password),

    scanKeys: (containerId: string, pattern?: string, cursor?: string, count?: number, db?: number, password?: string): Promise<{ cursor: string; keys: Array<{ key: string; type: string; ttl: number }> }> =>
      ipcRenderer.invoke('redis:scan-keys', containerId, pattern, cursor, count, db, password),

    getKeyType: (containerId: string, key: string, db?: number, password?: string): Promise<string> =>
      ipcRenderer.invoke('redis:get-key-type', containerId, key, db, password),

    getKeyTTL: (containerId: string, key: string, db?: number, password?: string): Promise<number> =>
      ipcRenderer.invoke('redis:get-key-ttl', containerId, key, db, password),

    getKeyValue: (containerId: string, key: string, type: string, db?: number, password?: string): Promise<{ type: string; value: unknown; ttl: number; size: number }> =>
      ipcRenderer.invoke('redis:get-key-value', containerId, key, type, db, password),

    setKeyValue: (containerId: string, key: string, value: string, db?: number, password?: string): Promise<string> =>
      ipcRenderer.invoke('redis:set-key-value', containerId, key, value, db, password),

    deleteKey: (containerId: string, key: string, db?: number, password?: string): Promise<number> =>
      ipcRenderer.invoke('redis:delete-key', containerId, key, db, password),

    setKeyTTL: (containerId: string, key: string, ttl: number, db?: number, password?: string): Promise<string> =>
      ipcRenderer.invoke('redis:set-key-ttl', containerId, key, ttl, db, password),

    getDbSize: (containerId: string, db?: number, password?: string): Promise<number> =>
      ipcRenderer.invoke('redis:get-db-size', containerId, db, password),

    getKeyMetadata: (
      containerId: string,
      key: string,
      db?: number,
      password?: string
    ): Promise<{
      key: string;
      type: string;
      ttl: number;
      size: number;
      encoding: string | null;
      refCount: number | null;
      idleSeconds: number | null;
      lfuFreq: number | null;
      length: number | null;
    }> => ipcRenderer.invoke('redis:get-key-metadata', containerId, key, db, password),

    getKeyPage: (
      containerId: string,
      key: string,
      type: string,
      cursor?: string,
      offset?: number,
      limit?: number,
      db?: number,
      password?: string
    ): Promise<{
      type: string;
      cursor: string;
      pageStart: number;
      pageSize: number;
      totalApprox: number;
      items: unknown[];
    }> => ipcRenderer.invoke('redis:get-key-page', containerId, key, type, cursor, offset, limit, db, password),

    stringAppend: (containerId: string, key: string, value: string, db?: number, password?: string): Promise<number> =>
      ipcRenderer.invoke('redis:string-append', containerId, key, value, db, password),

    stringIncr: (containerId: string, key: string, delta?: number, db?: number, password?: string): Promise<number> =>
      ipcRenderer.invoke('redis:string-incr', containerId, key, delta, db, password),

    listPush: (containerId: string, key: string, values: string[], position?: 'left' | 'right', db?: number, password?: string): Promise<number> =>
      ipcRenderer.invoke('redis:list-push', containerId, key, values, position, db, password),

    listPop: (containerId: string, key: string, position?: 'left' | 'right', count?: number, db?: number, password?: string): Promise<string[]> =>
      ipcRenderer.invoke('redis:list-pop', containerId, key, position, count, db, password),

    listSet: (containerId: string, key: string, index: number, value: string, db?: number, password?: string): Promise<string> =>
      ipcRenderer.invoke('redis:list-set', containerId, key, index, value, db, password),

    hashSet: (containerId: string, key: string, field: string, value: string, db?: number, password?: string): Promise<number> =>
      ipcRenderer.invoke('redis:hash-set', containerId, key, field, value, db, password),

    hashSetMany: (containerId: string, key: string, entries: Array<{ field: string; value: string }>, db?: number, password?: string): Promise<number> =>
      ipcRenderer.invoke('redis:hash-set-many', containerId, key, entries, db, password),

    hashDelete: (containerId: string, key: string, fields: string[], db?: number, password?: string): Promise<number> =>
      ipcRenderer.invoke('redis:hash-delete', containerId, key, fields, db, password),

    setAdd: (containerId: string, key: string, members: string[], db?: number, password?: string): Promise<number> =>
      ipcRenderer.invoke('redis:set-add', containerId, key, members, db, password),

    setRemove: (containerId: string, key: string, members: string[], db?: number, password?: string): Promise<number> =>
      ipcRenderer.invoke('redis:set-remove', containerId, key, members, db, password),

    zsetAdd: (containerId: string, key: string, member: string, score: number, db?: number, password?: string): Promise<number> =>
      ipcRenderer.invoke('redis:zset-add', containerId, key, member, score, db, password),

    zsetAddMany: (containerId: string, key: string, entries: Array<{ member: string; score: number }>, db?: number, password?: string): Promise<number> =>
      ipcRenderer.invoke('redis:zset-add-many', containerId, key, entries, db, password),

    zsetRemove: (containerId: string, key: string, members: string[], db?: number, password?: string): Promise<number> =>
      ipcRenderer.invoke('redis:zset-remove', containerId, key, members, db, password)
  },

  // ── Window ──
  window: {
    toggleMaximize: (): Promise<{ isMaximized: boolean }> =>
      ipcRenderer.invoke('window:toggle-maximize'),

    isMaximized: (): Promise<{ isMaximized: boolean }> =>
      ipcRenderer.invoke('window:is-maximized'),

    getZoom: (): Promise<{ zoomFactor: number }> =>
      ipcRenderer.invoke('window:get-zoom'),

    setZoom: (factor: number): Promise<{ zoomFactor: number }> =>
      ipcRenderer.invoke('window:set-zoom', factor)
  }
}

// Expose to renderer
contextBridge.exposeInMainWorld('electronAPI', electronAPI)
