# Quick Start Guide

Get OpenDB Studio running in 5 minutes!

## Prerequisites

- **Node.js 18+** → [Download](https://nodejs.org/)
- **Docker Desktop** (optional) → [Download](https://docker.com/products/docker-desktop)

## Installation

```bash
# 1. Extract the ZIP
unzip opendb-studio.zip
cd opendb-studio

# 2. Install dependencies (takes ~3 minutes)
npm install

# 3. Start the app
npm run dev
```

That's it! The app should open automatically.

## First Steps

### Option A: Create a Database with Docker

1. Make sure Docker Desktop is running
2. Click **"Docker"** in the sidebar
3. Click **"+ New Database"**
4. Select **"PostgreSQL"**
5. Click **"Create"** (keep defaults)
6. Wait ~10 seconds while it sets up

You now have a running PostgreSQL database! 🎉

### Option B: Connect to Existing Database

1. Click **"Connections"** in sidebar
2. Click **"+ New Connection"**
3. Fill in your database details:
   - Host: `localhost` (or remote host)
   - Port: `5432` (PostgreSQL default)
   - Username: `postgres`
   - Password: your password
   - Database: your database name
4. Click **"Test Connection"**
5. Click **"Save"**

### Run Your First Query

1. Click on a connection to open it
2. Type in the editor:
   ```sql
   SELECT version();
   ```
3. Press `Cmd+Enter` (Mac) or `Ctrl+Enter` (Windows/Linux)
4. See results below! ✨

## What's Next?

### Explore the Docs
- **[Full Documentation](docs/INDEX.md)** - Complete guide
- **[Architecture](docs/01-architecture-overview.md)** - How it works
- **[Docker Guide](docs/03-docker-integration.md)** - Docker details

### Learn the Features
- Create multiple database containers
- Save favorite queries
- View query history
- Run SQL files in terminal
- Export results to CSV/JSON

### Build Something
- Check the **[API Reference](docs/12-api-reference.md)**
- Read the **[Architecture docs](docs/01-architecture-overview.md)**
- Start contributing!

## Troubleshooting

### "Docker not detected"
→ Install and start Docker Desktop, then restart the app

### "Port already in use"
→ Use a different port (5433, 5434, etc.)

### "Cannot connect to database"
→ Check your connection details and firewall

### More help
→ See **[Setup Guide](docs/11-setup-guide.md)** for detailed troubleshooting

## Building for Production

```bash
# Build the app
npm run build

# Create installer
npm run package

# Find installer in out/make/
```

## Project Structure

```
opendb-studio/
├── docs/           # 📚 Complete documentation
├── src/
│   ├── main/      # 🔧 Backend code
│   ├── preload/   # 🔒 Security bridge
│   └── renderer/  # 🎨 Frontend code
├── package.json    # Dependencies
└── README.md       # Project intro
```

## Getting Help

- **Docs:** Check `/docs` folder
- **Issues:** Report on GitHub
- **Questions:** GitHub Discussions

Happy coding! 🚀
