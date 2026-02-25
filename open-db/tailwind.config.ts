import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#3b82f6',
        'bg-base': '#0d0d0d',
        'bg-elevated': '#1e1e1e',
        'bg-surface': '#252526',
        'bg-surface-hover': '#2a2d2e',
        'bg-surface-active': '#37373d',
        'bg-input': '#2d2d2d',
        'border-default': '#333333',
        'border-subtle': '#2d2d2d',
        'border-input': '#404040',
        'text-primary': '#cccccc',
        'text-secondary': '#858585',
        'text-muted': '#6e7681',
        'text-bright': '#ffffff',
        'text-disabled': '#969696',
        'accent-blue': '#007fd4',
        'accent-button': '#0e639c',
        'accent-button-hover': '#1177bb',
        'syntax-keyword': '#569cd6',
        'syntax-function': '#dcdcaa',
        'syntax-string': '#ce9178',
        'syntax-number': '#b5cea8',
        'syntax-comment': '#6a9955',
        'syntax-type': '#4ec9b0',
        'syntax-operator': '#d4d4d4',
        'syntax-param': '#9cdcfe',
        'syntax-decorator': '#c586c0',
        'status-green': '#4ec9b0',
        'status-amber': '#dcdcaa',
        'status-red': '#f44747',
        'selection-bg': '#264f78',
      },
      fontFamily: {
        display: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        '2xs': '0.65rem',
        xs: '0.75rem',
        sm: '0.8rem',
      },
    },
  },
  plugins: [],
}

export default config
