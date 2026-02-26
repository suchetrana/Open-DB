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
    "w-full bg-bg-input border border-border-input rounded px-2 py-1 text-xs text-text-primary outline-none focus:border-accent-blue";

  return (
    <div className="px-3 py-2 text-xs space-y-2 bg-bg-surface border-t border-border-default">
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
          className="flex-1 bg-accent-button hover:bg-accent-button-hover text-white text-[11px] font-medium py-1 rounded-sm disabled:opacity-50"
        >
          {testing ? "Connecting…" : "Connect"}
        </button>
        <button
          onClick={onClose}
          className="flex-1 bg-bg-input hover:bg-[#3e3e42] text-text-primary text-[11px] font-medium py-1 rounded-sm border border-border-input"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function Connections() {
  const connections = useAppStore((s) => s.connections);
  const activeConnectionId = useAppStore((s) => s.activeConnectionId);
  const disconnectDatabase = useAppStore((s) => s.disconnectDatabase);
  const deleteConnection = useAppStore((s) => s.deleteConnection);
  const loadConnections = useAppStore((s) => s.loadConnections);
  const connectToDatabase = useAppStore((s) => s.connectToDatabase);
  const [showForm, setShowForm] = useState(false);

  // Load saved connections from storage on mount
  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  const handleReconnect = async (conn: Connection) => {
    if (conn.isConnected) return;
    // Try saved password first, otherwise prompt
    let pw = conn.password ?? null;
    if (!pw) {
      pw = prompt(`Enter password for ${conn.name}:`);
      if (pw === null) return;
    }
    try {
      await connectToDatabase(conn, pw);
      // Save password for future auto-reconnect
      await window.electronAPI.database.saveConnection({ ...conn, password: pw });
    } catch {
      alert(`Failed to connect to ${conn.name}`);
    }
  };

  return (
    <details className="group mt-0.5" open>
      <summary className="flex items-center px-1 py-0.5 cursor-pointer hover:bg-bg-surface-hover select-none text-text-primary focus:outline-none focus:bg-bg-surface-active">
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
          <div
            key={conn.id}
            onClick={() => handleReconnect(conn)}
            className={clsx(
              "flex items-center gap-2 py-[3px] hover:bg-bg-surface-hover text-text-primary cursor-pointer text-left pr-2 group/conn",
              activeConnectionId === conn.id && "bg-bg-surface-active"
            )}
          >
            <Icon
              name={conn.isConnected ? "database" : "cloud_off"}
              size={14}
              className={conn.isConnected ? "text-status-green" : "text-text-muted"}
            />
            <span className="text-xs truncate flex-1">{conn.name}</span>
            <span className="flex gap-1 opacity-0 group-hover/conn:opacity-100">
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
        ))}
      </div>
    </details>
  );
}
