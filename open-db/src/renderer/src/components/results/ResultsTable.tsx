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
function CellValue({ col, value }: { col: ColumnDef; value: string | number | null }) {
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

  return <span className={cellColor(col)}>{str}</span>;
}

export function ResultsTable({ columns, rows }: ResultsTableProps) {
  return (
    <div className="overflow-auto flex-1 font-mono text-[11px] bg-bg-elevated">
      <table className="w-full text-left border-collapse table-fixed">
        {/* Header */}
        <thead className="bg-bg-surface text-text-primary sticky top-0 z-10 shadow-sm">
          <tr>
            {columns.map((col, i) => (
              <th
                key={col.name}
                className={clsx(
                  "p-1 pl-3 font-semibold whitespace-nowrap border-b border-border-default",
                  col.width,
                  i < columns.length - 1 && "border-r border-r-border-default"
                )}
              >
                <div className="flex items-center gap-1">
                  <Icon name={col.icon} size={10} className={col.iconColor} />
                  {col.name}
                </div>
                <span className="text-[9px] text-text-muted font-normal block pl-4">
                  {col.dataType}
                </span>
              </th>
            ))}
          </tr>
        </thead>

        {/* Body */}
        <tbody className="text-text-primary divide-y divide-border-subtle">
          {rows.map((row, rowIdx) => (
            <tr
              key={rowIdx}
              className={clsx(
                "hover:bg-bg-surface-hover cursor-default h-7",
                rowIdx % 2 !== 0 && "bg-[#1a1a1a]"
              )}
            >
              {columns.map((col, colIdx) => (
                <td
                  key={col.name}
                  className={clsx(
                    "px-3 whitespace-nowrap",
                    colIdx < columns.length - 1 && "border-r border-border-subtle"
                  )}
                >
                  <CellValue col={col} value={row[col.name] ?? null} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
