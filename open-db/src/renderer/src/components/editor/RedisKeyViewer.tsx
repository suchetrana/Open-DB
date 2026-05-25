import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/ui";
import { RedisJsonViewer } from "./RedisJsonViewer";
import { useAppStore } from "@/store/useAppStore";
import type { RedisValueType } from "@/types";

interface RedisKeyViewerProps {
  containerId: string;
  keyName: string;
  db?: number;
  typeHint?: RedisValueType;
}

interface KeyMetadata {
  key: string;
  type: string;
  ttl: number;
  size: number;
  encoding: string | null;
  refCount: number | null;
  idleSeconds: number | null;
  lfuFreq: number | null;
  length: number | null;
}

type HashEntry = { field: string; value: string };
type ZSetEntry = { member: string; score: string };
type PageItem = string | HashEntry | ZSetEntry;

interface KeyPage {
  type: string;
  cursor: string;
  pageStart: number;
  pageSize: number;
  totalApprox: number;
  items: PageItem[];
}

const PAGE_SIZE = 200;
const ROW_HEIGHT = 34;

function formatTtl(ttl: number): string {
  if (ttl === -1) return "No expiry";
  if (ttl === -2) return "Expired";
  if (ttl < 60) return `${ttl}s`;
  const mins = Math.floor(ttl / 60);
  const secs = ttl % 60;
  if (mins < 60) return `${mins}m ${secs}s`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m`;
}

function looksLikeJson(value: string): boolean {
  const t = value.trim();
  return (t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"));
}

function toNumber(input: string): number | null {
  const n = Number(input);
  return Number.isFinite(n) ? n : null;
}

interface VirtualRowsProps<T> {
  items: T[];
  rowHeight: number;
  renderRow: (item: T, index: number) => React.ReactNode;
  getKey: (item: T, index: number) => string;
}

function VirtualRows<T>({ items, rowHeight, renderRow, getKey }: VirtualRowsProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(480);
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const update = () => setViewportHeight(host.clientHeight || 480);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const totalHeight = items.length * rowHeight;
  const visibleCount = Math.ceil(viewportHeight / rowHeight) + 10;
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - 5);
  const end = Math.min(items.length, start + visibleCount);
  const topPad = start * rowHeight;

  return (
    <div
      ref={hostRef}
      className="flex-1 min-h-0 overflow-auto"
      onScroll={(e) => setScrollTop((e.currentTarget as HTMLDivElement).scrollTop)}
    >
      <div style={{ height: `${totalHeight}px`, position: "relative" }}>
        <div style={{ transform: `translateY(${topPad}px)` }}>
          {items.slice(start, end).map((item, idx) => (
            <div key={getKey(item, start + idx)} style={{ height: `${rowHeight}px` }}>
              {renderRow(item, start + idx)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function RedisKeyViewer({ containerId, keyName, db = 0, typeHint = "string" }: RedisKeyViewerProps) {
  const deleteRedisKey = useAppStore((s) => s.deleteRedisKey);
  const connections = useAppStore((s) => s.connections);
  const activeConnectionId = useAppStore((s) => s.activeConnectionId);

  const [metadata, setMetadata] = useState<KeyMetadata | null>(null);
  const [page, setPage] = useState<KeyPage | null>(null);
  const [stringValue, setStringValue] = useState("");
  const [lastSavedString, setLastSavedString] = useState("");
  const [ttlDraft, setTtlDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingPage, setLoadingPage] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savingCount, setSavingCount] = useState(0);

  const [hashField, setHashField] = useState("");
  const [hashValue, setHashValue] = useState("");
  const [listValue, setListValue] = useState("");
  const [setMember, setSetMember] = useState("");
  const [zMember, setZMember] = useState("");
  const [zScore, setZScore] = useState("0");

  const commitTimersRef = useRef<Map<string, number>>(new Map());
  const stringSaveTimerRef = useRef<number | null>(null);
  const latestStringRef = useRef(stringValue);
  const nextSaveTokenRef = useRef(0);
  const activeSaveTokensRef = useRef<Set<number>>(new Set());
  const mountedRef = useRef(true);

  useEffect(() => {
    latestStringRef.current = stringValue;
  }, [stringValue]);

  const type = (metadata?.type ?? typeHint) as RedisValueType;

  const redisPassword = useMemo(() => {
    const activeConn = connections.find((c) => c.id === activeConnectionId);
    const preferred =
      activeConn?.type === "redis" && activeConn.dockerContainerId === containerId ? activeConn : undefined;
    const matching = preferred ?? connections.find((c) => c.type === "redis" && c.dockerContainerId === containerId);
    return matching?.password ?? undefined;
  }, [connections, activeConnectionId, containerId]);

  const cleanupTimers = useCallback(() => {
    for (const timer of commitTimersRef.current.values()) {
      window.clearTimeout(timer);
    }
    commitTimersRef.current.clear();
  }, []);

  useEffect(() => cleanupTimers, [cleanupTimers]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (stringSaveTimerRef.current) {
        window.clearTimeout(stringSaveTimerRef.current);
        stringSaveTimerRef.current = null;
      }
      activeSaveTokensRef.current.clear();
    };
  }, []);

  const fetchMetadata = useCallback(async () => {
    const m = await window.electronAPI.redis.getKeyMetadata(containerId, keyName, db, redisPassword);
    setMetadata(m);
    setTtlDraft(String(m.ttl));
    return m;
  }, [containerId, keyName, db, redisPassword]);

  const fetchString = useCallback(async () => {
    const result = await window.electronAPI.redis.getKeyValue(containerId, keyName, "string", db, redisPassword);
    const next = typeof result.value === "string" ? result.value : "";
    setStringValue(next);
    setLastSavedString(next);
  }, [containerId, keyName, db, redisPassword]);

  const fetchPage = useCallback(
    async (nextCursor = "0", nextOffset = 0) => {
      const currentType = (metadata?.type ?? typeHint) as string;
      if (currentType === "string") return;

      setLoadingPage(true);
      try {
        const result = await window.electronAPI.redis.getKeyPage(
          containerId,
          keyName,
          currentType,
          nextCursor,
          nextOffset,
          PAGE_SIZE,
          db,
          redisPassword
        );

        setPage({
          type: result.type,
          cursor: result.cursor,
          pageStart: result.pageStart,
          pageSize: result.pageSize,
          totalApprox: result.totalApprox,
          items: result.items as PageItem[],
        });

      } finally {
        setLoadingPage(false);
      }
    },
    [containerId, keyName, db, metadata?.type, typeHint, redisPassword]
  );

  const refreshCurrent = useCallback(async () => {
    const meta = await fetchMetadata();
    if (meta.type === "string") {
      await fetchString();
      setPage(null);
      return;
    }

    if (meta.type === "list") {
      const nextOffset = page?.pageStart ?? 0;
      await fetchPage("0", nextOffset);
      return;
    }

    await fetchPage(page?.cursor ?? "0", 0);
  }, [fetchMetadata, fetchString, fetchPage, page?.pageStart, page?.cursor]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setSaveError(null);
      try {
        const meta = await fetchMetadata();
        if (!mounted) return;

        if (meta.type === "string") {
          await fetchString();
          if (!mounted) return;
          setPage(null);
        } else {
          await fetchPage("0", 0);
        }
      } catch (err: unknown) {
        if (!mounted) return;
        setSaveError(err instanceof Error ? err.message : String(err));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();

    return () => {
      mounted = false;
      cleanupTimers();
    };
  }, [containerId, keyName, db, fetchMetadata, fetchString, fetchPage, cleanupTimers]);

  const scheduleMutation = useCallback(
    (id: string, rollback: () => void, mutation: () => Promise<void>) => {
      const prev = commitTimersRef.current.get(id);
      if (prev) window.clearTimeout(prev);

      const timer = window.setTimeout(async () => {
        setSavingCount((c) => c + 1);
        setSaveError(null);
        try {
          await mutation();
          void fetchMetadata();
        } catch (err: unknown) {
          rollback();
          setSaveError(err instanceof Error ? err.message : String(err));
        } finally {
          setSavingCount((c) => Math.max(0, c - 1));
          commitTimersRef.current.delete(id);
        }
      }, 450);

      commitTimersRef.current.set(id, timer);
    },
    [fetchMetadata]
  );

  useEffect(() => {
    if (type !== "string" || stringValue === lastSavedString) return;
    if (stringSaveTimerRef.current) {
      window.clearTimeout(stringSaveTimerRef.current);
    }

    const scheduledValue = stringValue;
    stringSaveTimerRef.current = window.setTimeout(async () => {
      if (!metadata || !mountedRef.current) return;
      if (scheduledValue !== latestStringRef.current) return;

      const token = ++nextSaveTokenRef.current;
      activeSaveTokensRef.current.add(token);
      setSavingCount((c) => c + 1);

      try {
        await window.electronAPI.redis.setKeyValue(containerId, keyName, scheduledValue, db, redisPassword);
        if (!mountedRef.current || !activeSaveTokensRef.current.has(token)) return;
        setLastSavedString(scheduledValue);
        void fetchMetadata();
      } catch (err: unknown) {
        if (!mountedRef.current || !activeSaveTokensRef.current.has(token)) return;
        setSaveError(err instanceof Error ? err.message : String(err));
      } finally {
        if (activeSaveTokensRef.current.delete(token) && mountedRef.current) {
          setSavingCount((c) => Math.max(0, c - 1));
        }
      }
    }, 500);

    return () => {
      if (stringSaveTimerRef.current) {
        window.clearTimeout(stringSaveTimerRef.current);
        stringSaveTimerRef.current = null;
      }
    };
  }, [type, stringValue, lastSavedString, metadata, containerId, keyName, db, redisPassword, fetchMetadata]);

  const jsonValue = useMemo(() => {
    if (type !== "string" || !looksLikeJson(stringValue)) return null;
    try {
      return JSON.parse(stringValue) as unknown;
    } catch {
      return null;
    }
  }, [type, stringValue]);

  const applyTtl = async () => {
    const parsed = Number(ttlDraft);
    if (!Number.isInteger(parsed)) return;
    setSaveError(null);
    try {
      await window.electronAPI.redis.setKeyTTL(containerId, keyName, parsed, db, redisPassword);
      await fetchMetadata();
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDelete = async () => {
    const ok = window.confirm(`Delete key \"${keyName}\"? This cannot be undone.`);
    if (!ok) return;
    try {
      await deleteRedisKey(containerId, keyName, db);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSaveError(msg);
      window.alert(`Failed to delete key: ${msg}`);
    }
  };

  const pageItems = page?.items ?? [];
  const listStart = page?.pageStart ?? 0;
  const listLength = page?.items.length ?? 0;
  const listEnd = listLength > 0 ? listStart + listLength - 1 : listStart;

  const renderHashRow = (entry: HashEntry, index: number) => (
    <div className="grid grid-cols-[180px_1fr_auto] gap-2 items-center px-1 h-full">
      <div className="text-[11px] text-syntax-function truncate" title={entry.field}>{entry.field}</div>
      <input
        value={entry.value}
        onChange={(e) => {
          const next = e.target.value;
          setPage((prev) => {
            if (!prev) return prev;
            const copy = [...prev.items] as HashEntry[];
            const old = copy[index]?.value ?? "";
            copy[index] = { ...copy[index], value: next };
            scheduleMutation(
              `hash:${entry.field}`,
              () => setPage((p) => {
                if (!p) return p;
                const rb = [...p.items] as HashEntry[];
                rb[index] = { ...rb[index], value: old };
                return { ...p, items: rb };
              }),
              async () => {
                await window.electronAPI.redis.hashSet(containerId, keyName, entry.field, next, db, redisPassword);
              }
            );
            return { ...prev, items: copy };
          });
        }}
        className="glass-input bg-bg-input px-2 py-1 text-[11px] text-text-primary"
      />
      <button
        onClick={async () => {
          let snapshot: HashEntry[] = [];
          setPage((prev) => {
            if (!prev) return prev;
            snapshot = [...(prev.items as HashEntry[])];
            return { ...prev, items: (prev.items as HashEntry[]).filter((x) => x.field !== entry.field) };
          });
          try {
            await window.electronAPI.redis.hashDelete(containerId, keyName, [entry.field], db, redisPassword);
            void fetchMetadata();
          } catch (err: unknown) {
            setPage((prev) => prev ? { ...prev, items: snapshot } : prev);
            setSaveError(err instanceof Error ? err.message : String(err));
          }
        }}
        className="text-status-red hover:text-status-red/80"
      >
        <Icon name="delete" size={12} />
      </button>
    </div>
  );

  const renderListRow = (item: string, index: number) => (
    <div className="grid grid-cols-[56px_1fr] gap-2 items-center px-1 h-full">
      <div className="text-[11px] text-text-muted">[{(page?.pageStart ?? 0) + index}]</div>
      <input
        value={item}
        onChange={(e) => {
          const next = e.target.value;
          setPage((prev) => {
            if (!prev) return prev;
            const copy = [...prev.items] as string[];
            const old = copy[index] ?? "";
            copy[index] = next;
            scheduleMutation(
              `list:${prev.pageStart + index}`,
              () => setPage((p) => {
                if (!p) return p;
                const rb = [...p.items] as string[];
                rb[index] = old;
                return { ...p, items: rb };
              }),
              async () => {
                const absoluteIndex = prev.pageStart + index;
                await window.electronAPI.redis.listSet(containerId, keyName, absoluteIndex, next, db, redisPassword);
              }
            );
            return { ...prev, items: copy };
          });
        }}
        className="glass-input bg-bg-input px-2 py-1 text-[11px] text-text-primary"
      />
    </div>
  );

  const renderSetRow = (member: string) => (
    <div className="flex items-center gap-2 px-1 h-full">
      <div className="text-[11px] text-text-primary font-mono flex-1 truncate">{member}</div>
      <button
        onClick={async () => {
          let snapshot: string[] = [];
          setPage((prev) => {
            if (!prev) return prev;
            snapshot = [...(prev.items as string[])];
            return { ...prev, items: (prev.items as string[]).filter((x) => x !== member) };
          });
          try {
            await window.electronAPI.redis.setRemove(containerId, keyName, [member], db, redisPassword);
            void fetchMetadata();
          } catch (err: unknown) {
            setPage((prev) => prev ? { ...prev, items: snapshot } : prev);
            setSaveError(err instanceof Error ? err.message : String(err));
          }
        }}
        className="text-status-red hover:text-status-red/80"
      >
        <Icon name="delete" size={12} />
      </button>
    </div>
  );

  const renderZSetRow = (entry: ZSetEntry, index: number) => (
    <div className="grid grid-cols-[1fr_120px_auto] gap-2 items-center px-1 h-full">
      <div className="text-[11px] text-text-primary truncate">{entry.member}</div>
      <input
        value={entry.score}
        onChange={(e) => {
          const next = e.target.value;
          setPage((prev) => {
            if (!prev) return prev;
            const copy = [...prev.items] as ZSetEntry[];
            const old = copy[index]?.score ?? "0";
            copy[index] = { ...copy[index], score: next };
            scheduleMutation(
              `zset:${entry.member}`,
              () => setPage((p) => {
                if (!p) return p;
                const rb = [...p.items] as ZSetEntry[];
                rb[index] = { ...rb[index], score: old };
                return { ...p, items: rb };
              }),
              async () => {
                const parsed = toNumber(next);
                if (parsed == null) throw new Error("Invalid zset score")
                await window.electronAPI.redis.zsetAdd(containerId, keyName, entry.member, parsed, db, redisPassword);
              }
            );
            return { ...prev, items: copy };
          });
        }}
        className="glass-input bg-bg-input px-2 py-1 text-[11px] text-text-primary"
      />
      <button
        onClick={async () => {
          let snapshot: ZSetEntry[] = [];
          setPage((prev) => {
            if (!prev) return prev;
            snapshot = [...(prev.items as ZSetEntry[])];
            return { ...prev, items: (prev.items as ZSetEntry[]).filter((x) => x.member !== entry.member) };
          });
          try {
            await window.electronAPI.redis.zsetRemove(containerId, keyName, [entry.member], db, redisPassword);
            void fetchMetadata();
          } catch (err: unknown) {
            setPage((prev) => prev ? { ...prev, items: snapshot } : prev);
            setSaveError(err instanceof Error ? err.message : String(err));
          }
        }}
        className="text-status-red hover:text-status-red/80"
      >
        <Icon name="delete" size={12} />
      </button>
    </div>
  );

  if (loading) {
    return <div className="flex-1 p-4 text-[12px] text-text-muted">Loading Redis key...</div>;
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-[#181a1d]">
      <div className="border-b border-border-subtle px-3 py-2 flex items-center gap-2">
        <Icon name="key" size={14} className="text-status-red" />
        <div className="text-[12px] text-text-primary truncate">{keyName}</div>
        <span className="text-[10px] rounded-item border border-border-default px-1.5 py-0.5 text-text-secondary uppercase">{type}</span>
        <span className="text-[10px] text-text-muted">TTL: {formatTtl(metadata?.ttl ?? -1)}</span>
        <span className="text-[10px] text-text-muted">Size: {(metadata?.size ?? -1) >= 0 ? `${metadata?.size} B` : "n/a"}</span>
        <span className="ml-auto text-[10px] text-text-muted">{savingCount > 0 ? `Saving ${savingCount}...` : "Auto-save enabled"}</span>
      </div>

      <div className="border-b border-border-subtle px-3 py-2 grid grid-cols-2 lg:grid-cols-5 gap-x-3 gap-y-1 text-[10px] text-text-muted">
        <span>Encoding: <span className="text-text-primary">{metadata?.encoding ?? "n/a"}</span></span>
        <span>RefCount: <span className="text-text-primary">{metadata?.refCount ?? "n/a"}</span></span>
        <span>Idle: <span className="text-text-primary">{metadata?.idleSeconds ?? "n/a"}s</span></span>
        <span>LFU: <span className="text-text-primary">{metadata?.lfuFreq ?? "n/a"}</span></span>
        <span>Length: <span className="text-text-primary">{metadata?.length ?? "n/a"}</span></span>
      </div>

      <div className="border-b border-border-subtle px-3 py-2 flex items-center gap-2">
        <div className="glass-input bg-bg-input px-2 py-1.5 flex items-center gap-1">
          <Icon name="schedule" size={12} className="text-text-muted" />
          <input
            value={ttlDraft}
            onChange={(e) => setTtlDraft(e.target.value)}
            className="bg-transparent outline-none text-[11px] text-text-primary w-24"
            placeholder="TTL seconds"
          />
        </div>
        <button onClick={() => void applyTtl()} className="px-2 py-1 rounded-item border border-border-default text-[10px] text-text-primary hover:bg-bg-surface-hover">Apply TTL</button>
        <button onClick={() => void refreshCurrent()} className="px-2 py-1 rounded-item border border-border-default text-[10px] text-text-secondary hover:text-text-primary">Refresh</button>
        <button onClick={() => void handleDelete()} className="px-2 py-1 rounded-item border border-status-red/40 text-[10px] text-status-red hover:bg-status-red/10">Delete Key</button>

        {type !== "string" && page && (
          <>
            {type === "list" ? (
              <>
                <button
                  onClick={() => void fetchPage("0", Math.max(0, page.pageStart - PAGE_SIZE))}
                  disabled={page.pageStart <= 0 || loadingPage}
                  className="ml-auto px-2 py-1 rounded-item border border-border-default text-[10px] text-text-secondary disabled:opacity-40"
                >
                  Prev
                </button>
                <button
                  onClick={() => void fetchPage("0", page.pageStart + PAGE_SIZE)}
                  disabled={loadingPage || page.pageStart + PAGE_SIZE >= page.totalApprox}
                  className="px-2 py-1 rounded-item border border-border-default text-[10px] text-text-secondary disabled:opacity-40"
                >
                  Next
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => void fetchPage(page.cursor, 0)}
                  disabled={loadingPage || page.cursor === "0"}
                  className="ml-auto px-2 py-1 rounded-item border border-border-default text-[10px] text-text-secondary disabled:opacity-40"
                >
                  Next Cursor
                </button>
                <button
                  onClick={() => void fetchPage("0", 0)}
                  disabled={loadingPage}
                  className="px-2 py-1 rounded-item border border-border-default text-[10px] text-text-secondary disabled:opacity-40"
                >
                  Restart
                </button>
              </>
            )}
          </>
        )}
      </div>

      {saveError && <div className="px-3 py-2 text-[11px] text-status-red border-b border-border-subtle">{saveError}</div>}

      <div className="flex-1 min-h-0 overflow-hidden p-3 space-y-2">
        {type === "string" && (
          <>
            <textarea
              value={stringValue}
              onChange={(e) => setStringValue(e.target.value)}
              className="w-full min-h-[180px] glass-input bg-bg-input p-3 text-[12px] text-text-primary font-mono outline-none"
              placeholder="String value"
            />

            {jsonValue !== null && (
              <div className="h-[320px] border border-border-subtle rounded-widget overflow-hidden">
                <RedisJsonViewer
                  value={jsonValue as any}
                  onEditValue={(path, value) => {
                    if (path.length < 2) return;
                    try {
                      const parsed = JSON.parse(stringValue) as unknown;
                      let target: unknown = parsed;
                      for (let i = 1; i < path.length - 1; i++) {
                        if (typeof target !== "object" || target === null) return;
                        const step = path[i];
                        if (Array.isArray(target)) {
                          const idx = Number(step);
                          if (!Number.isInteger(idx) || idx < 0 || idx >= target.length) return;
                          target = target[idx];
                        } else {
                          if (!(step in (target as Record<string, unknown>))) return;
                          target = (target as Record<string, unknown>)[step];
                        }
                      }
                      const leaf = path[path.length - 1];
                      if (typeof target !== "object" || target === null) return;
                      if (Array.isArray(target)) {
                        const idx = Number(leaf);
                        if (!Number.isInteger(idx) || idx < 0 || idx >= target.length) return;
                        target[idx] = value;
                      } else {
                        (target as Record<string, unknown>)[leaf] = value;
                      }
                      setStringValue(JSON.stringify(parsed, null, 2));
                    } catch {
                      // no-op on invalid JSON path update
                    }
                  }}
                />
              </div>
            )}
          </>
        )}

        {type === "hash" && (
          <>
            <div className="text-[10px] text-text-muted">Showing page of {page?.items.length ?? 0} of ~{page?.totalApprox ?? 0} fields</div>
            <VirtualRows
              items={(page?.items as HashEntry[]) ?? []}
              rowHeight={ROW_HEIGHT}
              renderRow={(entry, index) => renderHashRow(entry, index)}
              getKey={(entry, index) => `h:${entry.field}:${index}`}
            />
            <div className="grid grid-cols-[180px_1fr_auto] gap-2 items-center pt-2 border-t border-border-subtle">
              <input value={hashField} onChange={(e) => setHashField(e.target.value)} placeholder="Field" className="glass-input bg-bg-input px-2 py-1 text-[11px] text-text-primary" />
              <input value={hashValue} onChange={(e) => setHashValue(e.target.value)} placeholder="Value" className="glass-input bg-bg-input px-2 py-1 text-[11px] text-text-primary" />
              <button
                onClick={async () => {
                  if (!hashField) return;
                  const snapshot = pageItems as HashEntry[];
                  setPage((prev) => prev ? { ...prev, items: [{ field: hashField, value: hashValue }, ...(prev.items as HashEntry[])] } : prev);
                  try {
                    await window.electronAPI.redis.hashSet(containerId, keyName, hashField, hashValue, db, redisPassword);
                    setHashField("");
                    setHashValue("");
                    await refreshCurrent();
                  } catch (err: unknown) {
                    setPage((prev) => prev ? { ...prev, items: snapshot } : prev);
                    setSaveError(err instanceof Error ? err.message : String(err));
                  }
                }}
                className="text-status-green hover:text-status-green/80"
              >
                <Icon name="add" size={12} />
              </button>
            </div>
          </>
        )}

        {type === "list" && (
          <>
            <div className="text-[10px] text-text-muted">Showing items {listStart} - {listEnd} of ~{page?.totalApprox ?? 0}</div>
            <VirtualRows
              items={(page?.items as string[]) ?? []}
              rowHeight={ROW_HEIGHT}
              renderRow={(item, index) => renderListRow(item, index)}
              getKey={(_item, index) => `l:${(page?.pageStart ?? 0) + index}`}
            />
            <div className="flex items-center gap-2 pt-2 border-t border-border-subtle">
              <input value={listValue} onChange={(e) => setListValue(e.target.value)} placeholder="Add list item" className="glass-input bg-bg-input px-2 py-1 text-[11px] text-text-primary flex-1" />
              <button
                onClick={async () => {
                  if (!listValue) return;
                  setSaveError(null);
                  try {
                    await window.electronAPI.redis.listPush(containerId, keyName, [listValue], "left", db, redisPassword);
                    setListValue("");
                    await refreshCurrent();
                  } catch (err: unknown) {
                    setSaveError(err instanceof Error ? err.message : String(err));
                  }
                }}
                className="px-2 py-1 text-[10px] rounded-item border border-border-default text-text-primary"
              >
                LPUSH
              </button>
              <button
                onClick={async () => {
                  if (!listValue) return;
                  setSaveError(null);
                  try {
                    await window.electronAPI.redis.listPush(containerId, keyName, [listValue], "right", db, redisPassword);
                    setListValue("");
                    await refreshCurrent();
                  } catch (err: unknown) {
                    setSaveError(err instanceof Error ? err.message : String(err));
                  }
                }}
                className="px-2 py-1 text-[10px] rounded-item border border-border-default text-text-primary"
              >
                RPUSH
              </button>
            </div>
          </>
        )}

        {type === "set" && (
          <>
            <div className="text-[10px] text-text-muted">Showing page of {page?.items.length ?? 0} of ~{page?.totalApprox ?? 0} members</div>
            <VirtualRows
              items={(page?.items as string[]) ?? []}
              rowHeight={ROW_HEIGHT}
              renderRow={(member) => renderSetRow(member)}
              getKey={(member, index) => `s:${member}:${index}`}
            />
            <div className="flex items-center gap-2 pt-2 border-t border-border-subtle">
              <input value={setMember} onChange={(e) => setSetMember(e.target.value)} placeholder="Add member" className="glass-input bg-bg-input px-2 py-1 text-[11px] text-text-primary flex-1" />
              <button
                onClick={async () => {
                  if (!setMember) return;
                  const snapshot = pageItems as string[];
                  setPage((prev) => prev ? { ...prev, items: [setMember, ...(prev.items as string[])] } : prev);
                  try {
                    await window.electronAPI.redis.setAdd(containerId, keyName, [setMember], db, redisPassword);
                    setSetMember("");
                    await refreshCurrent();
                  } catch (err: unknown) {
                    setPage((prev) => prev ? { ...prev, items: snapshot } : prev);
                    setSaveError(err instanceof Error ? err.message : String(err));
                  }
                }}
                className="text-status-green hover:text-status-green/80"
              >
                <Icon name="add" size={12} />
              </button>
            </div>
          </>
        )}

        {type === "zset" && (
          <>
            <div className="text-[10px] text-text-muted">Showing page of {page?.items.length ?? 0} of ~{page?.totalApprox ?? 0} members</div>
            <VirtualRows
              items={(page?.items as ZSetEntry[]) ?? []}
              rowHeight={ROW_HEIGHT}
              renderRow={(entry, index) => renderZSetRow(entry, index)}
              getKey={(entry, index) => `z:${entry.member}:${index}`}
            />
            <div className="grid grid-cols-[1fr_120px_auto] gap-2 items-center pt-2 border-t border-border-subtle">
              <input value={zMember} onChange={(e) => setZMember(e.target.value)} placeholder="Member" className="glass-input bg-bg-input px-2 py-1 text-[11px] text-text-primary" />
              <input value={zScore} onChange={(e) => setZScore(e.target.value)} placeholder="Score" className="glass-input bg-bg-input px-2 py-1 text-[11px] text-text-primary" />
              <button
                onClick={async () => {
                  const parsed = toNumber(zScore);
                  if (!zMember || parsed == null) {
                    setSaveError("Please provide a valid zset member and numeric score.");
                    return;
                  }
                  const snapshot = pageItems as ZSetEntry[];
                  setPage((prev) => prev ? { ...prev, items: [{ member: zMember, score: zScore }, ...(prev.items as ZSetEntry[])] } : prev);
                  try {
                    await window.electronAPI.redis.zsetAdd(containerId, keyName, zMember, parsed, db, redisPassword);
                    setZMember("");
                    await refreshCurrent();
                  } catch (err: unknown) {
                    setPage((prev) => prev ? { ...prev, items: snapshot } : prev);
                    setSaveError(err instanceof Error ? err.message : String(err));
                  }
                }}
                className="text-status-green hover:text-status-green/80"
              >
                <Icon name="add" size={12} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
