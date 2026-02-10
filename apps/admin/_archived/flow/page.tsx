"use client";

import { useCallback, useEffect, useState } from "react";
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  MarkerType,
  BackgroundVariant,
} from "reactflow";
import "reactflow/dist/style.css";

import { DataNode } from "./components/nodes/DataNode";
import { AgentNode } from "./components/nodes/AgentNode";
import { EditableEdge, loadSavedWaypoints, clearSavedWaypoints } from "./components/edges/EditableEdge";
import { NodeDetailPanel } from "./components/panels/NodeDetailPanel";
import type { FlowStatus, NodeStats } from "@/lib/flow/status-manifest";

// Custom node types - unified "data" type replaces source/output
const nodeTypes = {
  data: DataNode,
  agent: AgentNode,
};

// Custom edge types
const edgeTypes = {
  editable: EditableEdge,
};

// Colors
const colors = {
  // Data node role colors
  source: "#3b82f6", // blue - data sources
  output: "#14b8a6", // teal - data outputs
  both: "#8b5cf6", // purple - data that is both input and output
  // Agent colors
  agent: "#8b5cf6", // purple
  agentPublished: "#10b981", // green
  // Edge colors
  edge: "#94a3b8", // slate
  edgeActive: "#8b5cf6", // purple when running
};

type AgentStatus = {
  agentId: string;
  status: "idle" | "running" | "success" | "error";
  isPublished: boolean;
  hasDraft: boolean;
  version?: string;
  lastRunAt?: string;
};

// localStorage key for persisting node positions
const LAYOUT_STORAGE_KEY = "hf-flow-layout";

// Apply saved positions from localStorage to nodes
function applySavedPositions(nodes: Node[]): Node[] {
  if (typeof window === "undefined") return nodes;

  try {
    const saved = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!saved) return nodes;

    const savedPositions: Record<string, { x: number; y: number }> = JSON.parse(saved);

    return nodes.map((node) => {
      const savedPos = savedPositions[node.id];
      if (savedPos) {
        return { ...node, position: savedPos };
      }
      return node;
    });
  } catch {
    return nodes;
  }
}

type GroupDef = {
  id: string;
  label: string;
  description?: string;
  color?: string;
  members: string[];
  collapsed?: boolean;
};

export default function FlowPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentStatus>>({});
  const [flowStatus, setFlowStatus] = useState<FlowStatus | null>(null);
  const [groups, setGroups] = useState<GroupDef[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [graphLoaded, setGraphLoaded] = useState(false);
  const [defaultNodes, setDefaultNodes] = useState<Node[]>([]);

  // Fetch graph from API on mount
  useEffect(() => {
    async function fetchGraph() {
      try {
        const res = await fetch("/api/flow/graph");
        const data = await res.json();

        if (data.ok && data.nodes && data.edges) {
          // Load saved waypoints from localStorage
          const savedWaypoints = loadSavedWaypoints();

          // Add MarkerType and custom edge type to edges from API
          const edgesWithMarkers: Edge[] = data.edges.map((edge: Edge) => ({
            ...edge,
            type: "editable",
            markerEnd: { type: MarkerType.ArrowClosed },
            data: {
              ...edge.data,
              waypoints: savedWaypoints[edge.id] || [],
              label: edge.label,
            },
          }));

          // Store default nodes for reset functionality
          setDefaultNodes(data.nodes);

          // Apply saved positions from localStorage
          const nodesWithSavedPositions = applySavedPositions(data.nodes);

          setNodes(nodesWithSavedPositions);
          setEdges(edgesWithMarkers);
          setGroups(data.groups || []);
          setGraphLoaded(true);
        } else {
          console.error("[Flow Graph] Error:", data.error);
        }
      } catch (err) {
        console.error("[Flow Graph] Failed to fetch:", err);
      }
    }

    fetchGraph();
  }, [setNodes, setEdges]);

  // Save layout to localStorage when nodes change position
  const handleNodesChange = useCallback(
    (changes: any) => {
      onNodesChange(changes);

      // Debounced save - only save position changes
      const hasPositionChange = changes.some(
        (c: any) => c.type === "position" && c.position
      );
      if (hasPositionChange) {
        // Use setTimeout to batch saves
        setTimeout(() => {
          const positions: Record<string, { x: number; y: number }> = {};
          // Get current nodes from the setter function to avoid stale closure
          setNodes((currentNodes) => {
            currentNodes.forEach((node) => {
              positions[node.id] = node.position;
            });
            try {
              localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(positions));
            } catch {
              // localStorage might be full or disabled
            }
            return currentNodes; // return unchanged
          });
        }, 100);
      }
    },
    [onNodesChange, setNodes]
  );

  // Fetch flow status (source node stats)
  const fetchFlowStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/flow/status");
      if (!res.ok) {
        console.error("[Flow Status] HTTP error:", res.status);
        return;
      }
      const text = await res.text();
      if (!text) {
        console.error("[Flow Status] Empty response");
        return;
      }
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        console.error("[Flow Status] JSON parse error:", parseErr, "Response:", text.slice(0, 200));
        return;
      }
      if (data.ok && data.nodes) {
        setFlowStatus(data);

        // Update data nodes with status data
        setNodes((nds) =>
          nds.map((node) => {
            if (node.type === "data") {
              const nodeStats = data.nodes[node.id] as NodeStats | undefined;
              if (nodeStats) {
                return {
                  ...node,
                  data: {
                    ...node.data,
                    ragStatus: nodeStats.status,
                    statusLabel: nodeStats.statusLabel,
                    stats: nodeStats,
                  },
                };
              }
            }
            return node;
          })
        );
      }
    } catch (err) {
      console.error("Failed to fetch flow status:", err);
    }
  }, [setNodes]);

  // Fetch preflight status for all agent nodes
  const fetchPreflightStatuses = useCallback(async (agentIds: string[]) => {
    const preflightResults: Record<string, { canRun: boolean; hasWarnings: boolean }> = {};

    await Promise.all(
      agentIds.map(async (agentId) => {
        try {
          const res = await fetch(`/api/agents/${agentId}/preflight`);
          const data = await res.json();
          if (data.ok) {
            preflightResults[agentId] = {
              canRun: data.canRun,
              hasWarnings: data.hasWarnings,
            };
          }
        } catch (err) {
          // If preflight fails, assume can run (fail open)
          console.error(`Failed to fetch preflight for ${agentId}:`, err);
        }
      })
    );

    // Update nodes with preflight data
    setNodes((nds) =>
      nds.map((node) => {
        if (node.type === "agent" && node.data.agentId) {
          const preflight = preflightResults[node.data.agentId];
          if (preflight) {
            return {
              ...node,
              data: {
                ...node.data,
                preflight,
              },
            };
          }
        }
        return node;
      })
    );
  }, [setNodes]);

  // Fetch agent statuses on mount
  useEffect(() => {
    async function fetchAgents() {
      try {
        const res = await fetch("/api/agents");
        const data = await res.json();
        if (data.ok && data.agents) {
          const statuses: Record<string, AgentStatus> = {};
          const agentIds: string[] = [];
          for (const agent of data.agents) {
            statuses[agent.agentId] = {
              agentId: agent.agentId,
              status: "idle",
              isPublished: agent.instance?.status === "PUBLISHED",
              hasDraft: agent.instance?.hasDraft ?? false,
              version: agent.instance?.version,
            };
            agentIds.push(agent.agentId);
          }
          setAgentStatuses(statuses);

          // Update node data with agent info
          setNodes((nds) =>
            nds.map((node) => {
              if (node.type === "agent" && node.data.agentId) {
                const status = statuses[node.data.agentId];
                if (status) {
                  return {
                    ...node,
                    data: {
                      ...node.data,
                      isPublished: status.isPublished,
                      hasDraft: status.hasDraft,
                      version: status.version,
                    },
                  };
                }
              }
              return node;
            })
          );

          // Fetch preflight status for all agents
          fetchPreflightStatuses(agentIds);
        }
      } catch (err) {
        console.error("Failed to fetch agents:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchAgents();
    fetchFlowStatus();
  }, [setNodes, fetchFlowStatus, fetchPreflightStatuses]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const runAgent = useCallback(
    async (agentId: string, settings?: Record<string, any>) => {
      // Update node status to running
      setNodes((nds) =>
        nds.map((node) => {
          if (node.type === "agent" && node.data.agentId === agentId) {
            return { ...node, data: { ...node.data, status: "running" } };
          }
          return node;
        })
      );

      try {
        const res = await fetch("/api/agents/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentId, settings }),
        });
        const data = await res.json();

        // Update node status based on result
        setNodes((nds) =>
          nds.map((node) => {
            if (node.type === "agent" && node.data.agentId === agentId) {
              return {
                ...node,
                data: {
                  ...node.data,
                  status: data.ok ? "success" : "error",
                  lastRunAt: new Date().toISOString(),
                },
              };
            }
            return node;
          })
        );

        // Refresh flow status after agent run
        await fetchFlowStatus();

        // Reset status after 3 seconds
        setTimeout(() => {
          setNodes((nds) =>
            nds.map((node) => {
              if (node.type === "agent" && node.data.agentId === agentId) {
                return { ...node, data: { ...node.data, status: "idle" } };
              }
              return node;
            })
          );
        }, 3000);

        return data;
      } catch (err) {
        setNodes((nds) =>
          nds.map((node) => {
            if (node.type === "agent" && node.data.agentId === agentId) {
              return { ...node, data: { ...node.data, status: "error" } };
            }
            return node;
          })
        );
      }
    },
    [setNodes, fetchFlowStatus]
  );

  const runAllAgents = useCallback(async () => {
    const agentNodes = nodes.filter((n) => n.type === "agent");
    for (const node of agentNodes) {
      if (node.data.agentId) {
        await runAgent(node.data.agentId);
        // Small delay between agents
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  }, [nodes, runAgent]);

  // Refresh button handler
  const handleRefresh = useCallback(() => {
    fetchFlowStatus();
  }, [fetchFlowStatus]);

  return (
    <div style={{ width: "100%", height: "calc(100vh - 64px)", display: "flex" }}>
      {/* Flow Canvas */}
      <div style={{ flex: 1, position: "relative" }}>
        {/* Header */}
        <div
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            zIndex: 10,
            background: "white",
            padding: "12px 20px",
            borderRadius: 8,
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Pipeline Flow</h1>
              <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>
                Click nodes to view details. Drag to rearrange.
              </p>
            </div>
            <button
              onClick={handleRefresh}
              style={{
                padding: "8px 12px",
                background: "#f3f4f6",
                color: "#374151",
                border: "1px solid #e5e7eb",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Refresh
            </button>
            <button
              onClick={runAllAgents}
              style={{
                padding: "8px 16px",
                background: "#7c3aed",
                color: "white",
                border: "none",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Run All
            </button>
            {/* Layout controls dropdown */}
            <div style={{ position: "relative" }}>
              <div style={{ display: "flex", gap: 4 }}>
                <button
                  onClick={() => {
                    // Distribute selected nodes (or all if none selected) vertically
                    setNodes((nds) => {
                      const sorted = [...nds].sort((a, b) => a.position.y - b.position.y);
                      if (sorted.length < 2) return nds;

                      const minY = sorted[0].position.y;
                      const maxY = sorted[sorted.length - 1].position.y;
                      const spacing = Math.max(80, (maxY - minY) / (sorted.length - 1));

                      const newPositions: Record<string, { x: number; y: number }> = {};
                      sorted.forEach((node, i) => {
                        newPositions[node.id] = { x: node.position.x, y: minY + i * spacing };
                      });

                      // Save to localStorage
                      const positions: Record<string, { x: number; y: number }> = {};
                      nds.forEach((node) => {
                        positions[node.id] = newPositions[node.id] || node.position;
                      });
                      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(positions));

                      return nds.map((node) => ({
                        ...node,
                        position: newPositions[node.id] || node.position,
                      }));
                    });
                  }}
                  title="Distribute nodes vertically with even spacing"
                  style={{
                    padding: "6px 10px",
                    background: "#f3f4f6",
                    color: "#374151",
                    border: "1px solid #d1d5db",
                    borderRadius: 6,
                    fontSize: 11,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="3" x2="12" y2="21" />
                    <line x1="8" y1="6" x2="16" y2="6" />
                    <line x1="8" y1="12" x2="16" y2="12" />
                    <line x1="8" y1="18" x2="16" y2="18" />
                  </svg>
                  V
                </button>
                <button
                  onClick={() => {
                    // Distribute nodes horizontally
                    setNodes((nds) => {
                      const sorted = [...nds].sort((a, b) => a.position.x - b.position.x);
                      if (sorted.length < 2) return nds;

                      const minX = sorted[0].position.x;
                      const maxX = sorted[sorted.length - 1].position.x;
                      const spacing = Math.max(180, (maxX - minX) / (sorted.length - 1));

                      const newPositions: Record<string, { x: number; y: number }> = {};
                      sorted.forEach((node, i) => {
                        newPositions[node.id] = { x: minX + i * spacing, y: node.position.y };
                      });

                      // Save to localStorage
                      const positions: Record<string, { x: number; y: number }> = {};
                      nds.forEach((node) => {
                        positions[node.id] = newPositions[node.id] || node.position;
                      });
                      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(positions));

                      return nds.map((node) => ({
                        ...node,
                        position: newPositions[node.id] || node.position,
                      }));
                    });
                  }}
                  title="Distribute nodes horizontally with even spacing"
                  style={{
                    padding: "6px 10px",
                    background: "#f3f4f6",
                    color: "#374151",
                    border: "1px solid #d1d5db",
                    borderRadius: 6,
                    fontSize: 11,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="6" y1="8" x2="6" y2="16" />
                    <line x1="12" y1="8" x2="12" y2="16" />
                    <line x1="18" y1="8" x2="18" y2="16" />
                  </svg>
                  H
                </button>
                <button
                  onClick={() => {
                    // Auto-layout: arrange by type/role in columns
                    setNodes((nds) => {
                      // Data nodes: filter by role
                      const sources = nds.filter((n) => n.type === "data" && n.data.role === "source");
                      const bothNodes = nds.filter((n) => n.type === "data" && n.data.role === "both");
                      const outputs = nds.filter((n) => n.type === "data" && n.data.role === "output");
                      const agents = nds.filter((n) => n.type === "agent");

                      const COL = { sources: 50, agents: 280, both: 560, outputs: 800 };
                      const ROW_HEIGHT = 100;

                      const newPositions: Record<string, { x: number; y: number }> = {};

                      sources.forEach((node, i) => {
                        newPositions[node.id] = { x: COL.sources, y: 50 + i * ROW_HEIGHT };
                      });
                      agents.forEach((node, i) => {
                        newPositions[node.id] = { x: COL.agents, y: 50 + i * ROW_HEIGHT };
                      });
                      bothNodes.forEach((node, i) => {
                        newPositions[node.id] = { x: COL.both, y: 50 + i * ROW_HEIGHT };
                      });
                      outputs.forEach((node, i) => {
                        newPositions[node.id] = { x: COL.outputs, y: 50 + i * ROW_HEIGHT };
                      });

                      // Save to localStorage
                      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(newPositions));

                      return nds.map((node) => ({
                        ...node,
                        position: newPositions[node.id] || node.position,
                      }));
                    });
                  }}
                  title="Auto-layout: arrange by type in columns"
                  style={{
                    padding: "6px 10px",
                    background: "#f3f4f6",
                    color: "#374151",
                    border: "1px solid #d1d5db",
                    borderRadius: 6,
                    fontSize: 11,
                    cursor: "pointer",
                  }}
                >
                  Auto
                </button>
              </div>
            </div>
            <button
              onClick={() => {
                // Clear node positions
                localStorage.removeItem(LAYOUT_STORAGE_KEY);
                // Clear edge waypoints
                clearSavedWaypoints();
                // Reset nodes to defaults
                if (defaultNodes.length > 0) {
                  setNodes(defaultNodes);
                }
                // Reset edges to remove waypoints
                setEdges((eds) =>
                  eds.map((edge) => ({
                    ...edge,
                    data: { ...edge.data, waypoints: [] },
                  }))
                );
              }}
              title="Reset to default layout (nodes and edge paths)"
              style={{
                padding: "8px 12px",
                background: "transparent",
                color: "#6b7280",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Reset
            </button>
          </div>
        </div>

        {/* Legend */}
        <div
          style={{
            position: "absolute",
            bottom: 16,
            left: 16,
            zIndex: 10,
            background: "white",
            padding: "12px 16px",
            borderRadius: 8,
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            fontSize: 11,
            color: "#1f2937",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 8, color: "#111827" }}>Legend</div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 12, height: 12, background: colors.source, borderRadius: 2 }} />
              <span style={{ color: "#374151" }}>Data Source</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 12, height: 12, background: colors.both, borderRadius: 2 }} />
              <span style={{ color: "#374151" }}>Data (In/Out)</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 12, height: 12, background: colors.output, borderRadius: 2 }} />
              <span style={{ color: "#374151" }}>Data Output</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 12, height: 12, background: colors.agent, borderRadius: 2 }} />
              <span style={{ color: "#374151" }}>Agent (Draft)</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 12, height: 12, background: colors.agentPublished, borderRadius: 2 }} />
              <span style={{ color: "#374151" }}>Agent (Live)</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 10, height: 10, background: "#ef4444", borderRadius: "50%" }} />
              <span style={{ color: "#374151" }}>Not Ready</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 10, height: 10, background: "#f59e0b", borderRadius: "50%" }} />
              <span style={{ color: "#374151" }}>In Progress</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 10, height: 10, background: "#10b981", borderRadius: "50%" }} />
              <span style={{ color: "#374151" }}>Ready</span>
            </div>
          </div>
          {/* Pipeline Groups */}
          {groups.length > 0 && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #e5e7eb" }}>
              <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 4 }}>Pipelines</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {groups.map((group) => (
                  <div
                    key={group.id}
                    style={{ display: "flex", alignItems: "center", gap: 4 }}
                    title={group.description}
                  >
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        background: group.color || "#6b7280",
                        borderRadius: 2,
                      }}
                    />
                    <span style={{ color: "#374151", fontSize: 10 }}>{group.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          defaultEdgeOptions={{
            type: "editable",
            style: { stroke: colors.edge, strokeWidth: 2 },
            animated: false,
          }}
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#e5e7eb" />
          <Controls />
        </ReactFlow>
      </div>

      {/* Detail Panel */}
      {selectedNode && (
        <NodeDetailPanel
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
          onRunAgent={runAgent}
        />
      )}
    </div>
  );
}
