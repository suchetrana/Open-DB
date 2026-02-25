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
      <summary className="flex items-center px-1 py-0.5 cursor-pointer hover:bg-bg-surface-hover select-none text-text-primary focus:outline-none focus:bg-bg-surface-active">
        <Icon
          name="chevron_right"
          size={16}
          className="transition-transform group-open:rotate-90 text-text-primary"
        />
        <span className="text-[11px] font-bold uppercase ml-0.5">
          Open Editors
        </span>
        <button
          onClick={(e) => {
            e.preventDefault();
            setShowInput(!showInput);
          }}
          className="ml-auto mr-2 text-text-secondary hover:text-text-primary"
          title="New file"
        >
          <Icon name="note_add" size={14} />
        </button>
      </summary>

      {showInput && (
        <div className="px-3 py-1.5">
          <input
            autoFocus
            className="w-full bg-bg-input border border-border-input rounded px-2 py-0.5 text-xs text-text-primary outline-none focus:border-accent-blue"
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

      <div className="flex flex-col text-[13px] font-mono">
        {tabs.length === 0 && (
          <div className="text-text-muted text-[11px] py-2 pl-4">
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
                "flex items-center gap-2 px-4 py-[3px] cursor-pointer text-left w-full group/file",
                isActive
                  ? "bg-bg-surface-active text-white"
                  : "hover:bg-bg-surface-hover text-text-primary"
              )}
            >
              <Icon name={tab.icon} size={14} className={tab.iconColor} />
              <span className="truncate text-xs flex-1">{tab.title}</span>
              {tab.isModified && (
                <span className="text-[10px] text-text-secondary">M</span>
              )}
              <span
                onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                className="opacity-0 group-hover/file:opacity-100 text-text-secondary hover:text-status-red cursor-pointer"
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
