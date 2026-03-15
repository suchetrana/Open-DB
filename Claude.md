# OpenDB Studio — AI Context File

> **Purpose:** Read this FIRST. Contains everything needed to understand and modify this project without re-reading source files. **Update this file whenever the project changes.**

---

## Quick Summary

Electron desktop app (VS Code-style UI) for database management with Docker integration. **Islands Dark glass theme** (inspired by [Dark Islands VS Code theme](https://github.com/bwya77/vscode-dark-islands)), React + Zustand frontend, PostgreSQL backend via `pg`, Docker via `dockerode`, local persistence via `sql.js` (SQLite WASM).

**Stack:** Electron 28 + electron-vite + React 18 + Zustand + Immer + Tailwind 3 + xterm.js + TypeScript

---

## Architecture (3 Electron Processes)

```
┌─────────────────────────────────────────────────────┐
│ MAIN PROCESS (Node.js)                              │
│  src/main/index.ts (entry)                          │
│  ├── services/                                      │
│  │   ├── database.service.ts  (pg Pool manager)     │
│  │   ├── docker.service.ts    (dockerode wrapper)   │
│  │   ├── storage.service.ts   (sql.js SQLite)       │
│  │   └── terminal.service.ts  (child_process/exec)  │
│  └── ipc/                                           │
│      ├── database.handlers.ts  (13 channels)        │
│      ├── docker.handlers.ts    (7 channels)         │
│      ├── terminal.handlers.ts  (4+2 channels)       │
│      ├── filesystem.handlers.ts (8 channels)        │
│      └── window.handlers.ts    (4 channels)         │
├─────────────────────────────────────────────────────┤
│ PRELOAD (src/preload/index.ts)                      │
│  contextBridge.exposeInMainWorld('electronAPI', ...) │
│  5 namespaces: docker, terminal, filesystem, database, window│
│  38 methods total                                    │
├─────────────────────────────────────────────────────┤
│ RENDERER (React SPA)                                │
│  src/renderer/src/                                  │
│  ├── App.tsx → MainLayout                           │
│  ├── store/useAppStore.ts (Zustand + Immer, ~770 ln)│
│  ├── types/index.ts + electron.d.ts                 │
│  └── components/ (layout, editor, results,          │
│       sidebar, terminal, ui)                        │
└─────────────────────────────────────────────────────┘
```

**Bootstrap order:** `storageService.initialize()` → `dockerService.initialize()` → `registerAllHandlers()` → `createWindow()`

---

## Folder Structure

```
open-db/
├── electron.vite.config.ts     # 3 targets: main, preload, renderer. Aliases: @, @components, @hooks, @store, @types
├── package.json                # 4 runtime deps, 18 dev deps, scripts: dev/build/preview/start
├── tailwind.config.ts          # 28 custom colors, 2 fonts (Inter, JetBrains Mono)
├── tsconfig.json               # ES2020, react-jsx, bundler resolution
├── src/
│   ├── main/
│   │   ├── index.ts                        # BrowserWindow 1400×900, contextIsolation, preload bridge
│   │   ├── ipc/
│   │   │   ├── index.ts                    # registerAllHandlers() — calls all 5 handler modules
│   │   │   ├── database.handlers.ts        # db:* channels (connect, query, introspect)
│   │   │   ├── docker.handlers.ts          # docker:* channels (CRUD containers)
│   │   │   ├── terminal.handlers.ts        # terminal:* channels (create, write, resize, close)
│   │   │   ├── filesystem.handlers.ts      # fs:* channels (open folder/file, read/save, dir tree)
│   │   │   └── window.handlers.ts          # window:* channels (maximize/restore + zoom)
│   │   └── services/
│   │       ├── database.service.ts         # pg Pool map, introspection via information_schema
│   │       ├── docker.service.ts           # dockerode, images: postgres/mysql/mongo/redis
│   │       ├── storage.service.ts          # sql.js at {userData}/opendb.sqlite, tables: connections, query_history, settings
│   │       └── terminal.service.ts         # powershell/bash spawn + Docker exec streams
│   ├── preload/
│   │   ├── index.ts                        # electronAPI with 5 namespaces, 38 methods
│   │   └── index.d.ts                      # Window.electronAPI type augmentation
│   └── renderer/
│       ├── index.html                      # CSP, Google Fonts (Inter, JetBrains Mono, Material Symbols)
│       └── src/
│           ├── main.tsx                    # ReactDOM.createRoot + StrictMode
│           ├── App.tsx                     # → MainLayout
│           ├── index.css                   # Tailwind directives + SQL/JSON/code syntax classes + animations
│           ├── types/
│           │   ├── index.ts                # 16 types/interfaces (see Types section)
│           │   └── electron.d.ts           # Window.electronAPI interface declarations
│           ├── store/
│           │   └── useAppStore.ts           # ALL app state + 30 actions (see Store section)
│           ├── hooks/                      # (empty — reserved)
│           └── components/
│               ├── layout/
│               │   ├── MainLayout.tsx      # Root: ActivityBar + Sidebar + Editor + BottomPanel + StatusBar
│               │   ├── ActivityBar.tsx      # Left 48px rail: 5 nav + terminal dropdown + 3 bottom icons
│               │   ├── Sidebar.tsx          # 240px panel: FileExplorer + OpenEditors + DatabaseExplorer + DockerContainers + Connections
│               │   └── StatusBar.tsx        # Fixed bottom bar: docker/db status + zoom controls
│               ├── editor/
│               │   ├── EditorArea.tsx       # Tabs + Toolbar + SqlEditor + ResultsPanel
│               │   ├── EditorTabs.tsx       # Horizontal tab strip (VS Code-style)
│               │   ├── EditorToolbar.tsx    # Connection breadcrumb + DB dropdown + Run/Save buttons
│               │   └── SqlEditor.tsx        # Transparent textarea over highlighted <pre>, custom SQL tokenizer
│               ├── results/
│               │   ├── ResultsPanel.tsx     # Results header + mode controls + ResultsTable
│               │   └── ResultsTable.tsx     # Data table with type icons, NULL rendering, role badges
│               ├── sidebar/
│               │   ├── FileExplorer.tsx     # VS Code-style file tree with folder open/file open
│               │   ├── OpenEditors.tsx      # Open tabs list with new-file input
│               │   ├── DatabaseExplorer.tsx # db → schema → table → column tree (lazy-loaded)
│               │   ├── DockerContainers.tsx # Container list + create form, polls every 5s
│               │   └── Connections.tsx      # Saved connections + add form + auto-reconnect
│               ├── terminal/
│               │   ├── BottomPanel.tsx      # Tabbed panel with drag-to-resize (150-600px)
│               │   └── TerminalView.tsx     # Real xterm.js ↔ main process via IPC
│               └── ui/
│                   └── Icon.tsx             # <span> wrapper for Material Symbols Outlined
```

---

## Types (src/renderer/src/types/index.ts)

| Type | Key Fields |
|------|-----------|
| `ContainerStatus` | `"running" \| "starting" \| "stopped"` |
| `DatabaseType` | `"postgres" \| "mysql" \| "cassandra" \| "mongodb" \| "redis"` |
| `DockerContainer` | `id, name, image, status, port, type` |
| `Connection` | `id, name, type, host, port, username?, password?, database?, isConnected, dockerContainerId?` |
| `SchemaNode` | `name` |
| `TableNode` | `schema, name, type("table"\|"view"), rowEstimate` |
| `ColumnNode` | `name, dataType, nullable, defaultValue, isPrimaryKey` |
| `EditorTab` | `id, title, type("sql"\|"config"\|"table"), icon, iconColor, isActive, isModified, content?` |
| `ColumnDef` | `name, dataType, icon, iconColor, width?` |
| `QueryResult` | `columns: ColumnDef[], rows[], rowCount, executionTimeMs` |
| `RawQueryResult` | `columns: string[], rows: Record<string, unknown>[], rowCount, executionTimeMs` |
| `TerminalLine` | `id, type, content, prefix?, prefixColor?` *(defined but unused)* |
| `SidebarView` | `"explorer" \| "search" \| "schema" \| "runner" \| "extensions"` |
| `TerminalSessionInfo` | `id, name, type('local'\|'docker'), containerId?, cmd?` |
| `FileTreeNode` | `name, path, type('file'\|'directory'), children?, extension?` |
| `BottomPanelTab` | `"problems" \| "output" \| "terminal" \| "debug"` |

---

## Zustand Store (useAppStore.ts)

### State

| Field | Type | Default |
|-------|------|---------|
| `activeSidebarView` | `SidebarView` | `'explorer'` |
| `sidebarOpen` | `boolean` | `true` |
| `containers` | `DockerContainer[]` | `[]` |
| `dockerAvailable` | `boolean` | `false` |
| `connections` | `Connection[]` | `[]` |
| `activeConnectionId` | `string \| null` | `null` |
| `tabs` | `EditorTab[]` | 3 DEMO_TABS |
| `activeTabId` | `string \| null` | `'t1'` |
| `queryResult` | `QueryResult \| null` | DEMO_QUERY_RESULT (5 fake rows) |
| `isExecuting` | `boolean` | `false` |
| `queryError` | `string \| null` | `null` |
| `activeBottomTab` | `BottomPanelTab` | `'terminal'` |
| `bottomPanelOpen` | `boolean` | `true` |
| `resultsPanelMode` | `'normal'\|'minimized'\|'maximized'` | `'normal'` |
| `availableDatabases` | `string[]` | `[]` |
| `selectedDatabase` | `string \| null` | `null` |
| `terminalSessions` | `TerminalSessionInfo[]` | `[]` |
| `activeTerminalSessionId` | `string \| null` | `null` |
| `workspaceRootPath` | `string \| null` | `null` |
| `workspaceRootName` | `string \| null` | `null` |
| `fileTree` | `FileTreeNode[]` | `[]` |
| `expandedDirs` | `Record<string, boolean>` | `{}` |
| `bottomPanelHeight` | `number` | `300` |

### Actions (30 total)

**UI:** `setSidebarView`, `toggleSidebar`, `setActiveTab`, `closeTab`, `setBottomTab`, `toggleBottomPanel`, `updateTabContent`, `openTableTab`, `addNewFileTab`, `setResultsPanelMode`, `setBottomPanelHeight`

**File Explorer:** `openFolder`, `openFileDialog`, `openFileFromTree`, `toggleDir`, `createNewFolder`

**File/DB Actions:** `saveCurrentFile`, `commitTransaction`, `rollbackTransaction`

**Database:** `loadConnections`, `connectToDatabase`, `disconnectDatabase`, `addConnection`, `deleteConnection`, `executeQuery`, `fetchDatabases`, `switchDatabase`

**Terminal:** `openLocalTerminal`, `openDockerTerminal`, `closeTerminalSession`, `setActiveTerminalSession`

**Docker:** `fetchDockerStatus`, `fetchContainers`, `startContainer`, `stopContainer`, `removeContainer`, `createDockerContainer`

**Helper:** `toColumnDef(name)` — infers icon/type from column name patterns

---

## IPC Channels (38 total: 36 invoke + 2 send)

### Database (13 invoke)
`db:connect`, `db:disconnect`, `db:execute-query`, `db:test-connection`, `db:get-connections`, `db:save-connection`, `db:delete-connection`, `db:get-query-history`, `db:get-databases`, `db:switch-database`, `db:get-schemas`, `db:get-tables`, `db:get-columns`

### Docker (7 invoke)
`docker:status`, `docker:list-containers`, `docker:create-container`, `docker:start-container`, `docker:stop-container`, `docker:remove-container`, `docker:logs`

### Terminal (4 invoke + 2 send)
`terminal:create`, `terminal:write`, `terminal:resize`, `terminal:close`
`terminal:data` (main→renderer), `terminal:exit` (main→renderer)

### Filesystem (8 invoke)
`fs:open-folder`, `fs:read-dir`, `fs:read-file`, `fs:save-file`, `fs:open-file`, `fs:create-folder`, `fs:create-file`, `fs:delete`

### Window (4 invoke)
`window:toggle-maximize`, `window:is-maximized`, `window:get-zoom`, `window:set-zoom`

---

## UI Component Tree

```
App → MainLayout
├── ActivityBar (48px left rail)
│   ├── 5 nav icons (explorer/search/schema/runner/extensions)
│   ├── Terminal button → TerminalDropdown (local + Docker containers)
│   └── 3 bottom icons (Open Folder/Account/Settings)
├── Sidebar (240px, togglable)
│   ├── FileExplorer → TreeNode (recursive)
│   ├── OpenEditors
│   ├── DatabaseExplorer → DatabaseItem → SchemaItem → TableItem → ColumnItem
│   ├── DockerContainers → CreateContainerForm
│   └── Connections → AddConnectionForm
├── EditorArea
│   ├── EditorTabs
│   ├── EditorToolbar (connection breadcrumb + DB selector + Run button)
│   ├── SqlEditor (textarea + highlighted pre + line numbers)
│   ├── Resize handle (drag row-resize between editor/results)
│   └── ResultsPanel → ResultsTable (Ctrl+F search, col-resize)
├── Sidebar resize handle (drag ew-resize, 160-500px)
├── BottomPanel (resizable 150-600px)
│   ├── Tab bar (Problems/Output/Terminal/Debug)
│   ├── Terminal session sidebar (left)
│   └── TerminalView (xterm.js)
└── StatusBar (fixed bottom 20px)
```

---

## Tailwind Custom Colors (Islands Dark Theme)

| Token | Hex | Usage |
|-------|-----|-------|
| `bg-canvas` | `#121216` | Body/root bg (deep dark canvas) |
| `bg-surface` | `#181a1d` | Sidebar/panels/editor bg |
| `bg-surface-hover` | `rgba(255,255,255,0.06)` | Hover state |
| `bg-surface-active` | `rgba(255,255,255,0.08)` | Selected state |
| `bg-input` | `#1a1c20` | Input bg |
| `border-default` | `#3c3f41` | Primary borders |
| `border-subtle` | `#25262a` | Subtle borders |
| `text-primary` | `#bcbec4` | Main text |
| `text-secondary` | `#7a7e85` | Secondary text |
| `text-muted` | `#6f737a` | Muted text |
| `text-bright` | `#ffffffd9` | Emphasis |
| `accent-blue` | `#548af7` | Links, active indicators |
| `accent-button` | `#3574f0` | Button primary |
| `syntax-keyword` | `#cf8e6d` | SQL keywords (warm orange) |
| `syntax-function` | `#56a8f5` | Functions (blue) |
| `syntax-string` | `#6aab73` | Strings (green) |
| `syntax-number` | `#2aacb8` | Numbers (cyan) |
| `syntax-comment` | `#7a7e85` | Comments (gray) |
| `syntax-type` | `#c77dbb` | Types (magenta) |
| `syntax-param` | `#bcbec4` | Params/identifiers |
| `syntax-decorator` | `#bbb529` | Decorators (yellow) |
| `status-green` | `#57a64a` | Connected/running |
| `status-amber` | `#e8bf6a` | Warning |
| `status-red` | `#f75464` | Error/stopped |

### Glass Design System
| Token | Value | Usage |
|-------|-------|-------|
| `rounded-panel` | `18px` | Floating panels |
| `rounded-widget` | `14px` | Dropdowns/menus |
| `rounded-input` | `10px` | Buttons/inputs |
| `rounded-item` | `6px` | List items/tags |
| `shadow-glass` | `0 2px 8px rgba(0,0,0,0.3)` | Panel shadow |
| Glass border-top | `rgba(255,255,255,0.10)` | Directional light sim |
| Glass border-left | `rgba(255,255,255,0.06)` | Directional light sim |
| Glass border-bottom/right | `rgba(255,255,255,0.02)` | Directional light sim |

### CSS Utility Classes
- `glass-panel` — floating panel with directional glass borders + shadow + rounded-panel
- `glass-widget` — dropdown/menu with glass borders + rounded-widget
- `glass-input` — input field with glass borders + rounded-input
- `glass-row` — list item with rounded-item + hover:bg-white/6

**Fonts:** `font-display` → Inter, `font-mono` → IBM Plex Mono, `font-terminal` → Fira Code

---

## What Works vs. What's Stubbed

### ✅ Fully Working
- PostgreSQL: connect, disconnect, query, introspect (databases/schemas/tables/columns), switch DB
- Docker: detect, list, create (postgres/mysql/mongo/redis), start/stop/remove containers
- Terminal: local shell (PowerShell/bash), Docker exec (psql/mysql/mongosh/redis-cli), multiple sessions
- File Explorer: open folder dialog, recursive tree view, click-to-open files in editor, create new folder
- Editor: SQL syntax highlighting, tab management, Ctrl+Enter execute, line numbers, Ctrl+S save
- Results: table with type icons, minimize/maximize, error display, Ctrl+F search/filter, resizable columns (drag col-resize)
- Persistence: connections + query history saved to SQLite, auto-reconnect
- Bottom panel: drag-to-resize (150-600px), terminal sessions
- Save button: Ctrl+S saves file to disk via `fs:save-file` IPC, marks tab as unmodified
- Commit/Rollback: sends COMMIT/ROLLBACK SQL to the active database connection
- Welcome screen: shown when no tabs open (New SQL File, Open Folder, Open File)

### ⚠️ Partial / Stubbed
| Item | Status |
|------|--------|
| **Sidebar views** | Each view shows different content: explorer (files+editors+docker), search (search/replace UI), schema (DB explorer+connections), runner (query actions), extensions (installed list). Search/replace not wired to backend yet |
| **Terminal resize** | `resize()` is a no-op in TerminalService — needs `node-pty` |
| **MySQL/MongoDB/Redis queries** | Docker containers work, terminal exec works, but editor query execution only works for PostgreSQL |
| **Save button** | ✅ Wired — Ctrl+S saves current tab to disk if it has a `_filePath` |
| **Commit/Rollback buttons** | ✅ Wired — sends COMMIT/ROLLBACK to active connection |
| **Download/Filter results** | Buttons exist, no handlers |
| **Query history UI** | Saved to SQLite, no UI to view it |
| **Branch indicator** | Hardcoded "main*" |
| **Error/Warning counts** | Hardcoded "0" |
| **Problems/Output/Debug tabs** | Static placeholder text |
| **Account/Settings buttons** | No handlers |
| **Settings storage** | SQLite table exists, never used |
| **`cassandra` type** | In DatabaseType union but no container/service support |
| **`TerminalLine` type** | Defined but never referenced |
| **Demo data** | Removed — app starts with empty tabs showing welcome screen |

---

## Key Patterns & Conventions

- **Singletons:** All services (`databaseService`, `dockerService`, `storageService`, `terminalService`) are exported singleton instances
- **IPC:** All use `ipcMain.handle` / `ipcRenderer.invoke` pattern. Terminal data/exit use `webContents.send` for push events
- **State:** Single Zustand store with Immer middleware for immutable updates
- **Icons:** Material Symbols Outlined via `<Icon name="..." />` component
- **Styling:** Tailwind utility classes, custom color tokens, no component library
- **Tab IDs:** Generated as `'tab-' + Math.random().toString(36).slice(2, 8)`
- **Terminal IDs:** Generated as `'term-' + Date.now()`
- **Container naming:** `opendb-{name}` prefix
- **Docker images:** `postgres:16-alpine`, `mysql:8.0`, `mongo:7`, `redis:7-alpine`
- **SQLite path:** `{app.getPath('userData')}/opendb.sqlite`

---

## Dependencies

**Runtime:** `dockerode` ^4.0.2, `sql.js` ^1.10.3, `pg` ^8.11.3, `uuid` ^9.0.1
**UI:** `react` ^18.3.1, `zustand` ^4.5.2, `immer` ^10.0.4, `clsx` ^2.1.1, `@xterm/xterm` ^5.5.0
**Build:** `electron` ^28.1.0, `electron-vite` ^2.3.0, `tailwindcss` ^3.4.4, `typescript` ^5.5.3
**Scripts:** `npm run dev` (electron-vite dev), `npm run build`, `npm run start`

---

## How to Run

```bash
cd open-db
npm install
npm run dev
```

---

*Last updated: Mar 2026 — Added status bar zoom controls (`-`, slider, `+`, `%`) for inner UI scaling via new `window:get-zoom` / `window:set-zoom` IPC channels*