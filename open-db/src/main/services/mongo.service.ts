/**
 * MongoDB via Docker exec - no mongodb npm package needed.
 * Executes mongosh inside running containers and parses JSON output.
 */
import Docker from 'dockerode'

const docker = new Docker()
const CONTAINER_ID_PATTERN = /^[a-f0-9]{12,64}$/i

export interface MongoResult {
  documents: Record<string, unknown>[]
  count: number
  executionTimeMs: number
}

class MongoService {
  /**
   * Execute a query inside a mongo container via mongosh --eval.
   * Accepts JSON-format query objects and shell-style db.collection.find(...) expressions.
   */
  async execute(containerId: string, rawQuery: string): Promise<MongoResult> {
    const start = Date.now()
    const evalExpr = this.buildEvalExpr(rawQuery)

    const stdout = await this.execInContainer(containerId, [
      'mongosh',
      '--quiet',
      '--norc',
      '--eval',
      evalExpr
    ])

    const documents = this.parseOutput(stdout)

    return {
      documents,
      count: documents.length,
      executionTimeMs: Date.now() - start
    }
  }

  async getDatabases(containerId: string): Promise<string[]> {
    const stdout = await this.execInContainer(containerId, [
      'mongosh',
      '--quiet',
      '--norc',
      '--eval',
      'EJSON.stringify(db.adminCommand({listDatabases:1}).databases.map(d => d.name))'
    ])

    try {
      const parsed = JSON.parse(stdout.trim())
      if (!Array.isArray(parsed)) return []
      return parsed.filter((n): n is string => typeof n === 'string' && !['admin', 'config', 'local'].includes(n))
    } catch {
      return []
    }
  }

  async getCollections(containerId: string, database = 'test'): Promise<Array<{ name: string; count: number }>> {
    const validatedDatabase = this.validateIdentifier(database, 'database')
    const stdout = await this.execInContainer(containerId, [
      'mongosh',
      '--quiet',
      '--norc',
      '--eval',
      `const _db = db.getSiblingDB(${JSON.stringify(validatedDatabase)}); EJSON.stringify(_db.getCollectionNames().map(n => ({name: n, count: _db.getCollection(n).estimatedDocumentCount()})))`
    ])

    try {
      const match = stdout.match(/(\[[\s\S]*\])/)
      if (!match) return []
      const parsed = JSON.parse(match[1])
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  async getFields(containerId: string, collection: string, database = 'test'): Promise<Array<{ name: string; type: string }>> {
    const validatedDatabase = this.validateIdentifier(database, 'database')
    const validatedCollection = this.validateIdentifier(collection, 'collection')
    const stdout = await this.execInContainer(containerId, [
      'mongosh',
      '--quiet',
      '--norc',
      '--eval',
      `const _db = db.getSiblingDB(${JSON.stringify(validatedDatabase)}); const _coll = _db.getCollection(${JSON.stringify(validatedCollection)}); const docs = _coll.find({}).limit(10).toArray(); const keys = {}; docs.forEach(d => Object.entries(d).forEach(([k, v]) => { if (!keys[k]) keys[k] = new Set(); keys[k].add(v === null ? 'null' : typeof v) })); EJSON.stringify(Object.entries(keys).map(([name, types]) => ({name, type: [...types].join(' | ')})))`
    ])

    try {
      const match = stdout.match(/(\[[\s\S]*\])/)
      if (!match) return []
      const parsed = JSON.parse(match[1])
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  private buildEvalExpr(raw: string): string {
    const trimmed = raw.trim()

    if (trimmed.startsWith('{')) {
      let parsed: {
        collection?: string
        op?: string
        filter?: unknown
        projection?: unknown
        limit?: number
        sort?: unknown
        pipeline?: unknown[]
        update?: unknown
        doc?: unknown
        database?: string
      }

      try {
        parsed = JSON.parse(trimmed) as {
          collection?: string
          op?: string
          filter?: unknown
          projection?: unknown
          limit?: number
          sort?: unknown
          pipeline?: unknown[]
          update?: unknown
          doc?: unknown
          database?: string
        }
      } catch {
        throw new Error('Invalid JSON query format')
      }

      const {
        collection,
        op = 'find',
        filter = {},
        projection,
        limit = 50,
        sort,
        pipeline,
        update,
        doc
      } = parsed

      if (!collection) throw new Error('Query must have "collection" field')
      const validatedCollection = this.validateIdentifier(collection, 'collection')
      const validatedDatabase = parsed.database
        ? this.validateIdentifier(parsed.database, 'database')
        : null

      const dbExpr = validatedDatabase
        ? `db.getSiblingDB(${JSON.stringify(validatedDatabase)})`
        : 'db'
      const collExpr = `${dbExpr}.getCollection(${JSON.stringify(validatedCollection)})`
      const filterExpr = `EJSON.deserialize(${JSON.stringify(filter)})`
      const projectionExpr = projection ? `EJSON.deserialize(${JSON.stringify(projection)})` : null
      const sortExpr = sort ? `EJSON.deserialize(${JSON.stringify(sort)})` : null
      const pipelineExpr = `EJSON.deserialize(${JSON.stringify(pipeline ?? [])})`
      const updateExpr = `EJSON.deserialize(${JSON.stringify(update ?? {})})`
      const docExpr = `EJSON.deserialize(${JSON.stringify(doc ?? {})})`

      switch (op) {
        case 'find': {
          const proj = projectionExpr ? `, ${projectionExpr}` : ''
          const lim = `.limit(${Math.min(limit, 500)})`
          const srt = sortExpr ? `.sort(${sortExpr})` : ''
          return `EJSON.stringify(${collExpr}.find(${filterExpr}${proj})${srt}${lim}.toArray())`
        }
        case 'findOne':
          return `EJSON.stringify([${collExpr}.findOne(${filterExpr})])`
        case 'countDocuments':
          return `EJSON.stringify([{count: ${collExpr}.countDocuments(${filterExpr})}])`
        case 'aggregate':
          return `EJSON.stringify(${collExpr}.aggregate(${pipelineExpr}).toArray())`
        case 'insertOne':
          return `EJSON.stringify([${collExpr}.insertOne(${docExpr})])`
        case 'updateOne':
        case 'updateMany':
          return `EJSON.stringify([${collExpr}.${op}(${filterExpr}, ${updateExpr})])`
        case 'deleteOne':
        case 'deleteMany':
          return `EJSON.stringify([${collExpr}.${op}(${filterExpr})])`
        default:
          throw new Error(`Unknown op: ${op}`)
      }
    }

    throw new Error('Only structured JSON Mongo queries are supported in GUI mode')
  }

  private async execInContainer(containerId: string, cmd: string[]): Promise<string> {
    const container = await this.getVerifiedMongoContainer(containerId)
    const exec = await container.exec({
      Cmd: cmd,
      AttachStdout: true,
      AttachStderr: true
    })

    return await new Promise((resolve, reject) => {
      exec.start({ hijack: true, stdin: false }, (err, stream) => {
        if (err || !stream) {
          reject(err ?? new Error('No stream from Docker exec'))
          return
        }

        let stdout = ''
        let stderr = ''

        // dockerode exposes demuxStream on modem for multiplexed exec output.
        ;(docker.modem as unknown as {
          demuxStream: (
            stream: NodeJS.ReadableStream,
            stdout: { write: (chunk: Buffer) => void },
            stderr: { write: (chunk: Buffer) => void }
          ) => void
        }).demuxStream(
          stream,
          { write: (chunk: Buffer) => { stdout += chunk.toString('utf8') } },
          { write: (chunk: Buffer) => { stderr += chunk.toString('utf8') } }
        )

        stream.on('end', () => {
          if (stderr.trim() && !stdout.trim()) {
            reject(new Error(stderr.trim()))
            return
          }
          resolve(stdout)
        })

        stream.on('error', reject)
      })
    })
  }

  private validateIdentifier(name: string, type: 'database' | 'collection'): string {
    const trimmed = name.trim()
    if (!trimmed) throw new Error(`Mongo ${type} name is required`)
    if (/[\0/\\"$]/.test(trimmed)) {
      throw new Error(`Invalid Mongo ${type} name: forbidden characters detected`)
    }
    if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(trimmed)) {
      throw new Error(`Invalid Mongo ${type} name: only letters, numbers, underscore, dot, and hyphen are allowed`)
    }
    return trimmed
  }

  private async getVerifiedMongoContainer(containerId: string): Promise<Docker.Container> {
    if (!CONTAINER_ID_PATTERN.test(containerId)) {
      throw new Error('Invalid container id')
    }

    const containers = await docker.listContainers({ all: true })
    const match = containers.find((c) => c.Id.startsWith(containerId) || containerId.startsWith(c.Id.slice(0, 12)))
    if (!match) {
      throw new Error('Container not found')
    }

    const image = (match.Image ?? '').toLowerCase()
    if (!image.includes('mongo')) {
      throw new Error('Container is not a MongoDB container')
    }
    if (match.State !== 'running') {
      throw new Error('MongoDB container is not running')
    }

    return docker.getContainer(match.Id)
  }

  private parseOutput(stdout: string): Record<string, unknown>[] {
    const text = stdout.trim()
    if (!text) return []

    const match = text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/)
    if (!match) return []

    try {
      const parsed = JSON.parse(match[1]) as unknown
      return Array.isArray(parsed)
        ? (parsed as Record<string, unknown>[])
        : [parsed as Record<string, unknown>]
    } catch {
      const lines = text.split('\n').filter((line) => line.trim().startsWith('{'))
      const docs: Record<string, unknown>[] = []
      for (const line of lines) {
        try {
          docs.push(JSON.parse(line) as Record<string, unknown>)
        } catch {
          // ignore non-JSON lines
        }
      }
      return docs
    }
  }
}

export const mongoService = new MongoService()
