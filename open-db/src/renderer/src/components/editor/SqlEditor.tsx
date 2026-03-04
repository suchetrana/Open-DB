/**
 * SqlEditor — SQL editing with enhanced Beekeeper-style syntax highlighting
 *
 * Uses a transparent textarea overlaying a highlighted pre block.
 * Keywords, strings, numbers, comments, operators, and identifiers are
 * highlighted with distinct, carefully-chosen colours.
 */
import { useRef, useMemo, useCallback, useEffect, useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { clsx } from 'clsx'

// ── SQL Keyword sets ──
const KEYWORDS = new Set([
  'SELECT','FROM','WHERE','INSERT','INTO','UPDATE','DELETE',
  'CREATE','ALTER','DROP','TABLE','INDEX','VIEW','DATABASE',
  'JOIN','INNER','OUTER','LEFT','RIGHT','FULL','CROSS','NATURAL',
  'ON','AND','OR','NOT','IN','EXISTS','BETWEEN','LIKE','ILIKE',
  'IS','NULL','AS','ORDER','BY','GROUP','HAVING','LIMIT',
  'OFFSET','UNION','ALL','DISTINCT','SET','VALUES','RETURNING',
  'BEGIN','COMMIT','ROLLBACK','TRANSACTION','GRANT','REVOKE',
  'PRIMARY','KEY','FOREIGN','REFERENCES','CONSTRAINT','CHECK',
  'DEFAULT','UNIQUE','CASCADE','RESTRICT','IF','ELSE','THEN',
  'END','CASE','WHEN','WITH','RECURSIVE','ASC','DESC',
  'EXPLAIN','ANALYZE','TRUNCATE','SCHEMA','SERIAL','BIGSERIAL',
  'COPY','TEMP','TEMPORARY','LATERAL','OVER','PARTITION',
  'WINDOW','RANGE','ROWS','GROUPS','EXCLUDE','CURRENT','ROW',
  'PRECEDING','FOLLOWING','UNBOUNDED','FETCH','NEXT','FIRST','LAST',
  'ONLY','CONFLICT','DO','NOTHING','MATERIALIZED','CONCURRENTLY',
  'VACUUM','REINDEX','CLUSTER','TABLESPACE','OWNER','COMMENT',
  'EXECUTE','PREPARE','DEALLOCATE','NOTIFY','LISTEN','UNLISTEN',
  'RAISE','EXCEPTION','PERFORM','RETURN','RETURNS','LANGUAGE',
  'PLPGSQL','DECLARE','LOOP','WHILE','FOR','FOREACH','EXIT',
  'CONTINUE','USING','SECURITY','DEFINER','INVOKER','VOLATILE',
  'STABLE','IMMUTABLE','STRICT','PARALLEL','SAFE','UNSAFE',
])

const TYPES = new Set([
  'INT','INT2','INT4','INT8','INTEGER','BIGINT','SMALLINT',
  'FLOAT','FLOAT4','FLOAT8','DOUBLE','DECIMAL','PRECISION',
  'NUMERIC','REAL','BOOLEAN','BOOL','TEXT','VARCHAR','CHAR',
  'UUID','JSON','JSONB','BYTEA','DATE','TIME','TIMESTAMP',
  'TIMESTAMPTZ','TIMETZ','INTERVAL','ARRAY','SERIAL','BIGSERIAL',
  'SMALLSERIAL','MONEY','CIDR','INET','MACADDR','BIT','VARBIT',
  'TSVECTOR','TSQUERY','XML','POINT','LINE','LSEG','BOX',
  'PATH','POLYGON','CIRCLE','OID','REGCLASS','REGTYPE','VOID',
  'RECORD','TRIGGER','EVENT_TRIGGER','HSTORE',
])

const FUNCTIONS = new Set([
  'COUNT','SUM','AVG','MIN','MAX','COALESCE','NULLIF',
  'CAST','LOWER','UPPER','TRIM','LENGTH','CONCAT',
  'NOW','CURRENT_TIMESTAMP','CURRENT_DATE','EXTRACT',
  'ROW_NUMBER','RANK','DENSE_RANK','LAG','LEAD',
  'FIRST_VALUE','LAST_VALUE','STRING_AGG','ARRAY_AGG',
  'SUBSTRING','REPLACE','POSITION','TO_CHAR','TO_DATE',
  'TO_TIMESTAMP','TO_NUMBER','DATE_TRUNC','DATE_PART',
  'AGE','GENERATE_SERIES','UNNEST','ARRAY_LENGTH',
  'JSON_BUILD_OBJECT','JSON_AGG','JSONB_BUILD_OBJECT',
  'JSONB_AGG','ROW_TO_JSON','JSON_EACH','JSONB_EACH',
  'EXISTS','ABS','CEIL','CEILING','FLOOR','ROUND',
  'TRUNC','POWER','SQRT','MOD','RANDOM','SETSEED',
  'GREATEST','LEAST','LEFT','RIGHT','LPAD','RPAD',
  'REPEAT','REVERSE','SPLIT_PART','REGEXP_MATCH',
  'REGEXP_REPLACE','REGEXP_MATCHES','MD5','SHA256',
  'ENCODE','DECODE','PG_SIZE_PRETTY','PG_RELATION_SIZE',
])

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Tokenize and highlight SQL text with Beekeeper-style colors */
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
    // Double-quoted identifier
    if (text[i] === '"') {
      let j = i + 1
      while (j < len && text[j] !== '"') j++
      if (j < len) j++ // consume closing "
      result.push(`<span class="sql-quoted-id">${escHtml(text.slice(i, j))}</span>`)
      i = j
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
    // Dollar-quoted string (PostgreSQL)
    if (text[i] === '$') {
      const tagMatch = text.slice(i).match(/^\$([a-zA-Z_]*)\$/)
      if (tagMatch) {
        const closeTag = `$${tagMatch[1]}$`
        const end = text.indexOf(closeTag, i + closeTag.length)
        const ce = end === -1 ? len : end + closeTag.length
        result.push(`<span class="sql-string">${escHtml(text.slice(i, ce))}</span>`)
        i = ce
        continue
      }
    }
    // Parameter placeholders ($1, $2, etc.)
    if (text[i] === '$' && i + 1 < len && /\d/.test(text[i + 1])) {
      let j = i + 1
      while (j < len && /\d/.test(text[j])) j++
      result.push(`<span class="sql-placeholder">${escHtml(text.slice(i, j))}</span>`)
      i = j
      continue
    }
    // Bind parameter (:name)
    if (text[i] === ':' && i + 1 < len && /[a-zA-Z_]/.test(text[i + 1])) {
      let j = i + 1
      while (j < len && /[a-zA-Z0-9_]/.test(text[j])) j++
      result.push(`<span class="sql-placeholder">${escHtml(text.slice(i, j))}</span>`)
      i = j
      continue
    }
    // Numbers
    if (/\d/.test(text[i]) && (i === 0 || /[\s,()=<>!+\-*/;]/.test(text[i - 1]))) {
      let j = i
      while (j < len && /[\d.eE]/.test(text[j])) j++
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
        result.push(`<span class="sql-null">${escHtml(word)}</span>`)
      } else {
        // Identifiers — table/column names
        result.push(`<span class="sql-identifier">${escHtml(word)}</span>`)
      }
      i = j
      continue
    }
    // Comparison & assignment operators
    if (text[i] === '!' && text[i + 1] === '=') {
      result.push(`<span class="sql-operator">!=</span>`)
      i += 2
      continue
    }
    if (text[i] === '<' && text[i + 1] === '=') {
      result.push(`<span class="sql-operator">&lt;=</span>`)
      i += 2
      continue
    }
    if (text[i] === '>' && text[i + 1] === '=') {
      result.push(`<span class="sql-operator">&gt;=</span>`)
      i += 2
      continue
    }
    if (text[i] === '<' && text[i + 1] === '>') {
      result.push(`<span class="sql-operator">&lt;&gt;</span>`)
      i += 2
      continue
    }
    if (text[i] === '|' && text[i + 1] === '|') {
      result.push(`<span class="sql-operator">||</span>`)
      i += 2
      continue
    }
    if (text[i] === ':' && text[i + 1] === ':') {
      result.push(`<span class="sql-cast">::</span>`)
      i += 2
      continue
    }
    // Single operators
    if ('=<>+-*/%'.includes(text[i])) {
      if (text[i] === '*') {
        result.push(`<span class="sql-star">${escHtml(text[i])}</span>`)
      } else {
        result.push(`<span class="sql-operator">${escHtml(text[i])}</span>`)
      }
      i++
      continue
    }
    // Parentheses (with bracket-pair coloring)
    if (text[i] === '(' || text[i] === ')') {
      result.push(`<span class="sql-paren">${escHtml(text[i])}</span>`)
      i++
      continue
    }
    // Comma
    if (text[i] === ',') {
      result.push(`<span class="sql-comma">${escHtml(text[i])}</span>`)
      i++
      continue
    }
    // Semicolons
    if (text[i] === ';') {
      result.push(`<span class="sql-semicolon">${escHtml(text[i])}</span>`)
      i++
      continue
    }
    // Dots (schema.table.column)
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

// ── Autocomplete: merge all completable words into one list with categories ──
const ALL_COMPLETIONS: { word: string; kind: 'keyword' | 'type' | 'function' }[] = [
  ...[...KEYWORDS].map((w) => ({ word: w, kind: 'keyword' as const })),
  ...[...TYPES].map((w) => ({ word: w, kind: 'type' as const })),
  ...[...FUNCTIONS].map((w) => ({ word: w, kind: 'function' as const })),
]

/** Get the word being typed at the cursor position */
function getWordAtCursor(text: string, pos: number): { word: string; start: number } {
  let start = pos
  while (start > 0 && /[a-zA-Z0-9_]/.test(text[start - 1])) start--
  return { word: text.slice(start, pos), start }
}

/** Filter completions based on partial input */
function getCompletions(partial: string, limit = 12): { word: string; kind: string }[] {
  if (partial.length < 1) return []
  const upper = partial.toUpperCase()
  const exact: { word: string; kind: string }[] = []
  const startsWith: { word: string; kind: string }[] = []
  const contains: { word: string; kind: string }[] = []

  for (const item of ALL_COMPLETIONS) {
    if (item.word === upper) continue // skip exact match
    if (item.word.startsWith(upper)) {
      startsWith.push(item)
    } else if (item.word.includes(upper)) {
      contains.push(item)
    }
  }
  return [...startsWith, ...contains].slice(0, limit)
}

/** Icon + color for autocomplete item kinds (VS Code IntelliSense style) */
function completionIcon(kind: string): { icon: string; color: string; bg: string; label: string } {
  switch (kind) {
    case 'keyword': return { icon: 'code', color: '#569cd6', bg: 'rgba(86,156,214,0.15)', label: 'Keyword' }
    case 'type': return { icon: 'data_object', color: '#4ec9b0', bg: 'rgba(78,201,176,0.15)', label: 'Type' }
    case 'function': return { icon: 'functions', color: '#dcdcaa', bg: 'rgba(220,220,170,0.15)', label: 'Function' }
    default: return { icon: 'text_fields', color: '#9cdcfe', bg: 'rgba(156,220,254,0.15)', label: 'Text' }
  }
}

export function SqlEditor() {
  const activeTabId = useAppStore((s) => s.activeTabId)
  const tabs = useAppStore((s) => s.tabs)
  const updateTabContent = useAppStore((s) => s.updateTabContent)
  const setSelectedText = useAppStore((s) => s.setSelectedText)
  const executeQuery = useAppStore((s) => s.executeQuery)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const preRef = useRef<HTMLPreElement>(null)
  const gutterRef = useRef<HTMLDivElement>(null)
  const acRef = useRef<HTMLDivElement>(null)
  const [activeLine, setActiveLine] = useState(1)

  // Autocomplete state
  const [acItems, setAcItems] = useState<{ word: string; kind: string }[]>([])
  const [acIndex, setAcIndex] = useState(0)
  const [acPos, setAcPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const [acVisible, setAcVisible] = useState(false)
  const acWordRef = useRef<{ word: string; start: number }>({ word: '', start: 0 })

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId),
    [tabs, activeTabId]
  )

  const content = activeTab?.content ?? ''
  const lineCount = useMemo(() => content.split('\n').length, [content])
  const highlighted = useMemo(() => highlightSql(content), [content])

  // Track cursor line
  const updateActiveLine = useCallback(() => {
    const ta = textareaRef.current
    if (!ta) return
    const before = ta.value.substring(0, ta.selectionStart)
    const line = before.split('\n').length
    setActiveLine(line)
  }, [])

  // Calculate cursor pixel position for autocomplete popup
  const getCursorPixelPos = useCallback(() => {
    const ta = textareaRef.current
    if (!ta) return { top: 0, left: 0 }
    const text = ta.value.substring(0, ta.selectionStart)
    const lines = text.split('\n')
    const lineNum = lines.length
    const colNum = lines[lines.length - 1].length
    // Each line is 20px, padding top 12px, char width ~7.8px for 13px mono
    const top = 12 + lineNum * 20 - ta.scrollTop
    const left = 16 + colNum * 7.8 - ta.scrollLeft
    return { top, left }
  }, [])

  // Update autocomplete suggestions
  const updateAutocomplete = useCallback(() => {
    const ta = textareaRef.current
    if (!ta) return
    const pos = ta.selectionStart
    const { word, start } = getWordAtCursor(ta.value, pos)
    acWordRef.current = { word, start }

    if (word.length >= 1) {
      const items = getCompletions(word)
      if (items.length > 0) {
        setAcItems(items)
        setAcIndex(0)
        setAcPos(getCursorPixelPos())
        setAcVisible(true)
        return
      }
    }
    setAcVisible(false)
    setAcItems([])
  }, [getCursorPixelPos])

  // Accept the selected autocomplete item
  const acceptCompletion = useCallback((item: { word: string }) => {
    const ta = textareaRef.current
    if (!ta || !activeTabId) return
    const { start } = acWordRef.current
    const pos = ta.selectionStart
    const val = ta.value
    // Determine case: if user typed lowercase, insert lowercase; otherwise uppercase
    const typed = val.slice(start, pos)
    const isLower = typed.length > 0 && typed === typed.toLowerCase()
    const insertWord = isLower ? item.word.toLowerCase() : item.word
    const newVal = val.substring(0, start) + insertWord + val.substring(pos)
    updateTabContent(activeTabId, newVal)
    setAcVisible(false)
    setAcItems([])
    // Move cursor to end of inserted word
    requestAnimationFrame(() => {
      const newPos = start + insertWord.length
      ta.selectionStart = ta.selectionEnd = newPos
      ta.focus()
    })
  }, [activeTabId, updateTabContent])

  // Track selection changes and update store
  const handleSelectionChange = useCallback(() => {
    const ta = textareaRef.current
    if (ta && ta.selectionStart !== ta.selectionEnd) {
      setSelectedText(ta.value.substring(ta.selectionStart, ta.selectionEnd))
    } else {
      setSelectedText(null)
    }
    updateActiveLine()
  }, [setSelectedText, updateActiveLine])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (activeTabId) updateTabContent(activeTabId, e.target.value)
      handleSelectionChange()
      // Trigger autocomplete after state update
      requestAnimationFrame(() => updateAutocomplete())
    },
    [activeTabId, updateTabContent, handleSelectionChange, updateAutocomplete]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // ── Autocomplete navigation ──
      if (acVisible && acItems.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setAcIndex((prev) => (prev + 1) % acItems.length)
          return
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          setAcIndex((prev) => (prev - 1 + acItems.length) % acItems.length)
          return
        }
        if (e.key === 'Tab' || e.key === 'Enter') {
          // Only accept on Tab/Enter if autocomplete is showing
          if (acItems[acIndex]) {
            e.preventDefault()
            acceptCompletion(acItems[acIndex])
            return
          }
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          setAcVisible(false)
          return
        }
      }

      // ── Execute query ──
      if ((e.ctrlKey && e.key === 'Enter') || e.key === 'F5') {
        e.preventDefault()
        setAcVisible(false)
        const ta = textareaRef.current
        let selectedText: string | undefined
        if (ta && ta.selectionStart !== ta.selectionEnd) {
          selectedText = ta.value.substring(ta.selectionStart, ta.selectionEnd)
        }
        executeQuery(selectedText)
        return
      }

      // ── Tab indent (when autocomplete NOT visible) ──
      if (e.key === 'Tab' && !acVisible) {
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

      // Auto-close brackets
      if (e.key === '(') {
        const ta = textareaRef.current
        if (!ta) return
        const start = ta.selectionStart
        const end = ta.selectionEnd
        if (start === end) {
          e.preventDefault()
          const val = ta.value
          const newVal = val.substring(0, start) + '()' + val.substring(end)
          if (activeTabId) updateTabContent(activeTabId, newVal)
          requestAnimationFrame(() => {
            ta.selectionStart = ta.selectionEnd = start + 1
          })
        }
      }
      if (e.key === "'") {
        const ta = textareaRef.current
        if (!ta) return
        const start = ta.selectionStart
        const end = ta.selectionEnd
        if (start === end && (start === 0 || /[\s,()=<>!+\-*/;]/.test(ta.value[start - 1]))) {
          e.preventDefault()
          const val = ta.value
          const newVal = val.substring(0, start) + "''" + val.substring(end)
          if (activeTabId) updateTabContent(activeTabId, newVal)
          requestAnimationFrame(() => {
            ta.selectionStart = ta.selectionEnd = start + 1
          })
        }
      }
    },
    [activeTabId, updateTabContent, executeQuery, acVisible, acItems, acIndex, acceptCompletion]
  )

  // Close autocomplete on blur
  const handleBlur = useCallback(() => {
    // Delay so clicking on autocomplete item works
    setTimeout(() => setAcVisible(false), 200)
  }, [])

  // Scroll autocomplete selected item into view
  useEffect(() => {
    if (acVisible && acRef.current) {
      const item = acRef.current.children[acIndex] as HTMLElement
      if (item) item.scrollIntoView({ block: 'nearest' })
    }
  }, [acIndex, acVisible])

  const syncScroll = useCallback(() => {
    const ta = textareaRef.current
    const pre = preRef.current
    const gutter = gutterRef.current
    if (ta && pre) {
      pre.scrollTop = ta.scrollTop
      pre.scrollLeft = ta.scrollLeft
    }
    if (ta && gutter) {
      gutter.scrollTop = ta.scrollTop
    }
    // Hide autocomplete on scroll
    setAcVisible(false)
  }, [])

  useEffect(() => { syncScroll() }, [content, syncScroll])

  return (
    <div className="flex-1 bg-[#181a1d] relative flex font-mono overflow-hidden">
      {/* Gutter (line numbers) with active line highlight */}
      <div
        ref={gutterRef}
        className="w-14 bg-[#181a1d] border-r border-[#25262a] flex flex-col items-end py-3 pr-3 text-[11px] select-none leading-[20px] shrink-0 overflow-hidden"
      >
        {Array.from({ length: lineCount + 1 }, (_, i) => (
          <div
            key={i + 1}
            className={clsx(
              'w-full text-right pr-1 transition-colors',
              i + 1 === activeLine ? 'text-text-primary bg-bg-surface-active/50' : 'text-text-muted'
            )}
          >
            {i + 1}
          </div>
        ))}
      </div>

      {/* Editor area — highlighted pre underneath, transparent textarea on top */}
      <div className="flex-1 relative overflow-hidden">
        {/* Active line background highlight */}
        <div
          className="absolute left-0 right-0 h-5 bg-bg-surface-active/30 pointer-events-none transition-[top] duration-75"
          style={{ top: `${12 + (activeLine - 1) * 20}px` }}
        />

        {/* Highlighted layer */}
        <pre
          ref={preRef}
          className="absolute inset-0 text-[13px] leading-[20px] py-3 px-4 overflow-hidden pointer-events-none whitespace-pre-wrap break-words font-mono text-text-primary"
          style={{ zIndex: 1 }}
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: highlighted + '\n' }}
        />
        {/* Editable transparent textarea */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onKeyUp={handleSelectionChange}
          onClick={handleSelectionChange}
          onSelect={handleSelectionChange}
          onScroll={syncScroll}
          onBlur={handleBlur}
          spellCheck={false}
          className="absolute inset-0 w-full h-full bg-transparent text-[13px] leading-[20px] text-transparent caret-text-primary outline-none resize-none py-3 px-4 overflow-auto font-mono whitespace-pre-wrap break-words placeholder:text-text-muted"
          style={{ zIndex: 2, caretColor: '#aeafad' }}
          placeholder="-- Type your SQL query here and press Ctrl+Enter to execute"
        />

        {/* ── Autocomplete dropdown (VS Code IntelliSense style) ── */}
        {acVisible && acItems.length > 0 && (
          <div
            className="absolute z-50 animate-ac-in"
            style={{ top: acPos.top, left: acPos.left }}
          >
            {/* Main suggestion list */}
            <div
              ref={acRef}
              className="min-w-[300px] max-w-[420px] max-h-[224px] overflow-y-auto overflow-x-hidden glass-widget"
            >
              {acItems.map((item, i) => {
                const { icon, color, bg, label } = completionIcon(item.kind)
                const typed = acWordRef.current.word
                const upper = typed.toUpperCase()
                const wordDisplay = typed === typed.toLowerCase() ? item.word.toLowerCase() : item.word
                const matchIdx = wordDisplay.toUpperCase().indexOf(upper)
                return (
                  <div
                    key={item.word}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      acceptCompletion(item)
                    }}
                    onMouseEnter={() => setAcIndex(i)}
                    className={clsx(
                      'flex items-center gap-2 px-2 py-[3px] cursor-pointer text-[13px] leading-[22px] border-l-2 transition-colors duration-75',
                      i === acIndex
                        ? 'bg-[#1a2a3e] border-l-accent-blue'
                        : 'border-l-transparent hover:bg-white/6'
                    )}
                  >
                    {/* Kind icon badge */}
                    <span
                      className="flex items-center justify-center w-[18px] h-[18px] rounded-[3px] shrink-0"
                      style={{ backgroundColor: bg }}
                    >
                      <span
                        className="material-symbols-outlined select-none"
                        style={{ fontSize: 13, color, fontVariationSettings: "'FILL' 0, 'wght' 500" }}
                      >
                        {icon}
                      </span>
                    </span>
                    {/* Word with match highlight */}
                    <span className="flex-1 font-mono text-[13px] text-[#d4d4d4] truncate">
                      {matchIdx >= 0 ? (
                        <>
                          <span className="text-[#d4d4d4]">{wordDisplay.slice(0, matchIdx)}</span>
                          <span className="text-[#18a3ff] font-medium">{wordDisplay.slice(matchIdx, matchIdx + typed.length)}</span>
                          <span className="text-[#d4d4d4]">{wordDisplay.slice(matchIdx + typed.length)}</span>
                        </>
                      ) : (
                        wordDisplay
                      )}
                    </span>
                    {/* Kind label badge */}
                    <span
                      className="text-[10px] px-1.5 py-[1px] rounded font-medium shrink-0 uppercase tracking-wide"
                      style={{ color, backgroundColor: bg }}
                    >
                      {label}
                    </span>
                  </div>
                )
              })}
            </div>
            {/* Footer with keyboard shortcuts */}
            <div className="flex items-center gap-3 px-2.5 py-[3px] bg-[#181a1d] border border-t-0 border-[#25262a] rounded-b text-[10px] text-[#6e7681]">
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-[0.5px] rounded bg-[#2d2d2d] border border-[#3e3e3e] text-[9px] font-mono text-[#858585]">↑↓</kbd>
                navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-[0.5px] rounded bg-[#2d2d2d] border border-[#3e3e3e] text-[9px] font-mono text-[#858585]">Tab</kbd>
                accept
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-[0.5px] rounded bg-[#2d2d2d] border border-[#3e3e3e] text-[9px] font-mono text-[#858585]">Esc</kbd>
                dismiss
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

