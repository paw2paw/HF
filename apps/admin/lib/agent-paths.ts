import fs from "node:fs";
import path from "node:path";
import { getResolvedPaths } from "./paths";

/**
 * Agent Path Resolution
 *
 * Resolves paths for agent execution with 3-tier override system:
 * 1. AgentInstance settings (path_override) - highest priority
 * 2. System paths config (paths.json)
 * 3. Manifest defaults (agents.json)
 *
 * Path settings in agents.json use $ref to pathSettings which define:
 * - key: the settings key (e.g., "sourceDir")
 * - pathRef: reference to paths.json (e.g., "sources.knowledge")
 * - label/description: for UI
 */

interface PathSetting {
  key: string;
  pathRef: string;
  label: string;
  description?: string;
}

interface AgentSettings {
  [key: string]: unknown;
}

interface AgentManifest {
  pathSettings?: Record<string, PathSetting>;
  agents?: Array<{
    id: string;
    settings?: AgentSettings;
    settingsSchema?: {
      properties?: Record<string, { $ref?: string }>;
    };
  }>;
}

// Cache manifest
let cachedManifest: AgentManifest | null = null;

/**
 * Load agents manifest
 */
function loadManifest(): AgentManifest {
  if (cachedManifest) return cachedManifest;

  const cwd = process.cwd();
  const manifestPath = path.resolve(cwd, "../../lib/agents.json");

  if (!fs.existsSync(manifestPath)) {
    console.warn(`[AgentPaths] Manifest not found: ${manifestPath}`);
    return { pathSettings: {}, agents: [] };
  }

  const content = fs.readFileSync(manifestPath, "utf-8");
  cachedManifest = JSON.parse(content);
  return cachedManifest!;
}

/**
 * Get the path settings definitions from manifest
 */
export function getPathSettings(): Record<string, PathSetting> {
  const manifest = loadManifest();
  return manifest.pathSettings || {};
}

/**
 * Resolve a pathRef (e.g., "sources.knowledge") to an absolute path
 */
function resolvePathRef(pathRef: string): string | null {
  const resolved = getResolvedPaths();
  const parts = pathRef.split(".");

  if (parts.length !== 2) {
    console.warn(`[AgentPaths] Invalid pathRef: ${pathRef}`);
    return null;
  }

  const [category, key] = parts;
  const categoryPaths = resolved[category as keyof typeof resolved];

  if (!categoryPaths || typeof categoryPaths !== "object") {
    console.warn(`[AgentPaths] Unknown path category: ${category}`);
    return null;
  }

  return (categoryPaths as Record<string, string>)[key] || null;
}

/**
 * Get the default path for a path setting key
 */
export function getDefaultPathForSetting(settingRef: string): string | null {
  // settingRef is like "#/settings/knowledgeSourceDir" or just "knowledgeSourceDir"
  const key = settingRef.replace(/^#\/settings\//, "");
  const pathSettings = getPathSettings();
  const setting = pathSettings[key];

  if (!setting) {
    return null;
  }

  return resolvePathRef(setting.pathRef);
}

/**
 * Resolve all path settings for an agent
 *
 * @param agentId - The agent ID from manifest
 * @param instanceSettings - Settings from AgentInstance (may contain overrides)
 * @returns Merged settings with resolved paths
 */
export function resolveAgentPaths(
  agentId: string,
  instanceSettings: AgentSettings = {}
): AgentSettings {
  const manifest = loadManifest();
  const pathSettings = manifest.pathSettings || {};

  // Find the agent in manifest
  const agentDef = manifest.agents?.find((a) => a.id === agentId);
  if (!agentDef) {
    console.warn(`[AgentPaths] Agent not found in manifest: ${agentId}`);
    return instanceSettings;
  }

  // Start with manifest defaults
  const resolvedSettings: AgentSettings = { ...(agentDef.settings || {}) };

  // Get schema to find which settings are path references
  const schema = agentDef.settingsSchema;
  const properties = schema?.properties || {};

  // For each property that has a $ref to pathSettings, resolve the default
  for (const [propKey, propDef] of Object.entries(properties)) {
    if (propDef.$ref) {
      const settingKey = propDef.$ref.replace(/^#\/settings\//, "");
      const pathSetting = pathSettings[settingKey];

      if (pathSetting) {
        // Resolve the system default from paths.json
        const systemPath = resolvePathRef(pathSetting.pathRef);
        if (systemPath) {
          resolvedSettings[propKey] = systemPath;
        }
      }
    }
  }

  // Apply instance overrides (highest priority)
  for (const [key, value] of Object.entries(instanceSettings)) {
    if (value !== undefined && value !== null && value !== "") {
      resolvedSettings[key] = value;
    }
  }

  return resolvedSettings;
}

/**
 * Get path override info for an agent (for UI display)
 *
 * Returns which paths are configurable and their current values
 */
export function getAgentPathInfo(
  agentId: string,
  instanceSettings: AgentSettings = {}
): Array<{
  key: string;
  label: string;
  description?: string;
  defaultPath: string | null;
  currentPath: string;
  isOverridden: boolean;
}> {
  const manifest = loadManifest();
  const pathSettings = manifest.pathSettings || {};

  const agentDef = manifest.agents?.find((a) => a.id === agentId);
  if (!agentDef) {
    return [];
  }

  const schema = agentDef.settingsSchema;
  const properties = schema?.properties || {};
  const result: Array<{
    key: string;
    label: string;
    description?: string;
    defaultPath: string | null;
    currentPath: string;
    isOverridden: boolean;
  }> = [];

  for (const [propKey, propDef] of Object.entries(properties)) {
    if (propDef.$ref) {
      const settingKey = propDef.$ref.replace(/^#\/settings\//, "");
      const pathSetting = pathSettings[settingKey];

      if (pathSetting) {
        const defaultPath = resolvePathRef(pathSetting.pathRef);
        const instanceOverride = instanceSettings[propKey] as string | undefined;
        const currentPath = instanceOverride || defaultPath || "";

        result.push({
          key: propKey,
          label: pathSetting.label,
          description: pathSetting.description,
          defaultPath,
          currentPath,
          isOverridden: !!instanceOverride && instanceOverride !== defaultPath,
        });
      }
    }
  }

  return result;
}

/**
 * Clear cached manifest (for testing or hot reload)
 */
export function clearAgentPathsCache(): void {
  cachedManifest = null;
}
