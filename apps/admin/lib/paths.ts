import fs from "node:fs";
import path from "node:path";

/**
 * HF Paths Configuration
 *
 * Resolution order:
 * 1. $HF_KB_PATH/paths.json (production override)
 * 2. lib/paths.json (project config)
 * 3. lib/paths.default.json (defaults)
 *
 * All paths in config are relative to $HF_KB_PATH (or fallback root).
 */

export interface PathsConfig {
  version: number;
  sources: {
    knowledge: string;
    transcripts: string;
    parameters: string;
  };
  derived: {
    knowledge: string;
    embeddings: string;
    transcripts: string;
    analysis: string;
  };
  exports: {
    reports: string;
    snapshots: string;
  };
}

// Cache the resolved config
let cachedConfig: PathsConfig | null = null;
let cachedRoot: string | null = null;

/**
 * Get the KB root path from environment or fallback
 */
export function getKbRoot(): string {
  if (cachedRoot) return cachedRoot;

  const env = (process.env.HF_KB_PATH || "").trim();
  if (env) {
    cachedRoot = env;
    return env;
  }

  // Fallback: look for knowledge/ directory relative to project
  const cwd = process.cwd();
  const fallbacks = [
    path.resolve(cwd, "../../hf_kb"), // From apps/admin
    path.resolve(cwd, "../hf_kb"), // From apps/
    path.resolve(cwd, "hf_kb"), // From project root
    path.resolve(process.env.HOME || "~", "hf_kb"), // Home directory
  ];

  for (const fallback of fallbacks) {
    if (fs.existsSync(fallback)) {
      cachedRoot = fallback;
      return fallback;
    }
  }

  // Default to first fallback even if it doesn't exist
  cachedRoot = fallbacks[0];
  return cachedRoot;
}

/**
 * Load paths configuration
 */
export function loadPathsConfig(): PathsConfig {
  if (cachedConfig) return cachedConfig;

  const root = getKbRoot();
  const cwd = process.cwd();

  // Try loading in order of priority
  const configPaths = [
    path.join(root, "paths.json"), // $HF_KB_PATH/paths.json
    path.resolve(cwd, "../../lib/paths.json"), // lib/paths.json (from apps/admin)
    path.resolve(cwd, "lib/paths.json"), // lib/paths.json (from root)
  ];

  for (const configPath of configPaths) {
    if (fs.existsSync(configPath)) {
      try {
        const content = fs.readFileSync(configPath, "utf-8");
        cachedConfig = JSON.parse(content) as PathsConfig;
        console.log(`[Paths] Loaded config from: ${configPath}`);
        return cachedConfig;
      } catch (e) {
        console.warn(`[Paths] Failed to parse ${configPath}:`, e);
      }
    }
  }

  // Fall back to defaults
  const defaultPath = path.resolve(cwd, "../../lib/paths.default.json");
  if (fs.existsSync(defaultPath)) {
    const content = fs.readFileSync(defaultPath, "utf-8");
    cachedConfig = JSON.parse(content) as PathsConfig;
    console.log(`[Paths] Using defaults from: ${defaultPath}`);
    return cachedConfig;
  }

  // Hardcoded defaults as last resort
  cachedConfig = {
    version: 1,
    sources: {
      knowledge: "sources/knowledge",
      transcripts: "sources/transcripts",
      parameters: "sources/parameters/parameters.csv",
    },
    derived: {
      knowledge: "derived/knowledge",
      embeddings: "derived/embeddings",
      transcripts: "derived/transcripts",
      analysis: "derived/analysis",
    },
    exports: {
      reports: "exports/reports",
      snapshots: "exports/snapshots",
    },
  };

  console.log("[Paths] Using hardcoded defaults");
  return cachedConfig;
}

/**
 * Resolve a path relative to KB root
 */
export function resolvePath(relativePath: string): string {
  const root = getKbRoot();
  return path.resolve(root, relativePath);
}

/**
 * Get all resolved paths
 */
export function getResolvedPaths(): {
  root: string;
  sources: Record<string, string>;
  derived: Record<string, string>;
  exports: Record<string, string>;
} {
  const config = loadPathsConfig();
  const root = getKbRoot();

  return {
    root,
    sources: {
      knowledge: path.resolve(root, config.sources.knowledge),
      transcripts: path.resolve(root, config.sources.transcripts),
      parameters: path.resolve(root, config.sources.parameters),
    },
    derived: {
      knowledge: path.resolve(root, config.derived.knowledge),
      embeddings: path.resolve(root, config.derived.embeddings),
      transcripts: path.resolve(root, config.derived.transcripts),
      analysis: path.resolve(root, config.derived.analysis),
    },
    exports: {
      reports: path.resolve(root, config.exports.reports),
      snapshots: path.resolve(root, config.exports.snapshots),
    },
  };
}

/**
 * Validate that required paths exist
 */
export function validatePaths(): {
  valid: boolean;
  root: string;
  missing: string[];
  existing: string[];
} {
  const resolved = getResolvedPaths();
  const missing: string[] = [];
  const existing: string[] = [];

  // Check root
  if (!fs.existsSync(resolved.root)) {
    missing.push(`root: ${resolved.root}`);
  } else {
    existing.push(`root: ${resolved.root}`);
  }

  // Check source paths (should exist for input)
  for (const [key, p] of Object.entries(resolved.sources)) {
    if (!fs.existsSync(p)) {
      missing.push(`sources.${key}: ${p}`);
    } else {
      existing.push(`sources.${key}: ${p}`);
    }
  }

  // Derived paths can be created on demand, just note if missing
  for (const [key, p] of Object.entries(resolved.derived)) {
    if (!fs.existsSync(p)) {
      missing.push(`derived.${key}: ${p} (will be created)`);
    } else {
      existing.push(`derived.${key}: ${p}`);
    }
  }

  return {
    valid: missing.filter((m) => !m.includes("will be created")).length === 0,
    root: resolved.root,
    missing,
    existing,
  };
}

/**
 * Ensure derived directories exist
 */
export function ensureDerivedPaths(): void {
  const resolved = getResolvedPaths();

  for (const p of Object.values(resolved.derived)) {
    if (!fs.existsSync(p)) {
      fs.mkdirSync(p, { recursive: true });
      console.log(`[Paths] Created: ${p}`);
    }
  }

  for (const p of Object.values(resolved.exports)) {
    if (!fs.existsSync(p)) {
      fs.mkdirSync(p, { recursive: true });
      console.log(`[Paths] Created: ${p}`);
    }
  }
}

/**
 * Clear cached config (for testing or hot reload)
 */
export function clearPathsCache(): void {
  cachedConfig = null;
  cachedRoot = null;
}

// Convenience exports for common paths
export const paths = {
  get root() {
    return getKbRoot();
  },
  get sources() {
    return getResolvedPaths().sources;
  },
  get derived() {
    return getResolvedPaths().derived;
  },
  get exports() {
    return getResolvedPaths().exports;
  },
};
