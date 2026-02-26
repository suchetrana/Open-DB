/**
 * DatabaseService – manages live database connections and query execution
 */
import { Pool } from 'pg'

export interface QueryResult {
  columns: string[]
  rows: Record<string, unknown>[]
  rowCount: number
  executionTimeMs: number
}

export interface SchemaInfo {
  name: string
}

export interface TableInfo {
  schema: string
  name: string
  type: 'table' | 'view'
  rowEstimate: number
}

export interface ColumnInfo {
  name: string
  dataType: string
  nullable: boolean
  defaultValue: string | null
  isPrimaryKey: boolean
}

interface ConnectionConfig {
  host: string
  port: number
  user: string
  password: string
  database: string
}

class DatabaseService {
  private pools = new Map<string, Pool>()
  private configs = new Map<string, ConnectionConfig>()

  async connect(id: string, host: string, port: number, user: string, password: string, database: string): Promise<void> {
    if (this.pools.has(id)) {
      await this.disconnect(id)
    }

    const pool = new Pool({ host, port, user, password, database, max: 10, connectionTimeoutMillis: 5000 })
    const client = await pool.connect()
    await client.query('SELECT 1')
    client.release()
    this.pools.set(id, pool)
    this.configs.set(id, { host, port, user, password, database })
    console.log(`[DB] Connected ${id} → ${host}:${port}/${database}`)
  }

  /** Switch to a different database on the same server (Beekeeper-style) */
  async switchDatabase(connectionId: string, newDatabase: string): Promise<void> {
    const cfg = this.configs.get(connectionId)
    if (!cfg) throw new Error(`No config for ${connectionId}`)

    // Save config before disconnect (disconnect clears it)
    const { host, port, user, password } = cfg

    // Disconnect existing pool (only end pool, keep config intent)
    const pool = this.pools.get(connectionId)
    if (pool) {
      await pool.end()
      this.pools.delete(connectionId)
    }
    this.configs.delete(connectionId)

    // Reconnect with new database
    await this.connect(connectionId, host, port, user, password, newDatabase)
    console.log(`[DB] Switched ${connectionId} → ${newDatabase}`)
  }

  async executeQuery(connectionId: string, sql: string): Promise<QueryResult> {
    const pool = this.pools.get(connectionId)
    if (!pool) throw new Error(`No pool for ${connectionId}`)

    const start = performance.now()
    const res = await pool.query(sql)
    const elapsed = Math.round(performance.now() - start)

    return {
      columns: res.fields.map((f) => f.name),
      rows: res.rows,
      rowCount: res.rowCount ?? 0,
      executionTimeMs: elapsed
    }
  }

  async disconnect(id: string): Promise<void> {
    const pool = this.pools.get(id)
    if (pool) {
      await pool.end()
      this.pools.delete(id)
    }
    this.configs.delete(id)
  }

  async testConnection(host: string, port: number, user: string, password: string, database: string): Promise<boolean> {
    try {
      const pool = new Pool({ host, port, user, password, database, max: 1, connectionTimeoutMillis: 5000 })
      const client = await pool.connect()
      await client.query('SELECT 1')
      client.release()
      await pool.end()
      return true
    } catch {
      return false
    }
  }

  // ── Introspection ──

  async getDatabases(connectionId: string): Promise<string[]> {
    const pool = this.pools.get(connectionId)
    if (!pool) throw new Error(`No pool for ${connectionId}`)
    const res = await pool.query(
      `SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname`
    )
    return res.rows.map((r: Record<string, unknown>) => r.datname as string)
  }

  async getSchemas(connectionId: string): Promise<SchemaInfo[]> {
    const pool = this.pools.get(connectionId)
    if (!pool) throw new Error(`No pool for ${connectionId}`)
    const res = await pool.query(
      `SELECT schema_name as name FROM information_schema.schemata
       WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
       ORDER BY schema_name`
    )
    return res.rows as SchemaInfo[]
  }

  async getTables(connectionId: string, schema: string): Promise<TableInfo[]> {
    const pool = this.pools.get(connectionId)
    if (!pool) throw new Error(`No pool for ${connectionId}`)
    const res = await pool.query(
      `SELECT
         t.table_schema as schema,
         t.table_name as name,
         CASE WHEN t.table_type = 'VIEW' THEN 'view' ELSE 'table' END as type,
         COALESCE(c.reltuples, 0)::bigint as "rowEstimate"
       FROM information_schema.tables t
       LEFT JOIN pg_namespace n ON n.nspname = t.table_schema
       LEFT JOIN pg_class c ON c.relname = t.table_name AND c.relnamespace = n.oid
       WHERE t.table_schema = $1
       ORDER BY t.table_type, t.table_name`,
      [schema]
    )
    return res.rows as TableInfo[]
  }

  async getColumns(connectionId: string, schema: string, table: string): Promise<ColumnInfo[]> {
    const pool = this.pools.get(connectionId)
    if (!pool) throw new Error(`No pool for ${connectionId}`)
    const res = await pool.query(
      `SELECT
         c.column_name as name,
         c.data_type as "dataType",
         (c.is_nullable = 'YES') as nullable,
         c.column_default as "defaultValue",
         COALESCE(
           (SELECT true FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            WHERE tc.constraint_type = 'PRIMARY KEY'
              AND tc.table_schema = $1
              AND tc.table_name = $2
              AND kcu.column_name = c.column_name
            LIMIT 1),
           false
         ) as "isPrimaryKey"
       FROM information_schema.columns c
       WHERE c.table_schema = $1 AND c.table_name = $2
       ORDER BY c.ordinal_position`,
      [schema, table]
    )
    return res.rows as ColumnInfo[]
  }
}

export const databaseService = new DatabaseService()
