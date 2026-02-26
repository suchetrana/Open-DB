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

/* ── Mock Data (static UI until real DB connection is wired) ── */
const DEMO_TABS: EditorTab[] = [
  { id: 't1', title: 'users_query.sql', type: 'sql', icon: 'code', iconColor: 'text-status-green', isActive: true, isModified: true, content: "SELECT id, username, email, role, last_login, status\nFROM   public.users\nWHERE  status = 'active'\nORDER  BY last_login DESC\nLIMIT  50;" },
  { id: 't2', title: 'config.json', type: 'config', icon: 'description', iconColor: 'text-syntax-function', isActive: false, isModified: false },
  { id: 't3', title: 'public.users', type: 'table', icon: 'table_chart', iconColor: 'text-syntax-decorator', isActive: false, isModified: false },
]

const DEMO_QUERY_RESULT: QueryResult = {
  columns: [
    { name: 'id', dataType: 'uuid', icon: 'key', iconColor: 'text-syntax-function', width: 'w-24' },
    { name: 'username', dataType: 'varchar(50)', icon: 'abc', iconColor: 'text-syntax-keyword' },
    { name: 'email', dataType: 'varchar(255)', icon: 'abc', iconColor: 'text-syntax-keyword', width: 'w-48' },
    { name: 'role', dataType: 'enum', icon: 'list', iconColor: 'text-syntax-decorator', width: 'w-24' },
    { name: 'last_login', dataType: 'timestamp', icon: 'schedule', iconColor: 'text-status-green', width: 'w-40' },
    { name: 'status', dataType: 'varchar(20)', icon: 'abc', iconColor: 'text-syntax-keyword' },
  ],
  rows: [
    { id: 'c8d4e1...', username: 'dev_sarah', email: 'sarah@opendb.com', role: 'ADMIN', last_login: '2023-10-27 14:30:00', status: 'active' },
    { id: 'a1b2c3...', username: 'jason_bourne', email: 'jason@treadstone.org', role: 'USER', last_login: '2023-10-26 09:15:22', status: 'active' },
    { id: 'f9e8d7...', username: 'alice_w', email: 'alice@wonderland.net', role: 'USER', last_login: '2023-10-25 18:45:10', status: 'active' },
    { id: 'b4c5d6...', username: 'neo_matrix', email: 'one@matrix.com', role: 'ADMIN', last_login: '2023-10-25 11:20:05', status: 'active' },
    { id: 'd1e2f3...', username: 'trinity_ops', email: 'trin@matrix.com', role: 'USER', last_login: '2023-10-24 16:10:44', status: 'active' },
  ],
  rowCount: 14,
  executionTimeMs: 34,
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

    tabs: DEMO_TABS,
    activeTabId: 't1',

    queryResult: DEMO_QUERY_RESULT,
    isExecuting: false,
    queryError: null,

    activeBottomTab: 'terminal',
    bottomPanelOpen: true,

    resultsPanelMode: 'normal',

    availableDatabases: [],
    selectedDatabase: null,

    terminalSessions: [],
    activeTerminalSessionId: null,

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
        s.tabs.forEach((t: EditorTab) => (t.isActive = false))
        s.tabs.push({
          id,
          title,
          type: isSql ? 'sql' : 'config',
          icon: isSql ? 'code' : 'description',
          iconColor: isSql ? 'text-status-green' : 'text-syntax-function',
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
