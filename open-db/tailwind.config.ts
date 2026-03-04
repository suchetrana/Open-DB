import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        /* ── Islands Dark palette ── */
        primary: '#548af7',
        'bg-canvas': '#121216',         // deepest layer between panels
        'bg-base': '#121216',           // alias for canvas
        'bg-elevated': '#181a1d',       // panels, editor, sidebar
        'bg-surface': '#1e2024',        // section headers, elevated surfaces
        'bg-surface-hover': '#25262a',  // hover state
        'bg-surface-active': '#2b2d30', // active/selected state
        'bg-input': '#181a1d',          // input backgrounds
        'bg-tab-inactive': '#161619',   // inactive editor tabs
        'border-default': '#3c3f41',    // standard borders
        'border-subtle': '#25262a',     // subtle dividers
        'border-input': '#3c3f41',      // input borders
        'text-primary': '#bcbec4',      // main text
        'text-secondary': '#7a7e85',    // descriptions, secondary
        'text-muted': '#6f737a',        // muted, inactive
        'text-bright': '#ffffff',       // emphasis
        'text-disabled': '#4e5157',     // disabled / line numbers
        'accent-blue': '#548af7',       // links, badges, active borders
        'accent-button': '#548af7',     // primary buttons
        'accent-button-hover': '#6d9df8',
        'syntax-keyword': '#cf8e6d',    // warm orange keywords
        'syntax-function': '#56a8f5',   // blue functions
        'syntax-string': '#6aab73',     // green strings
        'syntax-number': '#2aacb8',     // cyan numbers
        'syntax-comment': '#7a7e85',    // gray comments
        'syntax-type': '#c77dbb',       // magenta types/classes
        'syntax-operator': '#bcbec4',   // operators same as text
        'syntax-param': '#bcbec4',      // params same as text
        'syntax-decorator': '#bbb529',  // yellow decorators
        'syntax-property': '#c77dbb',   // properties
        'status-green': '#73b00a',      // success / running
        'status-amber': '#e8a33e',      // warning
        'status-red': '#f75464',        // error / stopped
        'selection-bg': '#373b39',      // selection highlight
        'glass-border-t': 'rgba(255,255,255,0.10)',
        'glass-border-l': 'rgba(255,255,255,0.06)',
        'glass-border-b': 'rgba(255,255,255,0.02)',
        'glass-border-r': 'rgba(255,255,255,0.02)',
      },
      fontFamily: {
        display: ['Inter', 'sans-serif'],
        mono: ['IBM Plex Mono', 'JetBrains Mono', 'monospace'],
        terminal: ['FiraCode Nerd Font Mono', 'JetBrains Mono', 'monospace'],
      },
      fontSize: {
        '2xs': '0.65rem',
        xs: '0.75rem',
        sm: '0.8rem',
      },
      borderRadius: {
        'panel': '18px',   // large floating panels (sidebar, editor, terminal)
        'widget': '14px',  // dropdowns, notifications, command palette
        'input': '10px',   // search bars, inputs, buttons
        'item': '6px',     // list rows, tabs, small elements
      },
      boxShadow: {
        'glass': '0 2px 8px 0 rgba(0,0,0,0.3)',
        'glass-lg': '0 4px 16px 0 rgba(0,0,0,0.4)',
        'glass-xl': '0 8px 24px 0 rgba(0,0,0,0.5)',
        'glass-inset': 'inset 0 1px 0 0 rgba(255,255,255,0.08), inset 1px 0 0 0 rgba(255,255,255,0.04)',
        'pill': 'inset 0 1px 3px 0 rgba(255,255,255,0.06), 0 1px 4px 0 rgba(0,0,0,0.3)',
        'pill-active': 'inset 0 1px 0 0 rgba(255,255,255,0.12), inset 1px 0 0 0 rgba(255,255,255,0.06), inset 0 -1px 0 0 rgba(255,255,255,0.02), inset -1px 0 0 0 rgba(255,255,255,0.02), inset 0 1px 2px 0 rgba(255,255,255,0.05), 0 1px 3px 0 rgba(0,0,0,0.3)',
      },
    },
  },
  plugins: [],
}

export default config
