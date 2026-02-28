import { Icon } from "@/components/ui";
import { useAppStore } from "@/store/useAppStore";
import { clsx } from "clsx";
import { useState, useRef, useEffect } from "react";

export function EditorToolbar() {
  const executeQuery = useAppStore((s) => s.executeQuery);
  const isExecuting = useAppStore((s) => s.isExecuting);
  const activeConnectionId = useAppStore((s) => s.activeConnectionId);
  const connections = useAppStore((s) => s.connections);
  const availableDatabases = useAppStore((s) => s.availableDatabases);
  const selectedDatabase = useAppStore((s) => s.selectedDatabase);
  const selectedText = useAppStore((s) => s.selectedText);
  const switchDatabase = useAppStore((s) => s.switchDatabase);
  const saveCurrentFile = useAppStore((s) => s.saveCurrentFile);
  const commitTransaction = useAppStore((s) => s.commitTransaction);
  const rollbackTransaction = useAppStore((s) => s.rollbackTransaction);

  const [dbDropdownOpen, setDbDropdownOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeConn = connections.find((c) => c.id === activeConnectionId);
  const connLabel = activeConn
    ? `${activeConn.name}`
    : "No connection";

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDbDropdownOpen(false);
      }
    }
    if (dbDropdownOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dbDropdownOpen]);

  const handleSwitchDb = async (dbName: string) => {
    if (dbName === selectedDatabase) {
      setDbDropdownOpen(false);
      return;
    }
    setSwitching(true);
    try {
      await switchDatabase(dbName);
      setDbDropdownOpen(false);
    } catch {
      // error logged in store
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div className="h-9 flex items-center px-4 bg-bg-elevated border-b border-border-default gap-4 shadow-sm z-10">
      {/* Connection + Database breadcrumb */}
      <div className="flex items-center text-[11px] font-mono text-text-secondary gap-1">
        <Icon
          name={activeConn?.isConnected ? "database" : "cloud_off"}
          size={13}
          className={activeConn?.isConnected ? "text-status-green" : "text-text-muted"}
        />
        <span className={clsx(activeConn ? "text-status-green" : "text-text-muted")}>
          {connLabel}
        </span>
        {activeConn && (
          <>
            <Icon name="chevron_right" size={12} />
            {/* Database selector dropdown (Beekeeper-style) */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDbDropdownOpen(!dbDropdownOpen)}
                className={clsx(
                  "flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-bg-surface-hover transition-colors",
                  dbDropdownOpen && "bg-bg-surface-hover"
                )}
                title="Switch database"
              >
                <Icon name="storage" size={12} className="text-syntax-function" />
                <span className="text-text-primary font-semibold">
                  {switching ? "Switching…" : (selectedDatabase ?? activeConn.database ?? "postgres")}
                </span>
                <Icon name="expand_more" size={12} className="text-text-muted" />
              </button>

              {dbDropdownOpen && availableDatabases.length > 0 && (
                <div className="absolute top-full left-0 mt-1 bg-bg-surface border border-border-default rounded shadow-xl z-50 min-w-[180px] max-h-[240px] overflow-auto">
                  <div className="px-2 py-1 text-[10px] text-text-muted uppercase tracking-wider border-b border-border-default">
                    Databases ({availableDatabases.length})
                  </div>
                  {availableDatabases.map((db) => (
                    <button
                      key={db}
                      onClick={() => handleSwitchDb(db)}
                      className={clsx(
                        "flex items-center gap-2 w-full px-3 py-1.5 text-[11px] text-left hover:bg-bg-surface-hover transition-colors",
                        db === selectedDatabase
                          ? "text-accent-blue font-semibold bg-bg-surface-active"
                          : "text-text-primary"
                      )}
                    >
                      <Icon
                        name={db === selectedDatabase ? "check" : "storage"}
                        size={12}
                        className={db === selectedDatabase ? "text-accent-blue" : "text-text-muted"}
                      />
                      {db}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Action buttons */}
      <div className="ml-auto flex items-center gap-2">
        {/* Commit / Rollback group */}
        <div className="flex items-center bg-bg-input rounded border border-border-input overflow-hidden">
          <button
            onClick={() => commitTransaction()}
            disabled={!activeConnectionId || isExecuting}
            className={clsx(
              "flex items-center gap-1.5 px-3 py-0.5 text-text-primary text-[11px] font-medium transition-colors border-r border-border-input",
              activeConnectionId && !isExecuting ? "hover:bg-[#3e3e42]" : "opacity-50 cursor-not-allowed"
            )}
            title="Commit transaction (sends COMMIT to the active connection)"
          >
            <Icon name="check_circle" size={14} className="text-status-green" />
            Commit
          </button>
          <button
            onClick={() => rollbackTransaction()}
            disabled={!activeConnectionId || isExecuting}
            className={clsx(
              "flex items-center gap-1.5 px-3 py-0.5 text-text-primary text-[11px] font-medium transition-colors",
              activeConnectionId && !isExecuting ? "hover:bg-[#3e3e42]" : "opacity-50 cursor-not-allowed"
            )}
            title="Rollback transaction (sends ROLLBACK to the active connection)"
          >
            <Icon name="cancel" size={14} className="text-syntax-string" />
            Rollback
          </button>
        </div>

        <div className="w-[1px] h-4 bg-border-input mx-1" />

        {/* Run button */}
        <button
          onClick={() => executeQuery(selectedText ?? undefined)}
          disabled={isExecuting}
          className={clsx(
            "flex items-center gap-1.5 px-3 py-0.5 text-white text-[11px] font-medium rounded-sm transition-colors shadow-sm",
            isExecuting
              ? "bg-bg-input text-text-muted cursor-wait"
              : "bg-accent-button hover:bg-accent-button-hover"
          )}
          title={selectedText ? "Run selected query (Ctrl+Enter)" : "Run query (Ctrl+Enter)"}
        >
          <Icon name={isExecuting ? "hourglass_empty" : "play_arrow"} size={14} />
          {isExecuting ? "Running…" : (selectedText ? "Run Selection" : "Run")}
        </button>

        {/* Save button */}
        <button
          onClick={() => saveCurrentFile()}
          className="flex items-center gap-1.5 px-3 py-0.5 bg-bg-input hover:bg-[#3e3e42] text-text-primary text-[11px] font-medium rounded-sm transition-colors border border-border-input"
          title="Save file (Ctrl+S)"
        >
          <Icon name="save" size={14} />
          Save
        </button>

        {/* More */}
        <button className="p-0.5 text-text-secondary hover:text-text-primary rounded hover:bg-[#3e3e42]">
          <Icon name="more_horiz" size={18} />
        </button>
      </div>
    </div>
  );
}
