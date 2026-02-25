/**
 * DatabaseExplorer — tree view showing schemas → tables/views → columns
 * for the currently active database connection.
 */
import React, { useState, useEffect, useCallback } from "react";
import { Icon } from "@/components/ui";
import { useAppStore } from "@/store/useAppStore";
import { clsx } from "clsx";
import type { TableNode, ColumnNode } from "@/types";

function dataTypeIcon(dt: string): { icon: string; color: string } {
  const t = dt.toLowerCase();
  if (t.includes("int") || t.includes("numeric") || t.includes("float") || t.includes("double") || t.includes("decimal") || t === "serial" || t === "bigserial")
    return { icon: "tag", color: "text-syntax-number" };
  if (t.includes("bool")) return { icon: "check_circle", color: "text-status-green" };
  if (t.includes("time") || t.includes("date")) return { icon: "schedule", color: "text-status-green" };
  if (t.includes("json")) return { icon: "data_object", color: "text-syntax-decorator" };
  if (t === "uuid") return { icon: "fingerprint", color: "text-syntax-function" };
  if (t.includes("text") || t.includes("char") || t.includes("varchar"))
    return { icon: "abc", color: "text-syntax-keyword" };
  if (t.includes("bytea") || t.includes("blob")) return { icon: "memory", color: "text-text-secondary" };
  return { icon: "abc", color: "text-syntax-keyword" };
}

// ── Column item ──
function ColumnItem({ col }: { col: ColumnNode }) {
  const { icon, color } = col.isPrimaryKey
    ? { icon: "key", color: "text-syntax-function" }
    : dataTypeIcon(col.dataType);

  return (
    <div className="flex items-center gap-1.5 pl-14 pr-2 py-[2px] text-[11px] text-text-secondary hover:bg-bg-surface-hover cursor-default select-none">
      <Icon name={icon} size={12} className={color} />
      <span className="truncate">{col.name}</span>
      <span className="ml-auto text-[10px] text-text-muted truncate max-w-[80px]">
        {col.dataType}
        {col.nullable ? "" : " NN"}
      </span>
    </div>
  );
}

// ── Table item (expandable → columns) ──
function TableItem({ connId, table }: { connId: string; table: TableNode }) {
  const [open, setOpen] = useState(false);
  const [columns, setColumns] = useState<ColumnNode[]>([]);
  const [loading, setLoading] = useState(false);
  const addTab = useAppStore((s) => s.openTableTab);

  const toggle = useCallback(async () => {
    const next = !open;
    setOpen(next);
    if (next && columns.length === 0) {
      setLoading(true);
      try {
        const cols = await window.electronAPI.database.getColumns(connId, table.schema, table.name);
        setColumns(cols);
      } catch (err) {
        console.error("Failed to fetch columns", err);
      } finally {
        setLoading(false);
      }
    }
  }, [open, columns.length, connId, table]);

  const isView = table.type === "view";

  return (
    <div>
      <div
        className="flex items-center gap-1.5 pl-10 pr-2 py-[2px] hover:bg-bg-surface-hover cursor-pointer select-none group/tbl"
        onClick={toggle}
      >
        <Icon
          name="chevron_right"
          size={12}
          className={clsx("transition-transform text-text-muted", open && "rotate-90")}
        />
        <Icon
          name={isView ? "view_list" : "table_chart"}
          size={13}
          className={isView ? "text-syntax-keyword" : "text-syntax-decorator"}
        />
        <span className="text-[11px] text-text-primary truncate flex-1">{table.name}</span>
        {table.rowEstimate > 0 && (
          <span className="text-[10px] text-text-muted">
            ~{table.rowEstimate >= 1000 ? `${(table.rowEstimate / 1000).toFixed(1)}k` : table.rowEstimate}
          </span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); addTab(table.schema, table.name); }}
          className="opacity-0 group-hover/tbl:opacity-100 text-text-secondary hover:text-text-primary"
          title="Open table data"
        >
          <Icon name="open_in_new" size={12} />
        </button>
      </div>
      {open && (
        <div>
          {loading && (
            <div className="pl-14 text-[10px] text-text-muted py-1">Loading columns…</div>
          )}
          {columns.map((col) => (
            <ColumnItem key={col.name} col={col} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Schema item (expandable → tables + views) ──
function SchemaItem({ connId, schema }: { connId: string; schema: string }) {
  const [open, setOpen] = useState(schema === "public");
  const [tables, setTables] = useState<TableNode[]>([]);
  const [loading, setLoading] = useState(false);

  const toggle = useCallback(async () => {
    const next = !open;
    setOpen(next);
    if (next && tables.length === 0) {
      setLoading(true);
      try {
        const t = await window.electronAPI.database.getTables(connId, schema);
        setTables(t);
      } catch (err) {
        console.error("Failed to fetch tables", err);
      } finally {
        setLoading(false);
      }
    }
  }, [open, tables.length, connId, schema]);

  // Auto-expand public schema on mount
  useEffect(() => {
    if (schema === "public" && tables.length === 0) {
      setLoading(true);
      window.electronAPI.database.getTables(connId, schema).then(setTables).catch(console.error).finally(() => setLoading(false));
    }
  }, [connId, schema, tables.length]);

  const tableList = tables.filter((t) => t.type === "table");
  const viewList = tables.filter((t) => t.type === "view");

  return (
    <div>
      <div
        className="flex items-center gap-1.5 pl-6 pr-2 py-[2px] hover:bg-bg-surface-hover cursor-pointer select-none"
        onClick={toggle}
      >
        <Icon
          name="chevron_right"
          size={12}
          className={clsx("transition-transform text-text-muted", open && "rotate-90")}
        />
        <Icon name="schema" size={13} className="text-syntax-string" />
        <span className="text-[11px] text-text-primary">{schema}</span>
        <span className="text-[10px] text-text-muted ml-1">
          ({tables.length > 0 ? tables.length : "…"})
        </span>
      </div>
      {open && (
        <div>
          {loading && (
            <div className="pl-10 text-[10px] text-text-muted py-1">Loading…</div>
          )}
          {tableList.length > 0 && (
            <div>
              <div className="pl-10 text-[10px] text-text-muted uppercase tracking-wider py-0.5">
                Tables ({tableList.length})
              </div>
              {tableList.map((t) => (
                <TableItem key={t.name} connId={connId} table={t} />
              ))}
            </div>
          )}
          {viewList.length > 0 && (
            <div>
              <div className="pl-10 text-[10px] text-text-muted uppercase tracking-wider py-0.5">
                Views ({viewList.length})
              </div>
              {viewList.map((v) => (
                <TableItem key={v.name} connId={connId} table={v} />
              ))}
            </div>
          )}
          {!loading && tables.length === 0 && (
            <div className="pl-10 text-[10px] text-text-muted py-1">No tables</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main export ──
export function DatabaseExplorer() {
  const activeConnectionId = useAppStore((s) => s.activeConnectionId);
  const connections = useAppStore((s) => s.connections);
  const activeConn = connections.find((c) => c.id === activeConnectionId);

  const [databases, setDatabases] = useState<string[]>([]);
  const [schemas, setSchemas] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch schemas when connection changes
  useEffect(() => {
    if (!activeConnectionId || !activeConn?.isConnected) {
      setSchemas([]);
      setDatabases([]);
      return;
    }

    setLoading(true);
    Promise.all([
      window.electronAPI.database.getDatabases(activeConnectionId).catch(() => [] as string[]),
      window.electronAPI.database.getSchemas(activeConnectionId).catch(() => [] as { name: string }[]),
    ]).then(([dbs, sch]) => {
      setDatabases(dbs);
      setSchemas(sch.map((s) => s.name));
      setLoading(false);
    });
  }, [activeConnectionId, activeConn?.isConnected]);

  return (
    <details className="group mt-0.5" open>
      <summary className="flex items-center px-1 py-0.5 cursor-pointer hover:bg-bg-surface-hover select-none text-text-primary focus:outline-none focus:bg-bg-surface-active">
        <Icon
          name="chevron_right"
          size={16}
          className="transition-transform group-open:rotate-90 text-text-primary"
        />
        <span className="text-[11px] font-bold uppercase ml-0.5">
          Database
        </span>
        {activeConn && (
          <span className="ml-auto mr-2 text-[10px] text-status-green font-mono">
            {activeConn.database ?? "postgres"}
          </span>
        )}
      </summary>

      <div className="flex flex-col pb-1 font-mono">
        {!activeConn?.isConnected && (
          <div className="text-text-muted text-[11px] py-2 pl-6">
            Connect to a database to browse schema.
          </div>
        )}

        {loading && (
          <div className="text-text-muted text-[10px] py-2 pl-6">Loading schema…</div>
        )}

        {activeConn?.isConnected && !loading && (
          <>
            {/* Databases count */}
            {databases.length > 0 && (
              <div className="flex items-center gap-1.5 pl-4 pr-2 py-[2px] text-[11px] text-text-secondary select-none">
                <Icon name="storage" size={13} className="text-syntax-function" />
                <span>Databases: {databases.length}</span>
              </div>
            )}

            {/* Schemas */}
            {schemas.length > 0 ? (
              schemas.map((s) => (
                <SchemaItem key={s} connId={activeConnectionId!} schema={s} />
              ))
            ) : (
              <div className="text-text-muted text-[10px] py-1 pl-6">No schemas found</div>
            )}
          </>
        )}
      </div>
    </details>
  );
}
