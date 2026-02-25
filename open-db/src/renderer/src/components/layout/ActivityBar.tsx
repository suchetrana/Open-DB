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

export function ActivityBar() {
  const activeSidebarView = useAppStore((s) => s.activeSidebarView);
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const setSidebarView = useAppStore((s) => s.setSidebarView);

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
