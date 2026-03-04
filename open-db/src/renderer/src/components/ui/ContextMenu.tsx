/**
 * ContextMenu — Beekeeper-style right-click context menu
 */
import { useEffect, useRef } from 'react'
import { Icon } from './Icon'
import { clsx } from 'clsx'
import type { ContextMenuItem } from '@/types'

interface ContextMenuProps {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', keyHandler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', keyHandler)
    }
  }, [onClose])

  // Adjust position to keep menu within viewport
  useEffect(() => {
    if (!menuRef.current) return
    const rect = menuRef.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    if (rect.right > vw) {
      menuRef.current.style.left = `${x - rect.width}px`
    }
    if (rect.bottom > vh) {
      menuRef.current.style.top = `${y - rect.height}px`
    }
  }, [x, y])

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] min-w-[180px] glass-widget py-1 animate-context-menu"
      style={{ left: x, top: y }}
    >
      {items.map((item, i) => (
        <div key={i}>
          {item.separator && i > 0 && (
            <div className="h-px bg-[#25262a] mx-2 my-1" />
          )}
          <button
            onClick={() => {
              item.action()
              onClose()
            }}
            className={clsx(
              'flex items-center gap-2.5 w-full px-3 py-1.5 text-[11px] text-left transition-colors duration-200 rounded-item mx-1',
              item.danger
                ? 'text-status-red hover:bg-status-red/10'
                : 'text-text-primary hover:bg-white/6'
            )}
            style={{ width: 'calc(100% - 8px)' }}
          >
            {item.icon && (
              <Icon
                name={item.icon}
                size={14}
                className={item.iconColor ?? 'text-text-secondary'}
              />
            )}
            <span className="flex-1">{item.label}</span>
          </button>
        </div>
      ))}
    </div>
  )
}
