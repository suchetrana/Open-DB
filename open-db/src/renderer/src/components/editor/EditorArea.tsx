import { useRef, useCallback, useState, useEffect } from "react";
import { EditorTabs } from "./EditorTabs";
import { EditorToolbar } from "./EditorToolbar";
import { SqlEditor } from "./SqlEditor";
import { ResultsPanel } from "@/components/results/ResultsPanel";
import { Icon, Splitter } from "@/components/ui";
import { useAppStore } from "@/store/useAppStore";

function WelcomeScreen() {
  const openFolder = useAppStore((s) => s.openFolder);
  const openFileDialog = useAppStore((s) => s.openFileDialog);
  const addNewFileTab = useAppStore((s) => s.addNewFileTab);

  return (
    <div className="flex-1 flex items-center justify-center bg-bg-elevated">
      <div className="text-center max-w-md">
        <Icon name="database" size={64} className="mx-auto text-text-muted opacity-30 mb-6" />
        <h2 className="text-lg font-display text-text-primary mb-1">OpenDB Studio</h2>
        <p className="text-[12px] text-text-secondary mb-8">
          Database management made simple
        </p>

        <div className="flex flex-col gap-3 items-center">
          <button
            onClick={() => addNewFileTab("untitled.sql", "-- Write your SQL here\n")}
            className="flex items-center gap-2 w-56 px-4 py-2 bg-accent-button hover:bg-accent-button-hover text-white text-[12px] font-medium rounded transition-colors"
          >
            <Icon name="database" size={16} />
            New SQL File
          </button>
          <button
            onClick={openFolder}
            className="flex items-center gap-2 w-56 px-4 py-2 border border-border-default text-text-primary hover:bg-bg-surface-hover text-[12px] font-medium rounded transition-colors"
          >
            <Icon name="folder_open" size={16} />
            Open Folder
          </button>
          <button
            onClick={openFileDialog}
            className="flex items-center gap-2 w-56 px-4 py-2 border border-border-default text-text-secondary hover:text-text-primary hover:bg-bg-surface-hover text-[12px] rounded transition-colors"
          >
            <Icon name="note_add" size={16} />
            Open File
          </button>
        </div>

        <div className="mt-8 text-[10px] text-text-muted space-y-1">
          <p>Ctrl+Enter — Run query</p>
          <p>Ctrl+S — Save file</p>
          <p>Ctrl+F — Search in results</p>
        </div>
      </div>
    </div>
  );
}

export function EditorArea() {
  const resultsPanelMode = useAppStore((s) => s.resultsPanelMode);
  const tabs = useAppStore((s) => s.tabs);
  const activeTabId = useAppStore((s) => s.activeTabId);
  const saveCurrentFile = useAppStore((s) => s.saveCurrentFile);

  // Split pane: track editor height ratio as a percentage
  const containerRef = useRef<HTMLDivElement>(null);
  const [editorRatio, setEditorRatio] = useState(0.55); // 55% editor, 45% results
  const baseRatio = useRef(editorRatio);

  const handleSplitStart = useCallback(() => {
    baseRatio.current = editorRatio;
  }, [editorRatio]);

  const handleSplitResize = useCallback((delta: number) => {
    if (!containerRef.current) return;
    const height = containerRef.current.getBoundingClientRect().height;
    const newRatio = baseRatio.current + delta / height;
    setEditorRatio(Math.min(0.85, Math.max(0.15, newRatio)));
  }, []);

  // Ctrl+S shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        saveCurrentFile();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [saveCurrentFile]);

  // No tabs open — show welcome
  if (tabs.length === 0 || !activeTabId) {
    return <WelcomeScreen />;
  }

  return (
    <>
      {/* Tab strip */}
      <EditorTabs />

      {/* Toolbar / breadcrumb */}
      <EditorToolbar />

      {/* Editor + Results split */}
      <div ref={containerRef} className="flex-1 flex flex-col overflow-hidden">
        {/* SQL code editor — hidden when results maximized */}
        {resultsPanelMode !== 'maximized' && (
          <div style={{ flex: `0 0 ${editorRatio * 100}%` }} className="min-h-0 flex flex-col overflow-hidden">
            <SqlEditor />
          </div>
        )}

        {/* Row splitter between editor and results (vertical ↕) */}
        {resultsPanelMode === 'normal' && (
          <Splitter
            direction="vertical"
            onResizeStart={handleSplitStart}
            onResize={handleSplitResize}
          />
        )}

        {/* Query results */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <ResultsPanel />
        </div>
      </div>
    </>
  );
}
