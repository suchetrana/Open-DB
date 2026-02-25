/**
 * Database IPC Handlers
 */
import { ipcMain } from 'electron'
import { databaseService } from '../services/database.service'
import { storageService } from '../services/storage.service'

export function registerDatabaseHandlers(): void {
  ipcMain.handle(
    'db:connect',
    async (_e, connectionId: string, host: string, port: number, user: string, password: string, database: string) => {
      await databaseService.connect(connectionId, host, port, user, password, database)
      return { ok: true }
    }
  )

  ipcMain.handle('db:disconnect', async (_e, connectionId: string) => {
    await databaseService.disconnect(connectionId)
    return { ok: true }
  })

  ipcMain.handle('db:execute-query', async (_e, connectionId: string, sql: string) => {
    const result = await databaseService.executeQuery(connectionId, sql)
    // Save to history
    storageService.saveQueryHistory(connectionId, sql, result.executionTimeMs, result.rowCount)
    return result
  })

  ipcMain.handle(
    'db:test-connection',
    async (_e, host: string, port: number, user: string, password: string, database: string) => {
      return databaseService.testConnection(host, port, user, password, database)
    }
  )

  // ── Stored Connections ──

  ipcMain.handle('db:get-connections', () => {
    // Map storage ConnectionRecord → renderer Connection shape
    return storageService.getConnections().map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      host: c.host,
      port: c.port,
      username: c.username,
      database: c.database_name,
      isConnected: false,
      dockerContainerId: c.docker_container_id
    }))
  })

  ipcMain.handle('db:save-connection', (_e, connection: Record<string, unknown>) => {
    // Map renderer Connection fields → storage ConnectionRecord fields
    storageService.saveConnection({
      id: connection.id as string,
      name: connection.name as string,
      type: connection.type as string,
      host: connection.host as string,
      port: connection.port as number,
      username: (connection.username as string) ?? null,
      password: null,
      database_name: (connection.database as string) ?? null,
      docker_container_id: (connection.dockerContainerId as string) ?? null,
      created_at: new Date().toISOString()
    })
    return { ok: true }
  })

  ipcMain.handle('db:delete-connection', (_e, id: string) => {
    storageService.deleteConnection(id)
    return { ok: true }
  })

  ipcMain.handle('db:get-query-history', (_e, connectionId: string, limit?: number) => {
    return storageService.getQueryHistory(connectionId, limit)
  })

  // ── Introspection ──

  ipcMain.handle('db:get-databases', async (_e, connectionId: string) => {
    return databaseService.getDatabases(connectionId)
  })

  ipcMain.handle('db:get-schemas', async (_e, connectionId: string) => {
    return databaseService.getSchemas(connectionId)
  })

  ipcMain.handle('db:get-tables', async (_e, connectionId: string, schema: string) => {
    return databaseService.getTables(connectionId, schema)
  })

  ipcMain.handle('db:get-columns', async (_e, connectionId: string, schema: string, table: string) => {
    return databaseService.getColumns(connectionId, schema, table)
  })
}
