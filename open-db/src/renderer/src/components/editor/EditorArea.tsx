import { EditorTabs } from "./EditorTabs";
import { EditorToolbar } from "./EditorToolbar";
import { SqlEditor } from "./SqlEditor";
import { ResultsPanel } from "@/components/results/ResultsPanel";

export function EditorArea() {
  return (
    <>
      {/* Tab strip */}
      <EditorTabs />

      {/* Toolbar / breadcrumb */}
      <EditorToolbar />

      {/* Editor + Results split */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* SQL code editor */}
        <SqlEditor />

        {/* Resize handle */}
        <div className="h-[1px] bg-border-default cursor-row-resize hover:bg-accent-blue transition-colors relative z-20" />

        {/* Query results */}
        <ResultsPanel />
      </div>
    </>
  );
}
