import { useState, useRef, useEffect } from "react";
import { clsx } from "clsx";
import { Icon } from "@/components/ui";
import { useAppStore } from "@/store/useAppStore";
import type { SidebarView } from "@/types";

interface NavItem {
  view: SidebarView;
  icon: string;
  label: string;
}

const TOP_ITEMS: NavItem[] = [
  { view: "explorer", icon: "folder_copy", label: "Explorer" },
  { view: "search", icon: "search", label: "Search" },
  { view: "schema", icon: "schema", label: "Schema" },
  { view: "runner", icon: "play_arrow", label: "Runner" },
  { view: "extensions", icon: "extension", label: "Extensions" },
];

const BOTTOM_ITEMS = [
  { icon: "account_circle", label: "Account" },
  { icon: "settings", label: "Settings" },
];

const DB_CMD_LABELS: Record<string, string> = {
  postgres: "psql",
  mysql: "mysql",
  mongodb: "mongosh",
  redis: "redis-cli",
};

function TerminalDropdown({ onClose }: { onClose: () => void }) {
  const containers = useAppStore((s) => s.containers);
  const openLocalTerminal = useAppStore((s) => s.openLocalTerminal);
  const openDockerTerminal = useAppStore((s) => s.openDockerTerminal);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const runningContainers = containers.filter((c) => c.status === "running");

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={dropdownRef}
      className="absolute left-12 top-0 z-50 bg-[#252526] border border-border-default rounded shadow-xl min-w-[220px] py-1 text-xs"
    >
      {/* Local Terminal Option */}
      <button
        onClick={() => {
          openLocalTerminal();
          onClose();
        }}
        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#094771] text-text-primary text-left"
      >
        <Icon name="terminal" size={16} className="text-status-green" />
        <div>
          <div className="font-medium">Local Terminal</div>
          <div className="text-[10px] text-text-secondary">OS shell for git, commands, etc.</div>
        </div>
      </button>

      {/* Divider */}
      {runningContainers.length > 0 && (
        <>
          <div className="border-t border-border-default my-1" />
          <div className="px-3 py-1 text-[10px] text-text-secondary font-bold uppercase tracking-wide">
            Docker Containers
          </div>
        </>
      )}

      {/* Docker Container Terminals */}
      {runningContainers.map((c) => (
        <button
          key={c.id}
          onClick={() => {
            openDockerTerminal(c.id, c.name, c.type);
            onClose();
          }}
          className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#094771] text-text-primary text-left"
        >
          <Icon name="dns" size={16} className="text-accent-blue" />
          <div>
            <div className="font-medium">{c.name}</div>
            <div className="text-[10px] text-text-secondary">
              {DB_CMD_LABELS[c.type] ?? "shell"} · :{c.port}
            </div>
          </div>
        </button>
      ))}

      {runningContainers.length === 0 && (
        <>
          <div className="border-t border-border-default my-1" />
          <div className="px-3 py-1.5 text-[10px] text-text-muted">
            No running Docker containers
          </div>
        </>
      )}
    </div>
  );
}

export function ActivityBar() {
  const activeSidebarView = useAppStore((s) => s.activeSidebarView);
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const setSidebarView = useAppStore((s) => s.setSidebarView);
  const [showTerminalMenu, setShowTerminalMenu] = useState(false);

  return (
    <aside className="w-12 bg-[#333333] flex flex-col items-center py-2 gap-4 shrink-0 z-20">
      {/* Top nav items */}
      {TOP_ITEMS.map((item) => {
        const isActive = sidebarOpen && activeSidebarView === item.view;
        return (
          <button
            key={item.view}
            onClick={() => setSidebarView(item.view)}
            title={item.label}
            className={clsx(
              "cursor-pointer relative transition-colors",
              isActive ? "text-white" : "text-[#858585] hover:text-white"
            )}
          >
            <Icon name={item.icon} size={24} />
            {isActive && (
              <div className="absolute left-0 top-0 w-[2px] h-full bg-white" />
            )}
          </button>
        );
      })}

      {/* Terminal button */}
      <div className="relative">
        <button
          onClick={() => setShowTerminalMenu(!showTerminalMenu)}
          title="Terminal"
          className={clsx(
            "cursor-pointer relative transition-colors",
            showTerminalMenu ? "text-white" : "text-[#858585] hover:text-white"
          )}
        >
          <Icon name="terminal" size={24} />
          {showTerminalMenu && (
            <div className="absolute left-0 top-0 w-[2px] h-full bg-white" />
          )}
        </button>
        {showTerminalMenu && (
          <TerminalDropdown onClose={() => setShowTerminalMenu(false)} />
        )}
      </div>

      {/* Bottom items */}
      <div className="mt-auto flex flex-col gap-4 mb-2">
        {BOTTOM_ITEMS.map((item) => (
          <button
            key={item.label}
            title={item.label}
            className="cursor-pointer text-[#858585] hover:text-white transition-colors"
          >
            <Icon name={item.icon} size={24} />
          </button>
        ))}
      </div>
    </aside>
  );
}
