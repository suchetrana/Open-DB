import { useState, useEffect, useCallback, useRef } from "react";
import { Icon } from "@/components/ui";
import { clsx } from "clsx";
import type { ColumnDef } from "@/types";

interface ResultsTableProps {
  columns: ColumnDef[];
  rows: Record<string, string | number | null>[];
}

/** Colour a cell value based on its column type */
function cellColor(col: ColumnDef): string {
  if (col.dataType.startsWith("varchar") || col.dataType === "enum") return "text-syntax-string";
  if (col.dataType === "uuid") return "text-syntax-number";
  if (col.dataType === "timestamp") return "text-text-secondary";
  return "text-text-primary";
}

/** Render badges for special values */
function CellValue({
  col,
  value,
  highlight,
}: {
  col: ColumnDef;
  value: string | number | null;
  highlight?: string;
}) {
  if (value === null) return <span className="text-text-muted italic">NULL</span>;

  const str = String(value);

  // Role badges
  if (col.name === "role") {
    const isAdmin = str === "ADMIN";
    return (
      <span
        className={clsx(
          "px-1 py-0.5 rounded text-[9px]",
          isAdmin
            ? "bg-selection-bg text-syntax-param font-bold"
            : "bg-[#3c3c3c] text-syntax-operator"
        )}
      >
        {str}
      </span>
    );
  }

  // Status indicator
  if (col.name === "status" && str === "active") {
    return <span className="text-status-green">{str}</span>;
  }

  // Highlight search matches
  if (highlight && highlight.length > 0) {
    const lower = str.toLowerCase();
    const hLower = highlight.toLowerCase();
    const idx = lower.indexOf(hLower);
    if (idx !== -1) {
      return (
        <span className={cellColor(col)}>
          {str.slice(0, idx)}
          <mark className="bg-[#515c6a] text-[#e2c08d] rounded-sm px-0.5">{str.slice(idx, idx + highlight.length)}</mark>
          {str.slice(idx + highlight.length)}
        </span>
      );
    }
  }

  return <span className={cellColor(col)}>{str}</span>;
}

/** Hook: Ctrl+F search bar for the results table */
function useTableSearch() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape" && searchOpen) {
        setSearchOpen(false);
        setSearchTerm("");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [searchOpen]);

  return { searchOpen, setSearchOpen, searchTerm, setSearchTerm };
}

export function ResultsTable({ columns, rows }: ResultsTableProps) {
  const { searchOpen, setSearchOpen, searchTerm, setSearchTerm } = useTableSearch();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Column widths in px – initialised from col.width or default
  const [colWidths, setColWidths] = useState<number[]>(() =>
    columns.map((c) => {
      if (c.width) {
        const m = c.width.match(/w-(\d+)/);
        if (m) return parseInt(m[1]) * 4; // Tailwind w-N → N*4 px
      }
      return 150;
    })
  );

  // Reset widths when columns change
  useEffect(() => {
    setColWidths(
      columns.map((c) => {
        if (c.width) {
          const m = c.width.match(/w-(\d+)/);
          if (m) return parseInt(m[1]) * 4;
        }
        return 150;
      })
    );
  }, [columns]);

  // Focus search input when opened
  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  // Column resize handler
  const dragRef = useRef<{ colIdx: number; startX: number; startW: number } | null>(null);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent, colIdx: number) => {
      e.preventDefault();
      e.stopPropagation();
      dragRef.current = { colIdx, startX: e.clientX, startW: colWidths[colIdx] };

      const onMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        const delta = ev.clientX - dragRef.current.startX;
        const newWidth = Math.max(50, dragRef.current.startW + delta);
        setColWidths((prev) => {
          const next = [...prev];
          next[dragRef.current!.colIdx] = newWidth;
          return next;
        });
      };

      const onUp = () => {
        dragRef.current = null;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [colWidths]
  );

  // Filter rows by search term
  const filteredRows = searchTerm
    ? rows.filter((row) =>
        columns.some((col) => {
          const v = row[col.name];
          return v !== null && String(v).toLowerCase().includes(searchTerm.toLowerCase());
        })
      )
    : rows;

  const matchCount = searchTerm ? filteredRows.length : 0;

  if (rows.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-muted text-xs font-mono">
        No rows returned
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Search bar (Ctrl+F) */}
      {searchOpen && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#181a1d] border-b border-[#25262a] shrink-0">
          <Icon name="search" size={14} className="text-text-muted" />
          <input
            ref={searchInputRef}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Find in results…"
            className="glass-input w-60 px-2 py-0.5 text-[11px] placeholder:text-text-muted"
          />
          {searchTerm && (
            <span className="text-[10px] text-text-secondary font-mono">
              {matchCount} match{matchCount !== 1 ? "es" : ""}
            </span>
          )}
          <button
            onClick={() => {
              setSearchOpen(false);
              setSearchTerm("");
            }}
            className="ml-auto text-text-secondary hover:text-text-primary p-0.5 rounded-item hover:bg-white/6 transition-colors duration-200"
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-auto flex-1 font-mono text-[11px] bg-[#181a1d] min-h-0">
        <table className="text-left border-collapse" style={{ minWidth: "100%" }}>
          {/* Column groups for widths */}
          <colgroup>
            {colWidths.map((w, i) => (
              <col key={i} style={{ width: w, minWidth: 50 }} />
            ))}
          </colgroup>

          {/* Header */}
          <thead className="bg-[#1a1c20] text-text-primary sticky top-0 z-10 shadow-sm">
            <tr>
              {columns.map((col, i) => (
                <th
                  key={col.name}
                  className={clsx(
                    "p-1 pl-3 font-semibold whitespace-nowrap border-b border-[#25262a] relative",
                    i < columns.length - 1 && "border-r border-r-[#25262a]"
                  )}
                  style={{ width: colWidths[i] }}
                >
                  <div className="flex items-center gap-1">
                    <Icon name={col.icon} size={10} className={col.iconColor} />
                    {col.name}
                  </div>
                  <span className="text-[9px] text-text-muted font-normal block pl-4">
                    {col.dataType}
                  </span>

                  {/* Resize handle */}
                  {i < columns.length - 1 && (
                    <div
                      onMouseDown={(e) => handleResizeStart(e, i)}
                      className="absolute top-0 right-0 w-[5px] h-full cursor-col-resize hover:bg-accent-blue z-20"
                      style={{ transform: "translateX(50%)" }}
                    />
                  )}
                </th>
              ))}
            </tr>
          </thead>

          {/* Body */}
          <tbody className="text-text-primary divide-y divide-border-subtle">
            {filteredRows.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                className={clsx(
                  "hover:bg-white/4 cursor-default h-7",
                  rowIdx % 2 !== 0 && "bg-white/[0.02]"
                )}
              >
                {columns.map((col, colIdx) => (
                  <td
                    key={col.name}
                    className={clsx(
                      "px-3 whitespace-nowrap overflow-hidden text-ellipsis",
                      colIdx < columns.length - 1 && "border-r border-border-subtle"
                    )}
                    style={{ maxWidth: colWidths[colIdx] }}
                  >
                    <CellValue
                      col={col}
                      value={row[col.name] ?? null}
                      highlight={searchTerm}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
