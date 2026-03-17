import React, { useState, useEffect } from "react";
import { Icon } from "@/components/ui";
import { useAppStore } from "@/store/useAppStore";
import { clsx } from "clsx";
import type { Connection, DatabaseType } from "@/types";

function genId(): string {
  return "conn-" + Math.random().toString(36).slice(2, 10);
}

function AddConnectionForm({ onClose }: { onClose: () => void }) {
  const addConnection = useAppStore((s) => s.addConnection);
  const connectToDatabase = useAppStore((s) => s.connectToDatabase);

  const [name, setName] = useState("");
  const [host, setHost] = useState("localhost");
  const [port, setPort] = useState("5432");
  const [user, setUser] = useState("postgres");
  const [password, setPassword] = useState("");
  const [database, setDatabase] = useState("postgres");
  const [dbType] = useState<DatabaseType>("postgres");
  const [error, setError] = useState("");
  const [testing, setTesting] = useState(false);

  const handleConnect = async () => {
    if (testing) return; // prevent double-submit
    setError("");
    setTesting(true);

    const connName = name.trim() || `${host}:${port}/${database}`;
    const conn: Connection = {
      id: genId(),
      name: connName,
      type: dbType,
      host,
      port: parseInt(port, 10),
      username: user,
      database,
      isConnected: false,
    };

    try {
      // Test connection first
      const ok = await window.electronAPI.database.testConnection(
        dbType,
        host,
        parseInt(port, 10),
        user,
        password,
        database
      );
      if (!ok) {
        setError("Connection failed. Check host, port, and credentials.");
        setTesting(false);
        return;
      }

      addConnection(conn);
      await connectToDatabase(conn, password);
      // Persist to storage (include password for auto-reconnect)
      await window.electronAPI.database.saveConnection({ ...conn, password });
      setTesting(false);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setTesting(false);
    }
  };

  const inputCls =
    "w-full bg-bg-input border border-[#3c3f41] rounded-item px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent-blue transition-colors duration-200";

  return (
    <div className="px-3 py-2 text-xs space-y-2 bg-[#181a1d] border-t border-[#25262a]">
      <div className="font-semibold text-text-primary text-[11px]">New Connection</div>
      <input className={inputCls} placeholder="Connection name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="flex gap-2">
        <input className={clsx(inputCls, "flex-1")} placeholder="Host" value={host} onChange={(e) => setHost(e.target.value)} />
        <input className={clsx(inputCls, "w-16")} placeholder="Port" value={port} onChange={(e) => setPort(e.target.value)} />
      </div>
      <input className={inputCls} placeholder="Username" value={user} onChange={(e) => setUser(e.target.value)} />
      <input className={inputCls} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <input className={inputCls} placeholder="Database" value={database} onChange={(e) => setDatabase(e.target.value)} />

      {error && <div className="text-status-red text-[10px] break-words">{error}</div>}

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleConnect}
          disabled={testing}
          className="flex-1 bg-accent-button hover:bg-accent-button-hover text-white text-[11px] font-medium py-1.5 rounded-input disabled:opacity-50 transition-all duration-200"
        >
          {testing ? "Connecting…" : "Connect"}
        </button>
        <button
          onClick={onClose}
          className="flex-1 bg-bg-input hover:bg-bg-surface-hover text-text-primary text-[11px] font-medium py-1.5 rounded-input border border-[#3c3f41] transition-all duration-200"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function Connections() {
  const connections = useAppStore((s) => s.connections);
  const tabs = useAppStore((s) => s.tabs);
  const activeConnectionId = useAppStore((s) => s.activeConnectionId);
  const disconnectDatabase = useAppStore((s) => s.disconnectDatabase);
  const deleteConnection = useAppStore((s) => s.deleteConnection);
  const loadConnections = useAppStore((s) => s.loadConnections);
  const connectToDatabase = useAppStore((s) => s.connectToDatabase);
  const addNewFileTab = useAppStore((s) => s.addNewFileTab);
  const openRedisBrowserTab = useAppStore((s) => s.openRedisBrowserTab);
  const [showForm, setShowForm] = useState(false);
  const [reconnectingId, setReconnectingId] = useState<string | null>(null);
  const [passwordEntryId, setPasswordEntryId] = useState<string | null>(null);
  const [passwordDraft, setPasswordDraft] = useState("");
  const [reconnectError, setReconnectError] = useState<string>("");

  // Load saved connections from storage on mount
  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  const ensureQueryTabReady = () => {
    if (tabs.length === 0) {
      addNewFileTab("query.sql", "SELECT NOW() AS connected_at;");
    }
  };

  const connectWithPassword = async (conn: Connection, password: string) => {
    setReconnectError("");
    setReconnectingId(conn.id);

    try {
      await connectToDatabase(conn, password);
      await window.electronAPI.database.saveConnection({ ...conn, password });
      setPasswordEntryId(null);
      setPasswordDraft("");
      if (conn.type === 'redis' && conn.dockerContainerId) {
        openRedisBrowserTab(conn.dockerContainerId, 0);
      } else {
        ensureQueryTabReady();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Connection failed. Check password and connection details.";
      setReconnectError(msg);
      setPasswordEntryId(conn.id);
      setPasswordDraft(password);
    } finally {
      setReconnectingId(null);
    }
  };

  const handleReconnect = async (conn: Connection) => {
    if (conn.isConnected || reconnectingId === conn.id) return;

    if (conn.password) {
      await connectWithPassword(conn, conn.password);
      return;
    }

    setReconnectError("");
    setPasswordEntryId(conn.id);
    setPasswordDraft("");
  };

  const handleInlineConnect = async (conn: Connection) => {
    await connectWithPassword(conn, passwordDraft);
  };

  return (
    <details className="group mt-0.5" open>
      <summary className="flex items-center px-1 py-0.5 cursor-pointer select-none text-text-primary focus:outline-none focus:bg-bg-surface-active glass-row">
        <Icon
          name="chevron_right"
          size={16}
          className="transition-transform group-open:rotate-90 text-text-primary"
        />
        <span className="text-[11px] font-bold uppercase ml-0.5">
          Connections
        </span>
        <button
          onClick={(e) => {
            e.preventDefault();
            setShowForm(!showForm);
          }}
          className="ml-auto mr-2 text-text-secondary hover:text-text-primary"
          title="Add connection"
        >
          <Icon name="add" size={14} />
        </button>
      </summary>

      {showForm && <AddConnectionForm onClose={() => setShowForm(false)} />}

      <div className="flex flex-col text-[13px] pl-4 font-mono">
        {connections.length === 0 && !showForm && (
          <div className="text-text-muted text-[11px] py-2 pl-2">
            No connections. Click + to add one.
          </div>
        )}
        {connections.map((conn) => (
          <div key={conn.id} className="mx-1">
            <div
              onClick={() => handleReconnect(conn)}
              className={clsx(
                "flex items-center gap-2 py-[3px] text-text-primary cursor-pointer text-left pr-2 group/conn glass-row rounded-item",
                activeConnectionId === conn.id && "selected"
              )}
            >
              <Icon
                name={conn.isConnected ? "database" : "cloud_off"}
                size={14}
                className={conn.isConnected ? "text-status-green" : "text-text-muted"}
              />
              <span className="text-xs truncate flex-1">{conn.name}</span>
              <span className="flex gap-1 opacity-0 group-hover/conn:opacity-100">
                {!conn.isConnected && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleReconnect(conn); }}
                    className="text-text-secondary hover:text-status-green"
                    title="Connect"
                  >
                    <Icon name={reconnectingId === conn.id ? "hourglass_empty" : "play_arrow"} size={12} />
                  </button>
                )}
                {conn.isConnected && (
                  <button
                    onClick={(e) => { e.stopPropagation(); disconnectDatabase(conn.id); }}
                    className="text-text-secondary hover:text-status-amber"
                    title="Disconnect"
                  >
                    <Icon name="link_off" size={12} />
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); deleteConnection(conn.id); }}
                  className="text-text-secondary hover:text-status-red"
                  title="Delete connection"
                >
                  <Icon name="delete" size={12} />
                </button>
              </span>
            </div>

            {passwordEntryId === conn.id && !conn.isConnected && (
              <div className="mt-1 mb-2 rounded-item border border-border-subtle bg-bg-input px-2 py-2 text-[11px] space-y-1.5">
                <div className="text-text-secondary">
                  Connect to <span className="text-text-primary">{conn.host}:{conn.port}/{conn.database ?? "postgres"}</span> as <span className="text-text-primary">{conn.username ?? "postgres"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    value={passwordDraft}
                    onChange={(e) => setPasswordDraft(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="Enter database password"
                    className="flex-1 bg-bg-surface border border-border-default rounded-item px-2 py-1 text-[11px] text-text-primary outline-none focus:border-accent-blue"
                  />
                  <button
                    onClick={(e) => { e.stopPropagation(); void handleInlineConnect(conn); }}
                    disabled={reconnectingId === conn.id}
                    className="rounded-item border border-border-default bg-bg-surface-hover px-2 py-1 text-[11px] text-text-primary hover:text-status-green disabled:opacity-60"
                  >
                    {reconnectingId === conn.id ? "Connecting…" : "Connect"}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPasswordEntryId(null);
                      setReconnectError("");
                      setPasswordDraft("");
                    }}
                    className="rounded-item border border-border-default bg-bg-surface px-2 py-1 text-[11px] text-text-secondary hover:text-text-primary"
                  >
                    Cancel
                  </button>
                </div>
                {reconnectError && <div className="text-status-red text-[10px] break-words">{reconnectError}</div>}
                <div className="text-[10px] text-text-muted">Tip: common Docker defaults are postgres, localdev, or root.</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </details>
  );
}
