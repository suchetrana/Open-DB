# Application Startup Flow

## Complete Startup Sequence

```
┌─────────────────────────────────────────────────────────────────┐
│                    1. ELECTRON MAIN PROCESS STARTS              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
                    ┌────────────────┐
                    │ Load .env      │
                    │ Set app paths  │
                    └────────┬───────┘
                             │
                             ▼
         ┌───────────────────────────────────────┐
         │  2. INITIALIZE SERVICES               │
         │                                       │
         │  a) StorageService.initialize()      │
         │     ├─ Check app data directory      │
         │     ├─ Create/Open SQLite DB         │
         │     └─ Run schema migrations         │
         │                                       │
         │  b) DockerService.initialize()       │
         │     ├─ Check Docker availability     │
         │     ├─ Connect to Docker daemon      │
         │     └─ Sync container state          │
         │                                       │
         │  c) DatabaseService.initialize()     │
         │     └─ Initialize connection pool    │
         └───────────────┬───────────────────────┘
                         │
                         ▼
         ┌───────────────────────────────────────┐
         │  3. REGISTER IPC HANDLERS             │
         │                                       │
         │  • dockerHandlers.register()         │
         │  • databaseHandlers.register()       │
         │  • storageHandlers.register()        │
         └───────────────┬───────────────────────┘
                         │
                         ▼
         ┌───────────────────────────────────────┐
         │  4. CREATE BROWSER WINDOW             │
         │                                       │
         │  • Load preload script               │
         │  • Set security policies             │
         │  • Load React app (renderer)         │
         └───────────────┬───────────────────────┘
                         │
                         ▼
         ┌───────────────────────────────────────┐
         │  5. REACT APP LOADS                   │
         │                                       │
         │  a) Initialize Zustand store         │
         │  b) Check Docker status              │
         │  c) Load saved connections           │
         │  d) Restore previous session         │
         │  e) Render UI                        │
         └───────────────────────────────────────┘
```

## Detailed Phase Breakdown

### Phase 1: Storage Initialization

**What Happens:**
```typescript
StorageService.initialize()
  ├─ 1. Get user data path
  │     macOS:   ~/Library/Application Support/opendb-studio
  │     Windows: C:\Users\{user}\AppData\Roaming\opendb-studio
  │     Linux:   ~/.config/opendb-studio
  │
  ├─ 2. Create database file if not exists
  │     Path: {userData}/app.db
  │
  ├─ 3. Run SQL schema creation
  │     • CREATE TABLE connections
  │     • CREATE TABLE query_history
  │     • CREATE TABLE saved_queries
  │     • CREATE TABLE settings
  │     • CREATE TABLE docker_containers
  │     • CREATE INDEXES for performance
  │
  ├─ 4. Run migrations if needed
  │     • Check schema_version table
  │     • Apply pending migrations
  │
  └─ 5. Load encryption keys
        • For password storage
        • Using system keychain if available
```

**Database Schema Created:**
```sql
-- Connections table
CREATE TABLE connections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  host TEXT NOT NULL,
  port INTEGER NOT NULL,
  username TEXT,
  password TEXT, -- Encrypted
  database TEXT,
  docker_container_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Query history
CREATE TABLE query_history (
  id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL,
  query TEXT NOT NULL,
  executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  execution_time_ms INTEGER,
  rows_affected INTEGER,
  FOREIGN KEY (connection_id) REFERENCES connections(id)
);

-- And more... (see Data Storage docs)
```

### Phase 2: Docker Service Check

**What Happens:**
```typescript
DockerService.initialize()
  ├─ 1. Try to connect to Docker daemon
  │     Unix: /var/run/docker.sock
  │     Windows: npipe:////./pipe/docker_engine
  │
  ├─ 2. Send ping request
  │     docker.ping() -> HTTP GET to /_ping
  │
  ├─ 3. If success:
  │     • Get Docker info (version, containers)
  │     • Load existing containers
  │     • Sync with local database
  │     • Mark stopped containers
  │
  └─ 4. If fail:
        • Set dockerAvailable = false
        • Show warning in UI
        • Disable Docker features
        • Allow manual connections only
```

**Docker Daemon Connection:**
```typescript
// How it connects
const docker = new Docker();
await docker.ping(); // Verifies connection

// Returns Docker info
{
  ServerVersion: "24.0.7",
  Containers: 5,
  ContainersRunning: 2,
  ContainersPaused: 0,
  ContainersStopped: 3,
  Images: 10
}
```

### Phase 3: Register IPC Handlers

**What Happens:**
```typescript
// All IPC channels registered before window opens

ipcMain.handle('docker:check', async () => { ... });
ipcMain.handle('docker:create-postgres', async (event, opts) => { ... });
ipcMain.handle('db:connect-postgres', async (event, config) => { ... });
ipcMain.handle('db:execute-query', async (event, opts) => { ... });
ipcMain.handle('storage:get-connections', async () => { ... });
// ... 50+ more handlers
```

**Handler Categories:**
- Docker operations (pull, create, start, stop, remove)
- Database operations (connect, query, schema)
- Storage operations (save, load, delete)
- File operations (export, import)
- Settings operations (get, set)

### Phase 4: Browser Window Creation

**What Happens:**
```typescript
const mainWindow = new BrowserWindow({
  width: 1400,
  height: 900,
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    nodeIntegration: false,        // Security
    contextIsolation: true,         // Security
    sandbox: true                   // Security
  }
});

// Load React app
mainWindow.loadURL('http://localhost:5173'); // Dev mode
// or
mainWindow.loadFile('dist/index.html');      // Production
```

**Security Settings:**
- `nodeIntegration: false` - Renderer can't access Node.js
- `contextIsolation: true` - Separate JavaScript contexts
- `sandbox: true` - Extra isolation

### Phase 5: React App Initialization

**What Happens:**
```typescript
// App.tsx
function App() {
  useEffect(() => {
    async function initialize() {
      // 1. Check Docker status
      const dockerStatus = await electronAPI.docker.check();
      setDockerAvailable(dockerStatus.available);
      
      // 2. Load saved connections
      const connections = await electronAPI.storage.getConnections();
      connectionsStore.set(connections);
      
      // 3. Load saved queries
      const queries = await electronAPI.storage.getSavedQueries();
      queriesStore.set(queries);
      
      // 4. Restore previous session
      const lastSession = localStorage.getItem('lastSession');
      if (lastSession) {
        restoreSession(JSON.parse(lastSession));
      }
      
      // 5. Set app as ready
      setIsReady(true);
    }
    
    initialize();
  }, []);
  
  if (!isReady) return <LoadingScreen />;
  return <MainLayout />;
}
```

**UI Loads:**
```
┌──────────────────────────────────────────────────┐
│  Header                                          │
├──────────┬───────────────────────────────────────┤
│          │                                       │
│ Sidebar  │    Editor Tabs                       │
│          │                                       │
│ • Docker │    [SQL Editor]                      │
│          │    SELECT * FROM users;              │
│ • Conns  │                                       │
│          │    [Results Grid]                    │
│ • Saved  │    id | name      | email           │
│          │    ──────────────────────────────    │
│          │    1  | John Doe  | john@example.com│
│          │                                       │
└──────────┴───────────────────────────────────────┘
```

## Startup Timing

**Typical Startup Times:**
```
Cold start (first time):
  • Electron launch: 1000ms
  • Services init: 500ms
  • Window creation: 300ms
  • React load: 800ms
  • Data loading: 200ms
  Total: ~2.8 seconds

Warm start (app already ran):
  • Electron launch: 800ms
  • Services init: 300ms
  • Window creation: 200ms
  • React load: 500ms
  • Data loading: 100ms
  Total: ~1.9 seconds
```

## Error Handling

**What if things fail:**

```typescript
// Docker not available
if (!dockerStatus.available) {
  showNotification({
    type: 'warning',
    message: 'Docker not detected. Docker features disabled.',
    action: 'Install Docker Desktop'
  });
  // App still works, just no Docker features
}

// Database file corrupted
try {
  storageService.initialize();
} catch (error) {
  // Create backup of corrupted file
  fs.copyFileSync('app.db', 'app.db.backup');
  // Create fresh database
  storageService.createFresh();
}

// Network issues
if (cannotConnectToDatabase) {
  // Show offline mode
  // Cached data still available
  // User can still browse history
}
```

## Next: Understanding Docker Integration

Continue to [Docker Integration](03-docker-integration.md) to see how Docker containers are created and managed.
