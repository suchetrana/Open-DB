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
  { icon: "folder_open", label: "Open Folder", action: "openFolder" },
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
      className="absolute left-14 top-0 z-50 glass-widget bg-[#2b2d30] min-w-[220px] py-1 text-xs"
    >
      {/* Local Terminal Option */}
      <button
        onClick={() => {
          openLocalTerminal();
          onClose();
        }}
        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#25324d] text-text-primary text-left glass-row mx-1"
        style={{ width: 'calc(100% - 8px)' }}
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
          <div className="border-t border-[#3c3f41] my-1 mx-2" />
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
          className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#25324d] text-text-primary text-left glass-row mx-1"
          style={{ width: 'calc(100% - 8px)' }}
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
          <div className="border-t border-[#3c3f41] my-1 mx-2" />
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
  const openFolder = useAppStore((s) => s.openFolder);
  const [showTerminalMenu, setShowTerminalMenu] = useState(false);

  return (
    <aside className="w-[54px] bg-bg-canvas flex flex-col items-center py-2 shrink-0 z-20">
      {/* Pill-shaped container for nav icons */}
      <div
        className="flex flex-col items-center gap-1 py-2 px-[3px] rounded-full mt-2"
        style={{
          background: 'color-mix(in srgb, #121216, #181a1d 30%)',
          borderTop: '1px solid rgba(255,255,255,0.12)',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
          borderBottom: '1px solid rgba(255,255,255,0.03)',
          borderRight: '1px solid rgba(255,255,255,0.05)',
          boxShadow: 'inset 0 1px 3px 0 rgba(255,255,255,0.06), 0 1px 4px 0 rgba(0,0,0,0.3)',
        }}
      >
        {/* Top nav items */}
        {TOP_ITEMS.map((item) => {
          const isActive = sidebarOpen && activeSidebarView === item.view;
          return (
            <button
              key={item.view}
              onClick={() => setSidebarView(item.view)}
              title={item.label}
              className="cursor-pointer relative flex items-center justify-center w-[34px] h-[34px] transition-all duration-200"
              style={isActive ? {
                background: 'linear-gradient(180deg, rgba(55,56,62,0.9), rgba(40,41,46,0.7))',
                borderRadius: '50%',
                boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.12), inset 1px 0 0 0 rgba(255,255,255,0.06), inset 0 -1px 0 0 rgba(255,255,255,0.02), inset -1px 0 0 0 rgba(255,255,255,0.02), inset 0 1px 2px 0 rgba(255,255,255,0.05), 0 1px 3px 0 rgba(0,0,0,0.3)',
              } : {}}
            >
              <Icon
                name={item.icon}
                size={22}
                className={clsx(
                  "transition-colors duration-200",
                  isActive ? "text-text-primary" : "text-text-muted hover:text-text-primary"
                )}
              />
            </button>
          );
        })}

        {/* Terminal button */}
        <div className="relative">
          <button
            onClick={() => setShowTerminalMenu(!showTerminalMenu)}
            title="Terminal"
            className="cursor-pointer relative flex items-center justify-center w-[34px] h-[34px] transition-all duration-200"
            style={showTerminalMenu ? {
              background: 'linear-gradient(180deg, rgba(55,56,62,0.9), rgba(40,41,46,0.7))',
              borderRadius: '50%',
              boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.12), inset 1px 0 0 0 rgba(255,255,255,0.06), 0 1px 3px 0 rgba(0,0,0,0.3)',
            } : {}}
          >
            <Icon
              name="terminal"
              size={22}
              className={clsx(
                "transition-colors duration-200",
                showTerminalMenu ? "text-text-primary" : "text-text-muted hover:text-text-primary"
              )}
            />
          </button>
          {showTerminalMenu && (
            <TerminalDropdown onClose={() => setShowTerminalMenu(false)} />
          )}
        </div>
      </div>

      {/* Bottom items — outside pill */}
      <div className="mt-auto flex flex-col items-center gap-1 mb-6">
        {BOTTOM_ITEMS.map((item) => (
          <button
            key={item.label}
            title={item.label}
            onClick={() => {
              if ((item as any).action === 'openFolder') openFolder()
            }}
            className="cursor-pointer text-text-muted hover:text-text-primary transition-colors duration-200 w-[34px] h-[34px] flex items-center justify-center"
          >
            <Icon name={item.icon} size={22} />
          </button>
        ))}
      </div>
    </aside>
  );
}
