import { Icon } from "@/components/ui";
import { useAppStore } from "@/store/useAppStore";
import { clsx } from "clsx";

export function EditorToolbar() {
  const executeQuery = useAppStore((s) => s.executeQuery);
  const isExecuting = useAppStore((s) => s.isExecuting);
  const activeConnectionId = useAppStore((s) => s.activeConnectionId);
  const connections = useAppStore((s) => s.connections);

  const activeConn = connections.find((c) => c.id === activeConnectionId);
  const connLabel = activeConn
    ? `${activeConn.name}`
    : "No connection";

  return (
    <div className="h-9 flex items-center px-4 bg-bg-elevated border-b border-border-default gap-4 shadow-sm z-10">
      {/* Breadcrumb */}
      <div className="flex items-center text-[11px] font-mono text-text-secondary gap-1">
        <span className={clsx(activeConn ? "text-status-green" : "text-text-muted")}>
          {connLabel}
        </span>
        {activeConn && (
          <>
            <Icon name="chevron_right" size={12} />
            <span className="text-text-primary font-semibold">
              {activeConn.database ?? "postgres"}
            </span>
          </>
        )}
      </div>

      {/* Action buttons */}
      <div className="ml-auto flex items-center gap-2">
        {/* Commit / Rollback group */}
        <div className="flex items-center bg-bg-input rounded border border-border-input overflow-hidden">
          <button className="flex items-center gap-1.5 px-3 py-0.5 hover:bg-[#3e3e42] text-text-primary text-[11px] font-medium transition-colors border-r border-border-input">
            <Icon name="check_circle" size={14} className="text-status-green" />
            Commit
          </button>
          <button className="flex items-center gap-1.5 px-3 py-0.5 hover:bg-[#3e3e42] text-text-primary text-[11px] font-medium transition-colors">
            <Icon name="cancel" size={14} className="text-syntax-string" />
            Rollback
          </button>
        </div>

        <div className="w-[1px] h-4 bg-border-input mx-1" />

        {/* Run button */}
        <button
          onClick={() => executeQuery()}
          disabled={isExecuting}
          className={clsx(
            "flex items-center gap-1.5 px-3 py-0.5 text-white text-[11px] font-medium rounded-sm transition-colors shadow-sm",
            isExecuting
              ? "bg-bg-input text-text-muted cursor-wait"
              : "bg-accent-button hover:bg-accent-button-hover"
          )}
          title="Run query (Ctrl+Enter)"
        >
          <Icon name={isExecuting ? "hourglass_empty" : "play_arrow"} size={14} />
          {isExecuting ? "Running…" : "Run"}
        </button>

        {/* Save button */}
        <button className="flex items-center gap-1.5 px-3 py-0.5 bg-bg-input hover:bg-[#3e3e42] text-text-primary text-[11px] font-medium rounded-sm transition-colors border border-border-input">
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
