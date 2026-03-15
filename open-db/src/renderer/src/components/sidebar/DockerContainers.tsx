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
  mongodb: "admin",
  redis: "",
};

function StatusDot({ status }: { status: ContainerStatus }) {
  if (status === "running") {
    return <div className="w-2.5 h-2.5 rounded-full bg-status-green pulse-dot" />;
  }
  if (status === "starting") {
    return <div className="w-2.5 h-2.5 rounded-full bg-status-amber animate-pulse" />;
  }
  return <div className="w-2.5 h-2.5 rounded-full border border-text-secondary" />;
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
  const dockerAvailable = useAppStore((s) => s.dockerAvailable);
  const fetchContainers = useAppStore((s) => s.fetchContainers);
  const fetchDockerStatus = useAppStore((s) => s.fetchDockerStatus);
  const startContainer = useAppStore((s) => s.startContainer);
  const stopContainer = useAppStore((s) => s.stopContainer);
  const removeContainer = useAppStore((s) => s.removeContainer);
  const addConnection = useAppStore((s) => s.addConnection);
  const connectToDatabase = useAppStore((s) => s.connectToDatabase);
  const [showCreate, setShowCreate] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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

  const handleConnectToContainer = async (c: { id: string; name: string; port: number; type: string }) => {
    const dbType = c.type as DatabaseType;
    const user = DB_DEFAULT_USERS[dbType] ?? "postgres";
    const db = DB_DEFAULT_DBS[dbType] ?? "postgres";

    const pw = prompt(`Enter password for ${c.name} (${dbType}):\n\nDefault for Docker: postgres, localdev, or root`, "postgres");
    if (pw === null) return;

    const conn: Connection = {
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

    try {
      addConnection(conn);
      await connectToDatabase(conn, pw);
      // Save with password for auto-reconnect
      await window.electronAPI.database.saveConnection({ ...conn, password: pw });
    } catch {
      alert(`Failed to connect to ${c.name}. Check password and that the container is ready.`);
    }
  };

  return (
    <details className="group mt-0.5" open>
      <summary className="glass-row mx-1 cursor-pointer select-none text-text-primary focus:outline-none" style={{ width: 'calc(100% - 8px)' }}>
        <Icon
          name="chevron_right"
          size={17}
          className="transition-transform group-open:rotate-90 text-text-primary"
        />
        <span className="text-[12px] font-bold uppercase ml-0.5 tracking-[0.5px]">
          Docker Containers
        </span>
        {dockerAvailable && (
          <span className="ml-auto mr-2 flex gap-1">
            <button
              onClick={(e) => { e.preventDefault(); handleRefreshDocker(); }}
              className="text-text-secondary hover:text-text-primary"
              title="Refresh Docker status"
            >
              <Icon name="refresh" size={14} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={(e) => { e.preventDefault(); setShowCreate(!showCreate); }}
              className="text-text-secondary hover:text-text-primary"
              title="Create container"
            >
              <Icon name="add" size={14} />
            </button>
          </span>
        )}
        {!dockerAvailable && (
          <button
            onClick={(e) => { e.preventDefault(); handleRefreshDocker(); }}
            className="ml-auto mr-2 text-text-secondary hover:text-text-primary"
            title="Retry Docker connection"
          >
            <Icon name="refresh" size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
        )}
      </summary>

      {showCreate && dockerAvailable && <CreateContainerForm onClose={() => setShowCreate(false)} />}

      <div className="px-3 pt-1 pb-0.5 text-[11px] text-text-muted">
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
        <div className="flex flex-col gap-2 px-1 pt-1">
        {containers.map((c) => (
          <div
            key={c.id}
            className="glass-row mx-1 px-3 py-2.5 text-text-primary cursor-pointer group/item border border-border-subtle bg-bg-surface shadow-glass"
            style={{ width: 'calc(100% - 8px)' }}
          >
            <div className="flex items-center gap-2">
              <StatusDot status={c.status} />
              <span className={clsx("text-[11px] font-semibold uppercase tracking-wide", statusTextColor(c.status))}>
                {statusLabel(c.status)}
              </span>
              <span className="rounded-item border border-border-subtle px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-text-secondary">
                {c.type}
              </span>
              <span className="ml-auto flex items-center gap-1.5">
                {c.status === "stopped" && (
                  <button
                    onClick={(e) => { e.stopPropagation(); startContainer(c.id); }}
                    title="Run container"
                    className="flex items-center gap-1 rounded-input border border-border-default bg-bg-surface-hover px-2 py-1 text-[11px] font-medium text-text-primary hover:text-status-green transition-colors duration-200"
                  >
                    <Icon name="play_arrow" size={14} />
                    Run
                  </button>
                )}
                {c.status === "running" && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleConnectToContainer(c); }}
                    title="Connect to database"
                    className="flex items-center gap-1 rounded-input border border-border-default bg-bg-surface-hover px-2 py-1 text-[11px] font-medium text-text-primary hover:text-status-green transition-colors duration-200"
                  >
                    <Icon name="database" size={13} />
                    Connect
                  </button>
                )}
              </span>
            </div>

            <div className="mt-2 flex items-center gap-2 text-[13px]">
              <span
                className={clsx(
                  "truncate font-semibold",
                  c.status === "stopped" && "line-through decoration-[#555] text-text-secondary"
                )}
              >
                {c.name}
              </span>
              {c.port > 0 && (
                <span className="rounded-item border border-border-subtle px-1.5 py-0.5 text-[11px] text-text-muted font-mono">:{c.port}</span>
              )}

              <span className="ml-auto flex items-center gap-1 opacity-80 group-hover/item:opacity-100 transition-opacity duration-200">
                {c.status === "running" && (
                  <button
                    onClick={(e) => { e.stopPropagation(); stopContainer(c.id); }}
                    title="Stop container"
                    className="rounded-item p-1 hover:bg-bg-surface-hover"
                  >
                    <Icon name="stop" size={14} className="text-text-secondary hover:text-status-red" />
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); removeContainer(c.id); }}
                  title="Remove container"
                  className="rounded-item p-1 hover:bg-bg-surface-hover"
                >
                  <Icon name="delete" size={14} className="text-text-secondary hover:text-status-red" />
                </button>
              </span>
            </div>
          </div>
        ))}
        </div>
      </div>
    </details>
  );
}
