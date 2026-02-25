import { Icon } from "@/components/ui";
import { useAppStore } from "@/store/useAppStore";
import { ResultsTable } from "./ResultsTable";

export function ResultsPanel() {
  const queryResult = useAppStore((s) => s.queryResult);
  const isExecuting = useAppStore((s) => s.isExecuting);
  const queryError = useAppStore((s) => s.queryError);

  // Loading state
  if (isExecuting) {
    return (
      <div className="flex-1 bg-bg-elevated flex items-center justify-center">
        <div className="flex items-center gap-3 text-text-secondary text-sm">
          <Icon name="hourglass_empty" size={20} className="animate-spin" />
          Executing query…
        </div>
      </div>
    );
  }

  // Error state
  if (queryError) {
    return (
      <div className="flex-1 bg-bg-elevated flex flex-col overflow-hidden">
        <div className="px-4 py-1.5 border-b border-border-default bg-bg-surface flex items-center">
          <span className="text-[10px] font-bold text-status-red uppercase tracking-wider">
            Query Error
          </span>
        </div>
        <div className="p-4 text-status-red text-xs font-mono whitespace-pre-wrap overflow-auto">
          {queryError}
        </div>
      </div>
    );
  }

  if (!queryResult) {
    return (
      <div className="flex-1 bg-bg-elevated flex items-center justify-center">
        <div className="text-text-muted text-xs font-mono">
          Run a query to see results (Ctrl+Enter)
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-bg-elevated flex flex-col overflow-hidden">
      {/* Results header */}
      <div className="px-4 py-1.5 border-b border-border-default bg-bg-surface flex items-center justify-between">
        <span className="text-[10px] font-bold text-text-primary uppercase tracking-wider">
          Query Results{" "}
          <span className="text-text-secondary font-normal normal-case ml-2 font-mono">
            ({queryResult.rowCount} rows, {(queryResult.executionTimeMs / 1000).toFixed(3)}s)
          </span>
        </span>

        <div className="flex gap-2">
          <button className="text-text-secondary hover:text-text-primary">
            <Icon name="download" size={16} />
          </button>
          <button className="text-text-secondary hover:text-text-primary">
            <Icon name="filter_list" size={16} />
          </button>
          <button className="text-text-secondary hover:text-text-primary">
            <Icon name="splitscreen" size={16} />
          </button>
        </div>
      </div>

      {/* Results table */}
      <ResultsTable columns={queryResult.columns} rows={queryResult.rows} />
    </div>
  );
}
