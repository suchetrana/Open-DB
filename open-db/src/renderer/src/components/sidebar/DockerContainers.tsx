import React, { useState } from "react";
import { Icon } from "@/components/ui";
import { useAppStore } from "@/store/useAppStore";
import { clsx } from "clsx";
import type { ContainerStatus, DatabaseType, Connection } from "@/types";

function genId(): string {
  return "conn-" + Math.random().toString(36).slice(2, 10);
}

const DB_DEFAULT_USERS: Record<string, string> = {
  postgres: "postgres",
  mysql: "root",
  mongodb: "admin",
  redis: "",
};

const DB_DEFAULT_DBS: Record<string, string> = {
  postgres: "postgres",
  mysql: "mysql",
  mongodb: "test",
  redis: "",
};

const DB_PASSWORD_CANDIDATES: Record<string, string[]> = {
  postgres: ["postgres", "localdev", "root"],
  mysql: ["root", "localdev", "mysql"],
  mongodb: ["admin", "localdev", "mongodb"],
  redis: ["", "redis", "localdev", "root"],
};

function StatusDot({ status }: { status: ContainerStatus }) {
  if (status === "running") {
    return <div className="w-2 h-2 rounded-full bg-status-green shadow-[0_0_8px_rgba(115,176,10,0.45)]" />;
  }
  if (status === "starting") {
    return <div className="w-2 h-2 rounded-full bg-status-amber animate-pulse" />;
  }
  return <div className="w-2 h-2 rounded-full border border-[#52525b]" />;
}

function statusTextColor(status: ContainerStatus): string {
  if (status === "running") return "text-status-green";
  if (status === "starting") return "text-status-amber";
  return "text-text-secondary";
}

function statusLabel(status: ContainerStatus): string {
  if (status === "running") return "Running";
  if (status === "starting") return "Starting";
  return "Stopped";
}

const DB_TYPES: { label: string; value: DatabaseType }[] = [
  { label: "PostgreSQL", value: "postgres" },
  { label: "MySQL", value: "mysql" },
  { label: "MongoDB", value: "mongodb" },
  { label: "Redis", value: "redis" },
];

function CreateContainerForm({ onClose }: { onClose: () => void }) {
  const createDockerContainer = useAppStore((s) => s.createDockerContainer);
  const [name, setName] = useState("opendb-postgres");
  const [dbType, setDbType] = useState<DatabaseType>("postgres");
  const [port, setPort] = useState("5432");
  const [password, setPassword] = useState("postgres");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const portDefaults: Record<DatabaseType, string> = {
    postgres: "5432",
    mysql: "3306",
    cassandra: "9042",
    mongodb: "27017",
    redis: "6379",
  };

  const handleTypeChange = (t: DatabaseType) => {
    setDbType(t);
    setPort(portDefaults[t]);
    setName(`opendb-${t}`);
  };

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    setError("");
    try {
      await createDockerContainer({ name: name.trim() || `opendb-${dbType}`, type: dbType, port: parseInt(port, 10), password });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  };

  const inputCls =
    "w-full rounded-item bg-bg-input border border-[#3c3f41] px-2 py-1 text-xs text-text-primary outline-none focus:border-accent-blue transition-colors duration-200";

  return (
    <div className="px-3 py-2 text-xs space-y-2 bg-[#181a1d] border-t border-[#25262a]">
      <div className="font-semibold text-text-primary text-[11px]">Create Container</div>
      <select
        className={inputCls}
        value={dbType}
        onChange={(e) => handleTypeChange(e.target.value as DatabaseType)}
      >
        {DB_TYPES.map((t) => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>
      <input className={inputCls} placeholder="Container name" value={name} onChange={(e) => setName(e.target.value)} />
      <input className={inputCls} placeholder="Host port" value={port} onChange={(e) => setPort(e.target.value)} />
      {dbType !== "redis" && (
        <input className={inputCls} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
      )}
      {error && <div className="text-status-red text-[10px] break-words">{error}</div>}
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleCreate}
          disabled={creating}
          className="flex-1 rounded-input bg-accent-button hover:bg-accent-button-hover text-white text-[11px] font-medium py-1.5 disabled:opacity-50 transition-all duration-200 shadow-glass"
        >
          {creating ? "Creating…" : "Create & Start"}
        </button>
        <button
          onClick={onClose}
          className="flex-1 rounded-input bg-bg-input hover:bg-bg-surface-hover text-text-primary text-[11px] font-medium py-1.5 border border-[#3c3f41] transition-all duration-200"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function DockerContainers() {
  const containers = useAppStore((s) => s.containers);
  const connections = useAppStore((s) => s.connections);
  const dockerAvailable = useAppStore((s) => s.dockerAvailable);
  const fetchContainers = useAppStore((s) => s.fetchContainers);
  const fetchDockerStatus = useAppStore((s) => s.fetchDockerStatus);
  const startContainer = useAppStore((s) => s.startContainer);
  const stopContainer = useAppStore((s) => s.stopContainer);
  const removeContainer = useAppStore((s) => s.removeContainer);
  const addConnection = useAppStore((s) => s.addConnection);
  const connectToDatabase = useAppStore((s) => s.connectToDatabase);
  const setSidebarView = useAppStore((s) => s.setSidebarView);
  const [showCreate, setShowCreate] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [connectingContainerId, setConnectingContainerId] = useState<string | null>(null);

  // Fetch real containers on mount
  React.useEffect(() => {
    fetchDockerStatus();
    fetchContainers();
    const id = setInterval(() => {
      fetchDockerStatus();
      fetchContainers();
    }, 5000);
    return () => clearInterval(id);
  }, [fetchContainers, fetchDockerStatus]);

  const handleRefreshDocker = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await fetchDockerStatus();
      await fetchContainers();
    } finally {
      setRefreshing(false);
    }
  };

  const findConnectionForContainer = (c: { id: string; port: number; type: string }): Connection | undefined => {
    return connections.find((conn) =>
      conn.dockerContainerId === c.id
      || (conn.type === c.type && conn.host === "localhost" && conn.port === c.port)
    );
  };

  const handleConnectToContainer = async (c: { id: string; name: string; port: number; type: string }) => {
    const dbType = c.type as DatabaseType;
    const user = DB_DEFAULT_USERS[dbType] ?? "postgres";
    const db = DB_DEFAULT_DBS[dbType] ?? "postgres";

    if (connectingContainerId) return;
    setConnectingContainerId(c.id);

    const existingConn = findConnectionForContainer(c);
    const conn: Connection = existingConn
      ? {
          ...existingConn,
          name: existingConn.name || c.name,
          type: dbType,
          host: existingConn.host || "localhost",
          port: existingConn.port || c.port,
          username: existingConn.username ?? user,
          database: existingConn.database || db,
          dockerContainerId: c.id,
        }
      : {
      id: genId(),
      name: c.name,
      type: dbType,
      host: "localhost",
      port: c.port,
      username: user,
      database: db,
      isConnected: false,
      dockerContainerId: c.id,
    };

    if (!existingConn) {
      addConnection(conn);
    } else {
      addConnection(conn);
    }
    await window.electronAPI.database.saveConnection(conn).catch((err: unknown) => {
      console.error(`[Docker connect] Failed to save connection ${conn.id} (${conn.name})`, err);
    });

    try {
      if (conn.password) {
        try {
          await connectToDatabase(conn, conn.password);
          await window.electronAPI.database.saveConnection({ ...conn, password: conn.password });
          setSidebarView("schema");
          return;
        } catch {
          // try defaults below
        }
      }

      const attempts = DB_PASSWORD_CANDIDATES[dbType] ?? ["postgres", "localdev", "root"];
      for (const candidate of attempts) {
        try {
          await connectToDatabase(conn, candidate);
          await window.electronAPI.database.saveConnection({ ...conn, password: candidate });
          setSidebarView("schema");
          return;
        } catch {
          // keep trying candidates
        }
      }

      if (dbType === 'redis') {
        const entered = window.prompt(`Redis password required for ${c.name}. Enter password:`, "")
        if (entered !== null) {
          try {
            await connectToDatabase(conn, entered)
            await window.electronAPI.database.saveConnection({ ...conn, password: entered })
            setSidebarView('schema')
            return
          } catch {
            window.alert('Redis authentication failed. Please verify password and try again from Connections.')
          }
        }
      }

      // Redirect user to Connections panel to enter password via GUI inline form
      setSidebarView("schema");
    } finally {
      setConnectingContainerId(null);
    }
  };

  return (
    <details className="group mt-0.5" open>
      <summary
        className="mx-1 flex items-center rounded-item bg-white/[0.02] px-1.5 py-1 cursor-pointer select-none text-text-primary focus:outline-none"
        style={{ width: "calc(100% - 8px)" }}
      >
        <Icon
          name="chevron_right"
          size={14}
          className="transition-transform group-open:rotate-90 text-text-muted"
        />
        <span className="text-[11px] font-bold uppercase ml-1 tracking-[0.06em] text-text-secondary">
          Docker Containers
        </span>
        {dockerAvailable && (
          <span className="ml-auto mr-1 flex items-center gap-1">
            <button
              onClick={(e) => { e.preventDefault(); handleRefreshDocker(); }}
              className="rounded-item p-1 text-text-muted hover:text-text-primary hover:bg-bg-surface-hover transition-colors duration-200"
              title="Refresh Docker status"
            >
              <Icon name="refresh" size={14} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={(e) => { e.preventDefault(); setShowCreate(!showCreate); }}
              className="rounded-item p-1 text-text-muted hover:text-text-primary hover:bg-bg-surface-hover transition-colors duration-200"
              title="Create container"
            >
              <Icon name="add" size={14} />
            </button>
          </span>
        )}
        {!dockerAvailable && (
          <button
            onClick={(e) => { e.preventDefault(); handleRefreshDocker(); }}
            className="ml-auto mr-1 rounded-item p-1 text-text-muted hover:text-text-primary hover:bg-bg-surface-hover transition-colors duration-200"
            title="Retry Docker connection"
          >
            <Icon name="refresh" size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
        )}
      </summary>

      {showCreate && dockerAvailable && <CreateContainerForm onClose={() => setShowCreate(false)} />}

      <div className="px-4 pt-1 pb-2 text-[12px] text-text-muted">
        Manage local database containers quickly.
      </div>

      <div className="flex flex-col text-[13px] pb-2 font-mono">
        {!dockerAvailable && (
          <div className="text-text-muted text-[12px] py-2 pl-6 space-y-2">
            <div className="flex items-center gap-1.5">
              <Icon name="warning" size={13} className="text-status-amber" />
              Docker not available
            </div>
            <div className="text-[11px] text-text-secondary pl-3.5">
              Start Docker Desktop to manage containers.
            </div>
            <button
              onClick={handleRefreshDocker}
              disabled={refreshing}
              className="ml-3.5 flex items-center gap-1 text-[11px] text-accent-blue hover:text-text-bright disabled:opacity-50"
            >
              <Icon name="refresh" size={12} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Checking…' : 'Retry connection'}
            </button>
          </div>
        )}
        {dockerAvailable && containers.length === 0 && !showCreate && (
          <div className="text-text-muted text-[12px] py-2 pl-6">
            No containers. Click + to create one.
          </div>
        )}
        <div className="flex flex-col gap-2 px-2 pb-2">
        {containers.map((c) => (
          <div
            key={c.id}
            className="rounded-item border border-border-default bg-[#27272a] px-3 py-2.5 text-text-primary cursor-pointer group/item transition-colors duration-200 hover:border-[#52525b]"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <StatusDot status={c.status} />
                <span
                  className={clsx(
                    "truncate font-mono text-[13px] font-medium",
                    c.status === "stopped" ? "text-text-secondary" : "text-text-primary"
                  )}
                >
                  {c.name}
                </span>
              </div>
              <span className="flex items-center gap-1.5">
                {c.status === "running" && (
                  <button
                    onClick={(e) => { e.stopPropagation(); stopContainer(c.id); }}
                    title="Stop container"
                    className="rounded-item p-1 text-status-red hover:text-[#f87171] hover:bg-status-red/15 transition-colors duration-200"
                  >
                    <Icon name="stop" size={14} />
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const confirmed = window.confirm(`Remove container "${c.name}"? This action cannot be undone.`);
                    if (confirmed) {
                      void removeContainer(c.id);
                    }
                  }}
                  title="Remove container"
                  className="rounded-item p-1 text-text-secondary hover:text-status-red hover:bg-status-red/15 transition-colors duration-200"
                >
                  <Icon name="delete" size={14} />
                </button>
              </span>
            </div>

            <div className="mt-2 flex items-center gap-1.5">
              <span className={clsx("text-[10px] font-semibold uppercase tracking-[0.05em]", statusTextColor(c.status))}>
                {statusLabel(c.status)}
              </span>
              <span className="rounded-item bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.05em] text-text-secondary">
                {c.type}
              </span>
              {c.port > 0 && (
                <span className="rounded-item bg-accent-blue/10 px-1.5 py-0.5 text-[10px] font-mono text-accent-blue">:{c.port}</span>
              )}
            </div>

            <div className="mt-2 flex items-center justify-end gap-2">
              {c.status === "stopped" && (
                <button
                  onClick={(e) => { e.stopPropagation(); startContainer(c.id); }}
                  title="Run container"
                  className="flex items-center gap-1 rounded-item border border-border-default px-2.5 py-1 text-[12px] font-medium text-text-primary hover:bg-bg-surface-hover transition-colors duration-200"
                >
                  <Icon name="play_arrow" size={14} />
                  Run
                </button>
              )}
              {c.status === "running" && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleConnectToContainer(c); }}
                  title="Connect to database"
                  className="flex items-center gap-1 rounded-item border border-white/10 bg-white/10 px-2.5 py-1 text-[12px] font-medium text-text-primary hover:bg-white/15 transition-colors duration-200"
                >
                  <Icon name="database" size={13} />
                  {connectingContainerId === c.id ? "Connecting..." : "Connect"}
                </button>
              )}
            </div>
          </div>
        ))}
        </div>
      </div>
    </details>
  );
}
