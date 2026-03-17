/**
 * MongoDB via Docker exec - no mongodb npm package needed.
 * Executes mongosh inside running containers and parses JSON output.
 */
import Docker from 'dockerode'

const docker = new Docker()

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
    const stdout = await this.execInContainer(containerId, [
      'mongosh',
      '--quiet',
      '--norc',
      '--eval',
      `use ${database}; EJSON.stringify(db.getCollectionNames().map(n => ({name: n, count: db.getCollection(n).estimatedDocumentCount()})))`
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
    const stdout = await this.execInContainer(containerId, [
      'mongosh',
      '--quiet',
      '--norc',
      '--eval',
      `use ${database}; const docs = db.${collection}.find({}).limit(10).toArray(); const keys = {}; docs.forEach(d => Object.entries(d).forEach(([k, v]) => { if (!keys[k]) keys[k] = new Set(); keys[k].add(v === null ? 'null' : typeof v) })); EJSON.stringify(Object.entries(keys).map(([name, types]) => ({name, type: [...types].join(' | ')})))`
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

      const dbPrefix = parsed.database ? `use ${parsed.database}; ` : ''
      const f = JSON.stringify(filter)

      switch (op) {
        case 'find': {
          const proj = projection ? `, ${JSON.stringify(projection)}` : ''
          const lim = `.limit(${Math.min(limit, 500)})`
          const srt = sort ? `.sort(${JSON.stringify(sort)})` : ''
          return `${dbPrefix}EJSON.stringify(db.${collection}.find(${f}${proj})${srt}${lim}.toArray())`
        }
        case 'findOne':
          return `${dbPrefix}EJSON.stringify([db.${collection}.findOne(${f})])`
        case 'countDocuments':
          return `${dbPrefix}EJSON.stringify([{count: db.${collection}.countDocuments(${f})}])`
        case 'aggregate': {
          const pipe = JSON.stringify(pipeline ?? [])
          return `${dbPrefix}EJSON.stringify(db.${collection}.aggregate(${pipe}).toArray())`
        }
        case 'insertOne':
          return `${dbPrefix}EJSON.stringify([db.${collection}.insertOne(${JSON.stringify(doc ?? {})})])`
        case 'updateOne':
        case 'updateMany': {
          const upd = JSON.stringify(update ?? {})
          return `${dbPrefix}EJSON.stringify([db.${collection}.${op}(${f}, ${upd})])`
        }
        case 'deleteOne':
        case 'deleteMany':
          return `${dbPrefix}EJSON.stringify([db.${collection}.${op}(${f})])`
        default:
          throw new Error(`Unknown op: ${op}`)
      }
    }

    if (trimmed.startsWith('db.')) {
      if (trimmed.includes('EJSON.stringify')) return trimmed

      if (/\.(find|aggregate)\s*\(/.test(trimmed)) {
        const withToArray = trimmed
          .replace(/\)\s*$/, '.toArray())')
          .replace(/\.toArray\(\)\.toArray\(\)/, '.toArray()')
        return `EJSON.stringify(${withToArray})`
      }

      return `EJSON.stringify([${trimmed}])`
    }

    return trimmed
  }

  private async execInContainer(containerId: string, cmd: string[]): Promise<string> {
    const container = docker.getContainer(containerId)
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
