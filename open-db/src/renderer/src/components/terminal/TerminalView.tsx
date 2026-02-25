/**
 * TerminalView – real xterm.js terminal connected to main process
 *
 * Architecture inspired by VS Code's TerminalInstance:
 *   - xterm.js renders in the browser
 *   - FitAddon handles auto-resize
 *   - Keystrokes → IPC → main process (child_process or docker exec)
 *   - Main stdout → IPC → xterm.write()
 */
import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'

/** VS Code Dark+ inspired theme */
const DARK_THEME = {
  background: '#0d0d0d',
  foreground: '#cccccc',
  cursor: '#a7a7a7',
  cursorAccent: '#0d0d0d',
  selectionBackground: '#264f78',
  selectionForeground: '#ffffff',
  selectionInactiveBackground: '#3a3d41',
  black: '#000000',
  red: '#cd3131',
  green: '#0dbc79',
  yellow: '#e5e510',
  blue: '#2472c8',
  magenta: '#bc3fbc',
  cyan: '#11a8cd',
  white: '#e5e5e5',
  brightBlack: '#666666',
  brightRed: '#f14c4c',
  brightGreen: '#23d18b',
  brightYellow: '#f5f543',
  brightBlue: '#3b8eea',
  brightMagenta: '#d670d6',
  brightCyan: '#29b8db',
  brightWhite: '#e5e5e5'
}

export function TerminalView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const idRef = useRef<string | null>(null)
  const cleanupRef = useRef<(() => void)[]>([])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    // 1. Create xterm.js instance
    const term = new Terminal({
      theme: DARK_THEME,
      fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', monospace",
      fontSize: 13,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 10000,
      convertEol: true,
      allowProposedApi: true
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()

    term.loadAddon(fitAddon)
    term.loadAddon(webLinksAddon)
    term.open(el)

    // Delay fit so the element has dimensions
    requestAnimationFrame(() => fitAddon.fit())

    termRef.current = term
    fitRef.current = fitAddon

    // 2. Create terminal session in main process
    const termId = `term-${Date.now()}`
    idRef.current = termId
    window.electronAPI.terminal.create({ id: termId, type: 'local' })

    // 3. Keystroke → main process
    const dataDisp = term.onData((data) => {
      window.electronAPI.terminal.write(termId, data)
    })

    // 4. Main process stdout → xterm.js
    const cleanupData = window.electronAPI.terminal.onData(
      (id: string, data: string) => {
        if (id === termId) term.write(data)
      }
    )

    const cleanupExit = window.electronAPI.terminal.onExit((id: string) => {
      if (id === termId) {
        term.write('\r\n\x1b[90m[Process exited]\x1b[0m\r\n')
      }
    })

    // 5. Auto-resize
    const observer = new ResizeObserver(() => {
      try {
        fitAddon.fit()
        const { cols, rows } = term
        window.electronAPI.terminal.resize(termId, cols, rows)
      } catch {
        // ignore if element not visible
      }
    })
    observer.observe(el)

    cleanupRef.current = [cleanupData, cleanupExit]

    return () => {
      dataDisp.dispose()
      for (const fn of cleanupRef.current) fn()
      observer.disconnect()
      window.electronAPI.terminal.close(termId)
      term.dispose()
    }
  }, [])

  return <div ref={containerRef} className="h-full w-full" />
}
