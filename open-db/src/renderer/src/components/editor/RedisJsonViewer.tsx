import React, { useMemo, useState } from "react";
import { Icon } from "@/components/ui";

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

interface RedisJsonViewerProps {
  value: JsonValue;
  onEditValue?: (path: string[], value: string) => void;
}

function isObject(value: JsonValue): value is { [key: string]: JsonValue } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringifyInline(value: JsonValue): string {
  return JSON.stringify(value);
}

function pathLabel(path: string[]): string {
  return path.length ? path.join(".") : "$";
}

interface TreeNodeProps {
  nodeKey: string;
  value: JsonValue;
  path: string[];
  expandedPaths: Set<string>;
  onToggle: (pathKey: string) => void;
  onCopyPath: (path: string[]) => void;
  onCopyValue: (value: JsonValue) => void;
  onEditValue?: (path: string[], value: string) => void;
  filter: string;
}

function TreeNode(props: TreeNodeProps) {
  const {
    nodeKey,
    value,
    path,
    expandedPaths,
    onToggle,
    onCopyPath,
    onCopyValue,
    onEditValue,
    filter,
  } = props;

  const currentPath = [...path, nodeKey];
  const id = currentPath.join(".");
  const isContainer = Array.isArray(value) || isObject(value);
  const expanded = expandedPaths.has(id);
  const [draftValue, setDraftValue] = useState("");

  const searchableBlob = `${nodeKey} ${stringifyInline(value)}`.toLowerCase();
  if (filter && !searchableBlob.includes(filter.toLowerCase())) {
    return null;
  }

  const handleSaveLeaf = () => {
    if (!onEditValue) return;
    onEditValue(currentPath, draftValue);
    setDraftValue("");
  };

  return (
    <div className="text-[11px] font-mono">
      <div className="group flex items-center gap-1 py-0.5 px-1 glass-row rounded-item">
        {isContainer ? (
          <button
            onClick={() => onToggle(id)}
            className="text-text-secondary hover:text-text-primary"
            title={expanded ? "Collapse" : "Expand"}
          >
            <Icon name="chevron_right" size={12} className={expanded ? "rotate-90 transition-transform" : "transition-transform"} />
          </button>
        ) : (
          <span className="inline-block w-3" />
        )}

        <span className="text-syntax-function">{nodeKey}</span>
        <span className="text-text-muted">:</span>

        {!isContainer && (
          <span className={typeof value === "string" ? "text-syntax-string" : "text-syntax-number"}>
            {stringifyInline(value)}
          </span>
        )}

        {isContainer && (
          <span className="text-text-muted">{Array.isArray(value) ? `[${value.length}]` : `{${Object.keys(value).length}}`}</span>
        )}

        <span className="ml-auto opacity-0 group-hover:opacity-100 flex items-center gap-1">
          <button
            onClick={() => onCopyPath(currentPath)}
            className="text-text-secondary hover:text-text-primary"
            title="Copy JSON path"
          >
            <Icon name="account_tree" size={12} />
          </button>
          <button
            onClick={() => onCopyValue(value)}
            className="text-text-secondary hover:text-text-primary"
            title="Copy value"
          >
            <Icon name="content_copy" size={12} />
          </button>
        </span>
      </div>

      {!isContainer && onEditValue && (
        <div className="ml-6 mt-1 flex items-center gap-1">
          <input
            value={draftValue}
            onChange={(e) => setDraftValue(e.target.value)}
            placeholder="Edit leaf value"
            className="glass-input flex-1 bg-bg-input px-2 py-1 text-[11px] text-text-primary outline-none"
          />
          <button
            onClick={handleSaveLeaf}
            disabled={!draftValue.length}
            className="px-2 py-1 rounded-item border border-border-default text-[10px] text-text-primary hover:bg-bg-surface-hover disabled:opacity-50"
          >
            Save
          </button>
        </div>
      )}

      {isContainer && expanded && (
        <div className="ml-4 border-l border-border-subtle pl-2 mt-0.5 space-y-0.5">
          {Array.isArray(value)
            ? value.map((item, idx) => (
                <TreeNode
                  key={`${id}.${idx}`}
                  nodeKey={String(idx)}
                  value={item}
                  path={currentPath}
                  expandedPaths={expandedPaths}
                  onToggle={onToggle}
                  onCopyPath={onCopyPath}
                  onCopyValue={onCopyValue}
                  onEditValue={onEditValue}
                  filter={filter}
                />
              ))
            : Object.entries(value).map(([k, v]) => (
                <TreeNode
                  key={`${id}.${k}`}
                  nodeKey={k}
                  value={v}
                  path={currentPath}
                  expandedPaths={expandedPaths}
                  onToggle={onToggle}
                  onCopyPath={onCopyPath}
                  onCopyValue={onCopyValue}
                  onEditValue={onEditValue}
                  filter={filter}
                />
              ))}
        </div>
      )}
    </div>
  );
}

export function RedisJsonViewer({ value, onEditValue }: RedisJsonViewerProps) {
  const [filter, setFilter] = useState("");
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(["root"]));

  const rootValue = useMemo<JsonValue>(() => value, [value]);

  const togglePath = (pathKey: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(pathKey)) next.delete(pathKey);
      else next.add(pathKey);
      return next;
    });
  };

  const expandAll = () => {
    const all = new Set<string>();
    const walk = (node: JsonValue, path: string[]) => {
      const id = path.join(".");
      all.add(id);
      if (Array.isArray(node)) {
        node.forEach((child, idx) => walk(child, [...path, String(idx)]));
      } else if (isObject(node)) {
        Object.entries(node).forEach(([k, child]) => walk(child, [...path, k]));
      }
    };
    walk(rootValue, ["root"]);
    setExpandedPaths(all);
  };

  const collapseAll = () => setExpandedPaths(new Set(["root"]));

  const copyPath = (path: string[]) => {
    void navigator.clipboard.writeText(pathLabel(path.slice(1)));
  };

  const copyValue = (node: JsonValue) => {
    void navigator.clipboard.writeText(JSON.stringify(node, null, 2));
  };

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden">
      <div className="px-3 py-2 border-b border-border-subtle flex items-center gap-2">
        <div className="glass-input bg-bg-input px-2 py-1.5 flex items-center gap-1 flex-1">
          <Icon name="search" size={12} className="text-text-muted" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter JSON keys or values"
            className="bg-transparent outline-none text-[11px] text-text-primary w-full"
          />
        </div>
        <button
          onClick={expandAll}
          className="px-2 py-1 rounded-item border border-border-default text-[10px] text-text-primary hover:bg-bg-surface-hover"
        >
          Expand all
        </button>
        <button
          onClick={collapseAll}
          className="px-2 py-1 rounded-item border border-border-default text-[10px] text-text-secondary hover:text-text-primary"
        >
          Collapse all
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-2">
        <TreeNode
          nodeKey="root"
          value={rootValue}
          path={[]}
          expandedPaths={expandedPaths}
          onToggle={togglePath}
          onCopyPath={copyPath}
          onCopyValue={copyValue}
          onEditValue={onEditValue}
          filter={filter}
        />
      </div>
    </div>
  );
}
