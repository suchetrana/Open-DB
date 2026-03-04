import { useRef, useCallback, useState } from "react";
import { ActivityBar } from "./ActivityBar";
import { Sidebar } from "./Sidebar";
import { StatusBar } from "./StatusBar";
import { EditorArea } from "@/components/editor/EditorArea";
import { BottomPanel } from "@/components/terminal/BottomPanel";
import { Splitter } from "@/components/ui";
import { useAppStore } from "@/store/useAppStore";

export function MainLayout() {
  const bottomPanelOpen = useAppStore((s) => s.bottomPanelOpen);
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);

  // Sidebar resizable width
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const baseWidth = useRef(sidebarWidth);

  const handleSidebarResizeStart = useCallback(() => {
    baseWidth.current = sidebarWidth;
  }, [sidebarWidth]);

  const handleSidebarResize = useCallback((delta: number) => {
    setSidebarWidth(Math.min(500, Math.max(160, baseWidth.current + delta)));
  }, []);

  return (
    <div className="h-screen flex overflow-hidden bg-bg-canvas">
      {/* Activity Bar – far left pill-shaped rail */}
      <ActivityBar />

      {/* Sidebar – floating glass panel */}
      {sidebarOpen && (
        <>
          <div
            style={{ width: sidebarWidth }}
            className="shrink-0 flex flex-col overflow-hidden glass-panel my-[6px] ml-[6px] animate-float-up"
          >
            <Sidebar />
          </div>
          {/* Sidebar splitter (horizontal ↔) */}
          <Splitter
            direction="horizontal"
            onResizeStart={handleSidebarResizeStart}
            onResize={handleSidebarResize}
          />
        </>
      )}

      {/* Main content area — floating glass panel */}
      <main className="flex-1 flex flex-col min-w-0 glass-panel my-[6px] mr-[6px] ml-[6px] animate-float-up">
        {/* Editor area (tabs + code + results) */}
        <EditorArea />

        {/* Bottom panel (terminal, problems, output) */}
        {bottomPanelOpen && <BottomPanel />}
      </main>

      {/* Status Bar – full width footer */}
      <StatusBar />
    </div>
  );
}
