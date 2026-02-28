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

  // ── UI Actions ──
  setSidebarView: (view: SidebarView) => void
  toggleSidebar: () => void
  setActiveTab: (tabId: string) => void
  closeTab: (tabId: string) => void
  setBottomTab: (tab: BottomPanelTab) => void
  toggleBottomPanel: () => void
  updateTabContent: (tabId: string, content: string) => void
  openTableTab: (schema: string, table: string) => void
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
  executeQuery: () => Promise<void>
  fetchDatabases: () => Promise<void>
  switchDatabase: (dbName: string) => Promise<void>

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
        const connections = raw as Connection[]
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

              const dbName = conn.database ?? 'postgres'
              await window.electronAPI.database.connect(
                conn.id,
                conn.host,
                conn.port,
                conn.username ?? 'postgres',
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
        const dbName = conn.database ?? 'postgres'
        await window.electronAPI.database.connect(
          conn.id,
          conn.host,
          conn.port,
          conn.username ?? 'postgres',
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
        // Prevent duplicates — don't add if same host:port:database already exists
        const exists = s.connections.some(
          (c: Connection) => c.host === conn.host && c.port === conn.port && c.database === conn.database
        )
        if (!exists) s.connections.push(conn)
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

    executeQuery: async () => {
      const state = useAppStore.getState()
      const { activeTabId, tabs, activeConnectionId } = state

      const tab = tabs.find((t) => t.id === activeTabId)
      if (!tab?.content?.trim()) return

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
        const raw = (await window.electronAPI.database.executeQuery(
          activeConnectionId,
          tab.content
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
      const { activeConnectionId } = useAppStore.getState()
      if (!activeConnectionId) return
      try {
        const dbs = await window.electronAPI.database.getDatabases(activeConnectionId)
        set((s) => {
          s.availableDatabases = dbs
        })
      } catch (err) {
        console.error('Failed to fetch databases', err)
      }
    },

    switchDatabase: async (dbName: string) => {
      const { activeConnectionId } = useAppStore.getState()
      if (!activeConnectionId) return
      try {
        await window.electronAPI.database.switchDatabase(activeConnectionId, dbName)
        set((s) => {
          s.selectedDatabase = dbName
          // Update the connection's database field
          const c = s.connections.find((x: Connection) => x.id === activeConnectionId)
          if (c) c.database = dbName
        })
      } catch (err) {
        console.error('Failed to switch database', err)
        throw err
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
