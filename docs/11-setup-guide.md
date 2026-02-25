# Complete Setup Guide

## Prerequisites

Before you start, ensure you have:

- **Node.js 18 or higher** - [Download](https://nodejs.org/)
- **npm or yarn** - Comes with Node.js
- **Docker Desktop** - [Download](https://www.docker.com/products/docker-desktop/) (for Docker features)
- **Git** - [Download](https://git-scm.com/)

## Step 1: Clone or Download Project

```bash
# If using Git
git clone https://github.com/yourusername/opendb-studio.git
cd opendb-studio

# Or extract from ZIP
unzip opendb-studio.zip
cd opendb-studio
```

## Step 2: Install Dependencies

```bash
npm install
```

This will install:
- Electron and related tools
- React and UI libraries
- Database drivers (pg, mysql2, cassandra-driver)
- dockerode for Docker integration
- All TypeScript dependencies

**Installation time:** ~3-5 minutes depending on internet speed

## Step 3: Development Mode

```bash
npm run dev
```

This starts:
- Vite dev server for React (port 5173)
- Electron app in development mode
- Hot reload enabled (changes reflect immediately)
- DevTools open by default

**First launch:** ~10-15 seconds
**Subsequent launches:** ~5 seconds

## Step 4: Verify Installation

When the app opens, you should see:

1. **Main window** with sidebar and editor
2. **Docker Panel** (if Docker Desktop is running)
   - Shows "Docker Available" status
   - Option to create databases
3. **Connection Panel** (empty on first run)

### If Docker is not detected:

```
⚠️ Docker not detected
Docker Desktop may not be running or installed.

Install Docker Desktop to enable:
• One-click database creation
• Container management
• Terminal integration

[Install Docker Desktop]
```

You can still use the app to connect to existing databases!

## Step 5: Create Your First Database (Optional)

### Using Docker:

1. Click **"Docker"** in sidebar
2. Click **"+ New Database"**
3. Select **"PostgreSQL"**
4. Enter details:
   - Name: `my-first-db`
   - Port: `5432` (auto-detected)
   - Password: `localdev`
5. Click **"Create"**

Wait ~10 seconds while:
- Image pulls from Docker Hub (~80MB)
- Container creates and starts
- Database initializes
- Connection is configured

### Connecting to Existing Database:

1. Click **"Connections"** in sidebar
2. Click **"+ New Connection"**
3. Enter details:
   - Name: `Production DB`
   - Type: `PostgreSQL`
   - Host: `localhost` or remote host
   - Port: `5432`
   - Username: `postgres`
   - Password: your password
   - Database: `mydb`
4. Click **"Test Connection"**
5. Click **"Save"**

## Step 6: Run Your First Query

1. Click on a connection to connect
2. Wait for "Connected" status
3. In the SQL editor, type:
   ```sql
   SELECT version();
   ```
4. Press `Cmd+Enter` (Mac) or `Ctrl+Enter` (Windows/Linux)
5. See results in the grid below

## Building for Production

### Build the app:
```bash
npm run build
```

This compiles:
- TypeScript to JavaScript
- React app to optimized bundle
- Electron main process

**Build time:** ~30-60 seconds

### Package the app:
```bash
npm run package
```

Creates platform-specific distributables:
- **macOS:** `.dmg` file in `out/make/`
- **Windows:** `.exe` installer in `out/make/`
- **Linux:** `.deb` or `.AppImage` in `out/make/`

**Package time:** ~2-5 minutes

### Install the packaged app:

**macOS:**
1. Open the `.dmg` file
2. Drag OpenDB Studio to Applications
3. Open from Applications folder

**Windows:**
1. Run the `.exe` installer
2. Follow installation wizard
3. Launch from Start Menu

**Linux:**
```bash
# Debian/Ubuntu
sudo dpkg -i opendb-studio_1.0.0_amd64.deb

# Or AppImage
chmod +x opendb-studio-1.0.0.AppImage
./opendb-studio-1.0.0.AppImage
```

## Troubleshooting

### Issue: "Cannot find module 'electron'"
```bash
rm -rf node_modules package-lock.json
npm install
```

### Issue: Docker not detected
1. Ensure Docker Desktop is running
2. Check Docker daemon status:
   ```bash
   docker ps
   ```
3. Restart Docker Desktop
4. Restart the app

### Issue: Port already in use
```
Error: Port 5432 is already in use
```

**Solution:**
1. Check what's using the port:
   ```bash
   # Mac/Linux
   lsof -i :5432
   
   # Windows
   netstat -ano | findstr :5432
   ```
2. Stop the process or use a different port

### Issue: Database won't connect
1. Verify database is running
2. Check connection details (host, port, username, password)
3. Test manually with psql/mysql CLI
4. Check firewall settings

### Issue: App crashes on startup
1. Delete app data:
   ```bash
   # Mac
   rm -rf ~/Library/Application\ Support/opendb-studio
   
   # Windows
   rmdir /s %APPDATA%\opendb-studio
   
   # Linux
   rm -rf ~/.config/opendb-studio
   ```
2. Restart the app (fresh database will be created)

### Issue: Build fails
```bash
# Clear build cache
rm -rf .webpack dist out

# Rebuild
npm run build
```

## Development Tips

### Hot Reload
- Frontend changes: Auto-reload
- Backend changes: Restart required (`npm run dev` again)

### Debugging

**Frontend (React):**
- DevTools open by default in dev mode
- Use React DevTools extension
- `console.log()` appears in DevTools

**Backend (Main Process):**
```bash
# View logs in terminal where you ran npm run dev
```

**IPC Communication:**
```typescript
// Add logging in preload.ts
console.log('IPC Call:', channel, data);
```

### VSCode Setup

**.vscode/settings.json:**
```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode"
}
```

**Recommended Extensions:**
- ESLint
- Prettier
- TypeScript and JavaScript Language Features

## Project Structure Quick Reference

```
opendb-studio/
├── src/
│   ├── main/           # Backend code (runs in Node.js)
│   │   ├── services/   # Business logic
│   │   ├── handlers/   # IPC handlers
│   │   └── index.ts    # Entry point
│   │
│   ├── preload/        # IPC bridge (security)
│   │   └── preload.ts
│   │
│   └── renderer/       # Frontend code (runs in browser)
│       ├── components/ # React components
│       ├── hooks/      # Custom hooks
│       ├── store/      # State management
│       └── App.tsx     # Main component
│
├── docs/               # This documentation
├── resources/          # App icons and assets
├── package.json        # Dependencies and scripts
└── tsconfig.json       # TypeScript configuration
```

## Next Steps

1. ✅ Read [Architecture Overview](01-architecture-overview.md)
2. ✅ Understand [Docker Integration](03-docker-integration.md)
3. ✅ Learn [Query Execution](05-query-execution.md)
4. ✅ Explore [API Reference](12-api-reference.md)
5. 🚀 Start building features!

## Getting Help

- **Documentation:** Check `/docs` folder
- **Issues:** [GitHub Issues](https://github.com/yourusername/opendb-studio/issues)
- **Questions:** [Discussions](https://github.com/yourusername/opendb-studio/discussions)

Happy coding! 🎉
