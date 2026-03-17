/**
 * Window type augmentation for electronAPI exposed by preload
 */

interface DockerAPI {
  getStatus(): Promise<{ available: boolean }>
  listContainers(): Promise<ContainerInfo[]>
  createContainer(opts: {
    name: string
    type: string
    port?: number
    password?: string
  }): Promise<ContainerInfo>
  startContainer(id: string): Promise<{ ok: boolean }>
  stopContainer(id: string): Promise<{ ok: boolean }>
  removeContainer(id: string): Promise<{ ok: boolean }>
  getLogs(id: string, tail?: number): Promise<string>
}

interface TerminalAPI {
  create(opts: {
    id: string
    type: 'local' | 'docker'
    cwd?: string
    containerId?: string
    cmd?: string[]
  }): Promise<{ ok: boolean }>
  write(id: string, data: string): Promise<{ ok: boolean }>
  resize(id: string, cols: number, rows: number): Promise<{ ok: boolean }>
  close(id: string): Promise<{ ok: boolean }>
  onData(callback: (id: string, data: string) => void): () => void
  onExit(callback: (id: string) => void): () => void
}

interface DatabaseAPI {
  connect(
    connectionId: string,
    type: 'postgres' | 'mysql',
    host: string,
    port: number,
    user: string,
    password: string,
    database: string
  ): Promise<{ ok: boolean }>
  disconnect(connectionId: string): Promise<{ ok: boolean }>
  executeQuery(
    connectionId: string,
    sql: string
  ): Promise<{
    columns: string[]
    rows: Record<string, unknown>[]
    rowCount: number
    executionTimeMs: number
  }>
  testConnection(
    type: 'postgres' | 'mysql',
    host: string,
    port: number,
    user: string,
    password: string,
    database: string
  ): Promise<boolean>
  getConnections(): Promise<unknown[]>
  saveConnection(connection: unknown): Promise<{ ok: boolean }>
  deleteConnection(id: string): Promise<{ ok: boolean }>
  getQueryHistory(connectionId: string, limit?: number): Promise<unknown[]>
  getDatabases(connectionId: string): Promise<string[]>
  switchDatabase(connectionId: string, newDatabase: string): Promise<{ ok: boolean }>
  getSchemas(connectionId: string): Promise<{ name: string }[]>
  getTables(connectionId: string, schema: string): Promise<{ schema: string; name: string; type: 'table' | 'view'; rowEstimate: number }[]>
  getColumns(connectionId: string, schema: string, table: string): Promise<{ name: string; dataType: string; nullable: boolean; defaultValue: string | null; isPrimaryKey: boolean }[]>
  getIndexes(connectionId: string, schema: string, table: string): Promise<{ name: string; columns: string[]; isUnique: boolean; isPrimary: boolean; type: string; definition: string }[]>
  getRelations(connectionId: string, schema: string, table: string): Promise<{ name: string; sourceColumn: string; targetSchema: string; targetTable: string; targetColumn: string; onUpdate: string; onDelete: string }[]>
  getTriggers(connectionId: string, schema: string, table: string): Promise<{ name: string; event: string; timing: string; definition: string }[]>
}

interface MongoAPI {
  execute(containerId: string, query: string): Promise<{ documents: Record<string, unknown>[]; count: number; executionTimeMs: number }>
  getDatabases(containerId: string): Promise<string[]>
  getCollections(containerId: string, database?: string): Promise<Array<{ name: string; count: number }>>
  getFields(containerId: string, collection: string, database?: string): Promise<Array<{ name: string; type: string }>>
}

interface RedisAPI {
  getInfo(containerId: string, password?: string): Promise<Record<string, string>>
  getDatabases(containerId: string, password?: string): Promise<Array<{ index: number; keys: number }>>
  scanKeys(containerId: string, pattern?: string, cursor?: string, count?: number, db?: number, password?: string): Promise<{ cursor: string; keys: Array<{ key: string; type: string; ttl: number }> }>
  getKeyType(containerId: string, key: string, db?: number, password?: string): Promise<string>
  getKeyTTL(containerId: string, key: string, db?: number, password?: string): Promise<number>
  getKeyValue(containerId: string, key: string, type: string, db?: number, password?: string): Promise<{ type: string; value: unknown; ttl: number; size: number }>
  setKeyValue(containerId: string, key: string, value: string, db?: number, password?: string): Promise<string>
  deleteKey(containerId: string, key: string, db?: number, password?: string): Promise<number>
  setKeyTTL(containerId: string, key: string, ttl: number, db?: number, password?: string): Promise<string>
  getDbSize(containerId: string, db?: number, password?: string): Promise<number>
  getKeyMetadata(containerId: string, key: string, db?: number, password?: string): Promise<{ key: string; type: string; ttl: number; size: number; encoding: string | null; refCount: number | null; idleSeconds: number | null; lfuFreq: number | null; length: number | null }>
  getKeyPage(containerId: string, key: string, type: string, cursor?: string, offset?: number, limit?: number, db?: number, password?: string): Promise<{ type: string; cursor: string; pageStart: number; pageSize: number; totalApprox: number; items: unknown[] }>
  stringAppend(containerId: string, key: string, value: string, db?: number, password?: string): Promise<number>
  stringIncr(containerId: string, key: string, delta?: number, db?: number, password?: string): Promise<number>
  listPush(containerId: string, key: string, values: string[], position?: 'left' | 'right', db?: number, password?: string): Promise<number>
  listPop(containerId: string, key: string, position?: 'left' | 'right', count?: number, db?: number, password?: string): Promise<string[]>
  listSet(containerId: string, key: string, index: number, value: string, db?: number, password?: string): Promise<string>
  hashSet(containerId: string, key: string, field: string, value: string, db?: number, password?: string): Promise<number>
  hashSetMany(containerId: string, key: string, entries: Array<{ field: string; value: string }>, db?: number, password?: string): Promise<number>
  hashDelete(containerId: string, key: string, fields: string[], db?: number, password?: string): Promise<number>
  setAdd(containerId: string, key: string, members: string[], db?: number, password?: string): Promise<number>
  setRemove(containerId: string, key: string, members: string[], db?: number, password?: string): Promise<number>
  zsetAdd(containerId: string, key: string, member: string, score: number, db?: number, password?: string): Promise<number>
  zsetAddMany(containerId: string, key: string, entries: Array<{ member: string; score: number }>, db?: number, password?: string): Promise<number>
  zsetRemove(containerId: string, key: string, members: string[], db?: number, password?: string): Promise<number>
}

interface ContainerInfo {
  id: string
  name: string
  image: string
  status: 'running' | 'starting' | 'stopped'
  port: number
  type: string
  createdAt: string
}

interface FilesystemAPI {
  openFolder(): Promise<{ canceled: boolean; rootPath: string | null; tree: FileTreeNodeInfo[] }>
  readDir(dirPath: string): Promise<FileTreeNodeInfo[]>
  readFile(filePath: string): Promise<{ content: string; size: number; modified: string }>
  saveFile(filePath: string, content: string): Promise<{ ok: boolean }>
  openFile(): Promise<{ canceled: boolean; filePath: string | null; fileName: string | null; content: string | null }>
  createFolder(parentPath: string, folderName: string): Promise<{ ok: boolean; path: string }>
  createFile(parentPath: string, fileName: string): Promise<{ ok: boolean; path: string }>
  deleteItem(itemPath: string): Promise<{ ok: boolean }>
}

interface FileTreeNodeInfo {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileTreeNodeInfo[]
  extension?: string
}

interface ElectronAPI {
  docker: DockerAPI
  terminal: TerminalAPI
  database: DatabaseAPI
  mongo: MongoAPI
  redis: RedisAPI
  filesystem: FilesystemAPI
  window: {
    toggleMaximize(): Promise<{ isMaximized: boolean }>
    isMaximized(): Promise<{ isMaximized: boolean }>
    getZoom(): Promise<{ zoomFactor: number }>
    setZoom(factor: number): Promise<{ zoomFactor: number }>
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
