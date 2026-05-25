import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icon, ContextMenu } from "@/components/ui";
import { useAppStore } from "@/store/useAppStore";
import type { ContextMenuItem, RedisValueType } from "@/types";

interface RedisDatabaseBrowserProps {
  containerId: string;
  db?: number;
  embeddedInEditor?: boolean;
}

function ttlLabel(ttl: number): string {
  if (ttl === -1) return "no TTL";
  if (ttl === -2) return "expired";
  if (ttl < 60) return `${ttl}s`;
  const mins = Math.floor(ttl / 60);
  return `${mins}m`;
}

export function RedisDatabaseBrowser({ containerId, db = 0, embeddedInEditor = false }: RedisDatabaseBrowserProps) {
  const scanRedisKeys = useAppStore((s) => s.scanRedisKeys);
  const createRedisKey = useAppStore((s) => s.createRedisKey);
  const openDockerTerminal = useAppStore((s) => s.openDockerTerminal);
  const containers = useAppStore((s) => s.containers);
  const openRedisKeyTab = useAppStore((s) => s.openRedisKeyTab);
  const openRedisBrowserTab = useAppStore((s) => s.openRedisBrowserTab);
  const deleteRedisKey = useAppStore((s) => s.deleteRedisKey);
  const redisBrowserState = useAppStore((s) => s.redisBrowserState);

  const [pattern, setPattern] = useState("*");
  const [cursor, setCursor] = useState("0");
  const [addOpen, setAddOpen] = useState(false);
  const [newType, setNewType] = useState<Exclude<RedisValueType, "none" | "unknown">>("string");
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newTtl, setNewTtl] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; keyName: string; keyType: RedisValueType } | null>(null);
  const newKeyInputRef = useRef<HTMLInputElement | null>(null);

  const keys = useMemo(() => {
    if (!redisBrowserState) return [];
    if (redisBrowserState.containerId !== containerId || redisBrowserState.db !== db) return [];
    return redisBrowserState.keys;
  }, [redisBrowserState, containerId, db]);

  // Scan once on mount or when container/db changes — no polling
  useEffect(() => {
    void scanRedisKeys(containerId, "*", "0", db);
  }, [containerId, db, scanRedisKeys]);

  useEffect(() => {
    if (!addOpen) return;
    const id = window.setTimeout(() => {
      newKeyInputRef.current?.focus();
      newKeyInputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(id);
  }, [addOpen]);

  const handleScan = async (startCursor = "0") => {
    setActionError(null);
    try {
      setCursor(startCursor);
      await scanRedisKeys(containerId, pattern || "*", startCursor, db);
      setActionMessage("Scan complete");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleCreateKey = async () => {
    setAddError(null);
    setIsAdding(true);
    try {
      const trimmedKey = newKey.trim();
      if (!trimmedKey) {
        setAddError("Key name is required.");
        return;
      }

      let ttl: number | undefined;
      const trimmedTtl = newTtl.trim();
      if (trimmedTtl) {
        const parsedTtl = Number.parseInt(trimmedTtl, 10);
        if (Number.isNaN(parsedTtl) || parsedTtl < 0) {
          setAddError("TTL must be a non-negative integer.");
          return;
        }
        ttl = parsedTtl;
      }

      await createRedisKey({
        containerId,
        db,
        key: trimmedKey,
        type: newType,
        value: newValue,
        ttlSeconds: ttl,
      });
      setPattern("*");
      setCursor("0");
      setAddOpen(false);
      setNewKey("");
      setNewValue("");
      setNewTtl("");
      await scanRedisKeys(containerId, "*", "0", db);
      openRedisKeyTab(containerId, trimmedKey, newType, db);
      setActionMessage(`Created key ${trimmedKey}`);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsAdding(false);
    }
  };

  const typeHint = useMemo(() => {
    if (newType === "string") return "Any text or JSON";
    if (newType === "hash") return "One field per line: field=value";
    if (newType === "list") return "One item per line";
    if (newType === "set") return "One unique member per line";
    return "One member per line: member=score";
  }, [newType]);

  const nextCursor =
    redisBrowserState && redisBrowserState.containerId === containerId && redisBrowserState.db === db
      ? redisBrowserState.cursor
      : "0";

  const openRedisKeyView = (keyName: string, keyType: RedisValueType) => {
    openRedisKeyTab(containerId, keyName, keyType, db);
    setActionMessage(`Opened value for ${keyName}`);
  };

  const contextItems: ContextMenuItem[] = contextMenu
    ? [
        {
          label: "Edit Key",
          icon: "edit",
          iconColor: "text-syntax-function",
          action: () => {
            openRedisKeyTab(containerId, contextMenu.keyName, contextMenu.keyType, db);
            setActionMessage(`Editing key ${contextMenu.keyName}`);
          },
        },
        {
          label: "Open Value",
          icon: "preview",
          iconColor: "text-text-secondary",
          action: () => openRedisKeyView(contextMenu.keyName, contextMenu.keyType),
        },
        {
          label: "Delete Key",
          icon: "delete",
          danger: true,
          action: async () => {
            const ok = window.confirm(`Delete key \"${contextMenu.keyName}\"?`);
            if (!ok) return;
            try {
              await deleteRedisKey(containerId, contextMenu.keyName, db);
              await scanRedisKeys(containerId, "*", "0", db);
              setActionMessage(`Deleted key ${contextMenu.keyName}`);
              setContextMenu(null);
            } catch (err: unknown) {
              const message = err instanceof Error ? err.message : String(err);
              setActionError(message);
              window.alert(`Failed to delete key: ${message}`);
            }
          },
        },
        {
          label: "Copy Key Name",
          icon: "content_copy",
          iconColor: "text-text-secondary",
          action: () => void navigator.clipboard.writeText(contextMenu.keyName),
        },
      ]
    : [];

  return (
    <div className={embeddedInEditor ? "h-full min-h-0 flex flex-col" : "mt-1"}>
      {!embeddedInEditor && (
        <div className="px-1 pb-1 flex items-center">
          <button
            onClick={() => openRedisBrowserTab(containerId, db)}
            className="ml-auto mr-1 px-2 py-1 rounded-item border border-border-default text-[10px] text-text-secondary hover:text-text-primary"
            title="Open in tab"
          >
            Open Full Browser
          </button>
        </div>
      )}

      <div className="px-2 py-2 flex items-center gap-1 border-b border-border-subtle">
        <div className="glass-input bg-bg-input px-2 py-1.5 flex items-center gap-1 flex-1">
          <Icon name="filter_alt" size={12} className="text-text-muted" />
          <input
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="Pattern (e.g. user:*)"
            className="bg-transparent outline-none text-[11px] text-text-primary w-full"
          />
        </div>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void handleScan("0");
          }}
          className="px-2 py-1 rounded-item border border-border-default text-[10px] text-text-primary hover:bg-bg-surface-hover"
        >
          Scan
        </button>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setActionError(null);
            setActionMessage(null);
            setAddOpen((x) => !x);
          }}
          className="px-2 py-1 rounded-item border border-border-default text-[10px] text-accent-blue hover:bg-bg-surface-hover disabled:opacity-60"
          title="Add key using GUI"
        >
          Add Key
        </button>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const c = containers.find((x) => x.id === containerId);
            if (!c) {
              setActionError("Redis container not found for terminal access.");
              return;
            }
            openDockerTerminal(containerId, c.name || "redis", "redis");
            setActionMessage("Opened redis-cli terminal");
          }}
          className="px-2 py-1 rounded-item border border-border-default text-[10px] text-text-secondary hover:text-text-primary hover:bg-bg-surface-hover"
          title="Open redis-cli terminal"
        >
          Terminal
        </button>
      </div>

      {addOpen && (
        <div className="px-2 py-2 border-b border-border-subtle flex flex-col gap-2 bg-bg-surface/40">
          <div className="flex items-center gap-2">
            <input
              ref={newKeyInputRef}
              value={newKey}
              onChange={(e) => {
                console.debug('[Redis:AddKey] newKey onChange', e.target.value)
                setNewKey(e.target.value)
              }}
              onFocus={() => console.debug('[Redis:AddKey] newKey onFocus')}
              onKeyDown={(e) => console.debug('[Redis:AddKey] newKey onKeyDown', e.key)}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              tabIndex={0}
              placeholder="Key name (e.g. user:1001)"
              className="glass-input bg-bg-input px-2 py-1.5 text-[11px] text-text-primary flex-1 outline-none pointer-events-auto"
            />
            <select
              value={newType}
              onChange={(e) => {
                console.debug('[Redis:AddKey] newType onChange', e.target.value)
                setNewType(e.target.value as Exclude<RedisValueType, "none" | "unknown">)
              }}
              onFocus={() => console.debug('[Redis:AddKey] newType onFocus')}
              onKeyDown={(e) => console.debug('[Redis:AddKey] newType onKeyDown', e.key)}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              tabIndex={0}
              className="glass-input bg-bg-input px-2 py-1.5 text-[11px] text-text-primary outline-none pointer-events-auto"
            >
              <option value="string">string</option>
              <option value="hash">hash</option>
              <option value="list">list</option>
              <option value="set">set</option>
              <option value="zset">zset</option>
            </select>
            <input
              value={newTtl}
              onChange={(e) => {
                console.debug('[Redis:AddKey] ttl onChange', e.target.value)
                setNewTtl(e.target.value)
              }}
              onFocus={() => console.debug('[Redis:AddKey] ttl onFocus')}
              onKeyDown={(e) => console.debug('[Redis:AddKey] ttl onKeyDown', e.key)}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              tabIndex={0}
              placeholder="TTL(s)"
              className="glass-input bg-bg-input px-2 py-1.5 text-[11px] text-text-primary w-20 outline-none pointer-events-auto"
            />
          </div>
          <textarea
            value={newValue}
            onChange={(e) => {
              console.debug('[Redis:AddKey] newValue onChange', e.target.value.slice(0, 100))
              setNewValue(e.target.value)
            }}
            onFocus={() => console.debug('[Redis:AddKey] newValue onFocus')}
            onKeyDown={(e) => console.debug('[Redis:AddKey] newValue onKeyDown', e.key)}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            tabIndex={0}
            placeholder={typeHint}
            className="glass-input bg-bg-input px-2 py-2 text-[11px] text-text-primary min-h-[90px] font-mono outline-none resize-y pointer-events-auto"
          />
          <div className="flex items-center gap-2 text-[10px] text-text-muted">
            <span>{typeHint}</span>
            <button
              onClick={() => void handleCreateKey()}
              disabled={isAdding}
              className="ml-auto px-2 py-1 rounded-item border border-border-default text-text-primary hover:bg-bg-surface-hover disabled:opacity-60"
            >
              {isAdding ? "Creating..." : "Create"}
            </button>
          </div>
          {addError && <div className="text-[11px] text-status-red">{addError}</div>}
        </div>
      )}

      {(actionMessage || actionError) && (
        <div className="px-2 py-1 border-b border-border-subtle text-[10px] flex items-center gap-2">
          {actionMessage && <span className="text-status-green">{actionMessage}</span>}
          {actionError && <span className="text-status-red">{actionError}</span>}
        </div>
      )}

      <div className="px-2 py-1 text-[10px] text-text-muted border-b border-border-subtle flex items-center gap-2">
        <span>DB {db}</span>
        <span>Cursor: {nextCursor}</span>
        {redisBrowserState?.isLoading ? <span>Loading...</span> : <span>{keys.length} keys</span>}
        <button
          onClick={() => {
            const first = keys[0];
            if (first) openRedisKeyTab(containerId, first.key, first.type as RedisValueType, db);
          }}
          disabled={keys.length === 0}
          className="text-text-secondary hover:text-text-primary disabled:opacity-50"
          title="Open first key"
        >
          <Icon name="play_circle" size={13} />
        </button>
        <button
          onClick={() => void handleScan(nextCursor)}
          disabled={nextCursor === "0" && cursor !== "0"}
          className="ml-auto text-text-secondary hover:text-text-primary disabled:opacity-50"
          title="Load next page"
        >
          <Icon name="arrow_circle_right" size={13} />
        </button>
      </div>

      <div className={embeddedInEditor ? "flex-1 min-h-0 overflow-auto" : "max-h-[320px] overflow-auto"}>
        {redisBrowserState?.error && <div className="px-3 py-2 text-[11px] text-status-red">{redisBrowserState.error}</div>}

        {keys.map((item) => (
          <div
            key={item.key}
            className="glass-row mx-1 my-0.5 px-2 py-1 cursor-pointer flex items-center gap-2"
            onClick={() => openRedisKeyTab(containerId, item.key, item.type as RedisValueType, db)}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu({
                x: e.clientX,
                y: e.clientY,
                keyName: item.key,
                keyType: item.type as RedisValueType,
              });
            }}
          >
            <Icon name="key" size={12} className="text-status-red" />
            <span className="text-[11px] text-text-primary truncate flex-1" title={item.key}>
              {item.key}
            </span>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openRedisKeyTab(containerId, item.key, item.type as RedisValueType, db);
              }}
              className="text-text-secondary hover:text-syntax-function"
              title="Edit key"
            >
              <Icon name="edit" size={12} />
            </button>
            <span className="text-[9px] uppercase rounded-item border border-border-default px-1 py-0.5 text-text-secondary">{item.type}</span>
            <span className="text-[10px] text-text-muted">{ttlLabel(item.ttl)}</span>
          </div>
        ))}

        {!redisBrowserState?.isLoading && keys.length === 0 && (
          <div className="px-3 py-4 text-[11px] text-text-muted">No keys matched this pattern.</div>
        )}
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextItems}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
