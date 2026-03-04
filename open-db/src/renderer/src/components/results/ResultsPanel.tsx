import { Icon } from "@/components/ui";
import { useAppStore } from "@/store/useAppStore";
import { ResultsTable } from "./ResultsTable";

export function ResultsPanel() {
  const queryResult = useAppStore((s) => s.queryResult);
  const isExecuting = useAppStore((s) => s.isExecuting);
  const queryError = useAppStore((s) => s.queryError);
  const resultsPanelMode = useAppStore((s) => s.resultsPanelMode);
  const setResultsPanelMode = useAppStore((s) => s.setResultsPanelMode);

  // Minimized: show only the header bar
  if (resultsPanelMode === 'minimized') {
    return (
      <div className="bg-[#181a1d] border-t border-[#25262a]">
        <div className="px-4 py-1.5 flex items-center justify-between">
          <span className="text-[10px] font-bold text-text-primary uppercase tracking-wider">
            Query Results
            {queryResult && (
              <span className="text-text-secondary font-normal normal-case ml-2 font-mono">
                ({queryResult.rowCount} rows, {(queryResult.executionTimeMs / 1000).toFixed(3)}s)
              </span>
            )}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setResultsPanelMode('normal')}
              className="text-text-secondary hover:text-text-primary p-0.5 rounded-item hover:bg-white/6 transition-colors duration-200"
              title="Restore"
            >
              <Icon name="expand_less" size={16} />
            </button>
            <button
              onClick={() => setResultsPanelMode('maximized')}
              className="text-text-secondary hover:text-text-primary p-0.5 rounded-item hover:bg-white/6 transition-colors duration-200"
              title="Maximize"
            >
              <Icon name="open_in_full" size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (isExecuting) {
    return (
      <div className="flex-1 bg-[#181a1d] flex items-center justify-center">
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
      <div className="flex-1 bg-[#181a1d] flex flex-col overflow-hidden">
        <div className="px-4 py-1.5 border-b border-[#25262a] bg-[#181a1d] flex items-center justify-between">
          <span className="text-[10px] font-bold text-status-red uppercase tracking-wider">
            Query Error
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setResultsPanelMode('minimized')}
              className="text-text-secondary hover:text-text-primary p-0.5 rounded-item hover:bg-white/6 transition-colors duration-200"
              title="Minimize"
            >
              <Icon name="expand_more" size={16} />
            </button>
          </div>
        </div>
        <div className="p-4 text-status-red text-xs font-mono whitespace-pre-wrap overflow-auto">
          {queryError}
        </div>
      </div>
    );
  }

  if (!queryResult) {
    return (
      <div className="flex-1 bg-[#181a1d] flex items-center justify-center">
        <div className="text-text-muted text-xs font-mono">
          Run a query to see results (Ctrl+Enter)
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[#181a1d] flex flex-col overflow-hidden">
      {/* Results header with minimize/maximize controls */}
      <div className="px-4 py-1.5 border-b border-[#25262a] bg-[#181a1d] flex items-center justify-between">
        <span className="text-[10px] font-bold text-text-primary uppercase tracking-wider">
          Query Results{" "}
          <span className="text-text-secondary font-normal normal-case ml-2 font-mono">
            ({queryResult.rowCount} rows, {(queryResult.executionTimeMs / 1000).toFixed(3)}s)
          </span>
        </span>

        <div className="flex gap-1">
          <button
            className="text-text-secondary hover:text-text-primary p-0.5 rounded-item hover:bg-white/6 transition-colors duration-200"
            title="Download"
          >
            <Icon name="download" size={16} />
          </button>
          <button
            className="text-text-secondary hover:text-text-primary p-0.5 rounded-item hover:bg-white/6 transition-colors duration-200"
            title="Filter"
          >
            <Icon name="filter_list" size={16} />
          </button>

          <div className="w-[1px] h-4 bg-[#25262a] mx-0.5" />

          <button
            onClick={() => setResultsPanelMode('minimized')}
            className="text-text-secondary hover:text-text-primary p-0.5 rounded-item hover:bg-white/6 transition-colors duration-200"
            title="Minimize results"
          >
            <Icon name="expand_more" size={16} />
          </button>
          <button
            onClick={() => setResultsPanelMode(resultsPanelMode === 'maximized' ? 'normal' : 'maximized')}
            className="text-text-secondary hover:text-text-primary p-0.5 rounded-item hover:bg-white/6 transition-colors duration-200"
            title={resultsPanelMode === 'maximized' ? "Restore" : "Maximize results"}
          >
            <Icon name={resultsPanelMode === 'maximized' ? "close_fullscreen" : "open_in_full"} size={16} />
          </button>
        </div>
      </div>

      {/* Results table */}
      <ResultsTable columns={queryResult.columns} rows={queryResult.rows} />
    </div>
  );
}
