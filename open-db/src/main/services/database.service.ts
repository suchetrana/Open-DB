/**
 * DatabaseService – manages live database connections and query execution
 */
import { Pool } from 'pg'
type MySqlPool = {
  end: () => Promise<void>
  getConnection: () => Promise<{ query: (sql: string) => Promise<unknown>; release: () => void }>
  query: (sql: string, values?: unknown[]) => Promise<[unknown, unknown]>
}

export type DatabaseDriver = 'postgres' | 'mysql'

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
  type: DatabaseDriver
  host: string
  port: number
  user: string
  password: string
  database: string
}

interface ActiveConnection {
  type: DatabaseDriver
  pool: Pool | MySqlPool
}

class DatabaseService {
  private pools = new Map<string, ActiveConnection>()
  private configs = new Map<string, ConnectionConfig>()

  async connect(
    id: string,
    type: DatabaseDriver,
    host: string,
    port: number,
    user: string,
    password: string,
    database: string
  ): Promise<void> {
    if (this.pools.has(id)) {
      await this.disconnect(id)
    }

    if (type === 'mysql') {
      const mysql = await import('mysql2')
      const pool = mysql.createPool({
        host,
        port,
        user,
        password,
        database,
        waitForConnections: true,
        connectionLimit: 10,
        connectTimeout: 5000,
      }).promise() as MySqlPool
      const conn = await pool.getConnection()
      await conn.query('SELECT 1')
      conn.release()
      this.pools.set(id, { type, pool })
      this.configs.set(id, { type, host, port, user, password, database })
      console.log(`[DB] Connected (${type}) ${id} → ${host}:${port}/${database}`)
      return
    }

    const pool = new Pool({ host, port, user, password, database, max: 10, connectionTimeoutMillis: 5000 })
    const client = await pool.connect()
    await client.query('SELECT 1')
    client.release()
    this.pools.set(id, { type, pool })
    this.configs.set(id, { type, host, port, user, password, database })
    console.log(`[DB] Connected (${type}) ${id} → ${host}:${port}/${database}`)
  }

  /** Switch to a different database on the same server (Beekeeper-style) */
  async switchDatabase(connectionId: string, newDatabase: string): Promise<void> {
    const cfg = this.configs.get(connectionId)
    if (!cfg) throw new Error(`No config for ${connectionId}`)

    // Save config before disconnect (disconnect clears it)
    const { type, host, port, user, password } = cfg

    // Disconnect existing pool (only end pool, keep config intent)
    const active = this.pools.get(connectionId)
    if (active) {
      await active.pool.end()
      this.pools.delete(connectionId)
    }
    this.configs.delete(connectionId)

    // Reconnect with new database
    await this.connect(connectionId, type, host, port, user, password, newDatabase)
    console.log(`[DB] Switched ${connectionId} → ${newDatabase}`)
  }

  async executeQuery(connectionId: string, sql: string): Promise<QueryResult> {
    const active = this.pools.get(connectionId)
    if (!active) throw new Error(`No pool for ${connectionId}`)

    const start = performance.now()
    if (active.type === 'mysql') {
      const pool = active.pool as MySqlPool
      const [rows, fields] = await pool.query(sql)
      const elapsed = Math.round(performance.now() - start)

      const normalizedRows: Record<string, unknown>[] = Array.isArray(rows)
        ? (rows as Array<Record<string, unknown>>).map((r) => ({ ...r }))
        : []

      const headers = fields as Array<{ name: string }> | undefined
      const columns = headers?.map((f) => f.name) ?? []

      const rowCount = Array.isArray(rows)
        ? rows.length
        : ((rows as { affectedRows?: number }).affectedRows ?? 0)

      return {
        columns,
        rows: normalizedRows,
        rowCount,
        executionTimeMs: elapsed,
      }
    }

    const pool = active.pool as Pool
    const res = await pool.query(sql)
    const elapsed = Math.round(performance.now() - start)

    return {
      columns: res.fields.map((f) => f.name),
      rows: res.rows,
      rowCount: res.rowCount ?? 0,
      executionTimeMs: elapsed,
    }
  }

  async disconnect(id: string): Promise<void> {
    const active = this.pools.get(id)
    if (active) {
      await active.pool.end()
      this.pools.delete(id)
    }
    this.configs.delete(id)
  }

  async testConnection(type: DatabaseDriver, host: string, port: number, user: string, password: string, database: string): Promise<boolean> {
    try {
      if (type === 'mysql') {
        const mysql = await import('mysql2')
        const conn = mysql.createConnection({
          host,
          port,
          user,
          password,
          database,
          connectTimeout: 5000,
        }).promise()
        await conn.query('SELECT 1')
        await conn.end()
        return true
      }

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
    const active = this.pools.get(connectionId)
    if (!active) throw new Error(`No pool for ${connectionId}`)

    if (active.type === 'mysql') {
      const pool = active.pool as MySqlPool
      const [rows] = await pool.query('SHOW DATABASES')
      return (rows as Array<{ Database: string }>).map((r: { Database: string }) => String(r.Database))
    }

    const pool = active.pool as Pool
    const res = await pool.query(
      `SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname`
    )
    return res.rows.map((r: Record<string, unknown>) => r.datname as string)
  }

  async getSchemas(connectionId: string): Promise<SchemaInfo[]> {
    const active = this.pools.get(connectionId)
    if (!active) throw new Error(`No pool for ${connectionId}`)

    if (active.type === 'mysql') {
      const pool = active.pool as MySqlPool
      const [rows] = await pool.query(
        `SELECT schema_name as name FROM information_schema.schemata
         WHERE schema_name NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
         ORDER BY schema_name`
      )
      return (rows as Array<{ name: string }>).map((r: { name: string }) => ({ name: String(r.name) }))
    }

    const pool = active.pool as Pool
    const res = await pool.query(
      `SELECT schema_name as name FROM information_schema.schemata
       WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
       ORDER BY schema_name`
    )
    return res.rows as SchemaInfo[]
  }

  async getTables(connectionId: string, schema: string): Promise<TableInfo[]> {
    const active = this.pools.get(connectionId)
    if (!active) throw new Error(`No pool for ${connectionId}`)

    if (active.type === 'mysql') {
      const pool = active.pool as MySqlPool
      const [rows] = await pool.query(
        `SELECT
           table_schema as schema,
           table_name as name,
           CASE WHEN table_type = 'VIEW' THEN 'view' ELSE 'table' END as type,
           COALESCE(table_rows, 0) as rowEstimate
         FROM information_schema.tables
         WHERE table_schema = ?
         ORDER BY table_type, table_name`,
        [schema]
      )
      return (rows as Array<{ schema: string; name: string; type: string; rowEstimate: number }>).map((r: { schema: string; name: string; type: string; rowEstimate: number }) => ({
        schema: String(r.schema),
        name: String(r.name),
        type: (r.type === 'view' ? 'view' : 'table') as 'table' | 'view',
        rowEstimate: Number(r.rowEstimate ?? 0),
      }))
    }

    const pool = active.pool as Pool
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
    const active = this.pools.get(connectionId)
    if (!active) throw new Error(`No pool for ${connectionId}`)

    if (active.type === 'mysql') {
      const pool = active.pool as MySqlPool
      const [rows] = await pool.query(
        `SELECT
           c.column_name as name,
           c.data_type as dataType,
           (c.is_nullable = 'YES') as nullable,
           c.column_default as defaultValue,
           (c.column_key = 'PRI') as isPrimaryKey
         FROM information_schema.columns c
         WHERE c.table_schema = ? AND c.table_name = ?
         ORDER BY c.ordinal_position`,
        [schema, table]
      )
      return (rows as Array<{ name: string; dataType: string; nullable: unknown; defaultValue: unknown; isPrimaryKey: unknown }>).map((r: { name: string; dataType: string; nullable: unknown; defaultValue: unknown; isPrimaryKey: unknown }) => ({
        name: String(r.name),
        dataType: String(r.dataType),
        nullable: Boolean(r.nullable),
        defaultValue: r.defaultValue == null ? null : String(r.defaultValue),
        isPrimaryKey: Boolean(r.isPrimaryKey),
      }))
    }

    const pool = active.pool as Pool
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
