/**
 * StorageService – local SQLite storage via sql.js (pure WASM, no native deps)
 */
import initSqlJs, { type Database } from 'sql.js'
import path from 'path'
import fs from 'fs'
import { app } from 'electron'

export interface ConnectionRecord {
  id: string
  name: string
  type: string
  host: string
  port: number
  username: string | null
  password: string | null
  database_name: string | null
  docker_container_id: string | null
  created_at: string
}

class StorageService {
  private db!: Database
  private dbPath!: string

  async initialize(): Promise<void> {
    const userDataPath = app.getPath('userData')
    this.dbPath = path.join(userDataPath, 'opendb.sqlite')

    const SQL = await initSqlJs()

    if (fs.existsSync(this.dbPath)) {
      const buf = fs.readFileSync(this.dbPath)
      this.db = new SQL.Database(buf)
    } else {
      this.db = new SQL.Database()
    }

    this.createSchema()
    this.deduplicateConnections()
    this.persist()
    console.log('[Storage] initialized at', this.dbPath)
  }

  // ── Connections ──

  getConnections(): ConnectionRecord[] {
    const stmt = this.db.prepare('SELECT * FROM connections ORDER BY created_at DESC')
    const rows: ConnectionRecord[] = []
    while (stmt.step()) rows.push(stmt.getAsObject() as unknown as ConnectionRecord)
    stmt.free()
    return rows
  }

  saveConnection(c: ConnectionRecord): void {
    this.db.run(
      `INSERT OR REPLACE INTO connections
         (id, name, type, host, port, username, password, database_name, docker_container_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [c.id, c.name, c.type, c.host, c.port, c.username, c.password, c.database_name, c.docker_container_id]
    )
    this.persist()
  }

  deleteConnection(id: string): void {
    this.db.run('DELETE FROM connections WHERE id = ?', [id])
    this.persist()
  }

  // ── Query History ──

  saveQueryHistory(connectionId: string, sql: string, timeMs: number, rows: number): void {
    this.db.run(
      'INSERT INTO query_history (connection_id, query, execution_time_ms, rows_affected) VALUES (?,?,?,?)',
      [connectionId, sql, timeMs, rows]
    )
    this.persist()
  }

  getQueryHistory(connectionId: string, limit = 50): Record<string, unknown>[] {
    const stmt = this.db.prepare(
      'SELECT * FROM query_history WHERE connection_id = ? ORDER BY executed_at DESC LIMIT ?'
    )
    stmt.bind([connectionId, limit])
    const rows: Record<string, unknown>[] = []
    while (stmt.step()) rows.push(stmt.getAsObject())
    stmt.free()
    return rows
  }

  // ── Schema ──

  /** Remove duplicate connections (keep the most recent by created_at) */
  private deduplicateConnections(): void {
    this.db.run(`
      DELETE FROM connections WHERE id NOT IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY host, port, database_name ORDER BY created_at DESC) AS rn
          FROM connections
        ) WHERE rn = 1
      )
    `)
  }

  private createSchema(): void {
    this.db.run(`CREATE TABLE IF NOT EXISTS connections (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL,
      host TEXT NOT NULL, port INTEGER NOT NULL,
      username TEXT, password TEXT, database_name TEXT,
      docker_container_id TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`)

    this.db.run(`CREATE TABLE IF NOT EXISTS query_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      connection_id TEXT NOT NULL, query TEXT NOT NULL,
      executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      execution_time_ms INTEGER, rows_affected INTEGER,
      FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE
    )`)

    this.db.run(`CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY, value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`)

    this.db.run('CREATE INDEX IF NOT EXISTS idx_qh_conn ON query_history(connection_id)')
  }

  private persist(): void {
    const data = this.db.export()
    fs.writeFileSync(this.dbPath, Buffer.from(data))
  }
}

export const storageService = new StorageService()
