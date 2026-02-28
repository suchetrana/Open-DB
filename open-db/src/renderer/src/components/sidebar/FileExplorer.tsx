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
function TreeNode({ 
  node, 
  depth, 
  onCreateFile, 
  onCreateFolder,
  creatingItem,
  newItemName,
  setNewItemName,
  handleCreateItem,
  clearCreatingItem,
}: { 
  node: FileTreeNode; 
  depth: number;
  onCreateFile: (parentPath: string) => void;
  onCreateFolder: (parentPath: string) => void;
  creatingItem: { type: 'file' | 'folder'; parentPath: string } | null;
  newItemName: string;
  setNewItemName: (name: string) => void;
  handleCreateItem: () => void;
  clearCreatingItem: () => void;
}) {
  const expandedDirs = useAppStore((s) => s.expandedDirs)
  const toggleDir = useAppStore((s) => s.toggleDir)
  const openFileFromTree = useAppStore((s) => s.openFileFromTree)
  const deleteFileOrFolder = useAppStore((s) => s.deleteFileOrFolder)
  const [showActions, setShowActions] = useState(false)

  const isExpanded = !!expandedDirs[node.path]
  const paddingLeft = 8 + depth * 16
  const isCreatingHere = creatingItem && creatingItem.parentPath === node.path

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const confirmed = window.confirm(`Delete "${node.name}"?`)
    if (confirmed) {
      await deleteFileOrFolder(node.path)
    }
  }

  if (node.type === 'directory') {
    return (
      <>
        <div
          className="group w-full flex items-center gap-1 py-[2px] hover:bg-bg-surface-hover text-[11px] text-text-primary select-none cursor-pointer"
          style={{ paddingLeft }}
          onMouseEnter={() => setShowActions(true)}
          onMouseLeave={() => setShowActions(false)}
        >
          <button
            onClick={() => toggleDir(node.path)}
            className="flex items-center gap-1 flex-1 min-w-0"
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
          {showActions && (
            <div className="flex items-center gap-0.5 mr-1">
              <button
                onClick={(e) => { e.stopPropagation(); onCreateFile(node.path) }}
                className="p-0.5 text-text-secondary hover:text-text-primary"
                title="New File"
              >
                <Icon name="note_add" size={14} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onCreateFolder(node.path) }}
                className="p-0.5 text-text-secondary hover:text-text-primary"
                title="New Folder"
              >
                <Icon name="create_new_folder" size={14} />
              </button>
              <button
                onClick={handleDelete}
                className="p-0.5 text-text-secondary hover:text-status-red"
                title="Delete"
              >
                <Icon name="delete" size={14} />
              </button>
            </div>
          )}
        </div>
        {isExpanded && (
          <div>
            {/* Show input for creating inside this folder */}
            {isCreatingHere && (
              <div className="flex items-center gap-1 px-2 py-1" style={{ paddingLeft: paddingLeft + 16 }}>
                <Icon 
                  name={creatingItem.type === 'folder' ? 'create_new_folder' : 'note_add'} 
                  size={14} 
                  className={creatingItem.type === 'folder' ? 'text-syntax-function shrink-0' : 'text-text-secondary shrink-0'} 
                />
                <input
                  autoFocus
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateItem()
                    if (e.key === 'Escape') clearCreatingItem()
                  }}
                  onBlur={() => clearCreatingItem()}
                  placeholder={creatingItem.type === 'folder' ? 'Folder name…' : 'File name…'}
                  className="flex-1 bg-bg-input border border-accent-blue rounded px-1.5 py-0.5 text-[11px] text-text-primary outline-none"
                />
              </div>
            )}
            {node.children?.map((child) => (
              <TreeNode 
                key={child.path} 
                node={child} 
                depth={depth + 1}
                onCreateFile={onCreateFile}
                onCreateFolder={onCreateFolder}
                creatingItem={creatingItem}
                newItemName={newItemName}
                setNewItemName={setNewItemName}
                handleCreateItem={handleCreateItem}
                clearCreatingItem={clearCreatingItem}
              />
            ))}
          </div>
        )}
      </>
    )
  }

  // File node
  const { icon, color } = fileIcon(node.extension)
  return (
    <div
      className="group w-full flex items-center gap-1.5 py-[2px] hover:bg-bg-surface-hover text-[11px] text-text-secondary hover:text-text-primary select-none cursor-pointer"
      style={{ paddingLeft: paddingLeft + 14 }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <button
        onClick={() => openFileFromTree(node.path, node.name)}
        className="flex items-center gap-1.5 flex-1 min-w-0"
      >
        <Icon name={icon} size={14} className={clsx(color, 'shrink-0')} />
        <span className="truncate">{node.name}</span>
      </button>
      {showActions && (
        <button
          onClick={handleDelete}
          className="p-0.5 mr-1 text-text-secondary hover:text-status-red"
          title="Delete"
        >
          <Icon name="delete" size={14} />
        </button>
      )}
    </div>
  )
}

export function FileExplorer() {
  const fileTree = useAppStore((s) => s.fileTree)
  const workspaceRootName = useAppStore((s) => s.workspaceRootName)
  const workspaceRootPath = useAppStore((s) => s.workspaceRootPath)
  const openFolder = useAppStore((s) => s.openFolder)
  const openFileDialog = useAppStore((s) => s.openFileDialog)
  const createNewFolder = useAppStore((s) => s.createNewFolder)
  const createNewFile = useAppStore((s) => s.createNewFile)
  const expandedDirs = useAppStore((s) => s.expandedDirs)
  const toggleDir = useAppStore((s) => s.toggleDir)

  const [creatingItem, setCreatingItem] = useState<{ type: 'file' | 'folder'; parentPath: string } | null>(null)
  const [newItemName, setNewItemName] = useState('')

  const handleCreateItem = async () => {
    const name = newItemName.trim()
    if (!name || !creatingItem) return
    
    if (creatingItem.type === 'folder') {
      await createNewFolder(creatingItem.parentPath, name)
    } else {
      await createNewFile(creatingItem.parentPath, name)
    }
    setNewItemName('')
    setCreatingItem(null)
  }

  const startCreatingFile = (parentPath: string) => {
    // Expand the parent folder if not already expanded (except for root)
    if (parentPath !== workspaceRootPath && !expandedDirs[parentPath]) {
      toggleDir(parentPath)
    }
    setCreatingItem({ type: 'file', parentPath })
    setNewItemName('')
  }

  const startCreatingFolder = (parentPath: string) => {
    // Expand the parent folder if not already expanded (except for root)
    if (parentPath !== workspaceRootPath && !expandedDirs[parentPath]) {
      toggleDir(parentPath)
    }
    setCreatingItem({ type: 'folder', parentPath })
    setNewItemName('')
  }

  const clearCreatingItem = () => {
    setCreatingItem(null)
    setNewItemName('')
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
              startCreatingFile(workspaceRootPath)
            }}
            className="text-text-secondary hover:text-text-primary"
            title="New File"
          >
            <Icon name="note_add" size={14} />
          </button>
          <button
            onClick={(e) => {
              e.preventDefault()
              startCreatingFolder(workspaceRootPath)
            }}
            className="text-text-secondary hover:text-text-primary"
            title="New Folder"
          >
            <Icon name="create_new_folder" size={14} />
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
        {creatingItem && creatingItem.parentPath === workspaceRootPath && (
          <div className="flex items-center gap-1 px-2 py-1">
            <Icon 
              name={creatingItem.type === 'folder' ? 'create_new_folder' : 'note_add'} 
              size={14} 
              className={creatingItem.type === 'folder' ? 'text-syntax-function shrink-0' : 'text-text-secondary shrink-0'} 
            />
            <input
              autoFocus
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateItem()
                if (e.key === 'Escape') clearCreatingItem()
              }}
              onBlur={() => clearCreatingItem()}
              placeholder={creatingItem.type === 'folder' ? 'Folder name…' : 'File name…'}
              className="flex-1 bg-bg-input border border-accent-blue rounded px-1.5 py-0.5 text-[11px] text-text-primary outline-none"
            />
          </div>
        )}
        {fileTree.map((node) => (
          <TreeNode 
            key={node.path} 
            node={node} 
            depth={0}
            onCreateFile={startCreatingFile}
            onCreateFolder={startCreatingFolder}
            creatingItem={creatingItem}
            newItemName={newItemName}
            setNewItemName={setNewItemName}
            handleCreateItem={handleCreateItem}
            clearCreatingItem={clearCreatingItem}
          />
        ))}
      </div>
    </details>
  )
}
