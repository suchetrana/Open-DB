import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/ui";
import { useAppStore } from "@/store/useAppStore";
import type { MongoCollectionInfo } from "@/types";

interface MongoDatabaseBrowserProps {
  containerId: string;
  selectedDatabase: string | null;
  availableDatabases: string[];
  onSwitchDatabase: (dbName: string) => void;
  isSwitching?: boolean;
}

function formatCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}m`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
  return String(count);
}

export function MongoDatabaseBrowser({
  containerId,
  selectedDatabase,
  availableDatabases,
  onSwitchDatabase,
  isSwitching = false,
}: MongoDatabaseBrowserProps) {
  const openMongoCollectionTab = useAppStore((s) => s.openMongoCollectionTab);

  const [collections, setCollections] = useState<MongoCollectionInfo[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dbOptions = useMemo(() => {
    if (availableDatabases.length > 0) return availableDatabases;
    if (selectedDatabase) return [selectedDatabase];
    return ["test"];
  }, [availableDatabases, selectedDatabase]);

  const activeDb = selectedDatabase ?? dbOptions[0] ?? "test";

  const visibleCollections = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return collections;
    return collections.filter((c) => c.name.toLowerCase().includes(needle));
  }, [collections, filter]);

  const fetchCollections = useCallback(async () => {
    if (!activeDb) return;
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.mongo.getCollections(containerId, activeDb);
      setCollections(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [activeDb, containerId]);

  useEffect(() => {
    void fetchCollections();
  }, [fetchCollections]);

  return (
    <div className="flex flex-col">
      <div className="px-2 py-2 border-b border-border-subtle">
        <div className="flex items-center gap-1.5">
          <div className="glass-input bg-bg-input px-2 py-1.5 flex items-center gap-1 flex-1">
            <Icon name="storage" size={12} className="text-text-muted" />
            <select
              value={activeDb}
              onChange={(e) => onSwitchDatabase(e.target.value)}
              disabled={isSwitching}
              className="bg-transparent outline-none text-[11px] text-text-primary w-full"
            >
              {dbOptions.map((db) => (
                <option key={db} value={db}>
                  {db}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => void fetchCollections()}
            className="px-2 py-1 rounded-item border border-border-default text-[10px] text-text-secondary hover:text-text-primary"
            title="Refresh collections"
          >
            <Icon name="refresh" size={12} />
          </button>
        </div>
        <div className="mt-2 glass-input bg-bg-input px-2 py-1.5 flex items-center gap-1">
          <Icon name="filter_alt" size={12} className="text-text-muted" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter collections..."
            className="bg-transparent outline-none text-[11px] text-text-primary w-full"
          />
        </div>
      </div>

      <div className="flex flex-col py-1">
        {loading && (
          <div className="text-text-muted text-[10px] py-2 pl-6">Loading collections...</div>
        )}
        {!loading && error && (
          <div className="text-status-red text-[10px] py-2 pl-6">{error}</div>
        )}
        {!loading && !error && visibleCollections.length === 0 && (
          <div className="text-text-muted text-[10px] py-2 pl-6">No collections found.</div>
        )}

        {visibleCollections.map((collection) => (
          <button
            key={collection.name}
            onClick={() => openMongoCollectionTab(containerId, activeDb, collection.name)}
            className="glass-row mx-1 flex items-center gap-1.5 pl-4 pr-2 py-1.5 cursor-pointer select-none hover:bg-[#27272a]/60"
            style={{ width: "calc(100% - 8px)" }}
          >
            <Icon name="collections_bookmark" size={13} className="text-syntax-decorator" />
            <span className="text-[12px] text-text-primary truncate flex-1">{collection.name}</span>
            <span className="text-[10px] text-text-muted">{formatCount(collection.count)}</span>
            <Icon name="open_in_new" size={12} className="text-text-muted" />
          </button>
        ))}
      </div>
    </div>
  );
}
