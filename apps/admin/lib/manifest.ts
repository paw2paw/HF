import fs from "node:fs";
import path from "node:path";

/**
 * Manifest Manager Utility
 *
 * Handles CRUD operations, validation, and sync for agents.json manifest.
 */

export interface PathSetting {
  key: string;
  pathRef: string;
  label: string;
  description?: string;
}

export interface AgentGroup {
  id: string;
  label: string;
  description?: string;
  color?: string;
  members: string[];
  collapsed?: boolean;
}

export interface DataNode {
  id: string;
  label: string;
  storageType: "path" | "table";
  path?: string;
  table?: string;
  role: "source" | "output" | "both";
  resources?: Array<{
    type: "path" | "table";
    path?: string;
    table?: string;
    link?: string;
    label: string;
  }>;
}

export interface AgentInput {
  node: string;
  edgeType: "solid" | "dashed";
  label?: string;
}

export interface AgentOutput {
  node: string;
  edgeType: "solid" | "dashed";
  label?: string;
}

export interface AgentDefinition {
  id: string;
  agentId?: string;
  title: string;
  description?: string;
  enabled: boolean;
  opid: string;
  inputs?: AgentInput[];
  outputs?: AgentOutput[];
  resources?: Array<{
    type: "path" | "table";
    path?: string;
    table?: string;
    link?: string;
    label: string;
  }>;
  settings?: Record<string, unknown>;
  settingsSchema?: {
    type: string;
    properties?: Record<string, unknown>;
  };
  prompts?: Record<string, unknown>;
  prerequisites?: Array<{
    type: "table" | "path";
    table?: string;
    path?: string;
    min: number;
    required?: boolean;
    message?: string;
  }>;
}

export interface AgentManifest {
  version: number;
  pathSettings: Record<string, PathSetting>;
  groups: AgentGroup[];
  data: DataNode[];
  agents: AgentDefinition[];
  layout?: {
    positions?: Record<string, { x: number; y: number }>;
  };
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    agents: number;
    groups: number;
    dataNodes: number;
    pathSettings: number;
  };
}

// Cache for manifest
let cachedManifest: AgentManifest | null = null;
let cachedMtime: number = 0;

/**
 * Get the manifest file path
 */
export function getManifestPath(): string {
  const cwd = process.cwd();
  return path.resolve(cwd, "../../lib/agents.json");
}

/**
 * Load the manifest (with caching)
 */
export function loadManifest(forceReload = false): AgentManifest {
  const manifestPath = getManifestPath();

  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest not found: ${manifestPath}`);
  }

  const stat = fs.statSync(manifestPath);
  const mtime = stat.mtimeMs;

  // Return cached if not modified
  if (!forceReload && cachedManifest && mtime === cachedMtime) {
    return cachedManifest;
  }

  const content = fs.readFileSync(manifestPath, "utf-8");
  cachedManifest = JSON.parse(content);
  cachedMtime = mtime;

  return cachedManifest!;
}

/**
 * Save the manifest
 */
export function saveManifest(manifest: AgentManifest): void {
  const manifestPath = getManifestPath();

  // Backup current
  const backupPath = manifestPath + ".bak";
  if (fs.existsSync(manifestPath)) {
    fs.copyFileSync(manifestPath, backupPath);
  }

  // Write new
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  // Clear cache
  cachedManifest = null;
  cachedMtime = 0;
}

/**
 * Validate the manifest structure
 */
export function validateManifest(manifest: AgentManifest): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check version
  if (typeof manifest.version !== "number") {
    errors.push("Missing or invalid version number");
  }

  // Collect all IDs for reference checking
  const agentIds = new Set(manifest.agents?.map((a) => a.id) || []);
  const dataIds = new Set(manifest.data?.map((d) => d.id) || []);
  const pathSettingKeys = new Set(Object.keys(manifest.pathSettings || {}));
  const groupIds = new Set(manifest.groups?.map((g) => g.id) || []);

  // Validate pathSettings
  for (const [key, setting] of Object.entries(manifest.pathSettings || {})) {
    if (!setting.key) {
      errors.push(`pathSettings.${key}: missing 'key' field`);
    }
    if (!setting.pathRef) {
      errors.push(`pathSettings.${key}: missing 'pathRef' field`);
    }
    if (!setting.label) {
      warnings.push(`pathSettings.${key}: missing 'label' field`);
    }
  }

  // Validate groups
  for (const group of manifest.groups || []) {
    if (!group.id) {
      errors.push("Group missing 'id' field");
    }
    if (!group.label) {
      warnings.push(`Group ${group.id}: missing 'label' field`);
    }
    for (const member of group.members || []) {
      // Members should reference agent:xxx or data:xxx
      const [type, id] = member.split(":");
      if (type === "agent" && !agentIds.has(id)) {
        warnings.push(`Group ${group.id}: member '${member}' references unknown agent`);
      }
      if (type === "data" && !dataIds.has(member)) {
        warnings.push(`Group ${group.id}: member '${member}' references unknown data node`);
      }
    }
  }

  // Validate data nodes
  for (const node of manifest.data || []) {
    if (!node.id) {
      errors.push("Data node missing 'id' field");
    }
    if (!node.label) {
      warnings.push(`Data node ${node.id}: missing 'label' field`);
    }
    if (!node.storageType) {
      errors.push(`Data node ${node.id}: missing 'storageType' field`);
    }
    if (node.storageType === "path" && !node.path) {
      warnings.push(`Data node ${node.id}: storageType is 'path' but no path specified`);
    }
    if (node.storageType === "table" && !node.table) {
      warnings.push(`Data node ${node.id}: storageType is 'table' but no table specified`);
    }
  }

  // Validate agents
  for (const agent of manifest.agents || []) {
    if (!agent.id) {
      errors.push("Agent missing 'id' field");
    }
    if (!agent.title) {
      warnings.push(`Agent ${agent.id}: missing 'title' field`);
    }
    if (!agent.opid) {
      errors.push(`Agent ${agent.id}: missing 'opid' field`);
    }

    // Check input/output references
    for (const input of agent.inputs || []) {
      if (!dataIds.has(input.node) && !agentIds.has(input.node.replace("agent:", ""))) {
        warnings.push(`Agent ${agent.id}: input '${input.node}' references unknown node`);
      }
    }
    for (const output of agent.outputs || []) {
      if (!dataIds.has(output.node) && !agentIds.has(output.node.replace("agent:", ""))) {
        warnings.push(`Agent ${agent.id}: output '${output.node}' references unknown node`);
      }
    }

    // Check settingsSchema $ref references
    const properties = agent.settingsSchema?.properties || {};
    for (const [propKey, propDef] of Object.entries(properties)) {
      const def = propDef as { $ref?: string };
      if (def.$ref) {
        const refKey = def.$ref.replace("#/settings/", "");
        if (!pathSettingKeys.has(refKey)) {
          errors.push(
            `Agent ${agent.id}: settingsSchema.${propKey}.$ref '${def.$ref}' references unknown pathSetting`
          );
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: {
      agents: agentIds.size,
      groups: groupIds.size,
      dataNodes: dataIds.size,
      pathSettings: pathSettingKeys.size,
    },
  };
}

/**
 * Get an agent by ID
 */
export function getAgent(agentId: string): AgentDefinition | null {
  const manifest = loadManifest();
  return manifest.agents?.find((a) => a.id === agentId) || null;
}

/**
 * Update an agent definition
 */
export function updateAgent(agentId: string, updates: Partial<AgentDefinition>): AgentDefinition {
  const manifest = loadManifest(true);
  const index = manifest.agents?.findIndex((a) => a.id === agentId) ?? -1;

  if (index === -1) {
    throw new Error(`Agent not found: ${agentId}`);
  }

  const updated = { ...manifest.agents[index], ...updates };
  manifest.agents[index] = updated;
  manifest.version += 1;

  saveManifest(manifest);
  return updated;
}

/**
 * Add a new agent definition
 */
export function addAgent(agent: AgentDefinition): AgentDefinition {
  const manifest = loadManifest(true);

  // Check for duplicate
  if (manifest.agents?.some((a) => a.id === agent.id)) {
    throw new Error(`Agent already exists: ${agent.id}`);
  }

  manifest.agents = manifest.agents || [];
  manifest.agents.push(agent);
  manifest.version += 1;

  saveManifest(manifest);
  return agent;
}

/**
 * Remove an agent definition
 */
export function removeAgent(agentId: string): boolean {
  const manifest = loadManifest(true);
  const index = manifest.agents?.findIndex((a) => a.id === agentId) ?? -1;

  if (index === -1) {
    return false;
  }

  manifest.agents.splice(index, 1);

  // Also remove from any groups
  for (const group of manifest.groups || []) {
    group.members = group.members.filter((m) => m !== `agent:${agentId}`);
  }

  manifest.version += 1;
  saveManifest(manifest);
  return true;
}

/**
 * Add or update a path setting
 */
export function upsertPathSetting(key: string, setting: PathSetting): PathSetting {
  const manifest = loadManifest(true);
  manifest.pathSettings = manifest.pathSettings || {};
  manifest.pathSettings[key] = setting;
  manifest.version += 1;
  saveManifest(manifest);
  return setting;
}

/**
 * Remove a path setting
 */
export function removePathSetting(key: string): boolean {
  const manifest = loadManifest(true);
  if (!manifest.pathSettings?.[key]) {
    return false;
  }
  delete manifest.pathSettings[key];
  manifest.version += 1;
  saveManifest(manifest);
  return true;
}

/**
 * Add or update a data node
 */
export function upsertDataNode(node: DataNode): DataNode {
  const manifest = loadManifest(true);
  manifest.data = manifest.data || [];

  const index = manifest.data.findIndex((d) => d.id === node.id);
  if (index === -1) {
    manifest.data.push(node);
  } else {
    manifest.data[index] = node;
  }

  manifest.version += 1;
  saveManifest(manifest);
  return node;
}

/**
 * Add or update a group
 */
export function upsertGroup(group: AgentGroup): AgentGroup {
  const manifest = loadManifest(true);
  manifest.groups = manifest.groups || [];

  const index = manifest.groups.findIndex((g) => g.id === group.id);
  if (index === -1) {
    manifest.groups.push(group);
  } else {
    manifest.groups[index] = group;
  }

  manifest.version += 1;
  saveManifest(manifest);
  return group;
}

/**
 * Clear the manifest cache
 */
export function clearManifestCache(): void {
  cachedManifest = null;
  cachedMtime = 0;
}
