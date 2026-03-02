/**
 * TableStructureView — Beekeeper Studio-style table structure viewer
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

// ── Columns Tab ──
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
          Loading columns…
        </div>
      ) : columns.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-text-muted text-xs">
          No columns found
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 bg-bg-surface z-10">
              <tr className="border-b border-border-default">
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
                      'border-b border-border-default/50 hover:bg-bg-surface-hover transition-colors group',
                      i % 2 === 0 ? 'bg-bg-elevated' : 'bg-bg-elevated/50'
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
                          col.nullable ? 'bg-accent-blue/20 border border-accent-blue' : 'border border-border-default bg-bg-input'
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
                          <div className="w-4 h-4 rounded-sm border border-border-default bg-bg-input" />
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

// ── Indexes Tab ──
function IndexesView({ indexes, loading }: { indexes: IndexNode[]; loading: boolean }) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4">
        <h2 className="text-sm font-semibold text-text-primary">Indexes</h2>
      </div>
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-text-muted text-xs">
          <Icon name="hourglass_empty" size={16} className="animate-spin mr-2" />
          Loading indexes…
        </div>
      ) : indexes.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-text-muted text-xs">
          No indexes found
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 bg-bg-surface z-10">
              <tr className="border-b border-border-default">
                <th className="text-left px-6 py-2.5 text-text-secondary font-semibold text-[11px] uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-2.5 text-text-secondary font-semibold text-[11px] uppercase tracking-wider">Columns</th>
                <th className="text-center px-4 py-2.5 text-text-secondary font-semibold text-[11px] uppercase tracking-wider w-20">Unique</th>
                <th className="text-center px-4 py-2.5 text-text-secondary font-semibold text-[11px] uppercase tracking-wider w-20">Primary</th>
                <th className="text-left px-4 py-2.5 text-text-secondary font-semibold text-[11px] uppercase tracking-wider">Type</th>
              </tr>
            </thead>
            <tbody>
              {indexes.map((idx, i) => (
                <tr key={idx.name} className={clsx('border-b border-border-default/50 hover:bg-bg-surface-hover transition-colors', i % 2 === 0 ? 'bg-bg-elevated' : 'bg-bg-elevated/50')}>
                  <td className="px-6 py-2.5">
                    <div className="flex items-center gap-2">
                      <Icon name={idx.isPrimary ? 'key' : 'sort'} size={14} className={idx.isPrimary ? 'text-syntax-function' : 'text-accent-blue'} />
                      <span className="text-text-primary font-medium">{idx.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {idx.columns.map((col) => (
                        <span key={col} className="px-1.5 py-0.5 bg-bg-surface rounded text-[10px] text-syntax-param font-mono">{col}</span>
                      ))}
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Relations Tab ──
function RelationsView({ relations, loading }: { relations: RelationNode[]; loading: boolean }) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4">
        <h2 className="text-sm font-semibold text-text-primary">Relations</h2>
      </div>
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-text-muted text-xs">
          <Icon name="hourglass_empty" size={16} className="animate-spin mr-2" />
          Loading relations…
        </div>
      ) : relations.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-text-muted text-xs">
          No foreign key relations found
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 bg-bg-surface z-10">
              <tr className="border-b border-border-default">
                <th className="text-left px-6 py-2.5 text-text-secondary font-semibold text-[11px] uppercase tracking-wider">Constraint</th>
                <th className="text-left px-4 py-2.5 text-text-secondary font-semibold text-[11px] uppercase tracking-wider">Column</th>
                <th className="text-left px-4 py-2.5 text-text-secondary font-semibold text-[11px] uppercase tracking-wider">References</th>
                <th className="text-left px-4 py-2.5 text-text-secondary font-semibold text-[11px] uppercase tracking-wider">On Update</th>
                <th className="text-left px-4 py-2.5 text-text-secondary font-semibold text-[11px] uppercase tracking-wider">On Delete</th>
              </tr>
            </thead>
            <tbody>
              {relations.map((rel, i) => (
                <tr key={rel.name} className={clsx('border-b border-border-default/50 hover:bg-bg-surface-hover transition-colors', i % 2 === 0 ? 'bg-bg-elevated' : 'bg-bg-elevated/50')}>
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

// ── Triggers Tab ──
function TriggersView({ triggers, loading }: { triggers: TriggerNode[]; loading: boolean }) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4">
        <h2 className="text-sm font-semibold text-text-primary">Triggers</h2>
      </div>
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-text-muted text-xs">
          <Icon name="hourglass_empty" size={16} className="animate-spin mr-2" />
          Loading triggers…
        </div>
      ) : triggers.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-text-muted text-xs">
          No triggers found
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 bg-bg-surface z-10">
              <tr className="border-b border-border-default">
                <th className="text-left px-6 py-2.5 text-text-secondary font-semibold text-[11px] uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-2.5 text-text-secondary font-semibold text-[11px] uppercase tracking-wider">Event</th>
                <th className="text-left px-4 py-2.5 text-text-secondary font-semibold text-[11px] uppercase tracking-wider">Timing</th>
                <th className="text-left px-4 py-2.5 text-text-secondary font-semibold text-[11px] uppercase tracking-wider">Definition</th>
              </tr>
            </thead>
            <tbody>
              {triggers.map((trig, i) => (
                <tr key={trig.name} className={clsx('border-b border-border-default/50 hover:bg-bg-surface-hover transition-colors', i % 2 === 0 ? 'bg-bg-elevated' : 'bg-bg-elevated/50')}>
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

// ── Main Structure View ──
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
      const raw = await window.electronAPI.database.executeQuery(connId,
        `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = '${schema}' AND tablename = '${tableName}' ORDER BY indexname`
      ) as { rows: Record<string, unknown>[]; columns: string[] }
      const idxList: IndexNode[] = raw.rows.map((r) => {
        const def = String(r.indexdef ?? '')
        const isPrimary = def.includes('PRIMARY KEY')
        const isUnique = def.includes('UNIQUE') || isPrimary
        // Extract columns from indexdef: ... (col1, col2)
        const colMatch = def.match(/\(([^)]+)\)/)
        const cols = colMatch ? colMatch[1].split(',').map((c) => c.trim()) : []
        const type = def.includes('USING btree') ? 'btree' : def.includes('USING hash') ? 'hash' : def.includes('USING gin') ? 'gin' : def.includes('USING gist') ? 'gist' : 'btree'
        return { name: String(r.indexname), columns: cols, isUnique, isPrimary, type }
      })
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
      const raw = await window.electronAPI.database.executeQuery(connId,
        `SELECT
          tc.constraint_name,
          kcu.column_name,
          ccu.table_schema AS foreign_table_schema,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name,
          rc.update_rule,
          rc.delete_rule
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
        JOIN information_schema.referential_constraints rc ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = '${schema}' AND tc.table_name = '${tableName}'`
      ) as { rows: Record<string, unknown>[] }
      const rels: RelationNode[] = raw.rows.map((r) => ({
        name: String(r.constraint_name),
        sourceColumn: String(r.column_name),
        targetSchema: String(r.foreign_table_schema),
        targetTable: String(r.foreign_table_name),
        targetColumn: String(r.foreign_column_name),
        onUpdate: String(r.update_rule),
        onDelete: String(r.delete_rule),
      }))
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
      const raw = await window.electronAPI.database.executeQuery(connId,
        `SELECT trigger_name, event_manipulation, action_timing, action_statement
        FROM information_schema.triggers
        WHERE event_object_schema = '${schema}' AND event_object_table = '${tableName}'
        ORDER BY trigger_name`
      ) as { rows: Record<string, unknown>[] }
      const trigs: TriggerNode[] = raw.rows.map((r) => ({
        name: String(r.trigger_name),
        event: String(r.event_manipulation),
        timing: String(r.action_timing),
        definition: String(r.action_statement),
      }))
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
    if (activeTab === 'indexes' && indexes.length === 0 && !loadingIdx) fetchIndexes()
    if (activeTab === 'relations' && relations.length === 0 && !loadingRel) fetchRelations()
    if (activeTab === 'triggers' && triggers.length === 0 && !loadingTrig) fetchTriggers()
  }, [activeTab, indexes.length, relations.length, triggers.length, loadingIdx, loadingRel, loadingTrig, fetchIndexes, fetchRelations, fetchTriggers])

  const tabs: { id: StructureTab; label: string; icon: string }[] = [
    { id: 'columns', label: 'Columns', icon: 'view_column' },
    { id: 'indexes', label: 'Indexes', icon: 'sort' },
    { id: 'relations', label: 'Relations', icon: 'link' },
    { id: 'triggers', label: 'Triggers', icon: 'bolt' },
  ]

  return (
    <div className="flex-1 flex flex-col bg-bg-elevated overflow-hidden">
      {/* Tab bar (Beekeeper-style) */}
      <div className="flex items-center border-b border-border-default bg-bg-surface">
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
      {activeTab === 'indexes' && <IndexesView indexes={indexes} loading={loadingIdx} />}
      {activeTab === 'relations' && <RelationsView relations={relations} loading={loadingRel} />}
      {activeTab === 'triggers' && <TriggersView triggers={triggers} loading={loadingTrig} />}
    </div>
  )
}
