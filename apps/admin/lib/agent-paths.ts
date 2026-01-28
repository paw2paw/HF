import {
  loadManifest as loadDataManifest,
  getAgentPaths as getAgentDataPaths,
  resolveDataNodePath,
  getKbRoot,
  clearManifestCache
} from "./data-paths";

/**
 * Agent Path Resolution
 *
 * Uses unified data-paths.ts system for path resolution.
 * All paths are defined in agents.json data nodes.
 *
 * Legacy 3-tier system replaced with:
 * 1. AgentInstance settings (path_override) - highest priority
 * 2. Data node definitions in agents.json manifest
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

/**
 * Load agents manifest (delegates to data-paths)
 */
function loadManifest(): AgentManifest {
  const manifest = loadDataManifest();
  if (!manifest) {
    return { pathSettings: {}, agents: [] };
  }
  // Cast to local AgentManifest type (compatible subset)
  return manifest as unknown as AgentManifest;
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
 * Maps legacy pathRef format to data node IDs
 */
function resolvePathRef(pathRef: string): string | null {
  const parts = pathRef.split(".");

  if (parts.length !== 2) {
    console.warn(`[AgentPaths] Invalid pathRef: ${pathRef}`);
    return null;
  }

  const [category, key] = parts;

  // Map legacy pathRef format to data node IDs
  // e.g., "sources.knowledge" -> "data:knowledge"
  // e.g., "sources.transcripts" -> "data:transcripts"
  // e.g., "derived.knowledge" -> "data:knowledge_derived"
  let nodeId: string;
  if (category === "sources") {
    nodeId = `data:${key}`;
  } else if (category === "derived") {
    nodeId = `data:${key}_derived`;
  } else {
    console.warn(`[AgentPaths] Unknown path category: ${category}`);
    return null;
  }

  return resolveDataNodePath(nodeId);
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
  clearManifestCache();
}
