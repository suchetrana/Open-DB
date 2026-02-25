# OpenDB Studio - Complete Documentation Index

## 📚 Quick Navigation

### Getting Started
1. **[Setup Guide](11-setup-guide.md)** ⭐ START HERE
   - Installation steps
   - First database creation
   - Running first query
   - Troubleshooting

### Understanding the System
2. **[Architecture Overview](01-architecture-overview.md)**
   - System layers (Frontend, IPC, Backend, Storage)
   - Technology stack
   - Directory structure
   - Data flow diagrams

3. **[Application Startup](02-application-startup.md)**
   - Complete startup sequence
   - Service initialization
   - Window creation
   - React app loading

### Core Features
4. **[Docker Integration](03-docker-integration.md)**
   - Creating databases with Docker
   - Container lifecycle management
   - Docker API communication
   - Supported databases

5. **[Database Connections](04-database-connections.md)**
   - Connection process
   - Connection pool management
   - Password encryption
   - Multiple database support

6. **[Query Execution](05-query-execution.md)**
   - Complete query flow
   - Query type handling
   - Result processing
   - Performance optimization

7. **[Terminal Integration](09-terminal-integration.md)**
   - Running SQL files in containers
   - xterm.js integration
   - Docker exec commands

### Data & Security
8. **[Data Storage](06-data-storage.md)**
   - SQLite schema
   - File locations
   - Data persistence
   - Backup strategy

9. **[Security](08-security.md)**
   - Security layers
   - Password encryption
   - SQL injection prevention
   - IPC security

### Technical Details
10. **[IPC Communication](07-ipc-communication.md)**
    - How frontend and backend communicate
    - Type-safe API
    - Channel organization
    - Event handling

11. **[API Reference](12-api-reference.md)**
    - Complete API documentation
    - All IPC channels
    - TypeScript interfaces
    - Usage examples

### Future Planning
12. **[Migration to Rust](10-migration-to-rust.md)**
    - Why migrate to Rust
    - Phase-by-phase migration plan
    - Performance comparisons
    - Timeline recommendations

## 📖 Documentation Structure

```
docs/
├── INDEX.md (this file)
│
├── Getting Started
│   └── 11-setup-guide.md
│
├── Architecture
│   ├── 01-architecture-overview.md
│   ├── 02-application-startup.md
│   └── 07-ipc-communication.md
│
├── Core Features
│   ├── 03-docker-integration.md
│   ├── 04-database-connections.md
│   ├── 05-query-execution.md
│   └── 09-terminal-integration.md
│
├── Data & Security
│   ├── 06-data-storage.md
│   └── 08-security.md
│
└── Reference
    ├── 12-api-reference.md
    └── 10-migration-to-rust.md
```

## 🎯 Reading Paths

### For New Developers
```
1. Setup Guide
   ↓
2. Architecture Overview
   ↓
3. Application Startup
   ↓
4. Docker Integration
   ↓
5. Start coding!
```

### For Understanding Specific Features
```
Docker Features:
  → 03-docker-integration.md

Database Connections:
  → 04-database-connections.md

Query System:
  → 05-query-execution.md

Security Concerns:
  → 08-security.md
```

### For API Integration
```
1. IPC Communication
   ↓
2. API Reference
   ↓
3. Start building features
```

### For Performance Optimization
```
1. Architecture Overview
   ↓
2. Query Execution
   ↓
3. Migration to Rust
```

## 🔍 Quick Reference

### Common Questions

**Q: How do I create a Docker database?**
→ See [Docker Integration](03-docker-integration.md)

**Q: How do queries work internally?**
→ See [Query Execution](05-query-execution.md)

**Q: Where is data stored?**
→ See [Data Storage](06-data-storage.md)

**Q: How secure is password storage?**
→ See [Security](08-security.md)

**Q: How does frontend talk to backend?**
→ See [IPC Communication](07-ipc-communication.md)

**Q: What's the API for X feature?**
→ See [API Reference](12-api-reference.md)

**Q: Should I migrate to Rust?**
→ See [Migration to Rust](10-migration-to-rust.md)

## 📝 Documentation Conventions

### Code Examples
All code examples are in TypeScript unless otherwise specified.

### File Paths
- Absolute from project root: `/src/main/index.ts`
- Relative in context: `./services/DockerService.ts`

### Diagrams
```
┌─────────┐
│  Boxes  │ = Components/Systems
└────┬────┘
     │
     ▼
  Arrows = Data flow or process flow
```

### Sections
- **What Happens:** High-level explanation
- **Code:** Implementation details
- **Result:** What the user sees

## 🚀 Next Steps

1. **Start Here:** [Setup Guide](11-setup-guide.md)
2. **Understand System:** [Architecture Overview](01-architecture-overview.md)
3. **Build Features:** Use [API Reference](12-api-reference.md)
4. **Optimize Later:** Consider [Migration to Rust](10-migration-to-rust.md)

## 💡 Tips

- **Read sequentially** for full understanding
- **Jump to specific topics** when needed
- **Check API Reference** when coding
- **Review Security** before production
- **Plan Migration** after 3-6 months

## 📬 Contributing to Docs

Found an error or want to improve documentation?

1. Fork the repository
2. Edit the relevant `.md` file
3. Submit a pull request
4. Include context about the change

Thank you for reading! 📚
