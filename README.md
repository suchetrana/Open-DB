# OpenDB Studio

**Open-source database management desktop application with integrated Docker workflow.**

OpenDB Studio is a developer-first database GUI built on Electron, React, and TypeScript. It provides a VS Code-style interface for managing PostgreSQL, MySQL, MongoDB, and Redis databases — locally or through Docker containers — without requiring cloud accounts, subscriptions, or telemetry.

---

## Overview

| | |
|---|---|
| **Stack** | Electron 28 / React 18 / TypeScript / Tailwind CSS |
| **State** | Zustand + Immer |
| **Databases** | PostgreSQL (full), MySQL / MongoDB / Redis (Docker + terminal) |
| **Docker** | dockerode — pull, create, start, stop, remove containers |
| **Terminal** | xterm.js with real PTY sessions (local shell + Docker exec) |
| **Storage** | sql.js (SQLite WASM) — connections, query history, settings |
| **License** | MIT |

---

## Features

- **Docker-native database provisioning** — Create PostgreSQL, MySQL, MongoDB, or Redis containers from the sidebar. Images are pulled automatically; containers are named and port-mapped with zero manual config.
- **SQL editor with syntax highlighting** — Custom tokenizer with keyword, string, number, and comment coloring. Line numbers, tab management, `Ctrl+Enter` to execute, `Ctrl+S` to save.
- **Schema introspection** — Drill into databases, schemas, tables, and columns with lazy-loaded tree views. Row estimates and data types displayed inline.
- **Results grid** — Typed columns with icons, NULL rendering, `Ctrl+F` search/filter, resizable column widths, minimize/maximize modes.
- **Integrated terminal** — Local PowerShell/bash sessions or Docker exec into containers (psql, mysql, mongosh, redis-cli). Multiple concurrent sessions.
- **Connection management** — Saved connections persisted in local SQLite. Auto-reconnect on startup. Switch databases without reconnecting.
- **File explorer** — Open folders, browse file trees, open and edit files directly in the editor.
- **Fully offline** — No cloud dependencies, no accounts, no telemetry. Everything runs on your machine.

---

## Quick Start

### Prerequisites

- **Node.js** 18 or later
- **Docker Desktop** (for container features — optional for direct database connections)
- Windows, macOS, or Linux

### Install and Run

```bash
git clone https://github.com/user/OpenDb-Studio.git
cd OpenDb-Studio/open-db
npm install
npm run dev
```

### Build for Production

```bash
npm run build
npm run start
```

---

## Project Structure

```
OpenDb-Studio/
├── open-db/
│   ├── src/
│   │   ├── main/               # Electron main process
│   │   │   ├── index.ts        # Window creation, bootstrap
│   │   │   ├── ipc/            # IPC handlers (database, docker, terminal, filesystem)
│   │   │   └── services/       # Business logic (pg, dockerode, sql.js, terminal)
│   │   ├── preload/            # Context bridge (electronAPI with 4 namespaces)
│   │   └── renderer/           # React SPA
│   │       └── src/
│   │           ├── components/  # layout, editor, results, sidebar, terminal, ui
│   │           ├── store/       # Zustand store (single store, 30 actions)
│   │           └── types/       # TypeScript interfaces
│   ├── electron.vite.config.ts
│   ├── tailwind.config.ts
│   └── package.json
├── docs/                        # Architecture and feature documentation
├── CONTRIBUTING.md              # Contribution guidelines
├── MIGRATION_PLAN.md            # Rust/Tauri migration roadmap
└── Claude.md                    # AI context file (project knowledge base)
```

---

## Architecture

OpenDB Studio follows a three-process Electron architecture:

```
Main Process (Node.js)
  Services: database.service / docker.service / storage.service / terminal.service
  IPC Handlers: 30 invoke channels + 2 push channels
       |
  Preload (context bridge)
       |
Renderer Process (React)
  Zustand store -> Components -> IPC calls via window.electronAPI
```

**Bootstrap order:** `storageService.initialize()` -> `dockerService.initialize()` -> `registerAllHandlers()` -> `createWindow()`

Full architecture documentation: [docs/01-architecture-overview.md](docs/01-architecture-overview.md)

---

## Current Status

### Working

| Feature | Status |
|---|---|
| PostgreSQL connect / query / introspect / switch DB | Complete |
| Docker detect / list / create / start / stop / remove | Complete |
| Terminal (local shell + Docker exec) | Complete |
| File explorer (open folder, tree view, open files) | Complete |
| SQL editor (highlighting, tabs, execute, save) | Complete |
| Results grid (types, search, resize, min/max) | Complete |
| Connection persistence + auto-reconnect | Complete |
| Bottom panel drag-to-resize | Complete |

### In Progress

| Feature | Status |
|---|---|
| MySQL / MongoDB / Redis query execution via editor | Docker + terminal only |
| Terminal resize (needs node-pty) | Partial |
| Search/replace in files | UI exists, not wired |
| Query history viewer | Saved to SQLite, no UI |
| Result export (CSV/JSON) | Buttons exist, no handlers |

See [Claude.md](Claude.md) for the complete status matrix.

---

## Roadmap

| Phase | Description | Details |
|---|---|---|
| **Phase 1** (current) | Node.js / TypeScript MVP | Electron + React, PostgreSQL-first |
| **Phase 2** | Multi-engine query support | MySQL, MongoDB, Redis editor execution |
| **Phase 3** | Performance + native migration | Tauri + Rust backend, node-pty | 

Full migration plan: [MIGRATION_PLAN.md](MIGRATION_PLAN.md)

---

## Contributing

Contributions are welcome. Please read **[CONTRIBUTING.md](CONTRIBUTING.md)** before submitting a pull request.

Quick version:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Make your changes with tests where applicable
4. Ensure `npm run build` passes
5. Submit a pull request with a clear description

---

## Documentation

| Document | Description |
|---|---|
| [Architecture Overview](docs/01-architecture-overview.md) | System design, process model, data flow |
| [Application Startup](docs/02-application-startup.md) | Bootstrap sequence and initialization |
| [Docker Integration](docs/03-docker-integration.md) | Container lifecycle and Docker API usage |
| [Setup Guide](docs/11-setup-guide.md) | Step-by-step installation and first run |
| [Claude.md](Claude.md) | Complete AI context file (types, store, IPC, conventions) |
| [MIGRATION_PLAN.md](MIGRATION_PLAN.md) | Rust/Tauri migration roadmap |

---

## License

MIT License. See [LICENSE](LICENSE) for details.

---

## Links

- **Issues:** Report bugs and request features via GitHub Issues
- **Discussions:** Architecture decisions and feature proposals
- **Documentation:** Complete docs in the `/docs` directory
