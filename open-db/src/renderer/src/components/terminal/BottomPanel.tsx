import { useRef, useCallback } from "react";
import { Icon, Splitter } from "@/components/ui";
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
  const terminalSessions = useAppStore((s) => s.terminalSessions);
  const activeTerminalSessionId = useAppStore((s) => s.activeTerminalSessionId);
  const setActiveTerminalSession = useAppStore((s) => s.setActiveTerminalSession);
  const closeTerminalSession = useAppStore((s) => s.closeTerminalSession);
  const openLocalTerminal = useAppStore((s) => s.openLocalTerminal);
  const bottomPanelHeight = useAppStore((s) => s.bottomPanelHeight);
  const setBottomPanelHeight = useAppStore((s) => s.setBottomPanelHeight);

  // Resize drag logic
  const baseHeight = useRef(bottomPanelHeight);

  const handleResizeStart = useCallback(() => {
    baseHeight.current = bottomPanelHeight;
  }, [bottomPanelHeight]);

  const handleResize = useCallback(
    (delta: number) => {
      // delta is negative when dragging up (panel grows)
      setBottomPanelHeight(baseHeight.current - delta);
    },
    [setBottomPanelHeight]
  );

  // Get active session
  const activeSession = terminalSessions.find((s) => s.id === activeTerminalSessionId) ?? null;

  return (
    <div style={{ height: bottomPanelHeight }} className="bg-bg-elevated border-t border-border-default flex flex-col shrink-0">
      {/* Row splitter (vertical ↕) */}
      <Splitter
        direction="vertical"
        onResizeStart={handleResizeStart}
        onResize={handleResize}
      />
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
      <div className="flex-1 overflow-hidden flex">
        {activeTab === "terminal" && (
          <>
            {/* Terminal session tabs (left sidebar) */}
            {terminalSessions.length > 0 && (
              <div className="w-40 border-r border-border-default bg-[#1e1e1e] flex flex-col shrink-0 overflow-y-auto">
                {terminalSessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => setActiveTerminalSession(session.id)}
                    className={clsx(
                      "flex items-center gap-1.5 px-2 py-1 cursor-pointer text-[11px] group/term",
                      session.id === activeTerminalSessionId
                        ? "bg-[#094771] text-white"
                        : "text-text-secondary hover:bg-[#2a2d2e] hover:text-text-primary"
                    )}
                  >
                    <Icon
                      name={session.type === "docker" ? "dns" : "terminal"}
                      size={12}
                      className={session.type === "docker" ? "text-accent-blue" : "text-status-green"}
                    />
                    <span className="truncate flex-1">{session.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTerminalSession(session.id);
                      }}
                      className="opacity-0 group-hover/term:opacity-100 hover:text-status-red"
                    >
                      <Icon name="close" size={10} />
                    </button>
                  </div>
                ))}
                {/* New terminal button at bottom */}
                <button
                  onClick={openLocalTerminal}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] text-text-muted hover:text-text-primary hover:bg-[#2a2d2e] mt-auto"
                >
                  <Icon name="add" size={10} />
                  <span>New Terminal</span>
                </button>
              </div>
            )}
            {/* Terminal content */}
            <div className="flex-1 overflow-hidden">
              {activeSession ? (
                <TerminalView key={activeSession.id} session={activeSession} />
              ) : (
                <div className="flex items-center justify-center h-full text-text-muted text-xs">
                  <div className="text-center space-y-2">
                    <Icon name="terminal" size={32} className="mx-auto opacity-40" />
                    <div>No terminal open</div>
                    <button
                      onClick={openLocalTerminal}
                      className="text-accent-blue hover:underline text-[11px]"
                    >
                      Open a terminal
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
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
