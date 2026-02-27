import { useRef, useCallback, useState } from "react";
import { clsx } from "clsx";

export interface SplitterProps {
  direction: "horizontal" | "vertical";
  onResize: (delta: number) => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
  className?: string;
}

/* ── SVG Cursor Definitions ── */

const horizontalSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <g stroke="#cfcfcf" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <line x1="6" y1="16" x2="26" y2="16"/>
    <polyline points="10,10 4,16 10,22"/>
    <polyline points="22,10 28,16 22,22"/>
  </g>
</svg>
`;

const verticalSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <g stroke="#cfcfcf" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <line x1="16" y1="6" x2="16" y2="26"/>
    <polyline points="10,10 16,4 22,10"/>
    <polyline points="10,22 16,28 22,22"/>
  </g>
</svg>
`;

const encodeCursor = (svg: string, fallback: string) =>
  `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") 16 16, ${fallback}`;

const CURSOR_H = encodeCursor(horizontalSvg, "col-resize");
const CURSOR_V = encodeCursor(verticalSvg, "row-resize");

export function Splitter({
  direction,
  onResize,
  onResizeStart,
  onResizeEnd,
  className,
}: SplitterProps) {
  const startPos = useRef<number>(0);
  const [dragging, setDragging] = useState(false);

  const isHorizontal = direction === "horizontal";
  const cursorStyle = isHorizontal ? CURSOR_H : CURSOR_V;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();

      startPos.current = isHorizontal ? e.clientX : e.clientY;
      setDragging(true);
      onResizeStart?.();

      const onMove = (ev: MouseEvent) => {
        const current = isHorizontal ? ev.clientX : ev.clientY;
        onResize(current - startPos.current);
      };

      const onUp = () => {
        setDragging(false);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        onResizeEnd?.();
      };

      document.body.style.cursor = cursorStyle;
      document.body.style.userSelect = "none";

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [isHorizontal, cursorStyle, onResize, onResizeStart, onResizeEnd]
  );

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{ cursor: cursorStyle }}
      className={clsx(
        "relative z-20 flex items-center justify-center shrink-0 group",
        isHorizontal ? "w-[6px]" : "h-[6px]",
        className
      )}
    >
      {/* Divider line */}
      <div
        className={clsx(
          "absolute transition-colors duration-100",
          isHorizontal
            ? "inset-y-0 w-[1px]"
            : "inset-x-0 h-[1px]",
          dragging
            ? "bg-blue-500"
            : "bg-gray-500 group-hover:bg-blue-500"
        )}
      />

      {/* Wider invisible hit area */}
      <div
        className={clsx(
          "absolute",
          isHorizontal
            ? "inset-y-0 -left-2 -right-2"
            : "inset-x-0 -top-2 -bottom-2"
        )}
        style={{ cursor: cursorStyle }}
      />
    </div>
  );
}   