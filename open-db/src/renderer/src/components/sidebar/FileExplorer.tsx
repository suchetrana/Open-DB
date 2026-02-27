/**
 * FileExplorer — VS Code-style file/folder tree view
 *
 * Shows the opened workspace folder as a collapsible tree.
 * Clicking a file opens it in the editor.
 */
import { useState } from 'react'
import { Icon } from '@/components/ui'
import { useAppStore } from '@/store/useAppStore'
import { clsx } from 'clsx'
import type { FileTreeNode } from '@/types'

/** Map file extensions to Material icon names + colours */
function fileIcon(ext?: string): { icon: string; color: string } {
  switch (ext) {
    case '.sql':
      return { icon: 'database', color: 'text-status-green' }
    case '.ts':
    case '.tsx':
      return { icon: 'code', color: 'text-syntax-keyword' }
    case '.js':
    case '.jsx':
      return { icon: 'javascript', color: 'text-syntax-function' }
    case '.json':
      return { icon: 'data_object', color: 'text-syntax-decorator' }
    case '.md':
    case '.mdx':
      return { icon: 'article', color: 'text-accent-blue' }
    case '.css':
    case '.scss':
    case '.less':
      return { icon: 'palette', color: 'text-syntax-decorator' }
    case '.html':
      return { icon: 'html', color: 'text-status-red' }
    case '.yml':
    case '.yaml':
      return { icon: 'settings', color: 'text-syntax-string' }
    case '.env':
      return { icon: 'lock', color: 'text-status-amber' }
    case '.gitignore':
      return { icon: 'visibility_off', color: 'text-text-muted' }
    case '.png':
    case '.jpg':
    case '.jpeg':
    case '.svg':
    case '.gif':
    case '.ico':
      return { icon: 'image', color: 'text-syntax-string' }
    default:
      return { icon: 'description', color: 'text-text-secondary' }
  }
}

// ── Single tree node (recursive) ──
function TreeNode({ node, depth }: { node: FileTreeNode; depth: number }) {
  const expandedDirs = useAppStore((s) => s.expandedDirs)
  const toggleDir = useAppStore((s) => s.toggleDir)
  const openFileFromTree = useAppStore((s) => s.openFileFromTree)

  const isExpanded = !!expandedDirs[node.path]
  const paddingLeft = 8 + depth * 16

  if (node.type === 'directory') {
    return (
      <>
        <button
          onClick={() => toggleDir(node.path)}
          className="w-full flex items-center gap-1 py-[2px] hover:bg-bg-surface-hover text-[11px] text-text-primary select-none cursor-pointer"
          style={{ paddingLeft }}
        >
          <Icon
            name="chevron_right"
            size={14}
            className={clsx(
              'transition-transform shrink-0',
              isExpanded && 'rotate-90'
            )}
          />
          <Icon
            name={isExpanded ? 'folder_open' : 'folder'}
            size={16}
            className="text-syntax-function shrink-0"
          />
          <span className="truncate">{node.name}</span>
        </button>
        {isExpanded && node.children && (
          <div>
            {node.children.map((child) => (
              <TreeNode key={child.path} node={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </>
    )
  }

  // File node
  const { icon, color } = fileIcon(node.extension)
  return (
    <button
      onClick={() => openFileFromTree(node.path, node.name)}
      className="w-full flex items-center gap-1.5 py-[2px] hover:bg-bg-surface-hover text-[11px] text-text-secondary hover:text-text-primary select-none cursor-pointer"
      style={{ paddingLeft: paddingLeft + 14 }}
    >
      <Icon name={icon} size={14} className={clsx(color, 'shrink-0')} />
      <span className="truncate">{node.name}</span>
    </button>
  )
}

export function FileExplorer() {
  const fileTree = useAppStore((s) => s.fileTree)
  const workspaceRootName = useAppStore((s) => s.workspaceRootName)
  const workspaceRootPath = useAppStore((s) => s.workspaceRootPath)
  const openFolder = useAppStore((s) => s.openFolder)
  const openFileDialog = useAppStore((s) => s.openFileDialog)
  const createNewFolder = useAppStore((s) => s.createNewFolder)

  const [creatingFolder, setCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  const handleCreateFolder = async () => {
    const name = newFolderName.trim()
    if (!name || !workspaceRootPath) return
    await createNewFolder(workspaceRootPath, name)
    setNewFolderName('')
    setCreatingFolder(false)
  }

  // No folder open — show "Open Folder" prompt
  if (!workspaceRootPath) {
    return (
      <div className="px-4 py-6 text-center">
        <Icon name="folder_open" size={40} className="mx-auto text-text-muted opacity-50 mb-3" />
        <p className="text-[11px] text-text-secondary mb-3">
          No folder opened yet
        </p>
        <button
          onClick={openFolder}
          className="w-full py-1.5 px-3 bg-accent-button hover:bg-accent-button-hover text-white text-[11px] font-medium rounded transition-colors"
        >
          Open Folder
        </button>
        <button
          onClick={openFileDialog}
          className="w-full mt-2 py-1.5 px-3 border border-border-default text-text-secondary hover:text-text-primary text-[11px] rounded transition-colors hover:bg-bg-surface-hover"
        >
          Open File
        </button>
      </div>
    )
  }

  return (
    <details className="group" open>
      <summary className="flex items-center px-1 py-0.5 cursor-pointer hover:bg-bg-surface-hover select-none text-text-primary focus:outline-none">
        <Icon
          name="chevron_right"
          size={16}
          className="transition-transform group-open:rotate-90 text-text-primary"
        />
        <span className="text-[11px] font-bold uppercase ml-0.5 truncate">
          {workspaceRootName}
        </span>
        <div className="ml-auto flex gap-1 mr-2">
          <button
            onClick={(e) => {
              e.preventDefault()
              setCreatingFolder(true)
            }}
            className="text-text-secondary hover:text-text-primary"
            title="New Folder"
          >
            <Icon name="create_new_folder" size={14} />
          </button>
          <button
            onClick={(e) => {
              e.preventDefault()
              openFileDialog()
            }}
            className="text-text-secondary hover:text-text-primary"
            title="Open File"
          >
            <Icon name="note_add" size={14} />
          </button>
          <button
            onClick={(e) => {
              e.preventDefault()
              openFolder()
            }}
            className="text-text-secondary hover:text-text-primary"
            title="Open Folder"
          >
            <Icon name="folder_open" size={14} />
          </button>
        </div>
      </summary>

      <div className="overflow-y-auto max-h-[50vh]">
        {creatingFolder && (
          <div className="flex items-center gap-1 px-2 py-1">
            <Icon name="create_new_folder" size={14} className="text-syntax-function shrink-0" />
            <input
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateFolder()
                if (e.key === 'Escape') { setCreatingFolder(false); setNewFolderName('') }
              }}
              onBlur={() => { setCreatingFolder(false); setNewFolderName('') }}
              placeholder="Folder name…"
              className="flex-1 bg-bg-input border border-accent-blue rounded px-1.5 py-0.5 text-[11px] text-text-primary outline-none"
            />
          </div>
        )}
        {fileTree.map((node) => (
          <TreeNode key={node.path} node={node} depth={0} />
        ))}
      </div>
    </details>
  )
}
