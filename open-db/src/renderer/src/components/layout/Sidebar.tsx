import { useAppStore } from "@/store/useAppStore";
import { OpenEditors } from "@/components/sidebar/OpenEditors";
import { FileExplorer } from "@/components/sidebar/FileExplorer";
import { DockerContainers } from "@/components/sidebar/DockerContainers";
import { Connections } from "@/components/sidebar/Connections";
import { DatabaseExplorer } from "@/components/sidebar/DatabaseExplorer";
import { Icon } from "@/components/ui";
import type { SidebarView } from "@/types";

const VIEW_TITLES: Record<SidebarView, string> = {
  explorer: "Explorer",
  search: "Search",
  schema: "Database",
  runner: "Runner",
  extensions: "Extensions",
};

function SearchView() {
  return (
    <div className="px-3 py-2 flex flex-col gap-2">
      <div className="flex items-center gap-1 bg-bg-input border border-border-default rounded px-2 py-1">
        <Icon name="search" size={14} className="text-text-muted shrink-0" />
        <input
          type="text"
          placeholder="Search files..."
          className="bg-transparent text-text-primary text-[11px] outline-none flex-1 placeholder:text-text-muted"
        />
      </div>
      <div className="flex gap-1">
        <button className="p-0.5 text-text-secondary hover:text-text-primary rounded hover:bg-bg-surface-hover" title="Match case">
          <Icon name="match_case" size={14} />
        </button>
        <button className="p-0.5 text-text-secondary hover:text-text-primary rounded hover:bg-bg-surface-hover" title="Match whole word">
          <Icon name="match_word" size={14} />
        </button>
        <button className="p-0.5 text-text-secondary hover:text-text-primary rounded hover:bg-bg-surface-hover" title="Use regex">
          <Icon name="regular_expression" size={14} />
        </button>
      </div>
      <div className="flex items-center gap-1 bg-bg-input border border-border-default rounded px-2 py-1">
        <input
          type="text"
          placeholder="Replace..."
          className="bg-transparent text-text-primary text-[11px] outline-none flex-1 placeholder:text-text-muted"
        />
      </div>
      <p className="text-[10px] text-text-muted mt-2">Type to search across files in the workspace.</p>
    </div>
  );
}

function SchemaView() {
  return (
    <div className="flex flex-col">
      <DatabaseExplorer />
      <Connections />
    </div>
  );
}

function RunnerView() {
  return (
    <div className="px-3 py-2 flex flex-col gap-2">
      <p className="text-[10px] text-text-muted uppercase tracking-wider font-bold mb-1">Query Runner</p>
      <div className="flex flex-col gap-1.5">
        <button className="flex items-center gap-2 px-2 py-1.5 text-[11px] text-text-primary hover:bg-bg-surface-hover rounded transition-colors">
          <Icon name="play_arrow" size={14} className="text-status-green" />
          Run Current Query
        </button>
        <button className="flex items-center gap-2 px-2 py-1.5 text-[11px] text-text-primary hover:bg-bg-surface-hover rounded transition-colors">
          <Icon name="history" size={14} className="text-syntax-function" />
          Query History
        </button>
        <button className="flex items-center gap-2 px-2 py-1.5 text-[11px] text-text-primary hover:bg-bg-surface-hover rounded transition-colors">
          <Icon name="bookmark" size={14} className="text-syntax-decorator" />
          Saved Queries
        </button>
      </div>
      <p className="text-[10px] text-text-muted mt-2">Manage and run saved queries.</p>
    </div>
  );
}

function ExtensionsView() {
  return (
    <div className="px-3 py-2 flex flex-col gap-2">
      <div className="flex items-center gap-1 bg-bg-input border border-border-default rounded px-2 py-1">
        <Icon name="search" size={14} className="text-text-muted shrink-0" />
        <input
          type="text"
          placeholder="Search extensions..."
          className="bg-transparent text-text-primary text-[11px] outline-none flex-1 placeholder:text-text-muted"
        />
      </div>
      <p className="text-[10px] text-text-muted uppercase tracking-wider font-bold mt-2">Installed</p>
      <div className="text-[11px] text-text-secondary px-1">
        <div className="flex items-center gap-2 py-1.5 hover:bg-bg-surface-hover rounded px-1 cursor-pointer">
          <Icon name="extension" size={16} className="text-syntax-keyword" />
          <div>
            <div className="text-text-primary font-medium">PostgreSQL</div>
            <div className="text-[10px] text-text-muted">Built-in query support</div>
          </div>
        </div>
        <div className="flex items-center gap-2 py-1.5 hover:bg-bg-surface-hover rounded px-1 cursor-pointer">
          <Icon name="extension" size={16} className="text-status-green" />
          <div>
            <div className="text-text-primary font-medium">Docker</div>
            <div className="text-[10px] text-text-muted">Container management</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const activeSidebarView = useAppStore((s) => s.activeSidebarView);

  if (!sidebarOpen) return null;

  return (
    <div className="w-full h-full bg-bg-surface border-r border-bg-elevated flex flex-col overflow-y-auto">
      {/* Section title */}
      <div className="h-8 flex items-center px-4 text-[10px] font-semibold tracking-wider text-[#bbbbbb] uppercase">
        {VIEW_TITLES[activeSidebarView]}
      </div>

      {activeSidebarView === "explorer" && (
        <>
          <FileExplorer />
          <OpenEditors />
          <DockerContainers />
        </>
      )}
      {activeSidebarView === "search" && <SearchView />}
      {activeSidebarView === "schema" && <SchemaView />}
      {activeSidebarView === "runner" && <RunnerView />}
      {activeSidebarView === "extensions" && <ExtensionsView />}
    </div>
  );
}
