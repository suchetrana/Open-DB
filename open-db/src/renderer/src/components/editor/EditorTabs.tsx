import { Icon } from "@/components/ui";
import { useAppStore } from "@/store/useAppStore";
import { clsx } from "clsx";

export function EditorTabs() {
  const tabs = useAppStore((s) => s.tabs);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const closeTab = useAppStore((s) => s.closeTab);

  return (
    <div className="flex bg-[#161619] h-9 overflow-x-auto no-scrollbar" style={{ backgroundImage: 'linear-gradient(to top, #25262a 1px, transparent 1px)', backgroundRepeat: 'no-repeat', backgroundPosition: 'bottom' }}>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={clsx(
            "flex items-center gap-2 px-3 min-w-[120px] max-w-[200px] text-xs cursor-pointer group tab-transition font-display",
            "rounded-t-item",
            tab.isActive
              ? "bg-[#181a1d] text-text-primary"
              : "bg-[#161619] text-text-muted hover:text-text-secondary"
          )}
          style={tab.isActive ? {
            boxShadow: 'inset -1px 0 0 0 #25262a, inset 1px 0 0 0 #25262a',
          } : {
            boxShadow: 'inset 0 -1px 0 0 #25262a',
          }}
        >
          <Icon name={tab.icon} size={16} className={clsx(tab.iconColor, "transition-colors icon-glow")} />
          <span className="truncate font-mono text-[11px]">{tab.title}</span>
          {tab.isModified && (
            <span className="w-2 h-2 rounded-full bg-text-secondary shrink-0" />
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              closeTab(tab.id);
            }}
            className="ml-auto opacity-0 group-hover:opacity-100 hover:bg-[#3c3f41] rounded-full p-0.5 transition-opacity duration-200"
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
