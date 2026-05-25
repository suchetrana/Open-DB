/**
 * Redis IPC handlers — bridges renderer to redisService via Docker exec.
 */
import { ipcMain } from 'electron'
import { redisService } from '../services/redis.service'

export function registerRedisHandlers(): void {
  const register = (channel: string, handler: Parameters<typeof ipcMain.handle>[1]) => {
    ipcMain.removeHandler(channel)
    ipcMain.handle(channel, handler)
  }

  register('redis:info', async (_event, containerId: string, password?: string) => {
    return redisService.getInfo(containerId, password)
  })

  register('redis:get-databases', async (_event, containerId: string, password?: string) => {
    return redisService.getDatabases(containerId, password)
  })

  register('redis:scan-keys', async (_event, containerId: string, pattern?: string, cursor?: string, count?: number, db?: number, password?: string) => {
    return redisService.scanKeys(containerId, pattern ?? '*', cursor ?? '0', count ?? 100, db ?? 0, password)
  })

  register('redis:get-key-type', async (_event, containerId: string, key: string, db?: number, password?: string) => {
    return redisService.getKeyType(containerId, key, db ?? 0, password)
  })

  register('redis:get-key-ttl', async (_event, containerId: string, key: string, db?: number, password?: string) => {
    return redisService.getKeyTTL(containerId, key, db ?? 0, password)
  })

  register('redis:get-key-value', async (_event, containerId: string, key: string, type: string, db?: number, password?: string) => {
    return redisService.getKeyValue(containerId, key, type, db ?? 0, password)
  })

  register('redis:set-key-value', async (_event, containerId: string, key: string, value: string, db?: number, password?: string) => {
    return redisService.setKeyValue(containerId, key, value, db ?? 0, password)
  })

  register('redis:delete-key', async (_event, containerId: string, key: string, db?: number, password?: string) => {
    return redisService.deleteKey(containerId, key, db ?? 0, password)
  })

  register('redis:set-key-ttl', async (_event, containerId: string, key: string, ttl: number, db?: number, password?: string) => {
    return redisService.setKeyTTL(containerId, key, ttl, db ?? 0, password)
  })

  register('redis:get-db-size', async (_event, containerId: string, db?: number, password?: string) => {
    return redisService.getDbSize(containerId, db ?? 0, password)
  })

  register('redis:get-key-metadata', async (_event, containerId: string, key: string, db?: number, password?: string) => {
    return redisService.getKeyMetadata(containerId, key, db ?? 0, password)
  })

  register(
    'redis:get-key-page',
    async (
      _event,
      containerId: string,
      key: string,
      type: string,
      cursor?: string,
      offset?: number,
      limit?: number,
      db?: number,
      password?: string
    ) => {
      return redisService.getKeyPage(
        containerId,
        key,
        type,
        cursor ?? '0',
        offset ?? 0,
        limit ?? 200,
        db ?? 0,
        password
      )
    }
  )

  register('redis:string-append', async (_event, containerId: string, key: string, value: string, db?: number, password?: string) => {
    return redisService.stringAppend(containerId, key, value, db ?? 0, password)
  })

  register('redis:string-incr', async (_event, containerId: string, key: string, delta?: number, db?: number, password?: string) => {
    return redisService.stringIncr(containerId, key, delta ?? 1, db ?? 0, password)
  })

  register('redis:list-push', async (_event, containerId: string, key: string, values: string[], position?: 'left' | 'right', db?: number, password?: string) => {
    return redisService.listPush(containerId, key, values ?? [], position ?? 'right', db ?? 0, password)
  })

  register('redis:list-pop', async (_event, containerId: string, key: string, position?: 'left' | 'right', count?: number, db?: number, password?: string) => {
    return redisService.listPop(containerId, key, position ?? 'right', count ?? 1, db ?? 0, password)
  })

  register('redis:list-set', async (_event, containerId: string, key: string, index: number, value: string, db?: number, password?: string) => {
    return redisService.listSet(containerId, key, index, value, db ?? 0, password)
  })

  register('redis:hash-set', async (_event, containerId: string, key: string, field: string, value: string, db?: number, password?: string) => {
    return redisService.hashSet(containerId, key, field, value, db ?? 0, password)
  })

  register('redis:hash-set-many', async (_event, containerId: string, key: string, entries: Array<{ field: string; value: string }>, db?: number, password?: string) => {
    return redisService.hashSetMany(containerId, key, entries ?? [], db ?? 0, password)
  })

  register('redis:hash-delete', async (_event, containerId: string, key: string, fields: string[], db?: number, password?: string) => {
    return redisService.hashDelete(containerId, key, fields ?? [], db ?? 0, password)
  })

  register('redis:set-add', async (_event, containerId: string, key: string, members: string[], db?: number, password?: string) => {
    return redisService.setAdd(containerId, key, members ?? [], db ?? 0, password)
  })

  register('redis:set-remove', async (_event, containerId: string, key: string, members: string[], db?: number, password?: string) => {
    return redisService.setRemove(containerId, key, members ?? [], db ?? 0, password)
  })

  register('redis:zset-add', async (_event, containerId: string, key: string, member: string, score: number, db?: number, password?: string) => {
    return redisService.zsetAdd(containerId, key, member, score, db ?? 0, password)
  })

  register('redis:zset-add-many', async (_event, containerId: string, key: string, entries: Array<{ member: string; score: number }>, db?: number, password?: string) => {
    return redisService.zsetAddMany(containerId, key, entries ?? [], db ?? 0, password)
  })

  register('redis:zset-remove', async (_event, containerId: string, key: string, members: string[], db?: number, password?: string) => {
    return redisService.zsetRemove(containerId, key, members ?? [], db ?? 0, password)
  })
}
