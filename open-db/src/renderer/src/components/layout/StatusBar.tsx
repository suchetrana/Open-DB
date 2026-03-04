import { Icon } from "@/components/ui";
import { useAppStore } from "@/store/useAppStore";

export function StatusBar() {
  const activeConnectionId = useAppStore((s) => s.activeConnectionId);
  const connections = useAppStore((s) => s.connections);
  const selectedDatabase = useAppStore((s) => s.selectedDatabase);
  const dockerAvailable = useAppStore((s) => s.dockerAvailable);

  const activeConn = connections.find((c) => c.id === activeConnectionId);
  const isConnected = activeConn?.isConnected ?? false;

  return (
    <footer className="fixed bottom-0 w-full h-5 bg-bg-canvas flex items-center justify-between px-3 text-[10px] z-30 select-none font-display statusbar-container">
      {/* Left section */}
      <div className="flex items-center gap-4">
        {/* Branch */}
        <button className="flex items-center gap-1 hover:bg-white/10 px-1.5 py-0.5 rounded-item cursor-pointer statusbar-dim text-[#35383d] transition-all duration-300">
          <Icon name="code" size={12} />
          <span className="font-medium">main*</span>
        </button>

        {/* Docker status */}
        <button className="flex items-center gap-1 hover:bg-white/10 px-1.5 py-0.5 rounded-item cursor-pointer statusbar-dim text-[#35383d] transition-all duration-300">
          <div className={`w-1.5 h-1.5 rounded-full ${dockerAvailable ? 'bg-status-green' : 'bg-[#4e5157]'}`} />
          <span>Docker {dockerAvailable ? 'Ready' : 'Off'}</span>
        </button>

        {/* Errors / Warnings */}
        <button className="flex items-center gap-1 hover:bg-white/10 px-1.5 py-0.5 rounded-item cursor-pointer statusbar-dim text-[#35383d] transition-all duration-300">
          <Icon name="error" size={12} />
          <span>0</span>
          <Icon name="warning" size={12} />
          <span>0</span>
        </button>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-4">
        {/* DB connection indicator — real status */}
        <button className="flex items-center gap-1 hover:bg-white/10 px-1.5 py-0.5 rounded-item cursor-pointer statusbar-dim text-[#35383d] transition-all duration-300">
          <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-status-green' : 'bg-[#4e5157]'}`} />
          <span className="font-medium">
            {isConnected
              ? `${activeConn?.type ?? 'DB'}: ${selectedDatabase ?? activeConn?.database ?? 'connected'}`
              : 'No Connection'}
          </span>
        </button>

        <button className="cursor-pointer hover:bg-white/10 px-1.5 py-0.5 rounded-item statusbar-dim text-[#35383d] transition-all duration-300">
          UTF-8
        </button>
        <button className="cursor-pointer hover:bg-white/10 px-1.5 py-0.5 rounded-item statusbar-dim text-[#35383d] transition-all duration-300">
          <Icon name="notifications" size={12} />
        </button>
      </div>
    </footer>
  );
}
