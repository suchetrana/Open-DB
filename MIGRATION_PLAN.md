# OpenDB Studio -- Migration Plan

**From:** Electron + Node.js + TypeScript  
**To:** Tauri + Rust backend + React frontend  

This document defines the phased migration strategy to move OpenDB Studio from a pure Node.js/Electron stack to a Rust-backed Tauri application. The goal is improved performance, smaller binary size, lower memory footprint, and native OS integration -- while preserving the existing React frontend investment.

---

## Table of Contents

- [Motivation](#motivation)
- [Current Architecture](#current-architecture)
- [Target Architecture](#target-architecture)
- [Migration Phases](#migration-phases)
  - [Phase 1 -- Stabilize Current Stack](#phase-1--stabilize-current-stack)
  - [Phase 2 -- Service Isolation and Interface Contracts](#phase-2--service-isolation-and-interface-contracts)
  - [Phase 3 -- Tauri Shell Migration](#phase-3--tauri-shell-migration)
  - [Phase 4 -- Rust Service Implementation](#phase-4--rust-service-implementation)
  - [Phase 5 -- Native Terminal and Advanced Features](#phase-5--native-terminal-and-advanced-features)
- [File-by-File Migration Map](#file-by-file-migration-map)
- [Dependency Replacement Map](#dependency-replacement-map)
- [Risk Assessment](#risk-assessment)
- [Success Criteria](#success-criteria)

---

## Motivation

| Concern | Current (Electron) | Target (Tauri + Rust) |
|---|---|---|
| Binary size | ~150-200 MB (ships Chromium) | ~10-20 MB (uses system webview) |
| Memory usage | ~200-400 MB idle | ~50-100 MB idle |
| Startup time | 2-4 seconds | <1 second |
| Native feel | Chromium wrapper | System webview, native menus |
| Security | Node.js in main process, context isolation | Rust backend, no Node.js, stronger sandboxing |
| Docker SDK | dockerode (JS) | bollard (Rust, async, typed) |
| Database drivers | pg (JS) | sqlx or tokio-postgres (Rust, compile-time checked) |
| Local storage | sql.js (WASM SQLite) | rusqlite (native SQLite bindings) |
| Terminal | child_process (no PTY resize) | portable-pty (full PTY support) |

---

## Current Architecture

```
Electron Main Process (Node.js)
├── database.service.ts    -- pg Pool manager
├── docker.service.ts      -- dockerode wrapper
├── storage.service.ts     -- sql.js (SQLite WASM)
├── terminal.service.ts    -- child_process spawn
└── IPC handlers (32 channels)
       |
    Preload (context bridge)
       |
Renderer (React 18 + Zustand + Tailwind)
```

All business logic lives in four TypeScript service files. IPC handlers are thin wrappers that delegate to these services. The renderer communicates exclusively through `window.electronAPI`.

---

## Target Architecture

```
Tauri Backend (Rust)
├── src/database/      -- sqlx / tokio-postgres
├── src/docker/        -- bollard (async Docker API)
├── src/storage/       -- rusqlite
├── src/terminal/      -- portable-pty
├── src/commands/      -- Tauri command handlers (replaces IPC)
└── src/main.rs        -- Tauri app builder
       |
    Tauri IPC (invoke / event system)
       |
Frontend (React 18 + Zustand + Tailwind) -- minimal changes
```

The React frontend remains largely unchanged. The `window.electronAPI` calls are replaced with `@tauri-apps/api/core invoke()` calls. The Zustand store actions are updated to call Tauri commands instead of Electron IPC.

---

## Migration Phases

### Phase 1 -- Stabilize Current Stack

**Goal:** Complete all MVP features on the current Electron stack before introducing Rust.

**Tasks:**

| Task | File(s) | Priority |
|---|---|---|
| Wire MySQL query execution through editor | `database.service.ts`, `database.handlers.ts` | High |
| Wire MongoDB query execution | `database.service.ts`, `database.handlers.ts` | High |
| Wire Redis command execution | `database.service.ts`, `database.handlers.ts` | Medium |
| Build query history viewer panel | New component in `renderer/src/components/` | Medium |
| Implement CSV/JSON result export | `ResultsPanel.tsx`, `ResultsTable.tsx` | Medium |
| Wire search/replace to file system | `Sidebar.tsx`, `filesystem.handlers.ts` | Low |
| Build settings panel | New component + `storage.service.ts` | Low |
| Add unit and integration tests | New `__tests__/` directories | High |
| Integrate `node-pty` for terminal resize | `terminal.service.ts` | Medium |

**Exit criteria:** All database types queryable from the editor. Test coverage on services and IPC handlers. No critical bugs.

---

### Phase 2 -- Service Isolation and Interface Contracts

**Goal:** Decouple services from Electron APIs so they can be replaced independently.

**Tasks:**

| Task | Description |
|---|---|
| Define TypeScript interfaces for each service | Create `IDatabaseService`, `IDockerService`, `IStorageService`, `ITerminalService` interfaces |
| Extract IPC handler logic into pure functions | Handlers should call service interfaces, not concrete implementations |
| Create a shared types package | Move types to a shared location usable by both TS and Rust (via ts-rs or manual mapping) |
| Document all IPC commands with schemas | Input/output types for every channel, used as the contract for Rust commands |
| Create integration test suite against interfaces | Tests that validate behavior regardless of implementation language |

**File changes:**

```
src/main/services/
├── interfaces/
│   ├── database.interface.ts    -- IDatabaseService
│   ├── docker.interface.ts      -- IDockerService
│   ├── storage.interface.ts     -- IStorageService
│   └── terminal.interface.ts    -- ITerminalService
├── database.service.ts          -- implements IDatabaseService
├── docker.service.ts            -- implements IDockerService
├── storage.service.ts           -- implements IStorageService
└── terminal.service.ts          -- implements ITerminalService
```

**Exit criteria:** All services implement explicit interfaces. IPC handlers depend only on interfaces. Full command schema documentation exists.

---

### Phase 3 -- Tauri Shell Migration

**Goal:** Replace Electron with Tauri as the application shell while keeping Node.js services running as a sidecar.

**Tasks:**

| Task | Description |
|---|---|
| Initialize Tauri project alongside Electron | `cargo install create-tauri-app`, set up `src-tauri/` |
| Configure Tauri to serve the existing React build | Point Tauri `devPath` / `distDir` at the Vite output |
| Implement Tauri command stubs | One Tauri `#[command]` for each IPC channel, initially delegating to a Node.js sidecar |
| Replace `window.electronAPI` with Tauri invoke | Update all store actions to use `invoke()` from `@tauri-apps/api/core` |
| Migrate window management | Replace Electron `BrowserWindow` config with Tauri window config |
| Update build pipeline | Replace `electron-vite` with Tauri's build system |
| Sidecar bridge | Temporarily run Node.js services as a Tauri sidecar process, communicating via stdio/JSON |

**New file structure (additive):**

```
src-tauri/
├── Cargo.toml
├── tauri.conf.json
├── src/
│   ├── main.rs
│   └── commands/
│       ├── database.rs      -- stubs, delegates to sidecar
│       ├── docker.rs        -- stubs
│       ├── storage.rs       -- stubs
│       └── terminal.rs      -- stubs
```

**Frontend changes:**

```
src/renderer/src/
├── lib/
│   └── api.ts               -- abstraction layer: electronAPI OR tauri invoke
├── store/
│   └── useAppStore.ts        -- calls api.ts instead of window.electronAPI directly
```

**Exit criteria:** App runs under Tauri with Node.js sidecar. All features work. Electron can be removed.

---

### Phase 4 -- Rust Service Implementation

**Goal:** Replace Node.js sidecar services with native Rust implementations, one at a time.

**Migration order** (least to most complex):

#### 4.1 Storage Service (rusqlite)

| From | To |
|---|---|
| `storage.service.ts` (sql.js) | `src-tauri/src/storage/mod.rs` (rusqlite) |

- Simplest service. Single SQLite file, three tables (connections, query_history, settings).
- Use `rusqlite` with the same schema.
- Migrate data on first launch of Rust version.

#### 4.2 Docker Service (bollard)

| From | To |
|---|---|
| `docker.service.ts` (dockerode) | `src-tauri/src/docker/mod.rs` (bollard) |

- `bollard` is async-native and well-maintained.
- Map all 7 Docker commands to `bollard` API calls.
- Container creation config (image, ports, env) maps directly.

#### 4.3 Database Service (sqlx / tokio-postgres)

| From | To |
|---|---|
| `database.service.ts` (pg) | `src-tauri/src/database/mod.rs` (sqlx) |

- Use `sqlx` for compile-time query checking where possible.
- Connection pool management via `sqlx::Pool`.
- Introspection queries (information_schema) remain the same SQL.
- Add MySQL support via `sqlx` MySQL driver.
- Add MongoDB support via `mongodb` Rust crate.

#### 4.4 Terminal Service (portable-pty)

| From | To |
|---|---|
| `terminal.service.ts` (child_process) | `src-tauri/src/terminal/mod.rs` (portable-pty) |

- Most complex migration. Requires proper PTY handling.
- `portable-pty` provides cross-platform PTY creation with resize support.
- Docker exec sessions via `bollard`'s exec API with TTY attachment.
- Fixes the current terminal resize limitation.

**Rust project structure after Phase 4:**

```
src-tauri/src/
├── main.rs
├── commands/
│   ├── database.rs
│   ├── docker.rs
│   ├── storage.rs
│   └── terminal.rs
├── database/
│   ├── mod.rs
│   ├── postgres.rs
│   ├── mysql.rs
│   └── mongodb.rs
├── docker/
│   └── mod.rs
├── storage/
│   └── mod.rs
├── terminal/
│   └── mod.rs
└── models/
    ├── connection.rs
    ├── container.rs
    ├── query_result.rs
    └── terminal_session.rs
```

**Exit criteria:** Node.js sidecar fully removed. All services running as native Rust. No JavaScript in the backend.

---

### Phase 5 -- Native Terminal and Advanced Features

**Goal:** Leverage Rust capabilities for features that were impractical in Node.js.

| Feature | Description |
|---|---|
| Native PTY with resize | Full terminal emulation with proper window resize |
| SSH tunnel support | Rust `ssh2` crate for remote database connections |
| Connection pooling improvements | `deadpool` or `bb8` for async connection pools |
| Concurrent query execution | Tokio tasks for parallel query execution |
| Plugin system | WASM-based plugin system for custom database drivers |
| Native notifications | OS-level notifications for long-running queries |
| Auto-update | Tauri's built-in updater |
| Code signing | Tauri's streamlined code signing |

**Exit criteria:** Feature parity exceeded. Performance benchmarks met.

---

## File-by-File Migration Map

| Current File (TypeScript) | Target File (Rust) | Rust Crate |
|---|---|---|
| `src/main/index.ts` | `src-tauri/src/main.rs` | tauri |
| `src/main/services/database.service.ts` | `src-tauri/src/database/mod.rs` | sqlx, tokio-postgres |
| `src/main/services/docker.service.ts` | `src-tauri/src/docker/mod.rs` | bollard |
| `src/main/services/storage.service.ts` | `src-tauri/src/storage/mod.rs` | rusqlite |
| `src/main/services/terminal.service.ts` | `src-tauri/src/terminal/mod.rs` | portable-pty |
| `src/main/ipc/database.handlers.ts` | `src-tauri/src/commands/database.rs` | tauri::command |
| `src/main/ipc/docker.handlers.ts` | `src-tauri/src/commands/docker.rs` | tauri::command |
| `src/main/ipc/filesystem.handlers.ts` | `src-tauri/src/commands/filesystem.rs` | std::fs, tauri::api::dialog |
| `src/main/ipc/terminal.handlers.ts` | `src-tauri/src/commands/terminal.rs` | tauri::command |
| `src/preload/index.ts` | *(removed -- Tauri handles IPC natively)* | -- |
| `src/renderer/src/types/index.ts` | `src-tauri/src/models/*.rs` + ts-rs generated types | ts-rs |
| `src/renderer/src/store/useAppStore.ts` | *(stays, calls `invoke()`)* | -- |

---

## Dependency Replacement Map

| Current (npm) | Replacement (Rust crate) | Purpose |
|---|---|---|
| `pg` ^8.11.3 | `sqlx` + `tokio-postgres` | PostgreSQL driver |
| `dockerode` ^4.0.2 | `bollard` | Docker Engine API |
| `sql.js` ^1.10.3 | `rusqlite` | SQLite storage |
| `uuid` ^9.0.1 | `uuid` (Rust crate) | ID generation |
| `electron` ^28.1.0 | `tauri` ^2.x | Application shell |
| `electron-vite` ^2.3.0 | `@tauri-apps/cli` | Build tooling |
| *(none -- child_process)* | `portable-pty` | Terminal PTY |
| *(none)* | `serde` + `serde_json` | Serialization |
| *(none)* | `tokio` | Async runtime |
| *(none)* | `anyhow` + `thiserror` | Error handling |

**Frontend dependencies (unchanged):**
`react`, `react-dom`, `zustand`, `immer`, `clsx`, `@xterm/xterm`, `tailwindcss` -- all remain as-is.

---

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| Feature regression during migration | High | Medium | Phase 2 interface contracts + integration tests validate behavior across implementations |
| Rust learning curve for contributors | Medium | High | Keep frontend in React/TS. Rust is backend only. Provide clear onboarding docs. |
| bollard API differences from dockerode | Low | Medium | Docker Engine API is standard; both libraries wrap the same REST API |
| PTY portability across OS | Medium | Medium | portable-pty is battle-tested (used by Alacritty, Wezterm) |
| SQLite schema migration | Low | Low | Schema is simple (3 tables). Write a one-time migration script. |
| Tauri v2 breaking changes | Medium | Low | Pin Tauri version, test upgrades in a separate branch |
| Sidecar latency in Phase 3 | Low | Medium | Temporary phase. JSON-over-stdio is fast enough for the transition period. |

---

## Success Criteria

| Metric | Current | Target |
|---|---|---|
| Cold start time | ~3 seconds | <1 second |
| Idle memory | ~300 MB | <100 MB |
| Binary size (packaged) | ~180 MB | <20 MB |
| All IPC commands functional | 32 channels | 32 equivalent Tauri commands |
| Frontend code changes | -- | <15% of renderer files modified |
| Test coverage (backend) | 0% | >80% on Rust services |
| Cross-platform builds | Electron builder | Tauri bundler (msi, dmg, deb, AppImage) |

---

## Timeline Estimate

| Phase | Estimated Duration | Dependencies |
|---|---|---|
| Phase 1 -- Stabilize | 4-6 weeks | None |
| Phase 2 -- Service Isolation | 2-3 weeks | Phase 1 |
| Phase 3 -- Tauri Shell | 3-4 weeks | Phase 2 |
| Phase 4 -- Rust Services | 6-8 weeks | Phase 3 |
| Phase 5 -- Native Features | Ongoing | Phase 4 |

**Total estimated migration time:** 15-21 weeks for full Rust backend with no Node.js dependency.

Phases can overlap where possible (e.g., Phase 4.1 storage can begin while Phase 3 stabilizes).

---

*This is a living document. Update it as decisions are made and phases are completed.*
