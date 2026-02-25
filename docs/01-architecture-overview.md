# Architecture Overview

## System Overview

OpenDB Studio is built with a multi-layer architecture that separates concerns between UI, business logic, and data access.

```
┌─────────────────────────────────────────────────────────────────┐
│                      PRESENTATION LAYER                          │
│                  React Components (TypeScript)                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │  Docker  │  │ Database │  │  Editor  │  │ Terminal │       │
│  │  Panel   │  │ Explorer │  │  UI      │  │   UI     │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                      STATE MANAGEMENT                            │
│                     Zustand Store (TypeScript)                   │
│  • Docker Containers State                                      │
│  • Database Connections State                                   │
│  • Active Queries State                                         │
│  • UI State (tabs, modals, panels)                              │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                      IPC COMMUNICATION                           │
│                   Electron Preload (Security)                    │
│  • Type-safe API exposed to renderer                            │
│  • No direct Node.js access from React                          │
│  • All communication through IPC channels                       │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                      BUSINESS LOGIC LAYER                        │
│                  Electron Main Process (Node.js)                 │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐ │
│  │ DockerService    │  │ DatabaseService  │  │ StorageService│ │
│  │                  │  │                  │  │               │ │
│  │ • Pull images    │  │ • Connect to DB  │  │ • Save data   │ │
│  │ • Create         │  │ • Execute queries│  │ • Query history│ │
│  │   containers     │  │ • Schema info    │  │ • Settings    │ │
│  │ • Manage         │  │ • Transactions   │  │ • Encryption  │ │
│  │   lifecycle      │  │                  │  │               │ │
│  └──────────────────┘  └──────────────────┘  └──────────────┘ │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                      INFRASTRUCTURE LAYER                        │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ Docker Daemon│  │   Database   │  │    SQLite    │         │
│  │              │  │   Containers │  │  (App Data)  │         │
│  │ • Unix Socket│  │              │  │              │         │
│  │ • HTTP API   │  │ • Postgres   │  │ • Connections│         │
│  │ • Events     │  │ • MySQL      │  │ • History    │         │
│  │              │  │ • Cassandra  │  │ • Settings   │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. Frontend (Renderer Process)
- **Technology**: React 18 + TypeScript + Vite
- **Purpose**: User interface and interactions
- **Security**: No direct access to Node.js or file system
- **Communication**: Only through IPC bridge

### 2. IPC Bridge (Preload Script)
- **Technology**: Electron Preload
- **Purpose**: Secure communication bridge
- **Features**: Type-safe API, context isolation
- **Security**: Only exposes specific APIs

### 3. Backend (Main Process)
- **Technology**: Node.js + TypeScript
- **Purpose**: Business logic and system access
- **Services**: Docker, Database, Storage management
- **Access**: Full system and native modules

### 4. Storage
- **Technology**: SQLite (better-sqlite3)
- **Purpose**: Local data persistence
- **Stores**: Connections, history, settings, queries
- **Location**: OS-specific user data directory

## Data Flow

### Example: Creating a PostgreSQL Container

```
User clicks "Create PostgreSQL"
    │
    ▼
React Component
    │
    │ electronAPI.docker.createPostgres()
    ▼
Preload Script (IPC Bridge)
    │
    │ ipcRenderer.invoke('docker:create-postgres')
    ▼
Main Process Handler
    │
    │ dockerService.createPostgres()
    ▼
Docker Service
    │
    ├─ Pull postgres:16-alpine image
    ├─ Create container
    ├─ Start container
    ├─ Wait for ready
    └─ Save to SQLite
    │
    ▼
Storage Service
    │
    ├─ Save container info
    └─ Create connection entry
    │
    ▼
Return result to React
    │
    └─ Update UI
```

## Directory Structure

```
opendb-studio/
├── src/
│   ├── main/                      # Backend (Electron Main)
│   │   ├── services/              # Business logic
│   │   │   ├── DockerService.ts
│   │   │   ├── DatabaseService.ts
│   │   │   └── StorageService.ts
│   │   ├── handlers/              # IPC handlers
│   │   │   ├── dockerHandlers.ts
│   │   │   ├── databaseHandlers.ts
│   │   │   └── storageHandlers.ts
│   │   └── index.ts              # Entry point
│   │
│   ├── preload/                   # IPC Bridge
│   │   └── preload.ts            # Exposes API to renderer
│   │
│   └── renderer/                  # Frontend (React)
│       ├── components/           # UI components
│       ├── hooks/                # Custom hooks
│       ├── store/                # State management
│       └── App.tsx              # Main app component
│
├── docs/                         # Documentation
└── resources/                    # Assets
```

## Technology Stack

### Frontend
- **React 18**: UI framework
- **TypeScript**: Type safety
- **Vite**: Build tool (fast dev server)
- **Monaco Editor**: SQL editor (VSCode's editor)
- **xterm.js**: Terminal emulator
- **Zustand**: State management (simpler than Redux)
- **Tailwind CSS**: Styling

### Backend
- **Electron 28**: Desktop framework
- **Node.js**: Runtime
- **TypeScript**: Type safety
- **dockerode**: Docker API client
- **better-sqlite3**: Fast SQLite library
- **pg**: PostgreSQL driver
- **mysql2**: MySQL driver
- **cassandra-driver**: Cassandra driver

## Communication Patterns

### 1. Request-Response (IPC)
```typescript
// Frontend
const result = await electronAPI.docker.createPostgres(options);

// Backend
ipcMain.handle('docker:create-postgres', async (event, options) => {
  return await dockerService.createPostgres(options);
});
```

### 2. Events (Push notifications)
```typescript
// Backend sends event
mainWindow.webContents.send('docker:pull-progress', { status, progress });

// Frontend listens
electronAPI.on('docker:pull-progress', (data) => {
  updateProgress(data);
});
```

### 3. Streaming (Long operations)
```typescript
// Used for Docker image pulls, long queries
// Progress updates sent via events
```

## Security Model

### Layer 1: Context Isolation
- Renderer cannot access Node.js
- All access through preload script

### Layer 2: IPC Validation
- All inputs validated in main process
- Type checking with TypeScript

### Layer 3: Encryption
- Passwords encrypted using OS keychain
- Never stored in plain text

### Layer 4: SQL Injection Prevention
- Input sanitization
- Parameterized queries
- Dangerous pattern detection

## Performance Considerations

### Current (Node.js)
- **Bundle Size**: ~120MB
- **Memory Usage**: ~200MB
- **Startup Time**: 2-3 seconds
- **Query Performance**: Good for most use cases

### Future (Rust)
- **Bundle Size**: ~25MB
- **Memory Usage**: ~40MB
- **Startup Time**: 0.5 seconds
- **Query Performance**: 3-5x faster

## Next Steps

1. Read [Application Startup](02-application-startup.md)
2. Understand [Docker Integration](03-docker-integration.md)
3. Learn [Database Connections](04-database-connections.md)
