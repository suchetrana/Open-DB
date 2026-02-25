/**
 * Type declarations for the preload-exposed electronAPI
 * (available at window.electronAPI in the renderer)
 */
import type { electronAPI } from './index'

declare global {
  interface Window {
    electronAPI: typeof electronAPI
  }
}
