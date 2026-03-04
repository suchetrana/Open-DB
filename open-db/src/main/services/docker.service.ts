/**
 * DockerService – manages Docker containers via dockerode
 *
 * Inspired by VS Code's Docker extension pattern:
 *   - Check daemon availability
 *   - Pull images, create/start/stop/remove containers
 *   - Stream exec sessions for terminal integration
 */
import Docker from 'dockerode'
import type { Container } from 'dockerode'

export type DatabaseType = 'postgres' | 'mysql' | 'mongodb' | 'redis'
export type ContainerStatus = 'running' | 'starting' | 'stopped'

export interface ContainerInfo {
  id: string
  name: string
  image: string
  status: ContainerStatus
  port: number
  type: DatabaseType
  createdAt: string
}

export interface CreateContainerOpts {
  name: string
  type: DatabaseType
  port?: number
  password?: string
}

const IMAGE_MAP: Record<DatabaseType, string> = {
  postgres: 'postgres:16-alpine',
  mysql: 'mysql:8.0',
  mongodb: 'mongo:7',
  redis: 'redis:7-alpine'
}

const DEFAULT_PORT: Record<DatabaseType, number> = {
  postgres: 5432,
  mysql: 3306,
  mongodb: 27017,
  redis: 6379
}

class DockerService {
  private docker: Docker
  private _available = false

  constructor() {
    const socketPath =
      process.platform === 'win32'
        ? '//./pipe/docker_engine'
        : '/var/run/docker.sock'
    this.docker = new Docker({ socketPath })
  }

  get available(): boolean {
    return this._available
  }

  /** Ping daemon – called once at startup */
  async initialize(): Promise<boolean> {
    return this.checkStatus()
  }

  /** Re-ping daemon – can be called anytime to refresh availability */
  async checkStatus(): Promise<boolean> {
    try {
      await this.docker.ping()
      this._available = true
      console.log('[Docker] daemon connected')
      return true
    } catch {
      this._available = false
      console.warn('[Docker] daemon not available – Docker features disabled')
      return false
    }
  }

  /** List all database containers (postgres, mysql, mongo, redis) */
  async listContainers(): Promise<ContainerInfo[]> {
    if (!this._available) return []
    const all = await this.docker.listContainers({ all: true })
    const dbImages = ['postgres', 'mysql', 'mariadb', 'mongo', 'redis', 'cassandra', 'cockroach', 'timescale', 'supabase']
    return all
      .filter((c) => {
        const img = c.Image.toLowerCase()
        return dbImages.some((db) => img.includes(db)) || c.Names.some((n) => n.startsWith('/opendb-'))
      })
      .map((c) => ({
        id: c.Id.slice(0, 12),
        name: c.Names[0].replace('/', ''),
        image: c.Image,
        status: this.toStatus(c.State),
        port: c.Ports[0]?.PublicPort ?? 0,
        type: this.inferType(c.Image),
        createdAt: new Date(c.Created * 1000).toISOString()
      }))
  }

  /** Pull image + create + start a container */
  async createContainer(
    opts: CreateContainerOpts,
    onProgress?: (msg: string) => void
  ): Promise<ContainerInfo> {
    const image = IMAGE_MAP[opts.type]
    const containerPort = DEFAULT_PORT[opts.type]
    const hostPort = opts.port ?? containerPort
    const password = opts.password ?? 'localdev'

    // Pull image
    onProgress?.(`Pulling ${image}…`)
    await new Promise<void>((resolve, reject) => {
      this.docker.pull(image, (err: Error | null, stream: NodeJS.ReadableStream) => {
        if (err) return reject(err)
        this.docker.modem.followProgress(
          stream,
          (e: Error | null) => (e ? reject(e) : resolve()),
          (event: { status?: string }) => onProgress?.(event.status ?? '')
        )
      })
    })

    // Create container
    onProgress?.('Creating container…')
    const container = await this.docker.createContainer({
      Image: image,
      name: `opendb-${opts.name}`,
      Env: this.envFor(opts.type, password),
      ExposedPorts: { [`${containerPort}/tcp`]: {} },
      HostConfig: {
        PortBindings: {
          [`${containerPort}/tcp`]: [{ HostPort: String(hostPort) }]
        },
        RestartPolicy: { Name: 'unless-stopped' }
      }
    })

    // Start
    onProgress?.('Starting container…')
    await container.start()

    // Wait for healthy (try connecting)
    onProgress?.('Waiting for database to be ready…')
    await this.waitForReady(opts.type, hostPort, password)

    onProgress?.('Ready!')
    return {
      id: container.id.slice(0, 12),
      name: `opendb-${opts.name}`,
      image,
      status: 'running',
      port: hostPort,
      type: opts.type,
      createdAt: new Date().toISOString()
    }
  }

  async startContainer(id: string): Promise<void> {
    await this.getContainer(id).start()
  }

  async stopContainer(id: string): Promise<void> {
    await this.getContainer(id).stop({ t: 10 })
  }

  async removeContainer(id: string): Promise<void> {
    await this.getContainer(id).remove({ force: true })
  }

  /** Get container logs (last N lines) */
  async getLogs(id: string, tail = 200): Promise<string> {
    const buf = await this.getContainer(id).logs({
      stdout: true,
      stderr: true,
      tail,
      follow: false
    })
    return buf.toString('utf-8')
  }

  /**
   * Create a Docker exec session and return the duplex stream.
   * This powers the interactive terminal inside OpenDB Studio –
   * same approach VS Code's Docker extension uses.
   */
  async createExecStream(
    id: string,
    cmd: string[] = ['/bin/sh']
  ): Promise<NodeJS.ReadWriteStream> {
    const container = this.getContainer(id)
    const exec = await container.exec({
      Cmd: cmd,
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true
    })
    const stream = await exec.start({ hijack: true, stdin: true, Tty: true })
    return stream
  }

  // ── private helpers ──

  private getContainer(id: string): Container {
    return this.docker.getContainer(id)
  }

  private envFor(type: DatabaseType, password: string): string[] {
    switch (type) {
      case 'postgres':
        return [`POSTGRES_PASSWORD=${password}`, 'POSTGRES_USER=postgres', 'POSTGRES_DB=playground']
      case 'mysql':
        return [`MYSQL_ROOT_PASSWORD=${password}`, 'MYSQL_DATABASE=playground']
      case 'mongodb':
        return [`MONGO_INITDB_ROOT_USERNAME=admin`, `MONGO_INITDB_ROOT_PASSWORD=${password}`]
      case 'redis':
        return password !== 'localdev' ? [`REDIS_PASSWORD=${password}`] : []
    }
  }

  private toStatus(state: string): ContainerStatus {
    if (state === 'running') return 'running'
    if (state === 'created' || state === 'restarting') return 'starting'
    return 'stopped'
  }

  private inferType(image: string): DatabaseType {
    if (image.startsWith('postgres')) return 'postgres'
    if (image.startsWith('mysql')) return 'mysql'
    if (image.startsWith('mongo')) return 'mongodb'
    return 'redis'
  }

  /** Retry-connect to validate the container is ready */
  private async waitForReady(type: DatabaseType, port: number, password: string): Promise<void> {
    const maxAttempts = 30
    for (let i = 0; i < maxAttempts; i++) {
      try {
        if (type === 'postgres') {
          const { Client } = await import('pg')
          const client = new Client({
            host: '127.0.0.1',
            port,
            user: 'postgres',
            password,
            database: 'postgres',
            connectionTimeoutMillis: 2000
          })
          await client.connect()
          await client.query('SELECT 1')
          await client.end()
          return
        }
        // For non-postgres, just wait a fixed time
        await this.sleep(2000)
        return
      } catch {
        await this.sleep(1000)
      }
    }
    throw new Error('Container failed to become ready after 30 s')
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms))
  }
}

export const dockerService = new DockerService()
