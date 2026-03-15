/**
 * TableStructureView â€” Beekeeper Studio-style table structure viewer
 *
 * Shows Columns / Indexes / Relations / Triggers tabs for a table.
 * Opens as a dedicated editor tab.
 */
import { useState, useEffect, useCallback } from 'react'
import { Icon } from '@/components/ui'
import { clsx } from 'clsx'
import type { ColumnNode, StructureTab, IndexNode, RelationNode, TriggerNode } from '@/types'

interface TableStructureViewProps {
  connId: string
  schema: string
  tableName: string
}

function qIdent(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

function mapIndexRows(rows: Record<string, unknown>[]): IndexNode[] {
  return rows.map((r) => {
    const rawCols = r.columns
    const cols = Array.isArray(rawCols)
      ? rawCols.map((v) => String(v))
      : []
    return {
      name: String(r.name ?? ''),
      columns: cols,
      isUnique: Boolean(r.isUnique),
      isPrimary: Boolean(r.isPrimary),
      type: String(r.type ?? 'btree'),
      definition: String(r.definition ?? ''),
    }
  })
}

async function fetchIndexesWithFallback(connId: string, schema: string, tableName: string): Promise<IndexNode[]> {
  try {
    const direct = await window.electronAPI.database.getIndexes(connId, schema, tableName)
    if (direct.length > 0) return direct
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
      AND idx.tablename = ${qIdent(tableName)}
    GROUP BY idx.indexname, pi.indisunique, pi.indisprimary, am.amname, idx.indexdef
    ORDER BY idx.indexname
  `

  const raw = await window.electronAPI.database.executeQuery(connId, sql) as { rows: Record<string, unknown>[] }
  return mapIndexRows(raw.rows)
}

function dataTypeIcon(dt: string): { icon: string; color: string } {
  const t = dt.toLowerCase()
  if (t.includes('int') || t.includes('numeric') || t.includes('float') || t.includes('double') || t.includes('decimal') || t === 'serial' || t === 'bigserial')
    return { icon: 'tag', color: 'text-syntax-number' }
  if (t.includes('bool')) return { icon: 'check_circle', color: 'text-status-green' }
  if (t.includes('time') || t.includes('date')) return { icon: 'schedule', color: 'text-status-green' }
  if (t.includes('json')) return { icon: 'data_object', color: 'text-syntax-decorator' }
  if (t === 'uuid') return { icon: 'fingerprint', color: 'text-syntax-function' }
  if (t.includes('text') || t.includes('char') || t.includes('varchar'))
    return { icon: 'abc', color: 'text-syntax-keyword' }
  if (t.includes('bytea') || t.includes('blob')) return { icon: 'memory', color: 'text-text-secondary' }
  return { icon: 'abc', color: 'text-syntax-keyword' }
}

function getEmptyIndexColumnsLabel(idx: IndexNode): { label: string; title: string } {
  const maybeExpression = (idx as IndexNode & { isExpression?: boolean; expression?: string }).isExpression === true
    || Boolean((idx as IndexNode & { isExpression?: boolean; expression?: string }).expression)
    || String(idx.type ?? '').toLowerCase() === 'expression'

  if (maybeExpression) {
    return {
      label: 'Expression index',
      title: 'This index is marked as expression-based by metadata.'
    }
  }

  return {
    label: 'No columns',
    title: 'No indexed columns were returned. Possible causes: expression-based index, parsing mismatch, or API inconsistency.'
  }
}

// â”€â”€ Columns Tab â”€â”€
function ColumnsView({ columns, loading, onRefresh }: { columns: ColumnNode[]; loading: boolean; onRefresh: () => void }) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <h2 className="text-sm font-semibold text-text-primary">Columns</h2>
        <div className="flex items-center gap-2">
          <button onClick={onRefresh} className="p-1 text-text-secondary hover:text-text-primary hover:bg-bg-surface-hover rounded transition-colors" title="Refresh">
            <Icon name="refresh" size={18} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-text-muted text-xs">
          <Icon name="hourglass_empty" size={16} className="animate-spin mr-2" />
          Loading columnsâ€¦
        </div>
      ) : columns.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-text-muted text-xs">
          No columns found
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 bg-[#1a1c20] z-10">
              <tr className="border-b border-[#25262a]">
                <th className="text-left px-6 py-2.5 text-text-secondary font-semibold text-[11px] uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-2.5 text-text-secondary font-semibold text-[11px] uppercase tracking-wider">Type</th>
                <th className="text-center px-4 py-2.5 text-text-secondary font-semibold text-[11px] uppercase tracking-wider w-20">Nullable</th>
                <th className="text-left px-4 py-2.5 text-text-secondary font-semibold text-[11px] uppercase tracking-wider">Default Value</th>
                <th className="text-left px-4 py-2.5 text-text-secondary font-semibold text-[11px] uppercase tracking-wider">Comment</th>
                <th className="text-center px-4 py-2.5 text-text-secondary font-semibold text-[11px] uppercase tracking-wider w-20">Primary</th>
                <th className="text-center px-4 py-2.5 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {columns.map((col, i) => {
                const { icon, color } = col.isPrimaryKey
                  ? { icon: 'key', color: 'text-syntax-function' }
                  : dataTypeIcon(col.dataType)
                return (
                  <tr
                    key={col.name}
                    className={clsx(
                      'border-b border-[#25262a]/50 hover:bg-white/4 transition-colors group',
                      i % 2 === 0 ? 'bg-[#181a1d]' : 'bg-[#181a1d]/50'
                    )}
                  >
                    <td className="px-6 py-2.5">
                      <div className="flex items-center gap-2">
                        <Icon name={icon} size={14} className={color} />
                        <span className="text-text-primary font-medium">{col.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-syntax-type font-mono text-[11px]">{col.dataType}</span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <div className="flex justify-center">
                        <div className={clsx(
                          'w-4 h-4 rounded-sm flex items-center justify-center',
                          col.nullable ? 'bg-accent-blue/20 border border-accent-blue' : 'border border-[#25262a] bg-bg-input'
                        )}>
                          {col.nullable && <Icon name="check" size={12} className="text-accent-blue" />}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-text-muted font-mono text-[11px]">
                        {col.defaultValue ?? <span className="italic">(NULL)</span>}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-text-muted italic text-[11px]">(NULL)</span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <div className="flex justify-center">
                        {col.isPrimaryKey ? (
                          <div className="w-4 h-4 rounded-sm flex items-center justify-center bg-syntax-function/20 border border-syntax-function">
                            <Icon name="check" size={12} className="text-syntax-function" />
                          </div>
                        ) : (
                          <div className="w-4 h-4 rounded-sm border border-[#25262a] bg-bg-input" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <button className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-status-red transition-all" title="Remove column">
                        <Icon name="close" size={14} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// â”€â”€ Indexes Tab â”€â”€
function IndexesView({ indexes, loading, onRefresh }: { indexes: IndexNode[]; loading: boolean; onRefresh: () => void }) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4">
        <h2 className="text-sm font-semibold text-text-primary">Indexes</h2>
        <button onClick={onRefresh} className="p-1 text-text-secondary hover:text-text-primary hover:bg-bg-surface-hover rounded transition-colors" title="Refresh">
          <Icon name="refresh" size={18} />
        </button>
      </div>
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-text-muted text-xs">
          <Icon name="hourglass_empty" size={16} className="animate-spin mr-2" />
          Loading indexesâ€¦
        </div>
      ) : indexes.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-text-muted text-xs">
          No indexes found
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 bg-[#1a1c20] z-10">
              <tr className="border-b border-[#25262a]">
                <th className="text-left px-6 py-2.5 text-text-secondary font-semibold text-[11px] uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-2.5 text-text-secondary font-semibold text-[11px] uppercase tracking-wider">Columns</th>
                <th className="text-center px-4 py-2.5 text-text-secondary font-semibold text-[11px] uppercase tracking-wider w-20">Unique</th>
                <th className="text-center px-4 py-2.5 text-text-secondary font-semibold text-[11px] uppercase tracking-wider w-20">Primary</th>
                <th className="text-left px-4 py-2.5 text-text-secondary font-semibold text-[11px] uppercase tracking-wider">Type</th>
                <th className="text-left px-4 py-2.5 text-text-secondary font-semibold text-[11px] uppercase tracking-wider">Definition</th>
              </tr>
            </thead>
            <tbody>
              {indexes.map((idx, i) => (
                <tr key={idx.name} className={clsx('border-b border-[#25262a]/50 hover:bg-white/4 transition-colors', i % 2 === 0 ? 'bg-[#181a1d]' : 'bg-[#181a1d]/50')}>
                  <td className="px-6 py-2.5">
                    <div className="flex items-center gap-2">
                      <Icon name={idx.isPrimary ? 'key' : 'sort'} size={14} className={idx.isPrimary ? 'text-syntax-function' : 'text-accent-blue'} />
                      <span className="text-text-primary font-medium">{idx.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {idx.columns.map((col) => (
                        <span key={col} className="px-1.5 py-0.5 bg-[#1a1c20] rounded text-[10px] text-syntax-param font-mono">{col}</span>
                      ))}
                      {idx.columns.length === 0 && (
                        <span className="text-[10px] text-text-muted italic" title={getEmptyIndexColumnsLabel(idx).title}>
                          {getEmptyIndexColumnsLabel(idx).label}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {idx.isUnique && <Icon name="check" size={14} className="text-status-green" />}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {idx.isPrimary && <Icon name="check" size={14} className="text-syntax-function" />}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-text-muted font-mono text-[11px]">{idx.type}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-text-muted font-mono text-[11px] block max-w-[420px] truncate" title={idx.definition}>
                      {idx.definition}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// â”€â”€ Relations Tab â”€â”€
function RelationsView({ relations, loading, onRefresh }: { relations: RelationNode[]; loading: boolean; onRefresh: () => void }) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4">
        <h2 className="text-sm font-semibold text-text-primary">Relations</h2>
        <button onClick={onRefresh} className="p-1 text-text-secondary hover:text-text-primary hover:bg-bg-surface-hover rounded transition-colors" title="Refresh">
          <Icon name="refresh" size={18} />
        </button>
      </div>
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-text-muted text-xs">
          <Icon name="hourglass_empty" size={16} className="animate-spin mr-2" />
          Loading relationsâ€¦
        </div>
      ) : relations.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-text-muted text-xs">
          No foreign key relations found
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 bg-[#1a1c20] z-10">
              <tr className="border-b border-[#25262a]">
                <th className="text-left px-6 py-2.5 text-text-secondary font-semibold text-[11px] uppercase tracking-wider">Constraint</th>
                <th className="text-left px-4 py-2.5 text-text-secondary font-semibold text-[11px] uppercase tracking-wider">Column</th>
                <th className="text-left px-4 py-2.5 text-text-secondary font-semibold text-[11px] uppercase tracking-wider">References</th>
                <th className="text-left px-4 py-2.5 text-text-secondary font-semibold text-[11px] uppercase tracking-wider">On Update</th>
                <th className="text-left px-4 py-2.5 text-text-secondary font-semibold text-[11px] uppercase tracking-wider">On Delete</th>
              </tr>
            </thead>
            <tbody>
              {relations.map((rel, i) => (
                <tr key={rel.name} className={clsx('border-b border-[#25262a]/50 hover:bg-white/4 transition-colors', i % 2 === 0 ? 'bg-[#181a1d]' : 'bg-[#181a1d]/50')}>
                  <td className="px-6 py-2.5">
                    <div className="flex items-center gap-2">
                      <Icon name="link" size={14} className="text-syntax-decorator" />
                      <span className="text-text-primary font-medium">{rel.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-syntax-param font-mono text-[11px]">{rel.sourceColumn}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-syntax-function font-mono text-[11px]">{rel.targetSchema}.{rel.targetTable}</span>
                    <span className="text-text-muted">.</span>
                    <span className="text-syntax-param font-mono text-[11px]">{rel.targetColumn}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-text-muted text-[11px]">{rel.onUpdate}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-text-muted text-[11px]">{rel.onDelete}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// â”€â”€ Triggers Tab â”€â”€
function TriggersView({ triggers, loading, onRefresh }: { triggers: TriggerNode[]; loading: boolean; onRefresh: () => void }) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4">
        <h2 className="text-sm font-semibold text-text-primary">Triggers</h2>
        <button onClick={onRefresh} className="p-1 text-text-secondary hover:text-text-primary hover:bg-bg-surface-hover rounded transition-colors" title="Refresh">
          <Icon name="refresh" size={18} />
        </button>
      </div>
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-text-muted text-xs">
          <Icon name="hourglass_empty" size={16} className="animate-spin mr-2" />
          Loading triggersâ€¦
        </div>
      ) : triggers.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-text-muted text-xs">
          No triggers found
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 bg-[#1a1c20] z-10">
              <tr className="border-b border-[#25262a]">
                <th className="text-left px-6 py-2.5 text-text-secondary font-semibold text-[11px] uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-2.5 text-text-secondary font-semibold text-[11px] uppercase tracking-wider">Event</th>
                <th className="text-left px-4 py-2.5 text-text-secondary font-semibold text-[11px] uppercase tracking-wider">Timing</th>
                <th className="text-left px-4 py-2.5 text-text-secondary font-semibold text-[11px] uppercase tracking-wider">Definition</th>
              </tr>
            </thead>
            <tbody>
              {triggers.map((trig, i) => (
                <tr key={trig.name} className={clsx('border-b border-[#25262a]/50 hover:bg-white/4 transition-colors', i % 2 === 0 ? 'bg-[#181a1d]' : 'bg-[#181a1d]/50')}>
                  <td className="px-6 py-2.5">
                    <div className="flex items-center gap-2">
                      <Icon name="bolt" size={14} className="text-status-amber" />
                      <span className="text-text-primary font-medium">{trig.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-syntax-keyword font-mono text-[11px]">{trig.event}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-text-muted text-[11px]">{trig.timing}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-text-muted font-mono text-[11px] truncate block max-w-[300px]">{trig.definition}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// â”€â”€ Main Structure View â”€â”€
export function TableStructureView({ connId, schema, tableName }: TableStructureViewProps) {
  const [activeTab, setActiveTab] = useState<StructureTab>('columns')
  const [columns, setColumns] = useState<ColumnNode[]>([])
  const [indexes, setIndexes] = useState<IndexNode[]>([])
  const [relations, setRelations] = useState<RelationNode[]>([])
  const [triggers, setTriggers] = useState<TriggerNode[]>([])
  const [loadingCols, setLoadingCols] = useState(true)
  const [loadingIdx, setLoadingIdx] = useState(false)
  const [loadingRel, setLoadingRel] = useState(false)
  const [loadingTrig, setLoadingTrig] = useState(false)

  const fetchColumns = useCallback(async () => {
    setLoadingCols(true)
    try {
      const cols = await window.electronAPI.database.getColumns(connId, schema, tableName)
      setColumns(cols)
    } catch (err) {
      console.error('Failed to fetch columns', err)
    } finally {
      setLoadingCols(false)
    }
  }, [connId, schema, tableName])

  const fetchIndexes = useCallback(async () => {
    setLoadingIdx(true)
    try {
      const idxList = await fetchIndexesWithFallback(connId, schema, tableName)
      setIndexes(idxList)
    } catch (err) {
      console.error('Failed to fetch indexes', err)
    } finally {
      setLoadingIdx(false)
    }
  }, [connId, schema, tableName])

  const fetchRelations = useCallback(async () => {
    setLoadingRel(true)
    try {
      const rels = await window.electronAPI.database.getRelations(connId, schema, tableName)
      setRelations(rels)
    } catch (err) {
      console.error('Failed to fetch relations', err)
    } finally {
      setLoadingRel(false)
    }
  }, [connId, schema, tableName])

  const fetchTriggers = useCallback(async () => {
    setLoadingTrig(true)
    try {
      const trigs = await window.electronAPI.database.getTriggers(connId, schema, tableName)
      setTriggers(trigs)
    } catch (err) {
      console.error('Failed to fetch triggers', err)
    } finally {
      setLoadingTrig(false)
    }
  }, [connId, schema, tableName])

  // Load on mount
  useEffect(() => {
    fetchColumns()
  }, [fetchColumns])

  // Load tab data lazily
  useEffect(() => {
    if (activeTab === 'indexes') fetchIndexes()
    if (activeTab === 'relations') fetchRelations()
    if (activeTab === 'triggers') fetchTriggers()
  }, [activeTab, fetchIndexes, fetchRelations, fetchTriggers])

  const tabs: { id: StructureTab; label: string; icon: string }[] = [
    { id: 'columns', label: 'Columns', icon: 'view_column' },
    { id: 'indexes', label: 'Indexes', icon: 'sort' },
    { id: 'relations', label: 'Relations', icon: 'link' },
    { id: 'triggers', label: 'Triggers', icon: 'bolt' },
  ]

  return (
    <div className="flex-1 flex flex-col bg-[#181a1d] overflow-hidden">
      {/* Tab bar (Beekeeper-style) */}
      <div className="flex items-center border-b border-[#25262a] bg-[#1a1c20]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'flex items-center gap-1.5 px-5 py-2.5 text-[12px] font-medium transition-colors relative',
              activeTab === tab.id
                ? 'text-text-bright'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-surface-hover'
            )}
          >
            <Icon name={tab.icon} size={15} className={activeTab === tab.id ? 'text-syntax-function' : 'text-text-muted'} />
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-syntax-function" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'columns' && <ColumnsView columns={columns} loading={loadingCols} onRefresh={fetchColumns} />}
      {activeTab === 'indexes' && <IndexesView indexes={indexes} loading={loadingIdx} onRefresh={fetchIndexes} />}
      {activeTab === 'relations' && <RelationsView relations={relations} loading={loadingRel} onRefresh={fetchRelations} />}
      {activeTab === 'triggers' && <TriggersView triggers={triggers} loading={loadingTrig} onRefresh={fetchTriggers} />}
    </div>
  )
}
