import { useAppStore } from "@/store/useAppStore";
import { OpenEditors } from "@/components/sidebar/OpenEditors";
import { DockerContainers } from "@/components/sidebar/DockerContainers";
import { Connections } from "@/components/sidebar/Connections";
import { DatabaseExplorer } from "@/components/sidebar/DatabaseExplorer";

export function Sidebar() {
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);

  if (!sidebarOpen) return null;

  return (
    <div className="w-60 bg-bg-surface border-r border-bg-elevated flex flex-col shrink-0 overflow-y-auto">
      {/* Section title */}
      <div className="h-8 flex items-center px-4 text-[10px] font-semibold tracking-wider text-[#bbbbbb] uppercase">
        Explorer
      </div>

      <OpenEditors />
      <DatabaseExplorer />
      <DockerContainers />
      <Connections />
    </div>
  );
}
