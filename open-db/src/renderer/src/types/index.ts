/* ──────────────────────────────────────────
   Shared type definitions for OpenDB Pro
   ────────────────────────────────────────── */

// ── Docker ──
export type ContainerStatus = "running" | "starting" | "stopped";

export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  status: ContainerStatus;
  port: number;
  type: DatabaseType;
}

// ── Database ──
export type DatabaseType = "postgres" | "mysql" | "cassandra" | "mongodb" | "redis";

export interface Connection {
  id: string;
  name: string;
  type: DatabaseType;
  host: string;
  port: number;
  username?: string;
  password?: string;
  database?: string;
  isConnected: boolean;
  dockerContainerId?: string;
}

// ── Schema Tree ──
export interface SchemaNode {
  name: string;
}

export interface TableNode {
  schema: string;
  name: string;
  type: "table" | "view";
  rowEstimate: number;
}

export interface ColumnNode {
  name: string;
  dataType: string;
  nullable: boolean;
  defaultValue: string | null;
  isPrimaryKey: boolean;
}

// ── Editor ──
export interface EditorTab {
  id: string;
  title: string;
  type: "sql" | "config" | "table";
  icon: string;
  iconColor: string;
  isActive: boolean;
  isModified: boolean;
  content?: string;
}

// ── Query Results ──
export interface ColumnDef {
  name: string;
  dataType: string;
  icon: string;
  iconColor: string;
  width?: string;
}

export interface QueryResult {
  columns: ColumnDef[];
  rows: Record<string, string | number | null>[];
  rowCount: number;
  executionTimeMs: number;
}

/** Raw result from the main process DB service */
export interface RawQueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  executionTimeMs: number;
}

// ── Terminal ──
export interface TerminalLine {
  id: string;
  type: "command" | "output" | "prompt" | "blank";
  content: string;
  prefix?: string;
  prefixColor?: string;
}

// ── Sidebar ──
export type SidebarView = "explorer" | "search" | "schema" | "runner" | "extensions";

// ── Terminal Sessions ──
export interface TerminalSessionInfo {
  id: string;
  name: string;
  type: 'local' | 'docker';
  containerId?: string;
  cmd?: string[];
}

// ── File Tree ──
export interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileTreeNode[]
  extension?: string
}

// ── Bottom Panel ──
export type BottomPanelTab = "problems" | "output" | "terminal" | "debug";
