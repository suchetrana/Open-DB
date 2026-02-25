import { Icon } from "@/components/ui";
import { useAppStore } from "@/store/useAppStore";
import { clsx } from "clsx";

export function EditorTabs() {
  const tabs = useAppStore((s) => s.tabs);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const closeTab = useAppStore((s) => s.closeTab);

  return (
    <div className="flex bg-bg-surface h-8 overflow-x-auto no-scrollbar border-b border-bg-elevated">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={clsx(
            "flex items-center gap-2 px-3 min-w-[120px] max-w-[200px] text-xs cursor-pointer group",
            tab.isActive
              ? "bg-bg-elevated text-white border-t border-t-accent-blue"
              : "text-text-disabled border-r border-r-bg-surface hover:bg-bg-surface-hover"
          )}
        >
          <Icon name={tab.icon} size={16} className={tab.iconColor} />
          <span className="truncate font-mono text-[11px]">{tab.title}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              closeTab(tab.id);
            }}
            className="ml-auto opacity-0 group-hover:opacity-100 hover:bg-[#3e3e42] rounded-sm p-0.5"
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
