import { useState } from "react";
import { Icon } from "@/components/ui";
import { useAppStore } from "@/store/useAppStore";
import { clsx } from "clsx";

export function OpenEditors() {
  const tabs = useAppStore((s) => s.tabs);
  const activeTabId = useAppStore((s) => s.activeTabId);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const closeTab = useAppStore((s) => s.closeTab);
  const addNewFileTab = useAppStore((s) => s.addNewFileTab);
  const [showInput, setShowInput] = useState(false);
  const [newName, setNewName] = useState("");

  const handleCreate = () => {
    const name = newName.trim();
    if (name) {
      addNewFileTab(name.includes(".") ? name : name + ".sql");
    }
    setNewName("");
    setShowInput(false);
  };

  return (
    <details className="group" open>
      <summary
        className="mx-1 flex items-center rounded-item border-b border-border-subtle bg-white/[0.02] px-1.5 py-1 cursor-pointer select-none text-text-primary focus:outline-none"
        style={{ width: "calc(100% - 8px)" }}
      >
        <Icon
          name="chevron_right"
          size={14}
          className="transition-transform group-open:rotate-90 text-text-muted"
        />
        <span className="text-[11px] font-bold uppercase ml-1 tracking-[0.06em] text-text-secondary">
          Open Editors
        </span>
        <button
          onClick={(e) => {
            e.preventDefault();
            setShowInput(!showInput);
          }}
          className="ml-auto mr-1 rounded-item p-1 text-text-muted hover:text-text-primary hover:bg-bg-surface-hover transition-colors duration-200"
          title="New file"
        >
          <Icon name="note_add" size={14} />
        </button>
      </summary>

      {showInput && (
        <div className="px-3 py-2">
          <input
            autoFocus
            className="w-full rounded-item bg-bg-input border border-border-default px-2 py-1 text-xs text-text-primary outline-none focus:border-accent-blue transition-colors duration-200"
            placeholder="filename.sql"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") { setShowInput(false); setNewName(""); }
            }}
            onBlur={() => { if (!newName.trim()) setShowInput(false); }}
          />
        </div>
      )}

      <div className="flex flex-col text-[13px] font-mono pb-1">
        {tabs.length === 0 && (
          <div className="text-text-muted text-[11px] py-2.5 pl-4">
            No open files. Click + to create one.
          </div>
        )}
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                "mx-1 flex items-center gap-2 border-l-2 border-transparent rounded-item px-3 py-1.5 cursor-pointer text-left group/file transition-colors duration-150",
                isActive
                  ? "bg-accent-blue/10 border-l-accent-blue text-text-bright"
                  : "text-text-primary hover:bg-bg-surface-hover"
              )}
              style={{ width: 'calc(100% - 8px)' }}
            >
              <Icon name={tab.icon} size={14} className={tab.iconColor} />
              <span className="truncate text-xs flex-1">{tab.title}</span>
              {tab.isModified && (
                <span className="text-[10px] text-text-secondary font-semibold">M</span>
              )}
              <span
                onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                className="opacity-0 group-hover/file:opacity-100 rounded-item p-0.5 text-text-secondary hover:text-status-red hover:bg-status-red/10 cursor-pointer transition-colors duration-200"
                title="Close"
              >
                <Icon name="close" size={12} />
              </span>
            </button>
          );
        })}
      </div>
    </details>
  );
}
