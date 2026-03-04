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
    return <div className="w-2 h-2 rounded-full bg-status-green pulse-dot" />;
  }
  if (status === "starting") {
    return <div className="w-2 h-2 rounded-full bg-status-amber animate-pulse" />;
  }
  return <div className="w-2 h-2 rounded-full border border-text-secondary" />;
}

function statusTextColor(status: ContainerStatus): string {
  if (status === "running") return "text-status-green";
  if (status === "starting") return "text-status-amber";
  return "text-text-secondary";
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
    "w-full bg-bg-input border border-border-input rounded px-2 py-1 text-xs text-text-primary outline-none focus:border-accent-blue";

  return (
    <div className="px-3 py-2 text-xs space-y-2 bg-bg-surface border-t border-border-default">
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
          className="flex-1 bg-accent-button hover:bg-accent-button-hover text-white text-[11px] font-medium py-1 rounded-sm disabled:opacity-50"
        >
          {creating ? "Creating…" : "Create & Start"}
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
      <summary className="flex items-center px-1 py-0.5 cursor-pointer hover:bg-bg-surface-hover select-none text-text-primary focus:outline-none focus:bg-bg-surface-active">
        <Icon
          name="chevron_right"
          size={16}
          className="transition-transform group-open:rotate-90 text-text-primary"
        />
        <span className="text-[11px] font-bold uppercase ml-0.5">
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

      <div className="flex flex-col text-[13px] pb-2 font-mono">
        {!dockerAvailable && (
          <div className="text-text-muted text-[11px] py-2 pl-6 space-y-2">
            <div className="flex items-center gap-1.5">
              <Icon name="warning" size={12} className="text-status-amber" />
              Docker not available
            </div>
            <div className="text-[10px] text-text-secondary pl-3.5">
              Start Docker Desktop to manage containers.
            </div>
            <button
              onClick={handleRefreshDocker}
              disabled={refreshing}
              className="ml-3.5 flex items-center gap-1 text-[10px] text-accent-blue hover:text-text-bright disabled:opacity-50"
            >
              <Icon name="refresh" size={12} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Checking…' : 'Retry connection'}
            </button>
          </div>
        )}
        {dockerAvailable && containers.length === 0 && !showCreate && (
          <div className="text-text-muted text-[11px] py-2 pl-6">
            No containers. Click + to create one.
          </div>
        )}
        {containers.map((c) => (
          <div
            key={c.id}
            className="flex items-center gap-2 px-4 py-[3px] hover:bg-bg-surface-hover text-text-primary cursor-pointer group/item"
          >
            <StatusDot status={c.status} />
            <span
              className={clsx(
                "truncate text-xs flex-1",
                statusTextColor(c.status),
                c.status === "stopped" && "line-through decoration-[#555]"
              )}
            >
              {c.name}
            </span>
            {c.port > 0 && (
              <span className="text-[9px] text-text-muted font-mono">:{c.port}</span>
            )}
            <span className="ml-auto opacity-0 group-hover/item:opacity-100 flex gap-1">
              {c.status === "stopped" ? (
                <>
                  <button onClick={(e) => { e.stopPropagation(); startContainer(c.id); }} title="Start">
                    <Icon name="play_arrow" size={14} className="text-text-secondary hover:text-status-green" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); removeContainer(c.id); }} title="Remove">
                    <Icon name="delete" size={14} className="text-text-secondary hover:text-status-red" />
                  </button>
                </>
              ) : c.status === "running" ? (
                <>
                  <button onClick={(e) => { e.stopPropagation(); handleConnectToContainer(c); }} title="Connect to database">
                    <Icon name="database" size={14} className="text-text-secondary hover:text-status-green" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); stopContainer(c.id); }} title="Stop">
                    <Icon name="stop" size={14} className="text-text-secondary hover:text-status-red" />
                  </button>
                </>
              ) : null}
            </span>
          </div>
        ))}
      </div>
    </details>
  );
}
