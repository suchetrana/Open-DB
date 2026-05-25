/**
 * Redis via Docker exec — no redis npm package needed.
 * Executes redis-cli inside running containers and parses output.
 */
import Docker from 'dockerode'
import { storageService } from './storage.service'

const docker = new Docker()

const CONTAINER_ID_PATTERN = /^[a-f0-9]{12,64}$/i

export interface RedisExecResult {
  output: string
  executionTimeMs: number
}

export interface RedisScanResult {
  cursor: string
  keys: Array<{ key: string; type: string; ttl: number }>
}

export interface RedisKeyValue {
  type: string
  value: string | string[] | Record<string, string> | Array<{ member: string; score: string }>
  ttl: number
  size: number
}

export interface RedisKeyMetadata {
  key: string
  type: string
  ttl: number
  size: number
  encoding: string | null
  refCount: number | null
  idleSeconds: number | null
  lfuFreq: number | null
  length: number | null
}

export interface RedisPageResult {
  type: string
  cursor: string
  pageStart: number
  pageSize: number
  totalApprox: number
  items: string[] | Array<{ field: string; value: string }> | Array<{ member: string; score: string }>
}

class RedisService {
  private readonly cachedPasswords = new Map<string, { password?: string; expiresAt: number }>()
  private readonly passwordCacheTtlMs = RedisService.parsePositiveInt(process.env.REDIS_PASSWORD_CACHE_TTL_MS, 5 * 60 * 1000)
  private readonly cacheSweepIntervalMs = RedisService.parsePositiveInt(process.env.REDIS_PASSWORD_CACHE_SWEEP_MS, 60 * 1000)
  private readonly cacheSweepTimer: NodeJS.Timeout
  private readonly execTimeoutMs = Number(process.env.REDIS_EXEC_TIMEOUT_MS ?? 15000)

  constructor() {
    this.cacheSweepTimer = setInterval(() => {
      this.sweepExpiredPasswordCache()
    }, this.cacheSweepIntervalMs)
  }

  /**
   * Execute a pre-tokenized command only; raw command strings are blocked at IPC layer.
   */
  async execute(containerId: string, command: string | string[], db = 0, password?: string): Promise<RedisExecResult> {
    const start = Date.now()
    const tokens = Array.isArray(command) ? [...command] : this.parseCommandString(command)
    const [op] = tokens
    const safeAllowList = new Set(['PING', 'INFO', 'GET', 'SET', 'TTL', 'TYPE', 'SCAN'])
    if (!op || !safeAllowList.has(op.toUpperCase())) {
      throw new Error('Raw redis execute is restricted to a small safe allow-list')
    }

    const stdout = await this.execRedis(containerId, db, password, ...tokens)
    return {
      output: stdout.trim(),
      executionTimeMs: Date.now() - start
    }
  }

  /**
   * Get Redis server info.
   */
  async getInfo(containerId: string, password?: string): Promise<Record<string, string>> {
    const stdout = await this.execRedis(containerId, 0, password, 'INFO')

    const info: Record<string, string> = {}
    for (const line of stdout.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const idx = trimmed.indexOf(':')
      if (idx > 0) {
        info[trimmed.slice(0, idx)] = trimmed.slice(idx + 1)
      }
    }
    return info
  }

  /**
   * Get available databases that have keys.
   */
  async getDatabases(containerId: string, password?: string): Promise<Array<{ index: number; keys: number }>> {
    const stdout = await this.execRedis(containerId, 0, password, 'INFO', 'keyspace')

    const dbs: Array<{ index: number; keys: number }> = []
    for (const line of stdout.split('\n')) {
      const match = line.match(/^db(\d+):keys=(\d+)/)
      if (match) {
        dbs.push({ index: parseInt(match[1], 10), keys: parseInt(match[2], 10) })
      }
    }

    // Always include db0 even if empty
    if (!dbs.some((d) => d.index === 0)) {
      dbs.unshift({ index: 0, keys: 0 })
    }

    return dbs.sort((a, b) => a.index - b.index)
  }

  /**
   * Scan keys with pattern matching and pagination.
   */
  async scanKeys(
    containerId: string,
    pattern = '*',
    cursor = '0',
    count = 100,
    db = 0,
    password?: string
  ): Promise<RedisScanResult> {
    const safeCount = Math.max(1, Math.min(1000, count))
    const stdout = await this.execRedis(
      containerId,
      db,
      password,
      'SCAN',
      cursor,
      'MATCH',
      pattern,
      'COUNT',
      String(safeCount)
    )

    const lines = stdout.replace(/\r/g, '').split('\n')
    const firstLine = (lines[0] ?? '').trim()

    if (!firstLine) {
      throw new Error('Unexpected empty response from Redis SCAN')
    }
    if (firstLine.startsWith('(error)')) {
      throw new Error(firstLine.replace(/^\(error\)\s*/, ''))
    }

    const newCursor = firstLine
    const keyNames = lines.slice(1).filter((k) => k.length > 0)

    // Batch fetch TYPE/TTL in one redis-cli call using Lua to avoid per-key docker exec overhead.
    const keys: Array<{ key: string; type: string; ttl: number }> = []
    if (keyNames.length > 0) {
      for (const key of keyNames) {
        keys.push({ key, type: 'unknown', ttl: -1 })
      }

      try {
        const script = [
          'local out = {}',
          'for i = 1, #ARGV do',
          '  local k = ARGV[i]',
          '  local t = redis.call("TYPE", k)',
          '  local tv = t',
          '  if type(t) == "table" and t.ok then tv = t.ok end',
          '  local ttl = redis.call("TTL", k)',
          '  table.insert(out, k)',
          '  table.insert(out, tostring(tv))',
          '  table.insert(out, tostring(ttl))',
          'end',
          'return out',
        ].join(' ')
        const batch = await this.execRedis(containerId, db, password, 'EVAL', script, '0', ...keyNames)
        const lines = batch.trim() ? batch.trim().split('\n') : []
        const lookup = new Map<string, { type: string; ttl: number }>()
        for (let i = 0; i < lines.length - 2; i += 3) {
          const key = lines[i]
          const keyType = lines[i + 1] || 'unknown'
          const ttl = this.tryParseInt(lines[i + 2]) ?? -1
          lookup.set(key, { type: keyType, ttl })
        }
        for (let i = 0; i < keys.length; i++) {
          const meta = lookup.get(keys[i].key)
          if (meta) {
            keys[i] = { key: keys[i].key, type: meta.type, ttl: meta.ttl }
          }
        }
      } catch {
        // Keep scan result resilient even when metadata enrichment fails.
      }
    }

    return { cursor: newCursor, keys }
  }

  /**
   * Get the type of a key.
   */
  async getKeyType(containerId: string, key: string, db = 0, password?: string): Promise<string> {
    const stdout = await this.execRedis(containerId, db, password, 'TYPE', key)
    return stdout.trim()
  }

  /**
   * Get the TTL of a key.
   */
  async getKeyTTL(containerId: string, key: string, db = 0, password?: string): Promise<number> {
    const stdout = await this.execRedis(containerId, db, password, 'TTL', key)
    return parseInt(stdout.trim(), 10)
  }

  /**
   * Get a key's value based on its type.
   */
  async getKeyValue(containerId: string, key: string, type: string, db = 0, password?: string): Promise<RedisKeyValue> {
    if (type !== 'string') {
      throw new Error('Use redis:get-key-page for non-string key types')
    }

    let value: RedisKeyValue['value']
    const stdout = await this.execRedis(containerId, db, password, 'GET', key)
    value = stdout.trimEnd()

    // Get TTL and memory usage
    const [ttlOut, memOut] = await Promise.all([
      this.execRedis(containerId, db, password, 'TTL', key),
      this.execRedis(containerId, db, password, 'MEMORY', 'USAGE', key).catch(() => '-1')
    ])

    return {
      type,
      value,
      ttl: parseInt(ttlOut.trim(), 10),
      size: parseInt(typeof memOut === 'string' ? memOut.trim() : '-1', 10)
    }
  }

  /**
   * Set a key's value (string type).
   */
  async setKeyValue(containerId: string, key: string, value: string, db = 0, password?: string): Promise<string> {
    const stdout = await this.execRedis(containerId, db, password, 'SET', key, value)
    return stdout.trim()
  }

  async stringAppend(containerId: string, key: string, value: string, db = 0, password?: string): Promise<number> {
    const stdout = await this.execRedis(containerId, db, password, 'APPEND', key, value)
    return parseInt(stdout.trim(), 10)
  }

  async stringIncr(containerId: string, key: string, delta: number, db = 0, password?: string): Promise<number> {
    const stdout = await this.execRedis(containerId, db, password, 'INCRBY', key, String(delta))
    return parseInt(stdout.trim(), 10)
  }

  async listPush(
    containerId: string,
    key: string,
    values: string[],
    position: 'left' | 'right' = 'right',
    db = 0,
    password?: string
  ): Promise<number> {
    if (!values.length) return this.getListLength(containerId, key, db, password)
    const op = position === 'left' ? 'LPUSH' : 'RPUSH'
    const stdout = await this.execRedis(containerId, db, password, op, key, ...values)
    return parseInt(stdout.trim(), 10)
  }

  async listPop(
    containerId: string,
    key: string,
    position: 'left' | 'right' = 'right',
    count = 1,
    db = 0,
    password?: string
  ): Promise<string[]> {
    const op = position === 'left' ? 'LPOP' : 'RPOP'
    const cmd = [op, key]
    if (count > 1) cmd.push(String(count))
    const stdout = await this.execRedis(containerId, db, password, ...cmd)
    const trimmed = stdout.trim()
    if (!trimmed) return []
    return trimmed.split('\n')
  }

  async listSet(containerId: string, key: string, index: number, value: string, db = 0, password?: string): Promise<string> {
    const stdout = await this.execRedis(containerId, db, password, 'LSET', key, String(index), value)
    return stdout.trim()
  }

  async hashSet(containerId: string, key: string, field: string, value: string, db = 0, password?: string): Promise<number> {
    const stdout = await this.execRedis(containerId, db, password, 'HSET', key, field, value)
    return parseInt(stdout.trim(), 10)
  }

  async hashSetMany(containerId: string, key: string, entries: Array<{ field: string; value: string }>, db = 0, password?: string): Promise<number> {
    if (!entries.length) return 0
    const args: string[] = ['HSET', key]
    for (const entry of entries) {
      args.push(entry.field, entry.value)
    }
    const stdout = await this.execRedis(containerId, db, password, ...args)
    return parseInt(stdout.trim(), 10)
  }

  async hashDelete(containerId: string, key: string, fields: string[], db = 0, password?: string): Promise<number> {
    if (!fields.length) return 0
    const stdout = await this.execRedis(containerId, db, password, 'HDEL', key, ...fields)
    return parseInt(stdout.trim(), 10)
  }

  async setAdd(containerId: string, key: string, members: string[], db = 0, password?: string): Promise<number> {
    if (!members.length) return 0
    const stdout = await this.execRedis(containerId, db, password, 'SADD', key, ...members)
    return parseInt(stdout.trim(), 10)
  }

  async setRemove(containerId: string, key: string, members: string[], db = 0, password?: string): Promise<number> {
    if (!members.length) return 0
    const stdout = await this.execRedis(containerId, db, password, 'SREM', key, ...members)
    return parseInt(stdout.trim(), 10)
  }

  async zsetAdd(containerId: string, key: string, member: string, score: number, db = 0, password?: string): Promise<number> {
    const stdout = await this.execRedis(containerId, db, password, 'ZADD', key, String(score), member)
    return parseInt(stdout.trim(), 10)
  }

  async zsetAddMany(containerId: string, key: string, entries: Array<{ member: string; score: number }>, db = 0, password?: string): Promise<number> {
    if (!entries.length) return 0
    const args: string[] = ['ZADD', key]
    for (const entry of entries) {
      args.push(String(entry.score), entry.member)
    }
    const stdout = await this.execRedis(containerId, db, password, ...args)
    return parseInt(stdout.trim(), 10)
  }

  async zsetRemove(containerId: string, key: string, members: string[], db = 0, password?: string): Promise<number> {
    if (!members.length) return 0
    const stdout = await this.execRedis(containerId, db, password, 'ZREM', key, ...members)
    return parseInt(stdout.trim(), 10)
  }

  /**
   * Delete a key.
   */
  async deleteKey(containerId: string, key: string, db = 0, password?: string): Promise<number> {
    const stdout = await this.execRedis(containerId, db, password, 'DEL', key)
    return parseInt(stdout.trim(), 10)
  }

  /**
   * Set TTL on a key (seconds). Pass -1 to remove TTL.
   */
  async setKeyTTL(containerId: string, key: string, ttl: number, db = 0, password?: string): Promise<string> {
    if (ttl < 0) {
      const stdout = await this.execRedis(containerId, db, password, 'PERSIST', key)
      return stdout.trim()
    }
    const stdout = await this.execRedis(containerId, db, password, 'EXPIRE', key, String(ttl))
    return stdout.trim()
  }

  /**
   * Get DBSIZE for a specific database.
   */
  async getDbSize(containerId: string, db = 0, password?: string): Promise<number> {
    const stdout = await this.execRedis(containerId, db, password, 'DBSIZE')
    return parseInt(stdout.trim(), 10) || 0
  }

  async getKeyMetadata(containerId: string, key: string, db = 0, password?: string): Promise<RedisKeyMetadata> {
    const [typeOut, ttlOut, memOut, encodingOut, refCountOut, idleOut, freqOut] = await Promise.all([
      this.execRedis(containerId, db, password, 'TYPE', key),
      this.execRedis(containerId, db, password, 'TTL', key),
      this.execRedis(containerId, db, password, 'MEMORY', 'USAGE', key).catch(() => '-1'),
      this.execRedis(containerId, db, password, 'OBJECT', 'ENCODING', key).catch(() => ''),
      this.execRedis(containerId, db, password, 'OBJECT', 'REFCOUNT', key).catch(() => ''),
      this.execRedis(containerId, db, password, 'OBJECT', 'IDLETIME', key).catch(() => ''),
      this.execRedis(containerId, db, password, 'OBJECT', 'FREQ', key).catch(() => ''),
    ])

    const type = typeOut.trim()
    const length = await this.getTypeLength(containerId, key, type, db, password)

    return {
      key,
      type,
      ttl: parseInt(ttlOut.trim(), 10),
      size: this.tryParseInt(memOut) ?? -1,
      encoding: encodingOut.trim() || null,
      refCount: this.tryParseInt(refCountOut),
      idleSeconds: this.tryParseInt(idleOut),
      lfuFreq: this.tryParseInt(freqOut),
      length,
    }
  }

  async getKeyPage(
    containerId: string,
    key: string,
    type: string,
    cursor = '0',
    offset = 0,
    limit = 200,
    db = 0,
    password?: string
  ): Promise<RedisPageResult> {
    const safeLimit = Math.max(1, Math.min(1000, limit))

    if (type === 'list') {
      const [lenOut, pageOut] = await Promise.all([
        this.execRedis(containerId, db, password, 'LLEN', key),
        this.execRedis(containerId, db, password, 'LRANGE', key, String(offset), String(offset + safeLimit - 1))
      ])
      const total = parseInt(lenOut.trim(), 10) || 0
      const items = pageOut.trim() ? pageOut.trim().split('\n') : []
      const nextCursor = offset + safeLimit < total ? String(offset + safeLimit) : '0'
      return {
        type,
        cursor: nextCursor,
        pageStart: offset,
        pageSize: safeLimit,
        totalApprox: total,
        items,
      }
    }

    if (type === 'hash') {
      const [lenOut, pageOut] = await Promise.all([
        this.execRedis(containerId, db, password, 'HLEN', key),
        this.execRedis(containerId, db, password, 'HSCAN', key, cursor, 'COUNT', String(safeLimit))
      ])
      const total = parseInt(lenOut.trim(), 10) || 0
      const lines = pageOut.trim() ? pageOut.trim().split('\n') : []
      const nextCursor = lines[0] || '0'
      const pairs: Array<{ field: string; value: string }> = []
      for (let i = 1; i < lines.length - 1; i += 2) {
        pairs.push({ field: lines[i], value: lines[i + 1] ?? '' })
      }
      if (pairs.length === 0 && total > 0 && cursor === '0') {
        const fallback = await this.execRedis(containerId, db, password, 'HGETALL', key)
        const fallbackLines = fallback.trim() ? fallback.trim().split('\n') : []
        for (let i = 0; i < fallbackLines.length - 1; i += 2) {
          pairs.push({ field: fallbackLines[i], value: fallbackLines[i + 1] ?? '' })
        }
      }
      return {
        type,
        cursor: nextCursor,
        pageStart: 0,
        pageSize: safeLimit,
        totalApprox: total,
        items: pairs,
      }
    }

    if (type === 'set') {
      const [lenOut, pageOut] = await Promise.all([
        this.execRedis(containerId, db, password, 'SCARD', key),
        this.execRedis(containerId, db, password, 'SSCAN', key, cursor, 'COUNT', String(safeLimit))
      ])
      const total = parseInt(lenOut.trim(), 10) || 0
      const lines = pageOut.trim() ? pageOut.trim().split('\n') : []
      const nextCursor = lines[0] || '0'
      let items = lines.slice(1).filter((x) => x.trim().length > 0)
      if (items.length === 0 && total > 0 && cursor === '0') {
        const fallback = await this.execRedis(containerId, db, password, 'SMEMBERS', key)
        items = fallback.trim() ? fallback.trim().split('\n').filter((x) => x.trim().length > 0) : []
      }
      return {
        type,
        cursor: nextCursor,
        pageStart: 0,
        pageSize: safeLimit,
        totalApprox: total,
        items,
      }
    }

    if (type === 'zset') {
      const [lenOut, pageOut] = await Promise.all([
        this.execRedis(containerId, db, password, 'ZCARD', key),
        this.execRedis(containerId, db, password, 'ZSCAN', key, cursor, 'COUNT', String(safeLimit))
      ])
      const total = parseInt(lenOut.trim(), 10) || 0
      const lines = pageOut.trim() ? pageOut.trim().split('\n') : []
      const nextCursor = lines[0] || '0'
      const items: Array<{ member: string; score: string }> = []
      for (let i = 1; i + 1 < lines.length; i += 2) {
        items.push({ member: lines[i], score: lines[i + 1] })
      }
      if ((lines.length - 1) % 2 !== 0) {
        throw new Error('Malformed ZSCAN response: unpaired member/score in output')
      }
      if (items.length === 0 && total > 0 && cursor === '0') {
        const fallback = await this.execRedis(containerId, db, password, 'ZRANGE', key, '0', '-1', 'WITHSCORES')
        const fallbackLines = fallback.trim() ? fallback.trim().split('\n') : []
        for (let i = 0; i + 1 < fallbackLines.length; i += 2) {
          items.push({ member: fallbackLines[i], score: fallbackLines[i + 1] })
        }
      }
      return {
        type,
        cursor: nextCursor,
        pageStart: 0,
        pageSize: safeLimit,
        totalApprox: total,
        items,
      }
    }

    if (type === 'string') {
      const out = await this.execRedis(containerId, db, password, 'GET', key)
      return {
        type,
        cursor: '0',
        pageStart: 0,
        pageSize: 1,
        totalApprox: 1,
        items: [out.trimEnd()],
      }
    }

    return {
      type,
      cursor: '0',
      pageStart: 0,
      pageSize: 0,
      totalApprox: 0,
      items: [],
    }
  }

  private async getListLength(containerId: string, key: string, db = 0, password?: string): Promise<number> {
    const stdout = await this.execRedis(containerId, db, password, 'LLEN', key)
    return parseInt(stdout.trim(), 10) || 0
  }

  private async getTypeLength(containerId: string, key: string, type: string, db = 0, password?: string): Promise<number | null> {
    try {
      if (type === 'string') {
        const out = await this.execRedis(containerId, db, password, 'STRLEN', key)
        return parseInt(out.trim(), 10)
      }
      if (type === 'list') {
        const out = await this.execRedis(containerId, db, password, 'LLEN', key)
        return parseInt(out.trim(), 10)
      }
      if (type === 'hash') {
        const out = await this.execRedis(containerId, db, password, 'HLEN', key)
        return parseInt(out.trim(), 10)
      }
      if (type === 'set') {
        const out = await this.execRedis(containerId, db, password, 'SCARD', key)
        return parseInt(out.trim(), 10)
      }
      if (type === 'zset') {
        const out = await this.execRedis(containerId, db, password, 'ZCARD', key)
        return parseInt(out.trim(), 10)
      }
      return null
    } catch {
      return null
    }
  }

  private tryParseInt(value: unknown): number | null {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null
    if (typeof value !== 'string') return null
    const parsed = parseInt(value.trim(), 10)
    return Number.isFinite(parsed) ? parsed : null
  }

  private parseCommandString(command: string): string[] {
    const tokens: string[] = []
    let current = ''
    let quote: 'single' | 'double' | null = null
    let escaped = false

    for (let i = 0; i < command.length; i++) {
      const ch = command[i]
      if (escaped) {
        current += ch
        escaped = false
        continue
      }

      if (ch === '\\') {
        escaped = true
        continue
      }

      if (quote === 'single') {
        if (ch === "'") {
          quote = null
        } else {
          current += ch
        }
        continue
      }

      if (quote === 'double') {
        if (ch === '"') {
          quote = null
        } else {
          current += ch
        }
        continue
      }

      if (ch === "'") {
        quote = 'single'
        continue
      }

      if (ch === '"') {
        quote = 'double'
        continue
      }

      if (/\s/.test(ch)) {
        if (current) {
          tokens.push(current)
          current = ''
        }
        continue
      }

      current += ch
    }

    if (quote) {
      throw new Error('Invalid command: unmatched quote')
    }
    if (escaped) {
      throw new Error('Invalid command: trailing escape')
    }
    if (current) tokens.push(current)
    return tokens
  }

  private async execRedis(containerId: string, db: number, password: string | undefined, ...args: string[]): Promise<string> {
    const resolvedPassword = await this.resolveRedisPassword(containerId, password)
    const cmd = this.buildRedisCommand(db, resolvedPassword, args)
    return this.execInContainer(containerId, cmd)
  }

  private buildRedisCommand(db: number, password: string | undefined, args: string[]): string[] {
    const cmd: string[] = ['redis-cli', '--no-auth-warning', '--raw', '-n', String(db)]
    if (password) {
      cmd.push('-a', password)
    }
    cmd.push(...args)
    return cmd
  }

  private async resolveRedisPassword(containerId: string, provided?: string): Promise<string | undefined> {
    if (provided) return provided
    const cached = this.cachedPasswords.get(containerId)
    if (cached) {
      if (cached.expiresAt > Date.now()) {
        return cached.password
      }
      this.cachedPasswords.delete(containerId)
    }

    const fromConnection = storageService
      .getConnections()
      .find((c) => c.type === 'redis' && !!c.password && !!c.docker_container_id && this.matchesContainerId(c.docker_container_id, containerId))

    if (fromConnection?.password) {
      this.setCachedPassword(containerId, fromConnection.password)
      return fromConnection.password
    }

    const verifiedContainer = await this.getVerifiedRedisContainer(containerId)
    const inspect = await verifiedContainer.inspect()
    const env = inspect.Config?.Env ?? []
    const envPassword = env.find((line) => line.startsWith('REDIS_PASSWORD='))?.slice('REDIS_PASSWORD='.length)
    this.setCachedPassword(containerId, envPassword)
    return envPassword
  }

  invalidateCachedPassword(containerIdPrefix: string): void {
    const normalizedPrefix = containerIdPrefix.toLowerCase()
    for (const key of this.cachedPasswords.keys()) {
      const normalizedKey = key.toLowerCase()
      if (normalizedKey.startsWith(normalizedPrefix) || normalizedPrefix.startsWith(normalizedKey)) {
        this.cachedPasswords.delete(key)
      }
    }
  }

  clearCachedPasswords(): void {
    this.cachedPasswords.clear()
  }

  private setCachedPassword(containerId: string, password?: string): void {
    this.cachedPasswords.set(containerId, {
      password,
      expiresAt: Date.now() + this.passwordCacheTtlMs,
    })
  }

  private sweepExpiredPasswordCache(): void {
    const now = Date.now()
    for (const [key, entry] of this.cachedPasswords.entries()) {
      if (entry.expiresAt <= now) {
        this.cachedPasswords.delete(key)
      }
    }
  }

  private static parsePositiveInt(value: string | number | undefined, fallback: number): number {
    if (value == null) return fallback
    const parsed = typeof value === 'number' ? value : Number(value)
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback
    return Math.floor(parsed)
  }

  private matchesContainerId(savedId: string, requestedId: string): boolean {
    const normalizedSaved = savedId.toLowerCase()
    const normalizedRequested = requestedId.toLowerCase()
    return normalizedSaved.startsWith(normalizedRequested) || normalizedRequested.startsWith(normalizedSaved)
  }

  private async getVerifiedRedisContainer(containerId: string): Promise<Docker.Container> {
    if (!CONTAINER_ID_PATTERN.test(containerId)) {
      throw new Error('Invalid container id')
    }

    const containers = await docker.listContainers({ all: true })
    const match = containers.find((c) => c.Id.startsWith(containerId) || containerId.startsWith(c.Id.slice(0, 12)))
    if (!match) {
      throw new Error('Container not found')
    }

    const image = (match.Image ?? '').toLowerCase()
    if (!image.includes('redis')) {
      throw new Error('Container is not a Redis container')
    }
    if (match.State !== 'running') {
      throw new Error('Redis container is not running')
    }

    return docker.getContainer(match.Id)
  }

  private async execInContainer(containerId: string, cmd: string[]): Promise<string> {
    const container = await this.getVerifiedRedisContainer(containerId)
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
        let settled = false

        const timeoutHandle = setTimeout(() => {
          if (settled) return
          settled = true
          stream.removeAllListeners('end')
          stream.removeAllListeners('error')
          try {
            stream.destroy(new Error('Redis exec timed out'))
          } catch {
            // Ignore stream teardown failures.
          }
          reject(new Error(`Redis command timed out after ${this.execTimeoutMs}ms`))
        }, this.execTimeoutMs)

        const finish = (fn: () => void) => {
          if (settled) return
          settled = true
          clearTimeout(timeoutHandle)
          fn()
        }

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
          finish(() => {
            if (stderr.trim() && !stdout.trim()) {
              reject(new Error(stderr.trim()))
              return
            }
            resolve(stdout)
          })
        })

        stream.on('error', (streamErr) => {
          finish(() => reject(streamErr))
        })
      })
    })
  }
}

export const redisService = new RedisService()
