import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui";
import { useAppStore } from "@/store/useAppStore";

const MIN_ZOOM = 0.7;
const MAX_ZOOM = 1.6;

function normalizeZoom(value: number): number {
  const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
  return Math.round(clamped * 10) / 10;
}

export function StatusBar() {
  const [zoomFactor, setZoomFactor] = useState(1);
  const zoomFactorRef = useRef(1);
  const latestZoomRequestRef = useRef(0);
  const activeConnectionId = useAppStore((s) => s.activeConnectionId);
  const connections = useAppStore((s) => s.connections);
  const selectedDatabase = useAppStore((s) => s.selectedDatabase);
  const dockerAvailable = useAppStore((s) => s.dockerAvailable);

  const activeConn = connections.find((c) => c.id === activeConnectionId);
  const isConnected = activeConn?.isConnected ?? false;

  useEffect(() => {
    let mounted = true;
    window.electronAPI.window.getZoom().then((res) => {
      if (mounted) {
        const normalized = normalizeZoom(res.zoomFactor);
        zoomFactorRef.current = normalized;
        setZoomFactor(normalized);
      }
    }).catch(() => {
      if (mounted) {
        zoomFactorRef.current = 1;
        setZoomFactor(1);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  const applyZoom = useCallback(async (nextZoom: number) => {
    const normalized = normalizeZoom(nextZoom);
    const requestId = ++latestZoomRequestRef.current;

    zoomFactorRef.current = normalized;
    setZoomFactor(normalized);

    try {
      const res = await window.electronAPI.window.setZoom(normalized);
      if (requestId !== latestZoomRequestRef.current) return;

      const confirmed = normalizeZoom(res.zoomFactor);
      zoomFactorRef.current = confirmed;
      setZoomFactor(confirmed);
    } catch {
      if (requestId !== latestZoomRequestRef.current) return;
      zoomFactorRef.current = normalized;
      setZoomFactor(normalized);
    }
  }, []);

  const zoomOut = useCallback(() => {
    const next = normalizeZoom(zoomFactorRef.current - 0.1);
    void applyZoom(next);
  }, [applyZoom]);

  const zoomIn = useCallback(() => {
    const next = normalizeZoom(zoomFactorRef.current + 0.1);
    void applyZoom(next);
  }, [applyZoom]);

  const resetZoom = useCallback(() => {
    void applyZoom(1);
  }, [applyZoom]);

  // Ctrl+Plus / Ctrl+Minus / Ctrl+0 keyboard shortcuts for zoom
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((!e.ctrlKey && !e.metaKey) || e.altKey) return;

      const key = e.key;
      const code = e.code;

      // Ctrl+= or Ctrl+Shift+= (plus) — zoom in
      if (key === '=' || key === '+' || code === 'NumpadAdd') {
        e.preventDefault();
        zoomIn();
      }
      // Ctrl+- — zoom out
      else if (key === '-' || code === 'NumpadSubtract') {
        e.preventDefault();
        zoomOut();
      }
      // Ctrl+0 — reset zoom
      else if (key === '0' || code === 'Digit0' || code === 'Numpad0') {
        e.preventDefault();
        resetZoom();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [resetZoom, zoomIn, zoomOut]);

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
        <div className="flex items-center gap-1 hover:bg-white/10 px-1.5 py-0.5 rounded-item statusbar-dim text-[#35383d] transition-all duration-300">
          <button
            onClick={zoomOut}
            title="Zoom out"
            className="cursor-pointer"
          >
            <Icon name="remove" size={12} />
          </button>
          <input
            type="range"
            min={0.7}
            max={1.6}
            step={0.1}
            value={zoomFactor}
            onChange={(e) => {
              const nextZoom = Number(e.target.value);
              void applyZoom(nextZoom);
            }}
            className="w-14 h-2 accent-accent-blue cursor-pointer"
            title="Adjust UI zoom"
          />
          <button
            onClick={zoomIn}
            title="Zoom in"
            className="cursor-pointer"
          >
            <Icon name="add" size={12} />
          </button>
          <button
            onClick={resetZoom}
            title="Reset zoom"
            className="cursor-pointer font-medium"
          >
            {Math.round(zoomFactor * 100)}%
          </button>
        </div>
        <button className="cursor-pointer hover:bg-white/10 px-1.5 py-0.5 rounded-item statusbar-dim text-[#35383d] transition-all duration-300">
          <Icon name="notifications" size={12} />
        </button>
      </div>
    </footer>
  );
}
