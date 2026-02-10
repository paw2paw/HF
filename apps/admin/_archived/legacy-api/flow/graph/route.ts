import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";

interface Resource {
  type: "table" | "path";
  table?: string;
  path?: string;
  link?: string;
  label?: string;
}

interface EdgeConnection {
  node: string;
  edgeType: "solid" | "dashed";
  label?: string;
}

// Unified data node definition (replaces separate sources/outputs)
interface DataDef {
  id: string;
  label: string;
  storageType: "table" | "path";
  table?: string;
  path?: string;
  role: "source" | "output" | "both";
  resources?: Resource[];
}

interface AgentDef {
  id: string;
  agentId: string;
  title: string;
  description?: string;
  enabled?: boolean;
  opid?: string;
  inputs?: EdgeConnection[];
  outputs?: EdgeConnection[];
  resources?: Resource[];
  settings?: Record<string, unknown>;
  settingsSchema?: Record<string, unknown>;
}

interface LayoutDef {
  columns?: Record<string, number>;
  defaultPositions?: Record<string, { x: number; y: number }>;
}

interface GroupDef {
  id: string;
  label: string;
  description?: string;
  color?: string;
  members: string[];
  collapsed?: boolean;
}

interface AgentsManifest {
  version: number;
  groups?: GroupDef[];
  data?: DataDef[];
  agents?: AgentDef[];
  layout?: LayoutDef;
}

interface FlowNode {
  id: string;
  type: "data" | "agent" | "group";
  position: { x: number; y: number };
  parentId?: string; // For grouping - nodes inside a group have this set
  extent?: "parent"; // When set to "parent", node is constrained to parent bounds
  data: {
    label: string;
    // Data node properties
    storageType?: "table" | "path";
    table?: string;
    path?: string;
    role?: "source" | "output" | "both";
    // Agent node properties
    agentId?: string;
    description?: string;
    enabled?: boolean;
    opid?: string;
    resources?: Resource[];
    settings?: Record<string, unknown>;
    settingsSchema?: Record<string, unknown>;
    // Group properties
    groupId?: string;
    groupColor?: string;
    groupLabel?: string;
  };
  style?: Record<string, unknown>;
}

interface FlowEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
  animated?: boolean;
  style?: {
    strokeDasharray?: string;
    stroke?: string;
  };
  label?: string;
}

function loadAgentsManifest(): AgentsManifest {
  // Path to lib/agents.json relative to the admin app
  const manifestPath = path.resolve(process.cwd(), "../../lib/agents.json");

  if (!fs.existsSync(manifestPath)) {
    console.error(`Agents manifest not found at: ${manifestPath}`);
    return { version: 1 };
  }

  const content = fs.readFileSync(manifestPath, "utf-8");
  return JSON.parse(content);
}

function computeGraph(manifest: AgentsManifest): { nodes: FlowNode[]; edges: FlowEdge[]; groups: GroupDef[] } {
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];
  const edgeIds = new Set<string>(); // Track created edge IDs to prevent duplicates
  const positions = manifest.layout?.defaultPositions || {};
  const groups = manifest.groups || [];

  // Build node -> group lookup
  const nodeToGroup = new Map<string, GroupDef>();
  for (const group of groups) {
    for (const memberId of group.members) {
      nodeToGroup.set(memberId, group);
    }
  }

  // Default position offset tracking
  let sourceYOffset = 0;
  let outputYOffset = 0;

  // Add unified data nodes
  for (const dataNode of manifest.data || []) {
    // Determine default position based on role
    let defaultPos: { x: number; y: number };
    if (dataNode.role === "source") {
      defaultPos = { x: 50, y: sourceYOffset };
      sourceYOffset += 120;
    } else if (dataNode.role === "output") {
      defaultPos = { x: 740, y: outputYOffset };
      outputYOffset += 80;
    } else {
      // role === "both" - position depends on context, use stored position
      defaultPos = { x: 400, y: sourceYOffset };
      sourceYOffset += 100;
    }

    const pos = positions[dataNode.id] || defaultPos;

    nodes.push({
      id: dataNode.id,
      type: "data",
      position: pos,
      data: {
        label: dataNode.label,
        storageType: dataNode.storageType,
        table: dataNode.table,
        path: dataNode.path,
        role: dataNode.role,
        resources: dataNode.resources,
      },
    });
  }

  // Add agent nodes
  let agentYOffset = 0;
  for (const agent of manifest.agents || []) {
    const nodeId = `agent:${agent.id}`;
    const pos = positions[nodeId] || { x: 280, y: agentYOffset };
    agentYOffset += 100;

    // Check if this agent belongs to a group
    const group = nodeToGroup.get(nodeId);

    nodes.push({
      id: nodeId,
      type: "agent",
      position: pos,
      data: {
        label: agent.title,
        agentId: agent.agentId || agent.id,
        description: agent.description,
        enabled: agent.enabled ?? true,
        opid: agent.opid,
        resources: agent.resources,
        settings: agent.settings,
        settingsSchema: agent.settingsSchema,
        // Group info (if this agent belongs to a group)
        groupId: group?.id,
        groupColor: group?.color,
        groupLabel: group?.label,
      },
    });

    // Create edges from inputs
    for (const input of agent.inputs || []) {
      const sourceId = input.node;
      const targetId = nodeId;
      const edgeId = `${sourceId}->${targetId}`;

      // Skip if this edge already exists
      if (edgeIds.has(edgeId)) continue;
      edgeIds.add(edgeId);

      edges.push({
        id: edgeId,
        source: sourceId,
        target: targetId,
        animated: input.edgeType === "dashed",
        style: input.edgeType === "dashed"
          ? { strokeDasharray: "5,5", stroke: "#9ca3af" }
          : undefined,
        label: input.label,
      });
    }

    // Create edges to outputs
    for (const output of agent.outputs || []) {
      const sourceId = nodeId;
      const targetId = output.node;
      const edgeId = `${sourceId}->${targetId}`;

      // Skip if this edge already exists
      if (edgeIds.has(edgeId)) continue;
      edgeIds.add(edgeId);

      edges.push({
        id: edgeId,
        source: sourceId,
        target: targetId,
        animated: output.edgeType === "dashed",
        style: output.edgeType === "dashed"
          ? { strokeDasharray: "5,5", stroke: "#9ca3af" }
          : undefined,
        label: output.label,
      });
    }
  }

  return { nodes, edges, groups };
}

/**
 * GET /api/flow/graph
 *
 * Returns React Flow nodes and edges computed from agents.json manifest.
 */
export async function GET() {
  try {
    const manifest = loadAgentsManifest();

    if (manifest.version < 3) {
      return NextResponse.json({
        ok: false,
        error: "agents.json must be version 3 or higher for flow graph generation (unified data nodes)",
      }, { status: 400 });
    }

    const { nodes, edges, groups } = computeGraph(manifest);

    // Count data nodes by role
    const dataNodes = manifest.data || [];
    const sourceCount = dataNodes.filter(d => d.role === "source" || d.role === "both").length;
    const outputCount = dataNodes.filter(d => d.role === "output" || d.role === "both").length;

    return NextResponse.json({
      ok: true,
      nodes,
      edges,
      groups,
      layout: manifest.layout,
      meta: {
        version: manifest.version,
        dataCount: dataNodes.length,
        sourceCount,
        outputCount,
        agentCount: manifest.agents?.length || 0,
        edgeCount: edges.length,
        groupCount: groups.length,
      },
    });
  } catch (err: any) {
    console.error("[Flow Graph Error]", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to generate flow graph" },
      { status: 500 }
    );
  }
}
