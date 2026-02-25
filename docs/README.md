# OpenDB Studio

**Open Source Database GUI with Docker Integration**

A modern, desktop database management tool built with Electron, React, and TypeScript. Easily create and manage database containers with Docker, execute queries, and work with multiple database types.

## 🎯 Features

- ✅ **Docker Integration** - One-click database setup (PostgreSQL, MySQL, Cassandra, MongoDB)
- ✅ **Multiple Database Support** - Connect to any database (local or Docker)
- ✅ **SQL Editor** - Monaco Editor with syntax highlighting and auto-complete
- ✅ **Terminal Integration** - Execute SQL files directly in Docker containers
- ✅ **Query History** - All queries saved locally with execution time
- ✅ **Schema Explorer** - Browse tables, columns, and relationships
- ✅ **Local Storage** - All data stored locally in SQLite
- ✅ **No Cloud** - Everything runs on your machine
- ✅ **Open Source** - MIT License

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development
npm run dev

# Build for production
npm run build

# Package application
npm run package
```

## 📋 Requirements

- Node.js 18+ 
- Docker Desktop (for Docker integration features)
- 4GB RAM minimum
- macOS, Windows, or Linux

## 📚 Documentation

Complete documentation is available in the `/docs` folder:

- **[Architecture Overview](docs/01-architecture-overview.md)** - System design and components
- **[Application Startup](docs/02-application-startup.md)** - How the app initializes
- **[Docker Integration](docs/03-docker-integration.md)** - Complete Docker workflow
- **[Database Connections](docs/04-database-connections.md)** - Connection management
- **[Query Execution](docs/05-query-execution.md)** - How queries work
- **[Data Storage](docs/06-data-storage.md)** - Local data persistence
- **[IPC Communication](docs/07-ipc-communication.md)** - Frontend-Backend bridge
- **[Security](docs/08-security.md)** - Security layers and encryption
- **[Terminal Integration](docs/09-terminal-integration.md)** - Terminal features
- **[Migration to Rust](docs/10-migration-to-rust.md)** - Future optimization path
- **[Setup Guide](docs/11-setup-guide.md)** - Step-by-step setup instructions
- **[API Reference](docs/12-api-reference.md)** - Complete API documentation

## 🏗️ Project Structure

```
opendb-studio/
├── src/
│   ├── main/           # Electron Main Process (Backend)
│   ├── preload/        # IPC Bridge (Security)
│   └── renderer/       # React Frontend
├── docs/               # Complete documentation
├── resources/          # App icons and assets
└── package.json
```

## 🛠️ Tech Stack

**Frontend:**
- React 18 + TypeScript
- Monaco Editor (SQL editing)
- xterm.js (Terminal)
- Zustand (State management)
- Tailwind CSS (Styling)

**Backend:**
- Electron 28
- Node.js + TypeScript
- dockerode (Docker SDK)
- better-sqlite3 (Local storage)
- Database drivers: pg, mysql2, cassandra-driver

## 📖 How It Works

1. **Docker Integration**: Pull images and create containers directly from the app
2. **Database Connection**: Connect to any database (Docker or external)
3. **Query Execution**: Write and execute SQL with results displayed in a grid
4. **Terminal**: Run SQL files directly in Docker containers
5. **Local Storage**: All connections and queries saved in SQLite

See [Architecture Overview](docs/01-architecture-overview.md) for detailed explanation.

## 🔒 Security

- Context isolation enabled
- Passwords encrypted using OS keychain
- No direct Node.js access from frontend
- SQL injection prevention
- Input validation on all IPC calls

## 🗺️ Roadmap

**Phase 1 (Current):** Node.js/TypeScript MVP
**Phase 2 (Future):** Migrate to Tauri + Node.js
**Phase 3 (Future):** Full Rust backend for maximum performance

See [Migration to Rust](docs/10-migration-to-rust.md) for details.

## 📄 License

MIT License - see LICENSE file for details

## 🤝 Contributing

Contributions welcome! Please read CONTRIBUTING.md first.

## 💬 Support

- GitHub Issues: Report bugs and request features
- Documentation: Check /docs folder
- Discord: [Coming soon]

---

**Built with ❤️ for the developer community**
