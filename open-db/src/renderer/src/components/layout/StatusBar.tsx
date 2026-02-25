import { Icon } from "@/components/ui";

export function StatusBar() {
  return (
    <footer className="fixed bottom-0 w-full h-5 bg-accent-blue text-white flex items-center justify-between px-3 text-[10px] z-30 select-none font-sans">
      {/* Left section */}
      <div className="flex items-center gap-4">
        {/* Branch */}
        <button className="flex items-center gap-1 hover:bg-white/20 px-1 py-0.5 rounded cursor-pointer">
          <Icon name="code" size={12} />
          <span className="font-medium">main*</span>
        </button>

        {/* Sync status */}
        <button className="flex items-center gap-1 hover:bg-white/20 px-1 py-0.5 rounded cursor-pointer">
          <Icon name="sync" size={12} />
          <span>0</span>
          <Icon name="arrow_right_alt" size={12} className="rotate-180" />
          <span>1</span>
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
        {/* DB connection indicator */}
        <button className="flex items-center gap-1 hover:bg-white/20 px-1 py-0.5 rounded cursor-pointer">
          <div className="w-1.5 h-1.5 rounded-full bg-white" />
          <span className="font-medium">Postgres: Connected</span>
        </button>

        <button className="cursor-pointer hover:bg-white/20 px-1 py-0.5 rounded">
          Ln 7, Col 12
        </button>
        <button className="cursor-pointer hover:bg-white/20 px-1 py-0.5 rounded">
          UTF-8
        </button>
        <button className="cursor-pointer hover:bg-white/20 px-1 py-0.5 rounded">
          Prettier
        </button>
        <button className="cursor-pointer hover:bg-white/20 px-1 py-0.5 rounded">
          <Icon name="notifications" size={12} />
        </button>
      </div>
    </footer>
  );
}
