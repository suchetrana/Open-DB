/**
 * Type declarations for the preload-exposed electronAPI
 * (available at window.electronAPI in the renderer)
 */
import type { electronAPI } from './index'

declare global {
  interface Window {
    electronAPI: typeof electronAPI & {
      mongo: {
        execute(containerId: string, query: string): Promise<{ documents: Record<string, unknown>[]; count: number; executionTimeMs: number }>
        getDatabases(containerId: string): Promise<string[]>
        getCollections(containerId: string, database?: string): Promise<Array<{ name: string; count: number }>>
        getFields(containerId: string, collection: string, database?: string): Promise<Array<{ name: string; type: string }>>
      }
      redis: {
        getInfo(containerId: string, password?: string): Promise<Record<string, string>>
        getDatabases(containerId: string, password?: string): Promise<Array<{ index: number; keys: number }>>
        scanKeys(containerId: string, pattern?: string, cursor?: string, count?: number, db?: number, password?: string): Promise<{ cursor: string; keys: Array<{ key: string; type: string; ttl: number }> }>
        getKeyType(containerId: string, key: string, db?: number, password?: string): Promise<string>
        stringAppend(containerId: string, key: string, value: string, db?: number, password?: string): Promise<number>
        stringIncr(containerId: string, key: string, delta?: number, db?: number, password?: string): Promise<number>
        listPush(containerId: string, key: string, values: string[], position?: 'left' | 'right', db?: number, password?: string): Promise<number>
        listPop(containerId: string, key: string, position?: 'left' | 'right', count?: number, db?: number, password?: string): Promise<string[]>
        listSet(containerId: string, key: string, index: number, value: string, db?: number, password?: string): Promise<string>
        hashSet(containerId: string, key: string, field: string, value: string, db?: number, password?: string): Promise<number>
        hashSetMany(containerId: string, key: string, entries: Array<{ field: string; value: string }>, db?: number, password?: string): Promise<number>
        hashDelete(containerId: string, key: string, fields: string[], db?: number, password?: string): Promise<number>
        setAdd(containerId: string, key: string, members: string[], db?: number, password?: string): Promise<number>
        setRemove(containerId: string, key: string, members: string[], db?: number, password?: string): Promise<number>
        zsetAdd(containerId: string, key: string, member: string, score: number, db?: number, password?: string): Promise<number>
        zsetAddMany(containerId: string, key: string, entries: Array<{ member: string; score: number }>, db?: number, password?: string): Promise<number>
        zsetRemove(containerId: string, key: string, members: string[], db?: number, password?: string): Promise<number>
        getKeyTTL(containerId: string, key: string, db?: number, password?: string): Promise<number>
        getKeyValue(containerId: string, key: string, type: string, db?: number, password?: string): Promise<{ type: string; value: unknown; ttl: number; size: number }>
        setKeyValue(containerId: string, key: string, value: string, db?: number, password?: string): Promise<string>
        deleteKey(containerId: string, key: string, db?: number, password?: string): Promise<number>
        setKeyTTL(containerId: string, key: string, ttl: number, db?: number, password?: string): Promise<string>
        getDbSize(containerId: string, db?: number, password?: string): Promise<number>
        getKeyMetadata(containerId: string, key: string, db?: number, password?: string): Promise<{ key: string; type: string; ttl: number; size: number; encoding: string | null; refCount: number | null; idleSeconds: number | null; lfuFreq: number | null; length: number | null }>
        getKeyPage(containerId: string, key: string, type: string, cursor?: string, offset?: number, limit?: number, db?: number, password?: string): Promise<{ type: string; cursor: string; pageStart: number; pageSize: number; totalApprox: number; items: unknown[] }>
      }
    }
  }
}
