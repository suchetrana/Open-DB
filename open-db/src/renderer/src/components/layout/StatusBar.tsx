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
    <footer className="fixed bottom-0 w-full h-5 bg-accent-blue text-white flex items-center justify-between px-3 text-[10px] z-30 select-none font-sans">
      {/* Left section */}
      <div className="flex items-center gap-4">
        {/* Branch */}
        <button className="flex items-center gap-1 hover:bg-white/20 px-1 py-0.5 rounded cursor-pointer">
          <Icon name="code" size={12} />
          <span className="font-medium">main*</span>
        </button>

        {/* Docker status */}
        <button className="flex items-center gap-1 hover:bg-white/20 px-1 py-0.5 rounded cursor-pointer">
          <div className={`w-1.5 h-1.5 rounded-full ${dockerAvailable ? 'bg-green-400' : 'bg-gray-400'}`} />
          <span>Docker {dockerAvailable ? 'Ready' : 'Off'}</span>
        </button>

        {/* Errors / Warnings */}
        <button className="flex items-center gap-1 hover:bg-white/20 px-1 py-0.5 rounded cursor-pointer">
          <Icon name="error" size={12} />
          <span>0</span>
          <Icon name="warning" size={12} />
          <span>0</span>
        </button>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-4">
        {/* DB connection indicator — real status */}
        <button className="flex items-center gap-1 hover:bg-white/20 px-1 py-0.5 rounded cursor-pointer">
          <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-400' : 'bg-gray-400'}`} />
          <span className="font-medium">
            {isConnected
              ? `${activeConn?.type ?? 'DB'}: ${selectedDatabase ?? activeConn?.database ?? 'connected'}`
              : 'No Connection'}
          </span>
        </button>

        <button className="cursor-pointer hover:bg-white/20 px-1 py-0.5 rounded">
          UTF-8
        </button>
        <button className="cursor-pointer hover:bg-white/20 px-1 py-0.5 rounded">
          <Icon name="notifications" size={12} />
        </button>
      </div>
    </footer>
  );
}
