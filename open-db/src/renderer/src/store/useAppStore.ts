import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type {
  SidebarView,
  BottomPanelTab,
  DockerContainer,
  Connection,
  EditorTab,
  QueryResult,
  ColumnDef,
  RawQueryResult,
  TerminalSessionInfo,
  FileTreeNode,
  RedisBrowserState,
  RedisKeyViewerState,
  RedisKeyInfo,
  RedisValueType,
  RedisZSetMember,
} from '@/types'

/** Map a raw column name to a ColumnDef with sensible icon defaults */
function toColumnDef(name: string): ColumnDef {
  const n = name.toLowerCase()
  if (n === 'id' || n.endsWith('_id'))
    return { name, dataType: 'id', icon: 'key', iconColor: 'text-syntax-function' }
  if (n.includes('email'))
    return { name, dataType: 'varchar', icon: 'abc', iconColor: 'text-syntax-keyword', width: 'w-48' }
  if (n.includes('date') || n.includes('time') || n.includes('created') || n.includes('updated') || n.includes('login'))
    return { name, dataType: 'timestamp', icon: 'schedule', iconColor: 'text-status-green', width: 'w-40' }
  if (n === 'role' || n === 'type' || n === 'status' || n === 'kind')
    return { name, dataType: 'enum', icon: 'list', iconColor: 'text-syntax-decorator', width: 'w-24' }
  if (n.includes('count') || n.includes('amount') || n.includes('price') || n === 'age')
    return { name, dataType: 'number', icon: 'tag', iconColor: 'text-syntax-number' }
  if (n === 'active' || n === 'enabled' || n === 'is_' || n.startsWith('is_') || n.startsWith('has_'))
    return { name, dataType: 'boolean', icon: 'check_circle', iconColor: 'text-status-green' }
  return { name, dataType: 'varchar', icon: 'abc', iconColor: 'text-syntax-keyword' }
}

/** Infer a file icon from its name/extension */
function fileTabIcon(fileName: string): { icon: string; iconColor: string } {
  if (fileName.endsWith('.sql')) return { icon: 'database', iconColor: 'text-status-green' }
  if (fileName.endsWith('.json')) return { icon: 'data_object', iconColor: 'text-syntax-decorator' }
  if (fileName.endsWith('.md') || fileName.endsWith('.mdx')) return { icon: 'article', iconColor: 'text-accent-blue' }
  if (fileName.endsWith('.ts') || fileName.endsWith('.tsx')) return { icon: 'code', iconColor: 'text-syntax-keyword' }
  if (fileName.endsWith('.js') || fileName.endsWith('.jsx')) return { icon: 'javascript', iconColor: 'text-syntax-function' }
  if (fileName.endsWith('.css') || fileName.endsWith('.scss')) return { icon: 'palette', iconColor: 'text-syntax-decorator' }
  if (fileName.endsWith('.html')) return { icon: 'html', iconColor: 'text-status-red' }
  return { icon: 'description', iconColor: 'text-syntax-function' }
}

/* ── Store Shape ── */
interface AppState {
  // Sidebar
  activeSidebarView: SidebarView
  sidebarOpen: boolean

  // Docker
  containers: DockerContainer[]
  dockerAvailable: boolean

  // Connections
  connections: Connection[]
  activeConnectionId: string | null

  // Editor
  tabs: EditorTab[]
  activeTabId: string | null
  selectedText: string | null

  // Query Results
  queryResult: QueryResult | null
  isExecuting: boolean
  queryError: string | null

  // Bottom Panel
  activeBottomTab: BottomPanelTab
  bottomPanelOpen: boolean

  // Results Panel
  resultsPanelMode: 'normal' | 'minimized' | 'maximized'

  // Database Selection
  availableDatabases: string[]
  selectedDatabase: string | null

  // Terminal Sessions
  terminalSessions: TerminalSessionInfo[]
  activeTerminalSessionId: string | null

  // File Explorer
  workspaceRootPath: string | null
  workspaceRootName: string | null
  fileTree: FileTreeNode[]
  expandedDirs: Record<string, boolean>

  // Bottom Panel Height
  bottomPanelHeight: number

  // Redis Browser / Viewer
  redisBrowserState: RedisBrowserState | null
  redisKeyViewerState: RedisKeyViewerState | null

  // ── UI Actions ──
  setSidebarView: (view: SidebarView) => void
  toggleSidebar: () => void
  setActiveTab: (tabId: string) => void
  closeTab: (tabId: string) => void
  setBottomTab: (tab: BottomPanelTab) => void
  toggleBottomPanel: () => void
  updateTabContent: (tabId: string, content: string) => void
  setSelectedText: (text: string | null) => void
  openTableTab: (schema: string, table: string) => void
  openStructureTab: (connId: string, schema: string, table: string) => void
  openRedisBrowserTab: (containerId: string, db?: number) => void
  openRedisKeyTab: (containerId: string, key: string, type: RedisValueType, db?: number) => void
  addNewFileTab: (title: string, content?: string) => void
  setResultsPanelMode: (mode: 'normal' | 'minimized' | 'maximized') => void
  setBottomPanelHeight: (height: number) => void

  // ── File Actions ──
  saveCurrentFile: () => Promise<void>
  commitTransaction: () => Promise<void>
  rollbackTransaction: () => Promise<void>
  createNewFolder: (parentPath: string, folderName: string) => Promise<void>
  createNewFile: (parentPath: string, fileName: string) => Promise<void>
  deleteFileOrFolder: (itemPath: string) => Promise<void>

  // ── File Explorer Actions ──
  openFolder: () => Promise<void>
  openFileDialog: () => Promise<void>
  openFileFromTree: (filePath: string, fileName: string) => Promise<void>
  toggleDir: (dirPath: string) => void

  // ── Database Actions ──
  loadConnections: () => Promise<void>
  connectToDatabase: (conn: Connection, password: string) => Promise<void>
  disconnectDatabase: (connId: string) => Promise<void>
  addConnection: (conn: Connection) => void
  deleteConnection: (connId: string) => Promise<void>
  executeQuery: (selectedText?: string) => Promise<void>
  fetchDatabases: () => Promise<void>
  switchDatabase: (dbName: string) => Promise<void>
  scanRedisKeys: (containerId: string, pattern?: string, cursor?: string, db?: number) => Promise<void>
  loadRedisKeyValue: (containerId: string, key: string, type: RedisValueType, db?: number) => Promise<void>
  setRedisStringValue: (containerId: string, key: string, value: string, db?: number) => Promise<void>
  setRedisTTL: (containerId: string, key: string, ttl: number, db?: number) => Promise<void>
  deleteRedisKey: (containerId: string, key: string, db?: number) => Promise<void>
  redisHashSetField: (containerId: string, key: string, field: string, value: string, db?: number) => Promise<void>
  redisHashDeleteField: (containerId: string, key: string, field: string, db?: number) => Promise<void>
  redisListSetAt: (containerId: string, key: string, index: number, value: string, db?: number) => Promise<void>
  redisListPushValue: (containerId: string, key: string, value: string, position?: 'left' | 'right', db?: number) => Promise<void>
  redisSetAddMember: (containerId: string, key: string, member: string, db?: number) => Promise<void>
  redisSetRemoveMember: (containerId: string, key: string, member: string, db?: number) => Promise<void>
  redisZSetUpsertMember: (containerId: string, key: string, member: string, score: number, db?: number) => Promise<void>
  redisZSetRemoveMember: (containerId: string, key: string, member: string, db?: number) => Promise<void>
  createRedisKey: (input: {
    containerId: string
    key: string
    type: Exclude<RedisValueType, 'none' | 'unknown'>
    value: string
    ttlSeconds?: number
    db?: number
  }) => Promise<void>

  // ── Terminal Actions ──
  openLocalTerminal: () => void
  openDockerTerminal: (containerId: string, containerName: string, dbType: string) => void
  closeTerminalSession: (sessionId: string) => void
  setActiveTerminalSession: (sessionId: string) => void

  // ── Docker Actions ──
  fetchDockerStatus: () => Promise<void>
  fetchContainers: () => Promise<void>
  startContainer: (id: string) => Promise<void>
  stopContainer: (id: string) => Promise<void>
  removeContainer: (id: string) => Promise<void>
  createDockerContainer: (opts: { name: string; type: string; port?: number; password?: string }) => Promise<void>
}

export const useAppStore = create<AppState>()(
  immer((set) => ({
    // ── Initial state ──
    activeSidebarView: 'explorer',
    sidebarOpen: true,

    containers: [],
    dockerAvailable: false,

    connections: [],
    activeConnectionId: null,

    tabs: [],
    activeTabId: null,
    selectedText: null,

    queryResult: null,
    isExecuting: false,
    queryError: null,

    activeBottomTab: 'terminal',
    bottomPanelOpen: true,

    resultsPanelMode: 'normal',

    availableDatabases: [],
    selectedDatabase: null,

    terminalSessions: [],
    activeTerminalSessionId: null,

    workspaceRootPath: null,
    workspaceRootName: null,
    fileTree: [],
    expandedDirs: {} as Record<string, boolean>,

    bottomPanelHeight: 300,

    redisBrowserState: null,
    redisKeyViewerState: null,

    // ── UI Actions ──
    setSidebarView: (view) =>
      set((s) => {
        if (s.activeSidebarView === view) {
          s.sidebarOpen = !s.sidebarOpen
        } else {
          s.activeSidebarView = view
          s.sidebarOpen = true
        }
      }),

    toggleSidebar: () =>
      set((s) => {
        s.sidebarOpen = !s.sidebarOpen
      }),

    setActiveTab: (tabId) =>
      set((s) => {
        s.tabs.forEach((t) => (t.isActive = t.id === tabId))
        s.activeTabId = tabId
      }),

    closeTab: (tabId) =>
      set((s) => {
        const idx = s.tabs.findIndex((t) => t.id === tabId)
        if (idx === -1) return
        const wasActive = s.tabs[idx].isActive
        s.tabs.splice(idx, 1)
        if (wasActive && s.tabs.length > 0) {
          const next = s.tabs[Math.min(idx, s.tabs.length - 1)]
          next.isActive = true
          s.activeTabId = next.id
        } else if (s.tabs.length === 0) {
          s.activeTabId = null
        }
      }),

    setBottomTab: (tab) =>
      set((s) => {
        s.activeBottomTab = tab
        s.bottomPanelOpen = true
      }),

    toggleBottomPanel: () =>
      set((s) => {
        s.bottomPanelOpen = !s.bottomPanelOpen
      }),

    updateTabContent: (tabId: string, content: string) =>
      set((s) => {
        const tab = s.tabs.find((t: EditorTab) => t.id === tabId)
        if (tab) {
          tab.content = content
          tab.isModified = true
        }
      }),

    setSelectedText: (text: string | null) =>
      set((s) => {
        s.selectedText = text
      }),

    openTableTab: (schema: string, table: string) =>
      set((s) => {
        const title = `${schema}.${table}`
        // If already open, just switch to it
        const existing = s.tabs.find((t: EditorTab) => t.title === title && t.type === 'table')
        if (existing) {
          s.tabs.forEach((t: EditorTab) => (t.isActive = t.id === existing.id))
          s.activeTabId = existing.id
          return
        }
        const id = 'tab-' + Math.random().toString(36).slice(2, 8)
        s.tabs.forEach((t: EditorTab) => (t.isActive = false))
        s.tabs.push({
          id,
          title,
          type: 'table',
          icon: 'table_chart',
          iconColor: 'text-syntax-decorator',
          isActive: true,
          isModified: false,
          content: `SELECT * FROM ${schema}.${table} LIMIT 100;`,
        })
        s.activeTabId = id
      }),

    openStructureTab: (connId: string, schema: string, table: string) =>
      set((s) => {
        const title = `${table}`
        // If already open, just switch to it
        const existing = s.tabs.find((t: EditorTab) => t.type === 'structure' && (t as any)._schema === schema && (t as any)._tableName === table && (t as any)._connId === connId)
        if (existing) {
          s.tabs.forEach((t: EditorTab) => (t.isActive = t.id === existing.id))
          s.activeTabId = existing.id
          return
        }
        const id = 'tab-' + Math.random().toString(36).slice(2, 8)
        s.tabs.forEach((t: EditorTab) => (t.isActive = false))
        const newTab: any = {
          id,
          title,
          type: 'structure',
          icon: 'table_chart',
          iconColor: 'text-syntax-decorator',
          isActive: true,
          isModified: false,
          _schema: schema,
          _tableName: table,
          _connId: connId,
        }
        s.tabs.push(newTab)
        s.activeTabId = id
      }),

    openRedisBrowserTab: (containerId: string, db = 0) =>
      set((s) => {
        const title = `Redis DB ${db}`
        const existing = s.tabs.find(
          (t: EditorTab) =>
            t.type === 'redis-browser' &&
            (t as unknown as { _containerId?: string })._containerId === containerId &&
            ((t as unknown as { _redisDb?: number })._redisDb ?? 0) === db
        )
        if (existing) {
          s.tabs.forEach((t: EditorTab) => (t.isActive = t.id === existing.id))
          s.activeTabId = existing.id
          return
        }

        const id = 'tab-' + Math.random().toString(36).slice(2, 8)
        s.tabs.forEach((t: EditorTab) => (t.isActive = false))
        const newTab: EditorTab = {
          id,
          title,
          type: 'redis-browser',
          icon: 'storage',
          iconColor: 'text-status-red',
          isActive: true,
          isModified: false,
          _containerId: containerId,
          _redisDb: db,
        }
        s.tabs.push(newTab)
        s.activeTabId = id
      }),

    openRedisKeyTab: (containerId: string, key: string, type: RedisValueType, db = 0) =>
      set((s) => {
        const existing = s.tabs.find(
          (t: EditorTab) =>
            t.type === 'redis-key' &&
            (t as unknown as { _containerId?: string })._containerId === containerId &&
            (t as unknown as { _redisKey?: string })._redisKey === key &&
            ((t as unknown as { _redisDb?: number })._redisDb ?? 0) === db
        )
        if (existing) {
          s.tabs.forEach((t: EditorTab) => (t.isActive = t.id === existing.id))
          s.activeTabId = existing.id
          return
        }

        const id = 'tab-' + Math.random().toString(36).slice(2, 8)
        s.tabs.forEach((t: EditorTab) => (t.isActive = false))
        s.tabs.push({
          id,
          title: key,
          type: 'redis-key',
          icon: type === 'hash' ? 'data_object' : type === 'list' ? 'view_list' : type === 'set' ? 'layers' : type === 'zset' ? 'leaderboard' : 'key',
          iconColor: 'text-status-red',
          isActive: true,
          isModified: false,
          _redisKey: key,
          _redisDb: db,
          _containerId: containerId,
        })
        s.activeTabId = id
      }),

    addNewFileTab: (title: string, content = '') =>
      set((s) => {
        const id = 'tab-' + Math.random().toString(36).slice(2, 8)
        const isSql = title.endsWith('.sql')
        const { icon, iconColor } = fileTabIcon(title)
        s.tabs.forEach((t: EditorTab) => (t.isActive = false))
        s.tabs.push({
          id,
          title,
          type: isSql ? 'sql' : 'config',
          icon,
          iconColor,
          isActive: true,
          isModified: true,
          content,
        })
        s.activeTabId = id
      }),

    setResultsPanelMode: (mode: 'normal' | 'minimized' | 'maximized') =>
      set((s) => {
        s.resultsPanelMode = mode
      }),

    setBottomPanelHeight: (height: number) =>
      set((s) => {
        s.bottomPanelHeight = Math.max(150, Math.min(600, height))
      }),

    // ── File Actions ──

    saveCurrentFile: async () => {
      const state = useAppStore.getState()
      const tab = state.tabs.find((t) => t.id === state.activeTabId)
      if (!tab) return

      const filePath = (tab as any)._filePath as string | undefined
      if (!filePath) {
        // No file path — this is a new unsaved tab, nothing to save to disk
        console.warn('[Save] Tab has no file path')
        return
      }

      try {
        await window.electronAPI.filesystem.saveFile(filePath, tab.content ?? '')
        set((s) => {
          const t = s.tabs.find((x: EditorTab) => x.id === tab.id)
          if (t) t.isModified = false
        })
        console.log(`[Save] Saved ${filePath}`)
      } catch (err) {
        console.error('[Save] Failed:', err)
      }
    },

    commitTransaction: async () => {
      const { activeConnectionId } = useAppStore.getState()
      if (!activeConnectionId) return
      set((s) => { s.isExecuting = true })
      try {
        await window.electronAPI.database.executeQuery(activeConnectionId, 'COMMIT')
        set((s) => {
          s.isExecuting = false
          s.queryError = null
        })
        console.log('[DB] COMMIT executed')
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        set((s) => {
          s.isExecuting = false
          s.queryError = msg
        })
      }
    },

    rollbackTransaction: async () => {
      const { activeConnectionId } = useAppStore.getState()
      if (!activeConnectionId) return
      set((s) => { s.isExecuting = true })
      try {
        await window.electronAPI.database.executeQuery(activeConnectionId, 'ROLLBACK')
        set((s) => {
          s.isExecuting = false
          s.queryError = null
          s.queryResult = null
        })
        console.log('[DB] ROLLBACK executed')
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        set((s) => {
          s.isExecuting = false
          s.queryError = msg
        })
      }
    },

    createNewFolder: async (parentPath: string, folderName: string) => {
      try {
        await window.electronAPI.filesystem.createFolder(parentPath, folderName)
        // Refresh the subtree for the parent by re-reading the root workspace
        const state = useAppStore.getState()
        if (state.workspaceRootPath) {
          const dirTree = await window.electronAPI.filesystem.readDir(state.workspaceRootPath)
          set((s) => {
            s.fileTree = dirTree as FileTreeNode[]
          })
        }
      } catch (err) {
        console.error('[FS] Failed to create folder:', err)
      }
    },

    createNewFile: async (parentPath: string, fileName: string) => {
      try {
        const result = await window.electronAPI.filesystem.createFile(parentPath, fileName)
        // Refresh the file tree
        const state = useAppStore.getState()
        if (state.workspaceRootPath) {
          const dirTree = await window.electronAPI.filesystem.readDir(state.workspaceRootPath)
          set((s) => {
            s.fileTree = dirTree as FileTreeNode[]
          })
        }
        // Open the newly created file in editor
        if (result.ok && result.path) {
          useAppStore.getState().openFileFromTree(result.path, fileName)
        }
      } catch (err) {
        console.error('[FS] Failed to create file:', err)
      }
    },

    deleteFileOrFolder: async (itemPath: string) => {
      try {
        await window.electronAPI.filesystem.deleteItem(itemPath)
        // Refresh the file tree
        const state = useAppStore.getState()
        if (state.workspaceRootPath) {
          const dirTree = await window.electronAPI.filesystem.readDir(state.workspaceRootPath)
          set((s) => {
            s.fileTree = dirTree as FileTreeNode[]
          })
        }
        // Close any tabs that have this file open
        set((s) => {
          const tabsToRemove = s.tabs.filter(t => (t as unknown as { _filePath?: string })._filePath === itemPath)
          if (tabsToRemove.length > 0) {
            s.tabs = s.tabs.filter(t => (t as unknown as { _filePath?: string })._filePath !== itemPath)
            // If active tab was closed, select another
            if (tabsToRemove.some(t => t.id === s.activeTabId)) {
              s.activeTabId = s.tabs.length > 0 ? s.tabs[0].id : null
            }
          }
        })
      } catch (err) {
        console.error('[FS] Failed to delete:', err)
      }
    },

    // ── File Explorer Actions ──

    openFolder: async () => {
      try {
        const result = await window.electronAPI.filesystem.openFolder()
        if (result.canceled || !result.rootPath) return
        const rootPath = result.rootPath
        const rootName = rootPath.split(/[\\/]/).pop() ?? rootPath
        set((s) => {
          s.workspaceRootPath = rootPath
          s.workspaceRootName = rootName
          s.fileTree = result.tree as FileTreeNode[]
          s.expandedDirs = {}
          s.activeSidebarView = 'explorer'
          s.sidebarOpen = true
        })
      } catch (err) {
        console.error('Failed to open folder', err)
      }
    },

    openFileDialog: async () => {
      try {
        const result = await window.electronAPI.filesystem.openFile()
        if (result.canceled || !result.content) return
        const fileName = result.fileName ?? 'untitled'
        set((s) => {
          const id = 'tab-' + Math.random().toString(36).slice(2, 8)
          const isSql = fileName.endsWith('.sql')
          const { icon, iconColor } = fileTabIcon(fileName)
          s.tabs.forEach((t: EditorTab) => (t.isActive = false))
          s.tabs.push({
            id,
            title: fileName,
            type: isSql ? 'sql' : 'config',
            icon,
            iconColor,
            isActive: true,
            isModified: false,
            content: result.content!,
          })
          s.activeTabId = id
        })
      } catch (err) {
        console.error('Failed to open file', err)
      }
    },

    openFileFromTree: async (filePath: string, fileName: string) => {
      // Check if already open — match by filePath first (unique), then by title
      const state = useAppStore.getState()
      const existing = state.tabs.find(
        (t) => (t as any)._filePath === filePath
      )
      if (existing) {
        set((s) => {
          s.tabs.forEach((t: EditorTab) => (t.isActive = t.id === existing.id))
          s.activeTabId = existing.id
        })
        return
      }

      try {
        const result = await window.electronAPI.filesystem.readFile(filePath)
        const isSql = fileName.endsWith('.sql')
        const { icon, iconColor } = fileTabIcon(fileName)

        set((s) => {
          const id = 'tab-' + Math.random().toString(36).slice(2, 8)
          s.tabs.forEach((t: EditorTab) => (t.isActive = false))
          const newTab: any = {
            id,
            title: fileName,
            type: isSql ? 'sql' : 'config',
            icon,
            iconColor,
            isActive: true,
            isModified: false,
            content: result.content,
            _filePath: filePath,
          }
          s.tabs.push(newTab)
          s.activeTabId = id
        })
      } catch (err) {
        console.error('Failed to read file', err)
      }
    },

    toggleDir: (dirPath: string) =>
      set((s) => {
        if (s.expandedDirs[dirPath]) {
          delete s.expandedDirs[dirPath]
        } else {
          s.expandedDirs[dirPath] = true
        }
      }),

    // ── Database Actions ──

    loadConnections: async () => {
      try {
        const raw = await window.electronAPI.database.getConnections()
        const loaded = raw as Connection[]

        // De-dupe persisted connections that point to the same logical target.
        const byKey = new Map<string, Connection>()
        for (const conn of loaded) {
          const normalizedDb = conn.type === 'redis'
            ? '0'
            : (conn.database ?? '')
          const key = conn.dockerContainerId
            ? `docker:${conn.type}:${conn.dockerContainerId}:${normalizedDb}`
            : `tcp:${conn.type}:${conn.host}:${conn.port}:${normalizedDb}`

          const existing = byKey.get(key)
          if (!existing) {
            byKey.set(key, conn)
            continue
          }

          // Prefer records with password/dockerContainerId so reconnect works without prompting.
          byKey.set(key, {
            ...existing,
            ...conn,
            password: existing.password || conn.password,
            dockerContainerId: existing.dockerContainerId || conn.dockerContainerId,
          })
        }

        const connections = Array.from(byKey.values())
        set((s) => {
          s.connections = connections
        })
        // Auto-reconnect connections that have saved passwords
        for (const conn of connections) {
          if (conn.password) {
            try {
              const state = useAppStore.getState()
              // Skip if already connected
              const existing = state.connections.find((c: Connection) => c.id === conn.id)
              if (existing?.isConnected) continue

              const dbName = conn.database ?? (conn.type === 'mysql' ? 'mysql' : 'postgres')
              // MongoDB auto-reconnect - no direct TCP from renderer, use Docker-backed flow.
              if (conn.type === 'mongodb') {
                set((s) => {
                  const c = s.connections.find((x: Connection) => x.id === conn.id)
                  if (c) c.isConnected = true
                  if (!s.activeConnectionId) {
                    s.activeConnectionId = conn.id
                    s.selectedDatabase = conn.database || 'test'
                  }
                })
                continue
              }

              // Redis auto-reconnect must validate auth/container availability before marking connected.
              if (conn.type === 'redis') {
                if (!conn.dockerContainerId) continue
                const dbs = await window.electronAPI.redis.getDatabases(conn.dockerContainerId, conn.password)
                set((s) => {
                  const c = s.connections.find((x: Connection) => x.id === conn.id)
                  if (c) c.isConnected = true
                  if (!s.activeConnectionId) {
                    s.activeConnectionId = conn.id
                    s.selectedDatabase = '0'
                    s.availableDatabases = dbs.length ? dbs.map((d) => String(d.index)) : ['0']
                  }
                })
                continue
              }

              const driver = conn.type === 'mysql' ? 'mysql' : conn.type === 'postgres' ? 'postgres' : null
              if (!driver) continue
              const normalizedPort = Number(conn.port)
              if (!Number.isFinite(normalizedPort) || normalizedPort <= 0 || normalizedPort > 65535) continue
              await window.electronAPI.database.connect(
                conn.id,
                driver,
                conn.host,
                normalizedPort,
                conn.username ?? (driver === 'mysql' ? 'root' : 'postgres'),
                conn.password,
                dbName
              )
              set((s) => {
                const c = s.connections.find((x: Connection) => x.id === conn.id)
                if (c) c.isConnected = true
                // Set the first reconnected connection as active
                if (!s.activeConnectionId) {
                  s.activeConnectionId = conn.id
                  s.selectedDatabase = dbName
                }
              })
              // Auto-fetch databases for the active connection
              const updatedState = useAppStore.getState()
              if (updatedState.activeConnectionId === conn.id) {
                try {
                  const dbs = await window.electronAPI.database.getDatabases(conn.id)
                  set((s) => {
                    s.availableDatabases = dbs
                  })
                } catch {
                  // non-critical
                }
              }
              console.log(`[Auto-reconnect] Connected to ${conn.name}`)
            } catch (err) {
              console.warn(`[Auto-reconnect] Failed for ${conn.name}:`, err)
              // Connection failed — leave as disconnected, user can manually reconnect
            }
          }
        }
      } catch (err) {
        console.error('Failed to load connections', err)
      }
    },

    connectToDatabase: async (conn: Connection, password: string) => {
      try {
        // MongoDB connect flow uses Docker container exec; no direct driver connection required.
        if (conn.type === 'mongodb') {
          if (!conn.dockerContainerId) {
            throw new Error('MongoDB connection requires a Docker container. Use the Docker panel to connect.')
          }

          set((s) => {
            const c = s.connections.find((x: Connection) => x.id === conn.id)
            if (c) {
              c.isConnected = true
              c.password = password
            }
            s.activeConnectionId = conn.id
            s.selectedDatabase = conn.database || 'test'
          })

          try {
            const dbs = await window.electronAPI.mongo.getDatabases(conn.dockerContainerId)
            set((s) => {
              s.availableDatabases = dbs.length ? dbs : ['test']
            })
          } catch {
            // container may not have privileges to list databases
          }

          return
        }

        // Redis connect flow uses Docker container exec; no direct driver connection required.
        if (conn.type === 'redis') {
          if (!conn.dockerContainerId) {
            throw new Error('Redis connection requires a Docker container. Use the Docker panel to connect.')
          }

          let dbs: Array<{ index: number; keys: number }> = []
          try {
            dbs = await window.electronAPI.redis.getDatabases(conn.dockerContainerId, password)
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err)
            throw new Error(`Redis connect failed: ${message}`)
          }

          set((s) => {
            const c = s.connections.find((x: Connection) => x.id === conn.id)
            if (c) {
              c.isConnected = true
              c.password = password
              c.dockerContainerId = c.dockerContainerId || conn.dockerContainerId
            }
            s.activeConnectionId = conn.id
            s.selectedDatabase = '0'
            s.availableDatabases = dbs.length ? dbs.map((d) => String(d.index)) : ['0']
          })

          return
        }

        const driver = conn.type === 'mysql' ? 'mysql' : conn.type === 'postgres' ? 'postgres' : null
        if (!driver) {
          throw new Error(`GUI query mode currently supports PostgreSQL and MySQL. Received: ${conn.type}`)
        }

        const normalizedPort = Number(conn.port)
        if (!Number.isFinite(normalizedPort) || normalizedPort <= 0 || normalizedPort > 65535) {
          throw new Error(`Invalid port for ${conn.name}. Please set a valid port between 1 and 65535.`)
        }

        const dbName = conn.database ?? (driver === 'mysql' ? 'mysql' : 'postgres')
        await window.electronAPI.database.connect(
          conn.id,
          driver,
          conn.host,
          normalizedPort,
          conn.username ?? (driver === 'mysql' ? 'root' : 'postgres'),
          password,
          dbName
        )
        set((s) => {
          const c = s.connections.find((x: Connection) => x.id === conn.id)
          if (c) {
            c.isConnected = true
            c.password = password // Keep password in state for save
          }
          s.activeConnectionId = conn.id
          s.selectedDatabase = dbName
        })
        // Auto-fetch available databases after connecting (Beekeeper-style)
        try {
          const dbs = await window.electronAPI.database.getDatabases(conn.id)
          set((s) => {
            s.availableDatabases = dbs
          })
        } catch {
          // non-critical
        }
      } catch (err) {
        console.error('Failed to connect', err)
        throw err
      }
    },

    disconnectDatabase: async (connId: string) => {
      try {
        const disconnConn = useAppStore.getState().connections.find((c) => c.id === connId)
        if (disconnConn?.type === 'mongodb' || disconnConn?.type === 'redis') {
          set((s) => {
            const c = s.connections.find((x: Connection) => x.id === connId)
            if (c) c.isConnected = false
            if (s.activeConnectionId === connId) {
              s.activeConnectionId = null
              s.availableDatabases = []
              s.selectedDatabase = null
            }
          })
          return
        }

        await window.electronAPI.database.disconnect(connId)
        set((s) => {
          const c = s.connections.find((x: Connection) => x.id === connId)
          if (c) c.isConnected = false
          if (s.activeConnectionId === connId) {
            s.activeConnectionId = null
            s.availableDatabases = []
            s.selectedDatabase = null
          }
        })
      } catch (err) {
        console.error('Failed to disconnect', err)
      }
    },

    addConnection: (conn: Connection) =>
      set((s) => {
        // Upsert logical connection to avoid duplicates in sidebar.
        const normalizedDb = conn.type === 'redis' ? '0' : (conn.database ?? '')
        const idx = s.connections.findIndex((c: Connection) => {
          const cDb = c.type === 'redis' ? '0' : (c.database ?? '')
          if (c.dockerContainerId && conn.dockerContainerId) {
            return c.type === conn.type && c.dockerContainerId === conn.dockerContainerId && cDb === normalizedDb
          }
          return c.type === conn.type && c.host === conn.host && c.port === conn.port && cDb === normalizedDb
        })

        if (idx >= 0) {
          s.connections[idx] = {
            ...s.connections[idx],
            ...conn,
            password: conn.password || s.connections[idx].password,
            dockerContainerId: conn.dockerContainerId || s.connections[idx].dockerContainerId,
          }
        } else {
          s.connections.push(conn)
        }
      }),

    deleteConnection: async (connId: string) => {
      try {
        // Disconnect first if active
        await window.electronAPI.database.disconnect(connId).catch(() => {})
        await window.electronAPI.database.deleteConnection(connId)
        set((s) => {
          s.connections = s.connections.filter((c: Connection) => c.id !== connId)
          if (s.activeConnectionId === connId) s.activeConnectionId = null
        })
      } catch (err) {
        console.error('Failed to delete connection', err)
      }
    },

    executeQuery: async (selectedText?: string) => {
      const state = useAppStore.getState()
      const { activeTabId, tabs, activeConnectionId } = state

      const tab = tabs.find((t) => t.id === activeTabId)
      if (!tab?.content?.trim()) return

      // Auto-save the file first if it has a file path and is modified
      const filePath = (tab as unknown as { _filePath?: string })._filePath
      if (filePath && tab.isModified) {
        try {
          await window.electronAPI.filesystem.saveFile(filePath, tab.content)
          set((s) => {
            const t = s.tabs.find((x: EditorTab) => x.id === activeTabId)
            if (t) t.isModified = false
          })
        } catch (err) {
          console.error('[FS] Auto-save failed:', err)
        }
      }

      // Use selected text if provided, otherwise use the entire file content
      const sqlToExecute = selectedText?.trim() || tab.content

      set((s) => {
        s.isExecuting = true
        s.queryError = null
      })

      if (!activeConnectionId) {
        set((s) => {
          s.isExecuting = false
          s.queryError = 'No active database connection. Connect to a database first.'
        })
        return
      }

      try {
        // MongoDB query path via Docker exec + mongosh JSON output.
        const execConn = useAppStore.getState().connections.find((c) => c.id === activeConnectionId)
        if (execConn?.type === 'mongodb') {
          if (!execConn.dockerContainerId) {
            set((s) => {
              s.isExecuting = false
              s.queryError = 'No Docker container linked to this MongoDB connection.'
            })
            return
          }

          const result = await window.electronAPI.mongo.execute(execConn.dockerContainerId, sqlToExecute)
          const allKeys = Array.from(new Set(result.documents.flatMap((d) => Object.keys(d))))

          set((s) => {
            s.queryResult = {
              columns: allKeys.map(toColumnDef),
              rows: result.documents as Record<string, string | number | null>[],
              rowCount: result.count,
              executionTimeMs: result.executionTimeMs,
            }
            s.isExecuting = false
            s.queryError = null
          })
          return
        }

        const raw = (await window.electronAPI.database.executeQuery(
          activeConnectionId,
          sqlToExecute
        )) as RawQueryResult

        const columns: ColumnDef[] = raw.columns.map(toColumnDef)
        const rows = raw.rows.map((r) => {
          const mapped: Record<string, string | number | null> = {}
          for (const col of raw.columns) {
            const v = r[col]
            mapped[col] = v == null ? null : typeof v === 'object' ? JSON.stringify(v) : (v as string | number)
          }
          return mapped
        })

        set((s) => {
          s.queryResult = {
            columns,
            rows,
            rowCount: raw.rowCount,
            executionTimeMs: raw.executionTimeMs,
          }
          s.isExecuting = false
          s.queryError = null
        })
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        set((s) => {
          s.isExecuting = false
          s.queryError = msg
        })
      }
    },

    fetchDatabases: async () => {
      const { activeConnectionId, connections } = useAppStore.getState()
      if (!activeConnectionId) return
      const conn = connections.find((c) => c.id === activeConnectionId)
      if (!conn) return

      try {
        if (conn.type === 'mongodb') {
          if (!conn.dockerContainerId) return
          const dbs = await window.electronAPI.mongo.getDatabases(conn.dockerContainerId)
          set((s) => { s.availableDatabases = dbs.length ? dbs : ['test'] })
          return
        }

        if (conn.type === 'redis') {
          if (!conn.dockerContainerId) return
          const dbs = await window.electronAPI.redis.getDatabases(conn.dockerContainerId, conn.password ?? undefined)
          set((s) => { s.availableDatabases = dbs.length ? dbs.map((d) => String(d.index)) : ['0'] })
          return
        }

        const dbs = await window.electronAPI.database.getDatabases(activeConnectionId)
        set((s) => { s.availableDatabases = dbs })
      } catch (err) {
        console.error('Failed to fetch databases', err)
      }
    },

    switchDatabase: async (dbName: string) => {
      const { activeConnectionId, connections } = useAppStore.getState()
      if (!activeConnectionId) return
      const conn = connections.find((c) => c.id === activeConnectionId)
      if (!conn) return

      try {
        // MongoDB and Redis: just update state — db selection is per-command
        if (conn.type === 'mongodb' || conn.type === 'redis') {
          set((s) => {
            s.selectedDatabase = dbName
            const c = s.connections.find((x: Connection) => x.id === activeConnectionId)
            if (c) c.database = dbName
          })
          return
        }

        await window.electronAPI.database.switchDatabase(activeConnectionId, dbName)
        set((s) => {
          s.selectedDatabase = dbName
          const c = s.connections.find((x: Connection) => x.id === activeConnectionId)
          if (c) c.database = dbName
        })
      } catch (err) {
        console.error('Failed to switch database', err)
        throw err
      }
    },

    scanRedisKeys: async (containerId: string, pattern = '*', cursor = '0', db = 0) => {
      set((s) => {
        const next: RedisBrowserState = s.redisBrowserState ?? {
          containerId,
          db,
          pattern,
          cursor,
          keys: [],
          isLoading: true,
          error: null,
        }
        next.containerId = containerId
        next.db = db
        next.pattern = pattern
        next.cursor = cursor
        next.isLoading = true
        next.error = null
        s.redisBrowserState = next
      })

      try {
        const { connections, activeConnectionId } = useAppStore.getState()
        const activeConn = connections.find((c) => c.id === activeConnectionId)
        const matchingConn =
          (activeConn?.type === 'redis' && activeConn.dockerContainerId === containerId ? activeConn : undefined)
          ?? connections.find((c) => c.type === 'redis' && c.dockerContainerId === containerId)

        const result = await window.electronAPI.redis.scanKeys(
          containerId,
          pattern,
          cursor,
          150,
          db,
          matchingConn?.password ?? undefined
        )
        set((s) => {
          if (!s.redisBrowserState) return
          s.redisBrowserState.cursor = result.cursor
          s.redisBrowserState.keys = result.keys as RedisKeyInfo[]
          s.redisBrowserState.isLoading = false
          s.redisBrowserState.error = null
        })
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        set((s) => {
          if (!s.redisBrowserState) return
          s.redisBrowserState.isLoading = false
          s.redisBrowserState.error = msg
        })
      }
    },

    loadRedisKeyValue: async (containerId: string, key: string, type: RedisValueType, db = 0) => {
      set((s) => {
        s.redisKeyViewerState = {
          containerId,
          db,
          key,
          type,
          value: type === 'hash' ? {} : type === 'zset' ? [] : [],
          ttl: -1,
          size: 0,
          isLoading: true,
          isSaving: false,
          error: null,
        }
      })

      try {
        const metadata = await window.electronAPI.redis.getKeyMetadata(containerId, key, db)
        let nextValue: RedisKeyViewerState['value']

        if (metadata.type === 'string') {
          const result = await window.electronAPI.redis.getKeyValue(containerId, key, 'string', db)
          nextValue = (typeof result.value === 'string' ? result.value : '') as RedisKeyViewerState['value']
        } else {
          const page = await window.electronAPI.redis.getKeyPage(containerId, key, metadata.type, '0', 0, 500, db)
          if (metadata.type === 'hash') {
            const hash: Record<string, string> = {}
            for (const item of page.items as Array<{ field: string; value: string }>) {
              hash[item.field] = item.value
            }
            nextValue = hash
          } else if (metadata.type === 'zset') {
            nextValue = (page.items as RedisZSetMember[])
          } else {
            nextValue = (page.items as string[])
          }
        }

        set((s) => {
          if (!s.redisKeyViewerState) return
          s.redisKeyViewerState.type = metadata.type as RedisValueType
          s.redisKeyViewerState.value = nextValue
          s.redisKeyViewerState.ttl = metadata.ttl
          s.redisKeyViewerState.size = metadata.size
          s.redisKeyViewerState.isLoading = false
          s.redisKeyViewerState.error = null
        })
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        set((s) => {
          if (!s.redisKeyViewerState) return
          s.redisKeyViewerState.isLoading = false
          s.redisKeyViewerState.error = msg
        })
      }
    },

    setRedisStringValue: async (containerId: string, key: string, value: string, db = 0) => {
      set((s) => {
        if (s.redisKeyViewerState) s.redisKeyViewerState.isSaving = true
      })
      try {
        await window.electronAPI.redis.setKeyValue(containerId, key, value, db)
        await useAppStore.getState().loadRedisKeyValue(containerId, key, 'string', db)
      } finally {
        set((s) => {
          if (s.redisKeyViewerState) s.redisKeyViewerState.isSaving = false
        })
      }
    },

    setRedisTTL: async (containerId: string, key: string, ttl: number, db = 0) => {
      await window.electronAPI.redis.setKeyTTL(containerId, key, ttl, db)
      const current = useAppStore.getState().redisKeyViewerState
      if (current && current.key === key && current.containerId === containerId && current.db === db) {
        await useAppStore.getState().loadRedisKeyValue(containerId, key, current.type, db)
      }
    },

    deleteRedisKey: async (containerId: string, key: string, db = 0) => {
      await window.electronAPI.redis.deleteKey(containerId, key, db)
      set((s) => {
        if (s.redisKeyViewerState && s.redisKeyViewerState.key === key) {
          s.redisKeyViewerState = null
        }
        const tab = s.tabs.find(
          (t: EditorTab) =>
            t.type === 'redis-key' &&
            (t as unknown as { _containerId?: string })._containerId === containerId &&
            (t as unknown as { _redisKey?: string })._redisKey === key &&
            ((t as unknown as { _redisDb?: number })._redisDb ?? 0) === db
        )
        if (tab) {
          s.tabs = s.tabs.filter((t) => t.id !== tab.id)
          if (s.activeTabId === tab.id) {
            s.activeTabId = s.tabs.length ? s.tabs[s.tabs.length - 1].id : null
          }
        }
      })
      const browser = useAppStore.getState().redisBrowserState
      if (browser && browser.containerId === containerId && browser.db === db) {
        await useAppStore.getState().scanRedisKeys(containerId, browser.pattern, '0', db)
      }
    },

    redisHashSetField: async (containerId: string, key: string, field: string, value: string, db = 0) => {
      await window.electronAPI.redis.hashSet(containerId, key, field, value, db)
      await useAppStore.getState().loadRedisKeyValue(containerId, key, 'hash', db)
    },

    redisHashDeleteField: async (containerId: string, key: string, field: string, db = 0) => {
      await window.electronAPI.redis.hashDelete(containerId, key, [field], db)
      await useAppStore.getState().loadRedisKeyValue(containerId, key, 'hash', db)
    },

    redisListSetAt: async (containerId: string, key: string, index: number, value: string, db = 0) => {
      await window.electronAPI.redis.listSet(containerId, key, index, value, db)
      await useAppStore.getState().loadRedisKeyValue(containerId, key, 'list', db)
    },

    redisListPushValue: async (containerId: string, key: string, value: string, position = 'right', db = 0) => {
      await window.electronAPI.redis.listPush(containerId, key, [value], position, db)
      await useAppStore.getState().loadRedisKeyValue(containerId, key, 'list', db)
    },

    redisSetAddMember: async (containerId: string, key: string, member: string, db = 0) => {
      await window.electronAPI.redis.setAdd(containerId, key, [member], db)
      await useAppStore.getState().loadRedisKeyValue(containerId, key, 'set', db)
    },

    redisSetRemoveMember: async (containerId: string, key: string, member: string, db = 0) => {
      await window.electronAPI.redis.setRemove(containerId, key, [member], db)
      await useAppStore.getState().loadRedisKeyValue(containerId, key, 'set', db)
    },

    redisZSetUpsertMember: async (containerId: string, key: string, member: string, score: number, db = 0) => {
      await window.electronAPI.redis.zsetAdd(containerId, key, member, score, db)
      await useAppStore.getState().loadRedisKeyValue(containerId, key, 'zset', db)
    },

    redisZSetRemoveMember: async (containerId: string, key: string, member: string, db = 0) => {
      await window.electronAPI.redis.zsetRemove(containerId, key, [member], db)
      await useAppStore.getState().loadRedisKeyValue(containerId, key, 'zset', db)
    },

    createRedisKey: async ({ containerId, key, type, value, ttlSeconds, db = 0 }) => {
      const trimmedKey = key.trim()
      if (!trimmedKey) throw new Error('Key name is required')

      const lines = value
        .split('\n')
        .map((x) => x.trim())
        .filter(Boolean)

      if (type === 'string') {
        await window.electronAPI.redis.setKeyValue(containerId, trimmedKey, value, db)
      } else if (type === 'hash') {
        const entries: Array<{ field: string; value: string }> = []
        for (const line of lines) {
          const idx = line.indexOf('=')
          if (idx <= 0) throw new Error('Hash values must be in field=value format')
          const field = line.slice(0, idx).trim()
          const fieldValue = line.slice(idx + 1)
          if (!field) throw new Error('Hash field cannot be empty')
          entries.push({ field, value: fieldValue })
        }
        await window.electronAPI.redis.hashSetMany(containerId, trimmedKey, entries, db)
      } else if (type === 'list') {
        if (lines.length === 0) throw new Error('List requires at least one item (one per line)')
        await window.electronAPI.redis.listPush(containerId, trimmedKey, lines, 'right', db)
      } else if (type === 'set') {
        if (lines.length === 0) throw new Error('Set requires at least one member (one per line)')
        await window.electronAPI.redis.setAdd(containerId, trimmedKey, lines, db)
      } else if (type === 'zset') {
        if (lines.length === 0) throw new Error('ZSet requires members in member=score format')
        const entries: Array<{ member: string; score: number }> = []
        for (const line of lines) {
          const idx = line.indexOf('=')
          if (idx <= 0) throw new Error('ZSet values must be in member=score format')
          const member = line.slice(0, idx).trim()
          const scoreRaw = line.slice(idx + 1).trim()
          const score = Number(scoreRaw)
          if (!member || Number.isNaN(score)) throw new Error('Invalid zset line: expected member=score')
          entries.push({ member, score })
        }
        await window.electronAPI.redis.zsetAddMany(containerId, trimmedKey, entries, db)
      }

      if (typeof ttlSeconds === 'number' && ttlSeconds > 0) {
        await window.electronAPI.redis.setKeyTTL(containerId, trimmedKey, ttlSeconds, db)
      }

      const browser = useAppStore.getState().redisBrowserState
      if (browser && browser.containerId === containerId && browser.db === db) {
        await useAppStore.getState().scanRedisKeys(containerId, browser.pattern, '0', db)
      }
    },

    // ── Terminal Session Actions ──

    openLocalTerminal: () =>
      set((s) => {
        const id = 'term-' + Date.now()
        const session: TerminalSessionInfo = {
          id,
          name: 'Terminal',
          type: 'local',
        }
        s.terminalSessions.push(session)
        s.activeTerminalSessionId = id
        s.activeBottomTab = 'terminal'
        s.bottomPanelOpen = true
      }),

    openDockerTerminal: (containerId: string, containerName: string, dbType: string) =>
      set((s) => {
        const id = 'term-' + Date.now()
        const cmdMap: Record<string, string[]> = {
          postgres: ['psql', '-U', 'postgres'],
          mysql: ['mysql', '-u', 'root'],
          mongodb: ['mongosh'],
          redis: ['redis-cli'],
        }
        const cmd = cmdMap[dbType] ?? ['/bin/sh']
        const session: TerminalSessionInfo = {
          id,
          name: `${containerName} (${dbType})`,
          type: 'docker',
          containerId,
          cmd,
        }
        s.terminalSessions.push(session)
        s.activeTerminalSessionId = id
        s.activeBottomTab = 'terminal'
        s.bottomPanelOpen = true
      }),

    closeTerminalSession: (sessionId: string) =>
      set((s) => {
        const idx = s.terminalSessions.findIndex((t: TerminalSessionInfo) => t.id === sessionId)
        if (idx !== -1) {
          s.terminalSessions.splice(idx, 1)
          if (s.activeTerminalSessionId === sessionId) {
            s.activeTerminalSessionId = s.terminalSessions.length > 0
              ? s.terminalSessions[s.terminalSessions.length - 1].id
              : null
          }
        }
      }),

    setActiveTerminalSession: (sessionId: string) =>
      set((s) => {
        s.activeTerminalSessionId = sessionId
        s.activeBottomTab = 'terminal'
        s.bottomPanelOpen = true
      }),

    // ── Docker Actions ──

    fetchDockerStatus: async () => {
      try {
        const { available } = await window.electronAPI.docker.getStatus()
        set((s) => {
          s.dockerAvailable = available
        })
      } catch {
        set((s) => {
          s.dockerAvailable = false
        })
      }
    },

    fetchContainers: async () => {
      try {
        const raw = await window.electronAPI.docker.listContainers()
        const containers = raw as DockerContainer[]
        set((s) => {
          s.containers = containers
        })
      } catch {
        // Docker not available or error — keep empty
      }
    },

    startContainer: async (id: string) => {
      set((s) => {
        const c = s.containers.find((x) => x.id === id)
        if (c) c.status = 'starting'
      })
      try {
        await window.electronAPI.docker.startContainer(id)
        // Refresh list
        const raw = await window.electronAPI.docker.listContainers()
        set((s) => {
          s.containers = raw as DockerContainer[]
        })
      } catch (err) {
        console.error('Failed to start container', err)
      }
    },

    stopContainer: async (id: string) => {
      try {
        await window.electronAPI.docker.stopContainer(id)
        const raw = await window.electronAPI.docker.listContainers()
        set((s) => {
          s.containers = raw as DockerContainer[]
        })
      } catch (err) {
        console.error('Failed to stop container', err)
      }
    },

    removeContainer: async (id: string) => {
      try {
        await window.electronAPI.docker.removeContainer(id)
        const raw = await window.electronAPI.docker.listContainers()
        set((s) => {
          s.containers = raw as DockerContainer[]
        })
      } catch (err) {
        console.error('Failed to remove container', err)
      }
    },

    createDockerContainer: async (opts) => {
      try {
        await window.electronAPI.docker.createContainer(opts as { name: string; type: string; port?: number; password?: string })
        // Refresh container list
        const raw = await window.electronAPI.docker.listContainers()
        set((s) => {
          s.containers = raw as DockerContainer[]
        })
      } catch (err) {
        console.error('Failed to create container', err)
        throw err
      }
    },
  }))
)
