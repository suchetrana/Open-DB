import { ActivityBar } from "./ActivityBar";
import { Sidebar } from "./Sidebar";
import { StatusBar } from "./StatusBar";
import { EditorArea } from "@/components/editor/EditorArea";
import { BottomPanel } from "@/components/terminal/BottomPanel";
import { useAppStore } from "@/store/useAppStore";

export function MainLayout() {
  const bottomPanelOpen = useAppStore((s) => s.bottomPanelOpen);

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Activity Bar – far left icons */}
      <ActivityBar />

      {/* Sidebar – explorer panel */}
      <Sidebar />

      {/* Main content area */}
      <main className="flex-1 flex flex-col min-w-0 bg-bg-elevated">
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
