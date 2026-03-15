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
