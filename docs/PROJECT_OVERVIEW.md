# OpenDB Studio - Project Overview

## What is OpenDB Studio?

OpenDB Studio is an **open-source desktop database management tool** that makes it incredibly easy to work with databases. It's designed for developers who want:

- ✅ **Quick database setup** using Docker
- ✅ **No complex installations** - one-click database creation
- ✅ **Local-first** - all data stored on your machine
- ✅ **Free forever** - no subscriptions or feature gates
- ✅ **Cross-platform** - Works on Mac, Windows, and Linux

## Key Features

### 1. Docker Integration 🐳
Create PostgreSQL, MySQL, Cassandra, or MongoDB databases with a single click. No manual installation required!

**How it works:**
- Click "New Database" → Select database type → Done
- App pulls Docker image, creates container, and configures everything
- Database ready to use in ~10 seconds

### 2. Multi-Database Support 🗄️
Connect to any database - whether it's in Docker or running elsewhere:
- PostgreSQL
- MySQL
- Cassandra
- MongoDB
- More coming soon...

### 3. SQL Editor 📝
Write and execute queries with a professional editor:
- Syntax highlighting
- Auto-complete
- Multiple tabs
- Query history
- Save favorite queries

### 4. Terminal Integration 💻
Run SQL files directly in Docker containers:
- Right-click any .sql file → "Run in Terminal"
- Execute commands inside containers
- See real-time output

### 5. Local Storage 💾
Everything stored locally in SQLite:
- Connection details (passwords encrypted)
- Query history
- Saved queries
- Settings
- No cloud, no tracking

## Why OpenDB Studio?

### vs DataGrip
- ❌ DataGrip: $89/year, no Docker integration, no terminal
- ✅ OpenDB Studio: Free, Docker built-in, terminal support

### vs Beekeeper Studio
- ❌ Beekeeper: Limited free features
- ✅ OpenDB Studio: All features free, open source

### vs DBeaver
- ✅ DBeaver: Great, but heavy (Java-based)
- ✅ OpenDB Studio: Lightweight, modern UI, Docker integration

## Tech Stack

**Frontend:**
- React 18 + TypeScript
- Monaco Editor (VSCode's editor)
- xterm.js (Terminal)
- Tailwind CSS (Styling)

**Backend:**
- Electron (Desktop framework)
- Node.js + TypeScript
- dockerode (Docker SDK)
- SQLite (Local storage)

**Future:**
- Migrate to Tauri + Rust for better performance

## Project Status

**Current Phase:** MVP Development (Node.js + TypeScript)
- ✅ Core architecture designed
- ✅ Docker integration planned
- ✅ Database connection system planned
- ✅ Query execution system planned
- ⏳ Implementation in progress

**Timeline:**
- Month 1-3: Build MVP with Node.js
- Month 4-6: Add advanced features, gather feedback
- Month 7-9: Consider migration to Tauri
- Month 10-12: Optional Rust backend for performance

## Getting Started

### For Users
1. Download the app for your OS
2. Install Docker Desktop (optional, for Docker features)
3. Launch OpenDB Studio
4. Create a database or connect to existing one
5. Start querying!

### For Developers
1. Read `/docs/11-setup-guide.md`
2. Run `npm install`
3. Run `npm run dev`
4. Start coding!

## Architecture

```
┌─────────────────────────────────────────┐
│         React UI (Frontend)             │
│  • Docker Panel                         │
│  • Database Explorer                    │
│  • SQL Editor                           │
│  • Terminal                             │
└──────────────┬──────────────────────────┘
               │ IPC (Secure Bridge)
┌──────────────▼──────────────────────────┐
│      Node.js Backend (Electron Main)    │
│  • DockerService                        │
│  • DatabaseService                      │
│  • StorageService                       │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│         Infrastructure                  │
│  • Docker Daemon                        │
│  • Database Containers                  │
│  • SQLite (App Data)                    │
└─────────────────────────────────────────┘
```

## Complete Documentation

All documentation is in the `/docs` folder:

1. **[Architecture Overview](docs/01-architecture-overview.md)** - System design
2. **[Application Startup](docs/02-application-startup.md)** - How app initializes
3. **[Docker Integration](docs/03-docker-integration.md)** - Docker workflow
4. **[Database Connections](docs/04-database-connections.md)** - Connection management
5. **[Query Execution](docs/05-query-execution.md)** - How queries work
6. **[Data Storage](docs/06-data-storage.md)** - Local data persistence
7. **[IPC Communication](docs/07-ipc-communication.md)** - Frontend-Backend bridge
8. **[Security](docs/08-security.md)** - Security layers
9. **[Terminal Integration](docs/09-terminal-integration.md)** - Terminal features
10. **[Migration to Rust](docs/10-migration-to-rust.md)** - Future optimization
11. **[Setup Guide](docs/11-setup-guide.md)** - Getting started
12. **[API Reference](docs/12-api-reference.md)** - Complete API

## File Structure

```
opendb-studio/
├── README.md               # Project introduction
├── PROJECT_OVERVIEW.md     # This file
├── package.json            # Dependencies
├── tsconfig.json           # TypeScript config
│
├── docs/                   # Complete documentation
│   ├── INDEX.md           # Documentation index
│   ├── 01-architecture-overview.md
│   ├── 02-application-startup.md
│   ├── 03-docker-integration.md
│   ├── 04-database-connections.md
│   ├── 05-query-execution.md
│   ├── 06-data-storage.md
│   ├── 07-ipc-communication.md
│   ├── 08-security.md
│   ├── 09-terminal-integration.md
│   ├── 10-migration-to-rust.md
│   ├── 11-setup-guide.md
│   └── 12-api-reference.md
│
├── src/                    # Source code
│   ├── main/              # Backend (Electron Main)
│   ├── preload/           # IPC Bridge
│   └── renderer/          # Frontend (React)
│
└── resources/             # App assets
```

## How to Use This Project

### 1. For Learning
- Read docs sequentially starting with Architecture Overview
- Understand each layer: Frontend → IPC → Backend → Storage
- Study the data flow diagrams

### 2. For Building
- Start with Setup Guide
- Use API Reference while coding
- Follow TypeScript types for safety

### 3. For Contributing
- Read Architecture docs
- Check existing issues
- Submit PRs with tests

### 4. For Forking
- Clone the repo
- Customize for your needs
- Keep docs updated

## Key Design Decisions

### Why Electron?
- Cross-platform with single codebase
- Use web technologies (React)
- Access to Node.js for system features
- Large ecosystem

### Why Docker Integration?
- Eliminates database installation hassle
- Consistent environments
- Easy cleanup (just remove container)
- Perfect for development/testing

### Why Local Storage?
- Privacy - no data sent to cloud
- Works offline
- Fast access
- User owns their data

### Why TypeScript?
- Type safety catches bugs early
- Better IDE support
- Self-documenting code
- Easier refactoring

### Migration Path to Rust?
- Node.js great for MVP (fast development)
- Rust better for production (performance)
- Gradual migration possible
- Decision based on user feedback

## Performance Targets

### Current (Node.js)
- App size: ~120MB
- RAM usage: ~200MB
- Startup: 2-3 seconds
- Query: Good for most use cases

### Future (Rust)
- App size: ~25MB
- RAM usage: ~40MB
- Startup: 0.5 seconds
- Query: 3-5x faster

## Roadmap

### Phase 1: MVP (Months 1-3)
- [ ] Complete architecture implementation
- [ ] Docker integration for PostgreSQL
- [ ] Database connection management
- [ ] Basic SQL editor
- [ ] Query execution
- [ ] Local storage

### Phase 2: Features (Months 4-6)
- [ ] Add MySQL, Cassandra, MongoDB
- [ ] Terminal integration
- [ ] Query history and favorites
- [ ] Schema visualization
- [ ] Export results
- [ ] Multiple tabs

### Phase 3: Polish (Months 7-9)
- [ ] UI/UX improvements
- [ ] Performance optimization
- [ ] Comprehensive testing
- [ ] Documentation completion
- [ ] Community feedback

### Phase 4: Advanced (Months 10-12)
- [ ] AI query assistant (optional)
- [ ] Collaboration features
- [ ] Consider Tauri migration
- [ ] Consider Rust backend

## Contributing

We welcome contributions! Areas where you can help:

1. **Code:** Implement features, fix bugs
2. **Docs:** Improve documentation
3. **Testing:** Test on different OS/databases
4. **Design:** UI/UX improvements
5. **Ideas:** Feature requests and feedback

## License

MIT License - Free to use, modify, and distribute

## Support

- **Issues:** Report bugs on GitHub
- **Discussions:** Ask questions, share ideas
- **Docs:** Check `/docs` folder first
- **Email:** your.email@example.com

## Acknowledgments

Built with love for the developer community ❤️

Special thanks to:
- Electron team
- React team
- All open-source contributors

---

**Ready to start?** Go to [Setup Guide](docs/11-setup-guide.md) →
