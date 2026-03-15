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

export interface IndexInfo {
  name: string
  columns: string[]
  isUnique: boolean
  isPrimary: boolean
  type: string
  definition: string
}

export interface RelationInfo {
  name: string
  sourceColumn: string
  targetSchema: string
  targetTable: string
  targetColumn: string
  onUpdate: string
  onDelete: string
}

export interface TriggerInfo {
  name: string
  event: string
  timing: string
  definition: string
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

  async getIndexes(connectionId: string, schema: string, table: string): Promise<IndexInfo[]> {
    const active = this.pools.get(connectionId)
    if (!active) throw new Error(`No pool for ${connectionId}`)

    if (active.type === 'mysql') {
      const pool = active.pool as MySqlPool
      const [rows] = await pool.query(
        `SELECT
           index_name as name,
           GROUP_CONCAT(column_name ORDER BY seq_in_index SEPARATOR ',') as columnsCsv,
           (non_unique = 0) as isUnique,
           (index_name = 'PRIMARY') as isPrimary,
           index_type as type,
           CONCAT(index_name, ' ON ', table_name) as definition
         FROM information_schema.statistics
         WHERE table_schema = ? AND table_name = ?
         GROUP BY index_name, non_unique, index_type, table_name
         ORDER BY index_name`,
        [schema, table]
      )
      return (rows as Array<{ name: string; columnsCsv: string | null; isUnique: unknown; isPrimary: unknown; type: string; definition: string }>).map((r: { name: string; columnsCsv: string | null; isUnique: unknown; isPrimary: unknown; type: string; definition: string }) => ({
        name: String(r.name),
        columns: r.columnsCsv ? String(r.columnsCsv).split(',').map((c) => c.trim()).filter(Boolean) : [],
        isUnique: Boolean(r.isUnique),
        isPrimary: Boolean(r.isPrimary),
        type: String(r.type ?? 'btree'),
        definition: String(r.definition ?? ''),
      }))
    }

    const pool = active.pool as Pool

    const res = await pool.query(
      `SELECT
         idx.indexname AS name,
         COALESCE(
           array_agg(pg_get_indexdef(i.oid, gs.k, true) ORDER BY gs.k) FILTER (WHERE gs.k IS NOT NULL),
           '{}'::text[]
         ) AS columns,
         pi.indisunique AS "isUnique",
         pi.indisprimary AS "isPrimary",
         COALESCE(am.amname, 'btree') AS type,
         idx.indexdef AS definition
       FROM pg_indexes idx
       JOIN pg_class t ON t.relname = idx.tablename
       JOIN pg_namespace tn ON tn.oid = t.relnamespace AND tn.nspname = idx.schemaname
       JOIN pg_class i ON i.relname = idx.indexname
       JOIN pg_namespace ins ON ins.oid = i.relnamespace AND ins.nspname = idx.schemaname
       JOIN pg_index pi ON pi.indexrelid = i.oid AND pi.indrelid = t.oid
       LEFT JOIN pg_am am ON am.oid = i.relam
       LEFT JOIN LATERAL generate_series(1, pi.indnatts) AS gs(k) ON true
       WHERE idx.schemaname = $1
         AND idx.tablename = $2
       GROUP BY idx.indexname, pi.indisunique, pi.indisprimary, am.amname, idx.indexdef
       ORDER BY idx.indexname`,
      [schema, table]
    )

    return res.rows as IndexInfo[]
  }

  async getRelations(connectionId: string, schema: string, table: string): Promise<RelationInfo[]> {
    const active = this.pools.get(connectionId)
    if (!active) throw new Error(`No pool for ${connectionId}`)

    if (active.type === 'mysql') {
      const pool = active.pool as MySqlPool
      const [rows] = await pool.query(
        `SELECT
           rc.constraint_name AS name,
           kcu.column_name AS sourceColumn,
           kcu.referenced_table_schema AS targetSchema,
           kcu.referenced_table_name AS targetTable,
           kcu.referenced_column_name AS targetColumn,
           rc.update_rule AS onUpdate,
           rc.delete_rule AS onDelete
         FROM information_schema.referential_constraints rc
         JOIN information_schema.key_column_usage kcu
           ON rc.constraint_name = kcu.constraint_name
          AND rc.constraint_schema = kcu.constraint_schema
         WHERE kcu.table_schema = ?
           AND kcu.table_name = ?
         ORDER BY rc.constraint_name, kcu.ordinal_position`,
        [schema, table]
      )
      return (rows as Array<RelationInfo>).map((r: RelationInfo) => ({
        name: String(r.name),
        sourceColumn: String((r as unknown as Record<string, unknown>).sourceColumn ?? ''),
        targetSchema: String((r as unknown as Record<string, unknown>).targetSchema ?? ''),
        targetTable: String((r as unknown as Record<string, unknown>).targetTable ?? ''),
        targetColumn: String((r as unknown as Record<string, unknown>).targetColumn ?? ''),
        onUpdate: String((r as unknown as Record<string, unknown>).onUpdate ?? ''),
        onDelete: String((r as unknown as Record<string, unknown>).onDelete ?? ''),
      }))
    }

    const pool = active.pool as Pool

    const res = await pool.query(
      `SELECT
         con.conname AS name,
         src_att.attname AS "sourceColumn",
         ref_ns.nspname AS "targetSchema",
         ref_tbl.relname AS "targetTable",
         ref_att.attname AS "targetColumn",
         CASE con.confupdtype
           WHEN 'a' THEN 'NO ACTION'
           WHEN 'r' THEN 'RESTRICT'
           WHEN 'c' THEN 'CASCADE'
           WHEN 'n' THEN 'SET NULL'
           WHEN 'd' THEN 'SET DEFAULT'
           ELSE 'NO ACTION'
         END AS "onUpdate",
         CASE con.confdeltype
           WHEN 'a' THEN 'NO ACTION'
           WHEN 'r' THEN 'RESTRICT'
           WHEN 'c' THEN 'CASCADE'
           WHEN 'n' THEN 'SET NULL'
           WHEN 'd' THEN 'SET DEFAULT'
           ELSE 'NO ACTION'
         END AS "onDelete"
       FROM pg_constraint con
       JOIN pg_class src_tbl ON src_tbl.oid = con.conrelid
       JOIN pg_namespace src_ns ON src_ns.oid = src_tbl.relnamespace
       JOIN pg_class ref_tbl ON ref_tbl.oid = con.confrelid
       JOIN pg_namespace ref_ns ON ref_ns.oid = ref_tbl.relnamespace
       JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS src_key(attnum, ord) ON true
       JOIN LATERAL unnest(con.confkey) WITH ORDINALITY AS ref_key(attnum, ord) ON ref_key.ord = src_key.ord
       JOIN pg_attribute src_att ON src_att.attrelid = src_tbl.oid AND src_att.attnum = src_key.attnum
       JOIN pg_attribute ref_att ON ref_att.attrelid = ref_tbl.oid AND ref_att.attnum = ref_key.attnum
       WHERE con.contype = 'f'
         AND src_ns.nspname = $1
         AND src_tbl.relname = $2
       ORDER BY con.conname, src_key.ord`,
      [schema, table]
    )

    return res.rows as RelationInfo[]
  }

  async getTriggers(connectionId: string, schema: string, table: string): Promise<TriggerInfo[]> {
    const active = this.pools.get(connectionId)
    if (!active) throw new Error(`No pool for ${connectionId}`)

    if (active.type === 'mysql') {
      const pool = active.pool as MySqlPool
      const [rows] = await pool.query(
        `SELECT
           trigger_name AS name,
           event_manipulation AS event,
           action_timing AS timing,
           action_statement AS definition
         FROM information_schema.triggers
         WHERE trigger_schema = ?
           AND event_object_table = ?
         ORDER BY trigger_name`,
        [schema, table]
      )
      return (rows as Array<TriggerInfo>).map((r: TriggerInfo) => ({
        name: String(r.name),
        event: String((r as unknown as Record<string, unknown>).event ?? ''),
        timing: String((r as unknown as Record<string, unknown>).timing ?? ''),
        definition: String((r as unknown as Record<string, unknown>).definition ?? ''),
      }))
    }

    const pool = active.pool as Pool

    const res = await pool.query(
      `SELECT
         trigger_name AS name,
         event_manipulation AS event,
         action_timing AS timing,
         action_statement AS definition
       FROM information_schema.triggers
       WHERE event_object_schema = $1
         AND event_object_table = $2
       ORDER BY trigger_name`,
      [schema, table]
    )

    return res.rows as TriggerInfo[]
  }
}

export const databaseService = new DatabaseService()
