/**
 * SqlEditor — SQL editing with syntax highlighting
 *
 * Uses a transparent textarea overlaying a highlighted pre block.
 * Keywords, strings, numbers, comments are highlighted in distinct colours.
 */
import { useRef, useMemo, useCallback, useEffect } from 'react'
import { useAppStore } from '@/store/useAppStore'

// ── SQL Keyword sets ──
const KEYWORDS = new Set([
  'SELECT','FROM','WHERE','INSERT','INTO','UPDATE','DELETE',
  'CREATE','ALTER','DROP','TABLE','INDEX','VIEW','DATABASE',
  'JOIN','INNER','OUTER','LEFT','RIGHT','FULL','CROSS',
  'ON','AND','OR','NOT','IN','EXISTS','BETWEEN','LIKE',
  'IS','NULL','AS','ORDER','BY','GROUP','HAVING','LIMIT',
  'OFFSET','UNION','ALL','DISTINCT','SET','VALUES','RETURNING',
  'BEGIN','COMMIT','ROLLBACK','TRANSACTION','GRANT','REVOKE',
  'PRIMARY','KEY','FOREIGN','REFERENCES','CONSTRAINT','CHECK',
  'DEFAULT','UNIQUE','CASCADE','RESTRICT','IF','ELSE','THEN',
  'END','CASE','WHEN','WITH','RECURSIVE','ASC','DESC',
  'EXPLAIN','ANALYZE','TRUNCATE','SCHEMA','SERIAL','BIGSERIAL',
])

const TYPES = new Set([
  'INT','INTEGER','BIGINT','SMALLINT','FLOAT','DOUBLE','DECIMAL',
  'NUMERIC','REAL','BOOLEAN','BOOL','TEXT','VARCHAR','CHAR',
  'UUID','JSON','JSONB','BYTEA','DATE','TIME','TIMESTAMP',
  'TIMESTAMPTZ','INTERVAL','ARRAY','SERIAL','BIGSERIAL',
])

const FUNCTIONS = new Set([
  'COUNT','SUM','AVG','MIN','MAX','COALESCE','NULLIF',
  'CAST','LOWER','UPPER','TRIM','LENGTH','CONCAT',
  'NOW','CURRENT_TIMESTAMP','CURRENT_DATE','EXTRACT',
  'ROW_NUMBER','RANK','DENSE_RANK','LAG','LEAD',
  'FIRST_VALUE','LAST_VALUE','STRING_AGG','ARRAY_AGG',
  'SUBSTRING','REPLACE','POSITION','TO_CHAR','TO_DATE',
])

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Tokenize and highlight SQL text */
function highlightSql(text: string): string {
  const result: string[] = []
  let i = 0
  const len = text.length

  while (i < len) {
    // Single-line comment
    if (text[i] === '-' && text[i + 1] === '-') {
      const end = text.indexOf('\n', i)
      const ce = end === -1 ? len : end
      result.push(`<span class="sql-comment">${escHtml(text.slice(i, ce))}</span>`)
      i = ce
      continue
    }
    // Block comment
    if (text[i] === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2)
      const ce = end === -1 ? len : end + 2
      result.push(`<span class="sql-comment">${escHtml(text.slice(i, ce))}</span>`)
      i = ce
      continue
    }
    // String literal
    if (text[i] === "'") {
      let j = i + 1
      while (j < len) {
        if (text[j] === "'" && text[j + 1] === "'") { j += 2; continue }
        if (text[j] === "'") { j++; break }
        j++
      }
      result.push(`<span class="sql-string">${escHtml(text.slice(i, j))}</span>`)
      i = j
      continue
    }
    // Numbers
    if (/\d/.test(text[i]) && (i === 0 || /[\s,()=<>!+\-*/;]/.test(text[i - 1]))) {
      let j = i
      while (j < len && /[\d.]/.test(text[j])) j++
      result.push(`<span class="sql-number">${escHtml(text.slice(i, j))}</span>`)
      i = j
      continue
    }
    // Words
    if (/[a-zA-Z_]/.test(text[i])) {
      let j = i
      while (j < len && /[a-zA-Z0-9_]/.test(text[j])) j++
      const word = text.slice(i, j)
      const upper = word.toUpperCase()
      if (KEYWORDS.has(upper)) {
        result.push(`<span class="sql-keyword">${escHtml(word)}</span>`)
      } else if (TYPES.has(upper)) {
        result.push(`<span class="sql-type">${escHtml(word)}</span>`)
      } else if (FUNCTIONS.has(upper) || (text[j] === '(' && /[a-zA-Z]/.test(word[0]))) {
        result.push(`<span class="sql-function">${escHtml(word)}</span>`)
      } else if (upper === 'TRUE' || upper === 'FALSE') {
        result.push(`<span class="sql-boolean">${escHtml(word)}</span>`)
      } else if (upper === 'NULL') {
        result.push(`<span class="sql-keyword">${escHtml(word)}</span>`)
      } else {
        // Identifiers — use param color for table/column-like names
        result.push(`<span class="sql-param">${escHtml(word)}</span>`)
      }
      i = j
      continue
    }
    // Operators
    if ('=<>!+-*/%'.includes(text[i])) {
      if (text[i] === '*') {
        result.push(`<span class="sql-star">${escHtml(text[i])}</span>`)
      } else {
        result.push(`<span class="sql-operator">${escHtml(text[i])}</span>`)
      }
      i++
      continue
    }
    // Parentheses
    if (text[i] === '(' || text[i] === ')') {
      result.push(`<span class="sql-paren">${escHtml(text[i])}</span>`)
      i++
      continue
    }
    // Semicolons
    if (text[i] === ';') {
      result.push(`<span class="sql-semicolon">${escHtml(text[i])}</span>`)
      i++
      continue
    }
    // Dots (schema.table)
    if (text[i] === '.') {
      result.push(`<span class="sql-dot">${escHtml(text[i])}</span>`)
      i++
      continue
    }
    // Everything else
    result.push(escHtml(text[i]))
    i++
  }
  return result.join('')
}

export function SqlEditor() {
  const activeTabId = useAppStore((s) => s.activeTabId)
  const tabs = useAppStore((s) => s.tabs)
  const updateTabContent = useAppStore((s) => s.updateTabContent)
  const executeQuery = useAppStore((s) => s.executeQuery)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const preRef = useRef<HTMLPreElement>(null)

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId),
    [tabs, activeTabId]
  )

  const content = activeTab?.content ?? ''
  const lineCount = useMemo(() => content.split('\n').length, [content])
  const highlighted = useMemo(() => highlightSql(content), [content])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (activeTabId) updateTabContent(activeTabId, e.target.value)
    },
    [activeTabId, updateTabContent]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.ctrlKey && e.key === 'Enter') || e.key === 'F5') {
        e.preventDefault()
        executeQuery()
      }
      if (e.key === 'Tab') {
        e.preventDefault()
        const ta = textareaRef.current
        if (!ta) return
        const start = ta.selectionStart
        const end = ta.selectionEnd
        const val = ta.value
        const newVal = val.substring(0, start) + '  ' + val.substring(end)
        if (activeTabId) updateTabContent(activeTabId, newVal)
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = start + 2
        })
      }
    },
    [activeTabId, updateTabContent, executeQuery]
  )

  const syncScroll = useCallback(() => {
    const ta = textareaRef.current
    const pre = preRef.current
    if (ta && pre) {
      pre.scrollTop = ta.scrollTop
      pre.scrollLeft = ta.scrollLeft
    }
  }, [])

  useEffect(() => { syncScroll() }, [content, syncScroll])

  return (
    <div className="h-[45%] bg-bg-elevated relative flex font-mono overflow-hidden">
      {/* Gutter (line numbers) */}
      <div className="w-12 bg-bg-elevated border-r border-border-default flex flex-col items-end py-3 pr-3 text-[11px] text-text-muted select-none leading-[20px] shrink-0 overflow-hidden">
        {Array.from({ length: lineCount + 1 }, (_, i) => (
          <div key={i + 1}>{i + 1}</div>
        ))}
      </div>

      {/* Editor area — highlighted pre underneath, transparent textarea on top */}
      <div className="flex-1 relative overflow-hidden">
        {/* Highlighted layer */}
        <pre
          ref={preRef}
          className="absolute inset-0 text-[13px] leading-[20px] py-3 px-4 overflow-hidden pointer-events-none whitespace-pre-wrap break-words font-mono text-text-primary"
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: highlighted + '\n' }}
        />
        {/* Editable transparent textarea */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onScroll={syncScroll}
          spellCheck={false}
          className="absolute inset-0 w-full h-full bg-transparent text-[13px] leading-[20px] text-transparent caret-text-primary outline-none resize-none py-3 px-4 overflow-auto font-mono whitespace-pre-wrap break-words placeholder:text-text-muted"
          placeholder="-- Type your SQL query here and press Ctrl+Enter to execute"
        />
      </div>
    </div>
  )
}

