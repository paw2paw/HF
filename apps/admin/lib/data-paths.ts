/**
 * Data Path Resolver
 *
 * Single source of truth for resolving data node paths.
 * All paths are defined in agents.json data nodes.
 *
 * Usage:
 *   import { resolveDataNodePath, getKbRoot } from "@/lib/data-paths";
 *
 *   const kbRoot = getKbRoot();                              // /Volumes/.../hf_kb
 *   const knowledgePath = resolveDataNodePath("data:knowledge");  // /Volumes/.../hf_kb/sources/knowledge
 *   const derivedPath = resolveDataNodePath("data:knowledge_derived"); // /Volumes/.../hf_kb/derived/knowledge
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// ============================================================================
// Types
// ============================================================================

export type DataNode = {
  id: string;
  label: string;
  description?: string;
  storageType: "path" | "table";
  path?: string; // Relative path from KB root (for storageType: "path")
  table?: string; // Prisma table name (for storageType: "table")
  role: "source" | "output" | "both";
  resources?: Array<{
    type: "path" | "table";
    path?: string;
    table?: string;
    link?: string;
    label: string;
  }>;
};

export type AgentManifest = {
  version: number;
  data: DataNode[];
  agents: Array<{
    id: string;
    agentId?: string;
    title: string;
    inputs?: Array<{ node: string }>;
    outputs?: Array<{ node: string }>;
    settings?: Record<string, unknown>;
  }>;
  pathSettings?: Record<string, unknown>;
  groups?: unknown[];
  layout?: unknown;
};

// ============================================================================
// KB Root Resolution
// ============================================================================

/**
 * Expand ~ to home directory
 */
function expandTilde(p: string): string {
  const t = (p || "").trim();
  if (!t) return "";
  if (t === "~") return os.homedir();
  if (t.startsWith("~/") || t.startsWith("~\\")) {
    return path.join(os.homedir(), t.slice(2));
  }
  return t;
}

/**
 * Get the KB root directory from HF_KB_PATH environment variable.
 * Falls back to ~/hf_kb if not set.
 */
export function getKbRoot(): string {
  const envRaw =
    typeof process.env.HF_KB_PATH === "string" ? process.env.HF_KB_PATH : "";
  const env = expandTilde(envRaw);
  if (env && env.trim()) return path.resolve(env.trim());
  return path.resolve(path.join(os.homedir(), "hf_kb"));
}

// ============================================================================
// Manifest Loading
// ============================================================================

let cachedManifest: AgentManifest | null = null;
let manifestLoadTime = 0;
const CACHE_TTL_MS = 5000; // 5 second cache

/**
 * Find and load agents.json manifest
 */
export function loadManifest(): AgentManifest | null {
  const now = Date.now();
  if (cachedManifest && now - manifestLoadTime < CACHE_TTL_MS) {
    return cachedManifest;
  }

  const candidates: string[] = [];

  // 1) KB root .hf directory (production override)
  const kbRoot = getKbRoot();
  candidates.push(path.join(kbRoot, ".hf", "agents.manifest.json"));

  // 2) Walk up from current file to find lib/agents.json
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    candidates.push(path.join(dir, "lib", "agents.json"));
    candidates.push(path.join(dir, "..", "lib", "agents.json"));
    candidates.push(path.join(dir, "..", "..", "lib", "agents.json"));
    candidates.push(path.join(dir, "..", "..", "..", "lib", "agents.json"));
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  // 3) CWD-based paths
  candidates.push(path.resolve(process.cwd(), "lib", "agents.json"));
  candidates.push(path.resolve(process.cwd(), "..", "lib", "agents.json"));
  candidates.push(path.resolve(process.cwd(), "..", "..", "lib", "agents.json"));
  candidates.push(
    path.resolve(process.cwd(), "..", "..", "..", "lib", "agents.json")
  );

  // Dedupe
  const seen = new Set<string>();
  const uniq = candidates
    .map((p) => path.resolve(p))
    .filter((p) => {
      if (seen.has(p)) return false;
      seen.add(p);
      return true;
    });

  for (const p of uniq) {
    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, "utf8");
        const manifest = JSON.parse(raw) as AgentManifest;
        cachedManifest = manifest;
        manifestLoadTime = now;
        return manifest;
      }
    } catch {
      // Continue to next candidate
    }
  }

  return null;
}

/**
 * Clear the manifest cache (useful for testing or after manifest updates)
 */
export function clearManifestCache(): void {
  cachedManifest = null;
  manifestLoadTime = 0;
}

// ============================================================================
// Data Node Resolution
// ============================================================================

/**
 * Get a data node by ID from the manifest
 */
export function getDataNode(nodeId: string): DataNode | null {
  const manifest = loadManifest();
  if (!manifest?.data) return null;

  return manifest.data.find((d) => d.id === nodeId) || null;
}

/**
 * Get all data nodes from the manifest
 */
export function getAllDataNodes(): DataNode[] {
  const manifest = loadManifest();
  return manifest?.data || [];
}

/**
 * Resolve a data node ID to an absolute filesystem path.
 * Only works for nodes with storageType: "path".
 *
 * @param nodeId - Data node ID (e.g., "data:knowledge")
 * @param kbRoot - Optional KB root override (defaults to getKbRoot())
 * @returns Absolute path or null if node not found or is not a path node
 */
export function resolveDataNodePath(
  nodeId: string,
  kbRoot?: string
): string | null {
  const node = getDataNode(nodeId);
  if (!node) {
    console.warn(`[data-paths] Unknown data node: ${nodeId}`);
    return null;
  }

  if (node.storageType !== "path" || !node.path) {
    // Not a path-based node (it's a database table)
    return null;
  }

  const root = kbRoot || getKbRoot();
  return path.join(root, node.path);
}

/**
 * Resolve multiple data node IDs to paths
 *
 * @param nodeIds - Array of data node IDs
 * @param kbRoot - Optional KB root override
 * @returns Map of nodeId -> absolute path (excludes non-path nodes)
 */
export function resolveDataNodePaths(
  nodeIds: string[],
  kbRoot?: string
): Map<string, string> {
  const result = new Map<string, string>();
  const root = kbRoot || getKbRoot();

  for (const nodeId of nodeIds) {
    const resolved = resolveDataNodePath(nodeId, root);
    if (resolved) {
      result.set(nodeId, resolved);
    }
  }

  return result;
}

/**
 * Get input and output paths for an agent based on its manifest definition.
 *
 * @param agentId - Agent ID (e.g., "knowledge_extractor")
 * @param kbRoot - Optional KB root override
 * @returns Object with inputPaths and outputPaths arrays
 */
export function getAgentPaths(
  agentId: string,
  kbRoot?: string
): {
  inputPaths: Array<{ nodeId: string; path: string }>;
  outputPaths: Array<{ nodeId: string; path: string }>;
} {
  const manifest = loadManifest();
  const root = kbRoot || getKbRoot();

  const agent = manifest?.agents?.find(
    (a) => a.id === agentId || a.agentId === agentId
  );

  if (!agent) {
    return { inputPaths: [], outputPaths: [] };
  }

  const inputPaths: Array<{ nodeId: string; path: string }> = [];
  const outputPaths: Array<{ nodeId: string; path: string }> = [];

  // Resolve input paths
  for (const input of agent.inputs || []) {
    const resolved = resolveDataNodePath(input.node, root);
    if (resolved) {
      inputPaths.push({ nodeId: input.node, path: resolved });
    }
  }

  // Resolve output paths
  for (const output of agent.outputs || []) {
    const resolved = resolveDataNodePath(output.node, root);
    if (resolved) {
      outputPaths.push({ nodeId: output.node, path: resolved });
    }
  }

  return { inputPaths, outputPaths };
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Ensure a directory exists, creating it if necessary
 */
export function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

/**
 * Check if a path exists
 */
export function pathExists(p: string): boolean {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the .hf system directory path
 */
export function getSystemDir(kbRoot?: string): string {
  const root = kbRoot || getKbRoot();
  return path.join(root, ".hf");
}

/**
 * Validate that required KB directories exist
 */
export function validateKbStructure(kbRoot?: string): {
  valid: boolean;
  missing: string[];
  kbRoot: string;
} {
  const root = kbRoot || getKbRoot();
  const missing: string[] = [];

  // Check KB root exists
  if (!pathExists(root)) {
    return { valid: false, missing: [root], kbRoot: root };
  }

  // Check all path-based data nodes
  const nodes = getAllDataNodes();
  for (const node of nodes) {
    if (node.storageType === "path" && node.path && node.role === "source") {
      const fullPath = path.join(root, node.path);
      if (!pathExists(fullPath)) {
        missing.push(fullPath);
      }
    }
  }

  return { valid: missing.length === 0, missing, kbRoot: root };
}

/**
 * Initialize KB directory structure based on data nodes
 */
export function initializeKbStructure(kbRoot?: string): {
  created: string[];
  kbRoot: string;
} {
  const root = kbRoot || getKbRoot();
  const created: string[] = [];

  // Ensure KB root
  if (!pathExists(root)) {
    ensureDir(root);
    created.push(root);
  }

  // Ensure .hf system directory
  const systemDir = getSystemDir(root);
  if (!pathExists(systemDir)) {
    ensureDir(systemDir);
    created.push(systemDir);
  }

  // Create all path-based data node directories
  const nodes = getAllDataNodes();
  for (const node of nodes) {
    if (node.storageType === "path" && node.path) {
      const fullPath = path.join(root, node.path);
      if (!pathExists(fullPath)) {
        ensureDir(fullPath);
        created.push(fullPath);
      }
    }
  }

  return { created, kbRoot: root };
}
