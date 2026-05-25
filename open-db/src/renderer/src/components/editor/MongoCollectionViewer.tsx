import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/ui";

interface MongoCollectionViewerProps {
  containerId: string;
  database: string;
  collection: string;
}

type MongoDoc = Record<string, unknown>;

type EditorMode = "idle" | "new" | "edit";

const DEFAULT_LIMIT = 50;

function formatMongoId(id: unknown): string {
  if (id && typeof id === "object") {
    const oid = (id as { $oid?: string }).$oid;
    if (oid) return oid;
    const uuid = (id as { $uuid?: string }).$uuid;
    if (uuid) return uuid;
  }
  if (typeof id === "string") return id;
  return JSON.stringify(id);
}

function previewValue(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `[${value.length}]`;
  if (typeof value === "object") return "{...}";
  if (typeof value === "string") {
    const trimmed = value.length > 24 ? `${value.slice(0, 24)}...` : value;
    return `"${trimmed}"`;
  }
  return String(value);
}

function buildUpdateDoc(original: MongoDoc, next: MongoDoc): Record<string, unknown> {
  const { _id: _ignoreOriginal, ...originalRest } = original;
  const { _id: _ignoreNext, ...nextRest } = next;

  const unsetKeys = Object.keys(originalRest).filter((key) => !(key in nextRest));
  const update: Record<string, unknown> = { $set: nextRest };
  if (unsetKeys.length > 0) {
    update.$unset = unsetKeys.reduce<Record<string, string>>((acc, key) => {
      acc[key] = "";
      return acc;
    }, {});
  }
  return update;
}

function parseJsonValue(input: string): { value: unknown | null; error: string | null } {
  const trimmed = input.trim();
  if (!trimmed) return { value: {}, error: null };
  try {
    return { value: JSON.parse(trimmed), error: null };
  } catch (err: unknown) {
    return { value: null, error: err instanceof Error ? err.message : String(err) };
  }
}

export function MongoCollectionViewer({ containerId, database, collection }: MongoCollectionViewerProps) {
  const [documents, setDocuments] = useState<MongoDoc[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<MongoDoc | null>(null);
  const [editorText, setEditorText] = useState("");
  const [lastLoadedText, setLastLoadedText] = useState("");
  const [mode, setMode] = useState<EditorMode>("idle");
  const [filterText, setFilterText] = useState("{}");
  const [limitText, setLimitText] = useState(String(DEFAULT_LIMIT));
  const [isLoading, setIsLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [lastExecMs, setLastExecMs] = useState<number | null>(null);
  const filterRef = useRef(filterText);
  const limitRef = useRef(limitText);

  const isDirty = useMemo(() => editorText.trim().length > 0 && editorText !== lastLoadedText, [editorText, lastLoadedText]);

  const fetchDocuments = useCallback(async (filterInput: string, limitInput: string) => {
    setActionError(null);
    setActionMessage(null);

    const { value: filterValue, error } = parseJsonValue(filterInput);
    if (error) {
      setActionError(`Invalid filter JSON: ${error}`);
      return;
    }

    const parsedLimit = Number.parseInt(limitInput, 10);
    const limit = Number.isNaN(parsedLimit)
      ? DEFAULT_LIMIT
      : Math.min(500, Math.max(1, parsedLimit));

    setIsLoading(true);
    try {
      const query = JSON.stringify({
        database,
        collection,
        op: "find",
        filter: filterValue ?? {},
        limit,
      });
      const result = await window.electronAPI.mongo.execute(containerId, query);
      setDocuments(result.documents as MongoDoc[]);
      setLastExecMs(result.executionTimeMs);
      setSelectedIndex(null);
      setSelectedDoc(null);
      setEditorText("");
      setLastLoadedText("");
      setMode("idle");
      setActionMessage(`Loaded ${result.count} documents`);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [containerId, database, collection]);

  useEffect(() => {
    filterRef.current = filterText;
  }, [filterText]);

  useEffect(() => {
    limitRef.current = limitText;
  }, [limitText]);

  useEffect(() => {
    void fetchDocuments(filterRef.current, limitRef.current);
  }, [fetchDocuments]);

  const selectDoc = (doc: MongoDoc, index: number) => {
    const serialized = JSON.stringify(doc, null, 2);
    setSelectedIndex(index);
    setSelectedDoc(doc);
    setEditorText(serialized);
    setLastLoadedText(serialized);
    setMode("edit");
    setActionError(null);
    setActionMessage(null);
  };

  const startNewDoc = () => {
    setSelectedIndex(null);
    setSelectedDoc(null);
    setEditorText("{\n  \n}");
    setLastLoadedText("");
    setMode("new");
    setActionError(null);
    setActionMessage(null);
  };

  const insertDocument = async () => {
    setActionError(null);
    setActionMessage(null);
    const { value, error } = parseJsonValue(editorText);
    if (error || !value || typeof value !== "object") {
      setActionError(`Invalid document JSON: ${error ?? "Document must be an object"}`);
      return;
    }

    setIsLoading(true);
    try {
      const query = JSON.stringify({
        database,
        collection,
        op: "insertOne",
        doc: value,
      });
      await window.electronAPI.mongo.execute(containerId, query);
      await fetchDocuments();
      setActionMessage("Inserted 1 document");
      setMode("idle");
      setEditorText("");
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const updateDocument = async () => {
    if (!selectedDoc) {
      setActionError("Select a document to update.");
      return;
    }

    const originalId = selectedDoc._id;
    if (!originalId) {
      setActionError("Selected document has no _id field; update is unavailable.");
      return;
    }

    const { value, error } = parseJsonValue(editorText);
    if (error || !value || typeof value !== "object") {
      setActionError(`Invalid document JSON: ${error ?? "Document must be an object"}`);
      return;
    }

    setIsLoading(true);
    try {
      const update = buildUpdateDoc(selectedDoc, value as MongoDoc);
      const query = JSON.stringify({
        database,
        collection,
        op: "updateOne",
        filter: { _id: originalId },
        update,
      });
      await window.electronAPI.mongo.execute(containerId, query);
      await fetchDocuments();
      setActionMessage("Updated 1 document");
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const deleteDocument = async () => {
    if (!selectedDoc) {
      setActionError("Select a document to delete.");
      return;
    }

    const originalId = selectedDoc._id;
    if (!originalId) {
      setActionError("Selected document has no _id field; delete is unavailable.");
      return;
    }

    const ok = window.confirm("Delete the selected document?");
    if (!ok) return;

    setIsLoading(true);
    try {
      const query = JSON.stringify({
        database,
        collection,
        op: "deleteOne",
        filter: { _id: originalId },
      });
      await window.electronAPI.mongo.execute(containerId, query);
      await fetchDocuments();
      setActionMessage("Deleted 1 document");
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const canInsert = mode === "new" && editorText.trim().length > 0 && !isLoading;
  const canUpdate = mode === "edit" && !!selectedDoc && isDirty && !isLoading;
  const canDelete = mode === "edit" && !!selectedDoc && !isLoading;

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="px-3 py-2 border-b border-border-subtle flex items-center gap-2">
        <div>
          <div className="text-[12px] text-text-primary font-semibold">{collection}</div>
          <div className="text-[10px] text-text-muted">{database}</div>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => void fetchDocuments(filterText, limitText)}
            className="px-2 py-1 rounded-item border border-border-default text-[10px] text-text-secondary hover:text-text-primary"
            title="Refresh documents"
          >
            <Icon name="refresh" size={12} />
          </button>
          <button
            onClick={startNewDoc}
            className="px-2 py-1 rounded-item border border-border-default text-[10px] text-text-primary hover:bg-bg-surface-hover"
          >
            New
          </button>
          <button
            onClick={insertDocument}
            disabled={!canInsert}
            className="px-2 py-1 rounded-item border border-border-default text-[10px] text-status-green hover:bg-bg-surface-hover disabled:opacity-50"
          >
            Insert
          </button>
          <button
            onClick={updateDocument}
            disabled={!canUpdate}
            className="px-2 py-1 rounded-item border border-border-default text-[10px] text-accent-blue hover:bg-bg-surface-hover disabled:opacity-50"
          >
            Save
          </button>
          <button
            onClick={deleteDocument}
            disabled={!canDelete}
            className="px-2 py-1 rounded-item border border-border-default text-[10px] text-status-red hover:bg-bg-surface-hover disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-[280px_1fr]">
        <div className="flex flex-col border-r border-border-subtle min-h-0">
          <div className="px-2 py-2 border-b border-border-subtle">
            <div className="flex items-center gap-1.5">
              <div className="glass-input bg-bg-input px-2 py-1.5 flex items-center gap-1 flex-1">
                <Icon name="filter_alt" size={12} className="text-text-muted" />
                <input
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  placeholder='Filter JSON (e.g. {"status":"active"})'
                  className="bg-transparent outline-none text-[11px] text-text-primary w-full"
                />
              </div>
              <input
                value={limitText}
                onChange={(e) => setLimitText(e.target.value)}
                className="w-14 glass-input bg-bg-input px-2 py-1.5 text-[11px] text-text-primary outline-none"
                title="Limit"
              />
              <button
                onClick={() => void fetchDocuments(filterText, limitText)}
                className="px-2 py-1 rounded-item border border-border-default text-[10px] text-text-primary hover:bg-bg-surface-hover"
              >
                Find
              </button>
            </div>
            <div className="mt-1 text-[10px] text-text-muted">
              {isLoading ? "Loading..." : `${documents.length} docs`}
              {lastExecMs !== null && !isLoading ? ` · ${lastExecMs}ms` : ""}
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-auto">
            {documents.length === 0 && !isLoading && (
              <div className="text-[10px] text-text-muted px-3 py-2">No documents found.</div>
            )}
            {documents.map((doc, idx) => {
              const id = doc._id ? formatMongoId(doc._id) : `doc-${idx + 1}`;
              const previewEntries = Object.entries(doc).filter(([key]) => key !== "_id").slice(0, 2);
              const preview = previewEntries.map(([key, value]) => `${key}: ${previewValue(value)}`).join(" · ");
              const isActive = idx === selectedIndex;
              return (
                <button
                  key={`${id}-${idx}`}
                  onClick={() => selectDoc(doc, idx)}
                  className={`w-full text-left px-3 py-2 border-b border-border-subtle hover:bg-bg-surface-hover ${
                    isActive ? "bg-bg-surface-active" : ""
                  }`}
                >
                  <div className="text-[11px] text-text-primary font-medium truncate">{id}</div>
                  {preview && (
                    <div className="text-[10px] text-text-muted truncate">{preview}</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col min-h-0">
          <div className="px-3 py-2 border-b border-border-subtle flex items-center gap-2">
            <div className="text-[11px] text-text-secondary">
              {mode === "new" ? "New document" : mode === "edit" ? "Edit document" : "Select a document"}
            </div>
            {selectedDoc?._id && (
              <div className="ml-auto text-[10px] text-text-muted truncate">_id: {formatMongoId(selectedDoc._id)}</div>
            )}
          </div>
          <textarea
            value={editorText}
            onChange={(e) => setEditorText(e.target.value)}
            placeholder="Document JSON"
            className="flex-1 min-h-0 bg-transparent text-[11px] font-mono text-text-primary p-3 outline-none"
          />
          {(actionError || actionMessage) && (
            <div
              className={`px-3 py-2 text-[10px] border-t border-border-subtle ${
                actionError ? "text-status-red" : "text-status-green"
              }`}
            >
              {actionError ?? actionMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
