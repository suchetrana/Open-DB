/**
 * DatabaseExplorer — tree view showing schemas → tables/views → columns
 * for the currently active database connection.
 */
import React, { useState, useEffect, useCallback } from "react";
import { Icon, ContextMenu } from "@/components/ui";
import { useAppStore } from "@/store/useAppStore";
import { RedisDatabaseBrowser } from "./RedisDatabaseBrowser";
import { MongoDatabaseBrowser } from "./MongoDatabaseBrowser";
import { clsx } from "clsx";
import type { TableNode, ColumnNode, ContextMenuItem, IndexNode } from "@/types";

function qIdent(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function mapIndexRows(rows: Record<string, unknown>[]): IndexNode[] {
  return rows.map((r) => {
    const rawCols = r.columns;
    const cols = Array.isArray(rawCols) ? rawCols.map((v) => String(v)) : [];
    return {
      name: String(r.name ?? ""),
      columns: cols,
      isUnique: Boolean(r.isUnique),
      isPrimary: Boolean(r.isPrimary),
      type: String(r.type ?? "btree"),
      definition: String(r.definition ?? ""),
    };
  });
}

async function fetchIndexesWithFallback(connId: string, schema: string, table: string): Promise<IndexNode[]> {
  try {
    const direct = await window.electronAPI.database.getIndexes(connId, schema, table);
    return direct;
  } catch {
    // Fall through to SQL fallback for resilience.
  }

  const sql = `
    SELECT
      idx.indexname AS name,
      COALESCE(array_agg(pg_get_indexdef(i.oid, gs.k, true) ORDER BY gs.k) FILTER (WHERE gs.k IS NOT NULL), '{}'::text[]) AS columns,
      pi.indisunique AS "isUnique",
      pi.indisprimary AS "isPrimary",
      COALESCE(am.amname, 'btree') AS type,
      idx.indexdef AS definition
    FROM pg_indexes idx
    JOIN pg_class t ON t.relname = idx.tablename
    JOIN pg_namespace tn ON tn.oid = t.relnamespace AND tn.nspname = idx.schemaname
    JOIN pg_class i ON i.relname = idx.indexname
    JOIN pg_namespace ins ON ins.oid = i.relnamespace AND ins.nspname = idx.schemaname
    JOIN pg_index pi ON pi.indexrelid = i.oid AND pi.indrelid = t.oid
    LEFT JOIN pg_am am ON am.oid = i.relam
    LEFT JOIN LATERAL generate_series(1, pi.indnatts) AS gs(k) ON true
    WHERE idx.schemaname = ${qIdent(schema)}
      AND idx.tablename = ${qIdent(table)}
    GROUP BY idx.indexname, pi.indisunique, pi.indisprimary, am.amname, idx.indexdef
    ORDER BY idx.indexname
  `;

  const raw = await window.electronAPI.database.executeQuery(connId, sql) as { rows: Record<string, unknown>[] };
  return mapIndexRows(raw.rows);
}

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
    <div className="flex items-center gap-1.5 pl-14 pr-2 py-1 text-[11px] text-text-secondary glass-row mx-1 cursor-default select-none" style={{ width: 'calc(100% - 8px)', paddingLeft: '3.5rem' }}>
      <Icon name={icon} size={12} className={color} />
      <span className="truncate">{col.name}</span>
      <span className="ml-auto text-[10px] text-text-muted truncate max-w-[80px]">
        {col.dataType}
        {col.nullable ? "" : " NN"}
      </span>
    </div>
  );
}

function IndexItem({ idx }: { idx: IndexNode }) {
  return (
    <div
      className="flex items-center gap-1.5 pl-14 pr-2 py-1 text-[11px] text-text-secondary glass-row mx-1 cursor-default select-none"
      style={{ width: 'calc(100% - 8px)', paddingLeft: '3.5rem' }}
      title={idx.definition}
    >
      <Icon name={idx.isPrimary ? "key" : "sort"} size={12} className={idx.isPrimary ? "text-syntax-function" : "text-accent-blue"} />
      <span className="truncate">{idx.name}</span>
      <span className="ml-auto text-[10px] text-text-muted truncate max-w-[160px]">
        {idx.columns.length > 0 ? idx.columns.join(", ") : "Expression"}
      </span>
    </div>
  );
}

// ── Table item (expandable → columns) with right-click context menu ──
function TableItem({ connId, table }: { connId: string; table: TableNode }) {
  const [open, setOpen] = useState(false);
  const [columns, setColumns] = useState<ColumnNode[]>([]);
  const [indexes, setIndexes] = useState<IndexNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingIndexes, setLoadingIndexes] = useState(false);
  const addTab = useAppStore((s) => s.openTableTab);
  const openStructureTab = useAppStore((s) => s.openStructureTab);
  const addNewFileTab = useAppStore((s) => s.addNewFileTab);
  const executeQuery = useAppStore((s) => s.executeQuery);
  const setResultsPanelMode = useAppStore((s) => s.setResultsPanelMode);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const toggle = useCallback(async () => {
    const next = !open;
    setOpen(next);
    if (next && (columns.length === 0 || indexes.length === 0)) {
      setLoading(true);
      setLoadingIndexes(true);
      try {
        const [cols, idxList] = await Promise.all([
          columns.length === 0
            ? window.electronAPI.database.getColumns(connId, table.schema, table.name)
            : Promise.resolve(columns),
          indexes.length === 0
            ? fetchIndexesWithFallback(connId, table.schema, table.name)
            : Promise.resolve(indexes),
        ]);
        setColumns(cols);
        setIndexes(idxList);
      } catch (err) {
        console.error("Failed to fetch table details", err);
      } finally {
        setLoading(false);
        setLoadingIndexes(false);
      }
    }
  }, [open, columns, indexes, connId, table]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const contextMenuItems: ContextMenuItem[] = [
    {
      label: "View Data",
      icon: "table_rows",
      iconColor: "text-syntax-function",
      action: () => {
        addTab(table.schema, table.name);
        setResultsPanelMode('normal');
        window.setTimeout(() => {
          void executeQuery();
        }, 0);
      },
    },
    {
      label: "View Structure",
      icon: "view_column",
      iconColor: "text-syntax-decorator",
      action: () => openStructureTab(connId, table.schema, table.name),
    },
    {
      label: "Export To File",
      icon: "download",
      iconColor: "text-accent-blue",
      action: () => {
        // Open a query with COPY command hint
        addNewFileTab(`export_${table.name}.sql`, `-- Export ${table.schema}.${table.name} to CSV\nCOPY ${table.schema}.${table.name} TO '/tmp/${table.name}.csv' WITH CSV HEADER;\n`)
      },
      separator: true,
    },
    {
      label: "Copy Name",
      icon: "content_copy",
      iconColor: "text-text-secondary",
      action: () => navigator.clipboard.writeText(`${table.schema}.${table.name}`),
      separator: true,
    },
    {
      label: "SQL: Create",
      icon: "code",
      iconColor: "text-syntax-keyword",
      action: () => {
        // Generate CREATE TABLE script from columns
        const fetchAndGenerate = async () => {
          try {
            let cols = columns;
            if (cols.length === 0) {
              cols = await window.electronAPI.database.getColumns(connId, table.schema, table.name);
            }
            const colDefs = cols.map((c) => {
              let def = `  ${c.name} ${c.dataType}`;
              if (!c.nullable) def += ' NOT NULL';
              if (c.defaultValue) def += ` DEFAULT ${c.defaultValue}`;
              return def;
            }).join(',\n');
            const pks = cols.filter((c) => c.isPrimaryKey).map((c) => c.name);
            const pkLine = pks.length > 0 ? `,\n  PRIMARY KEY (${pks.join(', ')})` : '';
            const sql = `CREATE TABLE ${table.schema}.${table.name} (\n${colDefs}${pkLine}\n);\n`;
            addNewFileTab(`create_${table.name}.sql`, sql);
          } catch (err) {
            console.error('Failed to generate CREATE TABLE', err);
          }
        };
        fetchAndGenerate();
      },
      separator: true,
    },
    {
      label: "Rename",
      icon: "edit",
      iconColor: "text-text-secondary",
      action: () => {
        const newName = prompt(`Rename table "${table.name}" to:`, table.name);
        if (newName && newName !== table.name) {
          addNewFileTab(`rename_${table.name}.sql`, `ALTER TABLE ${table.schema}.${table.name} RENAME TO ${newName};\n`);
        }
      },
    },
    {
      label: "Drop",
      icon: "delete",
      danger: true,
      action: () => {
        addNewFileTab(`drop_${table.name}.sql`, `-- WARNING: This will permanently delete the table and all its data\nDROP TABLE IF EXISTS ${table.schema}.${table.name} CASCADE;\n`);
      },
    },
    {
      label: "Truncate",
      icon: "delete_sweep",
      danger: true,
      action: () => {
        addNewFileTab(`truncate_${table.name}.sql`, `-- WARNING: This will delete all rows from the table\nTRUNCATE TABLE ${table.schema}.${table.name};\n`);
      },
    },
    {
      label: "Duplicate",
      icon: "content_copy",
      iconColor: "text-text-secondary",
      action: () => {
        addNewFileTab(`duplicate_${table.name}.sql`, `-- Duplicate table structure and data\nCREATE TABLE ${table.schema}.${table.name}_copy AS TABLE ${table.schema}.${table.name};\n`);
      },
    },
  ];

  const isView = table.type === "view";

  return (
    <div>
      <div
        className="glass-row mx-1 flex items-center gap-1.5 pl-10 pr-2 py-1 cursor-pointer select-none group/tbl transition-colors hover:bg-[#27272a]/60"
        style={{ width: 'calc(100% - 8px)' }}
        onClick={toggle}
        onContextMenu={handleContextMenu}
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
        <span className="text-[12px] text-text-primary truncate flex-1">{table.name}</span>
        {table.rowEstimate > 0 && (
          <span className="text-[10px] text-text-muted">
            ~{table.rowEstimate >= 1000 ? `${(table.rowEstimate / 1000).toFixed(1)}k` : table.rowEstimate}
          </span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); openStructureTab(connId, table.schema, table.name); }}
          className="opacity-0 group-hover/tbl:opacity-100 text-text-secondary hover:text-text-primary transition-opacity"
          title="View structure"
        >
          <Icon name="view_column" size={12} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); addTab(table.schema, table.name); }}
          className="opacity-0 group-hover/tbl:opacity-100 text-text-secondary hover:text-text-primary transition-opacity"
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
          {!loading && (
            <div className="pl-14 pr-2 pt-1 pb-0.5 text-[10px] uppercase tracking-wider text-text-muted">Columns</div>
          )}
          {columns.map((col) => (
            <ColumnItem key={col.name} col={col} />
          ))}
          {loadingIndexes && (
            <div className="pl-14 text-[10px] text-text-muted py-1">Loading indexes…</div>
          )}
          {!loadingIndexes && (
            <div className="pl-14 pr-2 pt-1 pb-0.5 text-[10px] uppercase tracking-wider text-text-muted">Indexes</div>
          )}
          {indexes.length > 0 ? (
            indexes.map((idx) => <IndexItem key={idx.name} idx={idx} />)
          ) : (
            !loadingIndexes && (
              <div className="pl-14 text-[10px] text-text-muted py-1 italic">No indexes</div>
            )
          )}
        </div>
      )}
      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

// ── Schema item (expandable → tables + views) ──
function SchemaItem({ connId, schema, dbName }: { connId: string; schema: string; dbName: string }) {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connId, schema, dbName]);

  const tableList = tables.filter((t) => t.type === "table");
  const viewList = tables.filter((t) => t.type === "view");

  return (
    <div>
      <div
        className="glass-row mx-1 flex items-center gap-1.5 pl-6 pr-2 py-1 cursor-pointer select-none hover:bg-[#27272a]/55"
        style={{ width: 'calc(100% - 8px)' }}
        onClick={toggle}
      >
        <Icon
          name="chevron_right"
          size={12}
          className={clsx("transition-transform text-text-muted", open && "rotate-90")}
        />
        <Icon name="schema" size={13} className="text-syntax-string" />
        <span className="text-[11px] text-text-primary tracking-[0.01em]">{schema}</span>
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

// ── Database item (shows schemas for a single database) ──
function DatabaseItem({
  connId,
  dbName,
  isSelected,
  onSwitch,
}: {
  connId: string;
  dbName: string;
  isSelected: boolean;
  onSwitch: (db: string) => void;
}) {
  const [open, setOpen] = useState(isSelected);
  const [schemas, setSchemas] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // When this database becomes selected, load its schemas
  useEffect(() => {
    if (isSelected && !loaded) {
      setLoading(true);
      setOpen(true);
      window.electronAPI.database
        .getSchemas(connId)
        .then((sch) => {
          setSchemas(sch.map((s) => s.name));
          setLoaded(true);
        })
        .catch(() => {
          setSchemas([]);
          setLoaded(true);
        })
        .finally(() => setLoading(false));
    }
    // When deselected, clear loaded state so it refreshes when re-selected
    if (!isSelected) {
      setLoaded(false);
      setSchemas([]);
      setOpen(false);
    }
  }, [isSelected, connId, loaded]);

  const handleClick = () => {
    if (!isSelected) {
      onSwitch(dbName);
    } else {
      setOpen(!open);
    }
  };

  return (
    <div>
      <div
        className={clsx(
          "glass-row mx-1 flex items-center gap-1.5 pl-4 pr-2 py-1.5 cursor-pointer select-none group/db border border-transparent",
          isSelected
            ? "bg-[#1e293b]/80 border-[#334155] shadow-[inset_0_0_0_1px_rgba(96,165,250,0.12)]"
            : "opacity-80 hover:opacity-100 hover:bg-[#27272a]/65"
        )}
        style={{ width: 'calc(100% - 8px)' }}
        onClick={handleClick}
      >
        <Icon
          name="chevron_right"
          size={12}
          className={clsx(
            "transition-transform text-text-muted",
            open && isSelected && "rotate-90"
          )}
        />
        <Icon
          name="storage"
          size={13}
          className={isSelected ? "text-accent-blue" : "text-text-muted"}
        />
        <span
          className={clsx(
            "text-[13px] truncate flex-1",
            isSelected ? "text-text-primary font-semibold" : "text-text-secondary"
          )}
        >
          {dbName}
        </span>
        {isSelected && (
          <span className="ml-2 inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] text-accent-blue bg-accent-blue/15 border border-accent-blue/30">
            Active
          </span>
        )}
        {!isSelected && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSwitch(dbName);
            }}
            className="opacity-0 group-hover/db:opacity-100 text-[10px] uppercase tracking-[0.04em] text-text-secondary hover:text-accent-blue"
            title={`Switch to ${dbName}`}
          >
            connect
          </button>
        )}
      </div>
      {open && isSelected && (
        <div>
          {loading && (
            <div className="pl-8 text-[10px] text-text-muted py-1">Loading schemas…</div>
          )}
          {schemas.length > 0
            ? schemas.map((s) => (
                <SchemaItem key={`${dbName}-${s}`} connId={connId} schema={s} dbName={dbName} />
              ))
            : !loading && (
                <div className="pl-8 text-[10px] text-text-muted py-1">No schemas</div>
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
  const selectedDatabase = useAppStore((s) => s.selectedDatabase);
  const availableDatabases = useAppStore((s) => s.availableDatabases);
  const switchDatabase = useAppStore((s) => s.switchDatabase);
  const fetchDatabases = useAppStore((s) => s.fetchDatabases);
  const activeConn = connections.find((c) => c.id === activeConnectionId);
  const parsedRedisDb = Number.parseInt(selectedDatabase ?? '0', 10);
  const safeRedisDb = Number.isFinite(parsedRedisDb) ? parsedRedisDb : 0;
  const isSqlConn = activeConn?.type === 'postgres' || activeConn?.type === 'mysql';

  const [switching, setSwitching] = useState(false);

  // Fetch databases when connection changes
  useEffect(() => {
    if (activeConnectionId && activeConn?.isConnected) {
      fetchDatabases();
    }
  }, [activeConnectionId, activeConn?.isConnected, fetchDatabases]);

  const handleSwitchDb = async (dbName: string) => {
    if (switching || dbName === selectedDatabase) return;
    setSwitching(true);
    try {
      await switchDatabase(dbName);
      // Re-fetch databases list (still the same, but ensures consistency)
      await fetchDatabases();
    } catch (err) {
      console.error("Failed to switch database", err);
    } finally {
      setSwitching(false);
    }
  };

  return (
    <details className="group mt-0.5" open>
      <summary className="glass-row mx-1 flex items-center cursor-pointer select-none text-text-primary focus:outline-none py-1" style={{ width: 'calc(100% - 8px)' }}>
        <Icon
          name="chevron_right"
          size={14}
          className="transition-transform group-open:rotate-90 text-text-primary"
        />
        <span className="text-[11px] font-bold uppercase ml-0.5 tracking-[0.08em] text-text-secondary">Databases</span>
        {activeConn && (
          <button
            onClick={(e) => {
              e.preventDefault();
              fetchDatabases();
            }}
            className="ml-auto mr-2 text-text-muted hover:text-text-primary rounded-item p-0.5 hover:bg-[#27272a]/60"
            title="Refresh databases"
          >
            <Icon name="refresh" size={14} />
          </button>
        )}
      </summary>

      <div className="flex flex-col pb-1 font-mono">
        {!activeConn?.isConnected && (
          <div className="text-text-muted text-[11px] py-2 pl-6">
            Connect to a database to browse.
          </div>
        )}

        {activeConn?.isConnected && activeConn.type === 'redis' && activeConn.dockerContainerId && (
          <RedisDatabaseBrowser
            containerId={activeConn.dockerContainerId}
            db={safeRedisDb}
          />
        )}

        {activeConn?.isConnected && activeConn.type === 'redis' && !activeConn.dockerContainerId && (
          <div className="text-text-muted text-[11px] py-2 pl-6">
            Direct Redis connection detected. Docker-backed key browser is unavailable for this connection.
          </div>
        )}

        {activeConn?.isConnected && activeConn.type === 'mongodb' && activeConn.dockerContainerId && (
          <MongoDatabaseBrowser
            containerId={activeConn.dockerContainerId}
            selectedDatabase={selectedDatabase}
            availableDatabases={availableDatabases}
            onSwitchDatabase={handleSwitchDb}
            isSwitching={switching}
          />
        )}

        {activeConn?.isConnected && activeConn.type === 'mongodb' && !activeConn.dockerContainerId && (
          <div className="text-text-muted text-[11px] py-2 pl-6">
            Direct MongoDB connection detected. Docker-backed browser is unavailable for this connection.
          </div>
        )}

        {isSqlConn && switching && (
          <div className="text-text-muted text-[10px] py-1 pl-6">Switching database…</div>
        )}

        {activeConn?.isConnected && isSqlConn && availableDatabases.length > 0 && (
          <>
            {availableDatabases.map((db) => (
              <DatabaseItem
                key={db}
                connId={activeConnectionId!}
                dbName={db}
                isSelected={db === selectedDatabase}
                onSwitch={handleSwitchDb}
              />
            ))}
          </>
        )}

        {activeConn?.isConnected && isSqlConn && availableDatabases.length === 0 && !switching && (
          <div className="text-text-muted text-[10px] py-1 pl-6">
            No databases found.{" "}
            <button
              onClick={() => fetchDatabases()}
              className="text-accent-blue hover:underline"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </details>
  );
}
