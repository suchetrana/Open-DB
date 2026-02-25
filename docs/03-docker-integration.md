# Docker Integration - Complete Workflow

This document explains exactly how Docker integration works in OpenDB Studio.

## User Flow: Creating a PostgreSQL Database

```
USER CLICKS "Create New PostgreSQL Database"
                    │
                    ▼
        [Modal opens with form]
        • Name: "my-postgres"
        • Port: 5432 (auto-detect free port)
        • Password: "localdev" (optional)
                    │
                    ▼
        [User clicks "Create"]
                    │
                    ▼
        Frontend calls API:
        await electronAPI.docker.createPostgres({
          name: "my-postgres",
          port: 5432,
          password: "localdev"
        });
```

## Complete Backend Flow

### Step 1: Check Port Availability
```typescript
async createPostgres(name: string, port: number) {
  // Query all containers
  const containers = await docker.listContainers({ all: true });
  
  // Check if port is in use
  const portInUse = containers.some(c => 
    c.Ports.some(p => p.PublicPort === port)
  );
  
  if (portInUse) {
    // Find next available port
    port = await this.findAvailablePort(5432);
  }
}
```

### Step 2: Pull Docker Image
```typescript
// Pull postgres:16-alpine from Docker Hub
await this.pullImage('postgres:16-alpine', (progress) => {
  // Send progress to frontend
  mainWindow.webContents.send('docker:pull-progress', {
    status: progress.status,
    current: progress.progressDetail.current,
    total: progress.progressDetail.total
  });
});
```

**What happens:**
1. Docker sends HTTP POST to `/images/create?fromImage=postgres&tag=16-alpine`
2. Docker Hub sends image layers
3. Each layer is downloaded and extracted
4. Progress events are streamed back
5. Image is stored locally (~80MB for postgres:16-alpine)

### Step 3: Create Container
```typescript
const container = await docker.createContainer({
  Image: 'postgres:16-alpine',
  name: 'my-postgres',
  Env: [
    'POSTGRES_PASSWORD=localdev',
    'POSTGRES_USER=postgres',
    'POSTGRES_DB=playground'
  ],
  HostConfig: {
    PortBindings: {
      '5432/tcp': [{ HostPort: '5432' }]
    },
    RestartPolicy: {
      Name: 'unless-stopped'
    }
  }
});
```

**Docker API Call:**
```http
POST /v1.43/containers/create?name=my-postgres
Content-Type: application/json

{
  "Image": "postgres:16-alpine",
  "Env": ["POSTGRES_PASSWORD=localdev", ...],
  "HostConfig": {
    "PortBindings": {
      "5432/tcp": [{"HostPort": "5432"}]
    }
  }
}

Response:
{
  "Id": "abc123def456...",
  "Warnings": []
}
```

### Step 4: Start Container
```typescript
await container.start();
// HTTP POST to /containers/{id}/start
```

**What happens:**
1. Docker daemon starts the container
2. PostgreSQL process initializes
3. Database files created in container
4. PostgreSQL starts listening on port 5432 inside container
5. Port 5432 mapped to host machine

### Step 5: Wait for Database Ready
```typescript
async waitForHealthy(containerId: string, port: number) {
  const maxAttempts = 30;
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      // Try to connect
      const client = new Client({
        host: 'localhost',
        port: port,
        user: 'postgres',
        password: 'localdev',
        database: 'postgres',
        connectionTimeoutMillis: 2000
      });
      
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      
      // Success!
      return true;
    } catch (error) {
      // Not ready yet, wait and retry
      await sleep(1000);
      
      // Send progress to UI
      mainWindow.webContents.send('docker:status', {
        message: `Starting PostgreSQL... ${i + 1}/30`
      });
    }
  }
  
  throw new Error('Database failed to start');
}
```

### Step 6: Save to Local Database
```typescript
// Save container info
storageService.saveDockerContainer({
  id: container.id,
  name: 'my-postgres',
  type: 'postgres',
  image: 'postgres:16-alpine',
  port: 5432,
  status: 'running',
  createdAt: new Date()
});

// Save connection config
const connectionId = uuid();
storageService.saveConnection({
  id: connectionId,
  name: 'my-postgres (Docker)',
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'postgres',
  password: encrypt('localdev'),
  database: 'playground',
  dockerContainerId: container.id
});
```

## Docker Communication Details

### How dockerode Library Works

```
Application Code
     │
     │ Uses dockerode library
     ▼
dockerode
     │
     │ HTTP over Unix Socket/Named Pipe
     ▼
Unix Socket: /var/run/docker.sock (Mac/Linux)
Named Pipe: \\.\pipe\docker_engine (Windows)
     │
     │ Docker daemon listens
     ▼
Docker Daemon
     │
     │ Manages containers
     ▼
containerd (Container Runtime)
     │
     ▼
Running Container (PostgreSQL)
```

### Example HTTP Requests

**List Containers:**
```http
GET /v1.43/containers/json?all=1
Host: localhost

Response:
[
  {
    "Id": "abc123...",
    "Names": ["/my-postgres"],
    "Image": "postgres:16-alpine",
    "State": "running",
    "Status": "Up 5 minutes",
    "Ports": [
      {
        "PrivatePort": 5432,
        "PublicPort": 5432,
        "Type": "tcp"
      }
    ]
  }
]
```

**Get Container Logs:**
```http
GET /v1.43/containers/abc123/logs?stdout=1&stderr=1&tail=100
Host: localhost

Response: (streaming)
PostgreSQL Database directory appears to contain a database; Skipping initialization
LOG:  database system was shut down at 2024-02-21 10:30:00 UTC
LOG:  database system is ready to accept connections
```

**Execute Command in Container:**
```http
POST /v1.43/containers/abc123/exec
Content-Type: application/json

{
  "AttachStdout": true,
  "AttachStderr": true,
  "Cmd": ["psql", "-U", "postgres", "-c", "SELECT version();"]
}
```

## Container Lifecycle Management

### Starting a Stopped Container
```typescript
async startContainer(id: string) {
  const container = docker.getContainer(id);
  await container.start();
  
  // Wait for healthy
  await this.waitForHealthy(id, port);
  
  // Update database
  storageService.updateDockerContainer(id, {
    status: 'running',
    lastStarted: new Date()
  });
}
```

### Stopping a Running Container
```typescript
async stopContainer(id: string) {
  const container = docker.getContainer(id);
  
  // Graceful shutdown (SIGTERM)
  await container.stop({ t: 10 }); // Wait 10 seconds
  
  // Update database
  storageService.updateDockerContainer(id, {
    status: 'stopped'
  });
}
```

### Removing a Container
```typescript
async removeContainer(id: string) {
  const container = docker.getContainer(id);
  
  // Force remove even if running
  await container.remove({ force: true });
  
  // Clean up database
  storageService.deleteDockerContainer(id);
  
  // Remove associated connection
  const connection = storageService.findConnectionByContainerId(id);
  if (connection) {
    storageService.deleteConnection(connection.id);
  }
}
```

## Supported Databases

### PostgreSQL
```typescript
{
  image: 'postgres:16-alpine',
  env: [
    'POSTGRES_PASSWORD=localdev',
    'POSTGRES_USER=postgres',
    'POSTGRES_DB=playground'
  ],
  port: 5432,
  healthCheck: 'SELECT 1'
}
```

### MySQL
```typescript
{
  image: 'mysql:8.0',
  env: [
    'MYSQL_ROOT_PASSWORD=localdev',
    'MYSQL_DATABASE=playground'
  ],
  port: 3306,
  healthCheck: 'SELECT 1'
}
```

### Cassandra
```typescript
{
  image: 'cassandra:5.0',
  env: [
    'MAX_HEAP_SIZE=512M',
    'HEAP_NEWSIZE=100M'
  ],
  port: 9042,
  healthCheck: 'SELECT * FROM system.local'
}
```

### MongoDB
```typescript
{
  image: 'mongo:7',
  env: [
    'MONGO_INITDB_ROOT_USERNAME=admin',
    'MONGO_INITDB_ROOT_PASSWORD=localdev'
  ],
  port: 27017,
  healthCheck: '{ ping: 1 }'
}
```

## Docker Desktop Requirements

**What users need:**
- Docker Desktop installed
- Docker daemon running
- Minimum 4GB RAM allocated to Docker
- 10GB free disk space

**If Docker not available:**
- App still works
- Docker features disabled
- Can connect to external databases
- Show helpful error message with install link

## Error Handling

```typescript
// Port already in use
if (portInUse) {
  return {
    success: false,
    error: 'Port 5432 is already in use',
    suggestion: 'Try port 5433 or stop the other container'
  };
}

// Image pull failed
if (pullError) {
  return {
    success: false,
    error: 'Failed to pull image from Docker Hub',
    suggestion: 'Check your internet connection'
  };
}

// Container failed to start
if (!healthy) {
  return {
    success: false,
    error: 'Database failed to start',
    logs: await this.getLogs(containerId),
    suggestion: 'Check container logs for details'
  };
}
```

## Performance Considerations

**Container Startup Times:**
- PostgreSQL: ~5-10 seconds
- MySQL: ~10-15 seconds
- Cassandra: ~30-60 seconds (heavier)
- MongoDB: ~5-10 seconds

**Resource Usage (per container):**
- PostgreSQL: ~50MB RAM
- MySQL: ~150MB RAM
- Cassandra: ~512MB RAM (configured)
- MongoDB: ~100MB RAM

## Next Steps

Continue to [Database Connections](04-database-connections.md) to learn how to connect to databases.
