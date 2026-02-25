import { Icon } from "@/components/ui";
import { useAppStore } from "@/store/useAppStore";
import { clsx } from "clsx";
import { TerminalView } from "./TerminalView";
import type { BottomPanelTab } from "@/types";

const TABS: { id: BottomPanelTab; label: string }[] = [
  { id: "problems", label: "Problems" },
  { id: "output", label: "Output" },
  { id: "terminal", label: "Terminal" },
  { id: "debug", label: "Debug Console" },
];

export function BottomPanel() {
  const activeTab = useAppStore((s) => s.activeBottomTab);
  const setBottomTab = useAppStore((s) => s.setBottomTab);
  const toggleBottomPanel = useAppStore((s) => s.toggleBottomPanel);

  return (
    <div className="h-44 bg-bg-elevated border-t border-border-default flex flex-col shrink-0">
      {/* Tab bar */}
      <div className="flex items-center px-4 h-8 gap-6 border-b border-border-default bg-bg-surface">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setBottomTab(tab.id)}
            className={clsx(
              "text-[10px] uppercase font-bold pb-1.5 pt-2 border-b-2 tracking-wide transition-colors",
              activeTab === tab.id
                ? "text-text-primary border-text-primary"
                : "text-text-secondary hover:text-text-primary border-transparent hover:border-text-secondary"
            )}
          >
            {tab.label}
          </button>
        ))}

        {/* Actions */}
        <div className="ml-auto flex gap-3 text-text-secondary">
          <button className="hover:text-text-primary">
            <Icon name="add" size={16} />
          </button>
          <button className="hover:text-text-primary">
            <Icon name="delete" size={16} />
          </button>
          <button className="hover:text-text-primary">
            <Icon name="keyboard_arrow_up" size={16} />
          </button>
          <button onClick={toggleBottomPanel} className="hover:text-text-primary">
            <Icon name="close" size={16} />
          </button>
        </div>
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "terminal" && <TerminalView />}
        {activeTab === "problems" && (
          <div className="p-4 text-text-secondary text-xs font-mono">
            No problems detected.
          </div>
        )}
        {activeTab === "output" && (
          <div className="p-4 text-text-secondary text-xs font-mono">
            Output channel ready.
          </div>
        )}
        {activeTab === "debug" && (
          <div className="p-4 text-text-secondary text-xs font-mono">
            Debug console attached.
          </div>
        )}
      </div>
    </div>
  );
}
