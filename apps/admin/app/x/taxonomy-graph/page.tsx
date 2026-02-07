"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Network, Options, Data } from "vis-network/standalone";
import { entityColors } from "@/src/components/shared/uiColors";

// TODO: Add proper tagging system - we may want ubiquitous tagging across all entities
// When implemented, add "tag" back to NodeType
type NodeType = "spec" | "parameter" | "playbook" | "domain" | "trigger" | "action" | "anchor";

interface GraphNode {
  id: string;
  label: string;
  type: NodeType;
  slug?: string;
  group?: string;
  isOrphan?: boolean;
}

interface GraphEdge {
  from: string;
  to: string;
  type: string;
}

interface ApiResponse {
  ok: boolean;
  nodes: GraphNode[];
  edges: GraphEdge[];
  counts: {
    nodes: number;
    edges: number;
    byType?: Record<string, number>;
  };
  orphans?: {
    total: number;
    byType: Record<string, number>;
  };
  focus?: string;
  depth?: number;
}

type OrphanFilter = "all" | "connected" | "orphans";

// Color scheme matching entityColors from uiColors.ts
const nodeColors: Record<NodeType, { background: string; border: string; text: string }> = {
  spec: {
    background: entityColors.spec.bg,
    border: entityColors.spec.accent,
    text: entityColors.spec.text,
  },
  parameter: {
    // Use darker slate colors for visibility against light backgrounds
    background: "#cbd5e1", // slate-300 (more visible than slate-100)
    border: "#475569",     // slate-600 (stronger border)
    text: "#1e293b",       // slate-800
  },
  playbook: {
    background: entityColors.playbook.bg,
    border: entityColors.playbook.accent,
    text: entityColors.playbook.text,
  },
  domain: {
    background: entityColors.domain.bg,
    border: entityColors.domain.accent,
    text: entityColors.domain.text,
  },
  // Deeper level nodes
  trigger: {
    background: "#fef3c7", // amber-100
    border: "#f59e0b",     // amber-500
    text: "#92400e",       // amber-800
  },
  action: {
    background: "#dbeafe", // blue-100
    border: "#3b82f6",     // blue-500
    text: "#1e40af",       // blue-800
  },
  anchor: {
    background: "#fce7f3", // pink-100
    border: "#ec4899",     // pink-500
    text: "#9d174d",       // pink-800
  },
};

const nodeShapes: Record<NodeType, string> = {
  spec: "box",
  parameter: "ellipse",
  playbook: "diamond",
  domain: "hexagon",
  trigger: "dot",
  action: "square",
  anchor: "star",
};

const edgeColors: Record<string, string> = {
  measures: entityColors.spec.accent,
  uses: entityColors.parameter.accent,
  contains: entityColors.playbook.accent,
  belongs_to: entityColors.domain.accent,
  has_trigger: "#f59e0b",  // amber
  has_action: "#3b82f6",   // blue
  has_anchor: "#ec4899",   // pink
  targets: "#22c55e",      // green
};

// Context menu state
interface ContextMenuState {
  x: number;
  y: number;
  node: GraphNode;
}

export default function TaxonomyGraphPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<ApiResponse | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GraphNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [visibleTypes, setVisibleTypes] = useState<Set<NodeType>>(
    () => new Set<NodeType>(["spec", "parameter", "playbook", "domain", "trigger", "action", "anchor"])
  );
  const [orphanFilter, setOrphanFilter] = useState<OrphanFilter>("all");
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const focusParam = searchParams.get("focus");

  // Compute node statistics from edges (for hover tooltips)
  const getNodeStats = useCallback((nodeId: string): string => {
    if (!graphData) return "";

    const outgoing = graphData.edges.filter(e => e.from === nodeId);
    const incoming = graphData.edges.filter(e => e.to === nodeId);

    // Group by edge type
    const outTypes: Record<string, number> = {};
    const inTypes: Record<string, number> = {};

    outgoing.forEach(e => {
      outTypes[e.type] = (outTypes[e.type] || 0) + 1;
    });
    incoming.forEach(e => {
      inTypes[e.type] = (inTypes[e.type] || 0) + 1;
    });

    const stats: string[] = [];

    // Format outgoing connections
    if (outTypes.has_trigger) stats.push(`${outTypes.has_trigger} trigger${outTypes.has_trigger > 1 ? "s" : ""}`);
    if (outTypes.has_action) stats.push(`${outTypes.has_action} action${outTypes.has_action > 1 ? "s" : ""}`);
    if (outTypes.has_anchor) stats.push(`${outTypes.has_anchor} anchor${outTypes.has_anchor > 1 ? "s" : ""}`);
    if (outTypes.measures) stats.push(`measures ${outTypes.measures} param${outTypes.measures > 1 ? "s" : ""}`);
    if (outTypes.contains) stats.push(`contains ${outTypes.contains} spec${outTypes.contains > 1 ? "s" : ""}`);
    if (outTypes.targets) stats.push(`targets ${outTypes.targets} param${outTypes.targets > 1 ? "s" : ""}`);
    if (outTypes.belongs_to) stats.push(`in ${outTypes.belongs_to} domain${outTypes.belongs_to > 1 ? "s" : ""}`);

    // Format incoming connections
    if (inTypes.measures) stats.push(`used by ${inTypes.measures} spec${inTypes.measures > 1 ? "s" : ""}`);
    if (inTypes.contains) stats.push(`in ${inTypes.contains} playbook${inTypes.contains > 1 ? "s" : ""}`);
    if (inTypes.targets) stats.push(`targeted by ${inTypes.targets} action${inTypes.targets > 1 ? "s" : ""}`);

    return stats.length > 0 ? stats.join(" • ") : "No connections";
  }, [graphData]);

  // Close context menu on click outside
  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [contextMenu]);

  // Zoom/pan controls
  const zoomIn = useCallback(() => {
    if (networkRef.current) {
      const scale = networkRef.current.getScale();
      networkRef.current.moveTo({ scale: scale * 1.3, animation: { duration: 200, easingFunction: "easeInOutQuad" } });
    }
  }, []);

  const zoomOut = useCallback(() => {
    if (networkRef.current) {
      const scale = networkRef.current.getScale();
      networkRef.current.moveTo({ scale: scale / 1.3, animation: { duration: 200, easingFunction: "easeInOutQuad" } });
    }
  }, []);

  const fitToScreen = useCallback(() => {
    if (networkRef.current && containerRef.current) {
      // Force redraw to pick up container size
      networkRef.current.redraw();
      // Then fit with padding
      networkRef.current.fit({
        animation: { duration: 300, easingFunction: "easeInOutQuad" },
        maxZoomLevel: 1.5,
        minZoomLevel: 0.1,
      });
    }
  }, []);

  const panLeft = useCallback(() => {
    if (networkRef.current) {
      const pos = networkRef.current.getViewPosition();
      networkRef.current.moveTo({ position: { x: pos.x - 100, y: pos.y }, animation: { duration: 150, easingFunction: "easeInOutQuad" } });
    }
  }, []);

  const panRight = useCallback(() => {
    if (networkRef.current) {
      const pos = networkRef.current.getViewPosition();
      networkRef.current.moveTo({ position: { x: pos.x + 100, y: pos.y }, animation: { duration: 150, easingFunction: "easeInOutQuad" } });
    }
  }, []);

  const panUp = useCallback(() => {
    if (networkRef.current) {
      const pos = networkRef.current.getViewPosition();
      networkRef.current.moveTo({ position: { x: pos.x, y: pos.y - 100 }, animation: { duration: 150, easingFunction: "easeInOutQuad" } });
    }
  }, []);

  const panDown = useCallback(() => {
    if (networkRef.current) {
      const pos = networkRef.current.getViewPosition();
      networkRef.current.moveTo({ position: { x: pos.x, y: pos.y + 100 }, animation: { duration: 150, easingFunction: "easeInOutQuad" } });
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case "+":
        case "=":
          e.preventDefault();
          zoomIn();
          break;
        case "-":
        case "_":
          e.preventDefault();
          zoomOut();
          break;
        case "0":
          e.preventDefault();
          fitToScreen();
          break;
        case "ArrowLeft":
          e.preventDefault();
          panLeft();
          break;
        case "ArrowRight":
          e.preventDefault();
          panRight();
          break;
        case "ArrowUp":
          e.preventDefault();
          panUp();
          break;
        case "ArrowDown":
          e.preventDefault();
          panDown();
          break;
        case "Backspace":
          e.preventDefault();
          router.back();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [zoomIn, zoomOut, fitToScreen, panLeft, panRight, panUp, panDown, router]);

  // Handle container resize (debounced to prevent constant redraws)
  useEffect(() => {
    if (!containerRef.current) return;

    let resizeTimeout: NodeJS.Timeout | null = null;

    const resizeObserver = new ResizeObserver(() => {
      // Debounce resize events
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (networkRef.current) {
          networkRef.current.redraw();
        }
      }, 150);
    });

    resizeObserver.observe(containerRef.current);
    return () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeObserver.disconnect();
    };
  }, []);

  // Fetch graph data
  const fetchGraph = useCallback(async (focus?: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = focus
        ? `/api/taxonomy-graph?focus=${encodeURIComponent(focus)}&depth=2`
        : "/api/taxonomy-graph";
      const res = await fetch(url);
      const data: ApiResponse = await res.json();
      if (!data.ok) {
        throw new Error("Failed to load graph");
      }
      setGraphData(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load graph";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGraph(focusParam || undefined);
  }, [focusParam, fetchGraph]);

  // Initialize or update vis-network
  useEffect(() => {
    if (!containerRef.current || !graphData) return;

    // Filter nodes by visible types and orphan status
    const filteredNodes = graphData.nodes.filter((n) => {
      // Type filter
      if (!visibleTypes.has(n.type)) return false;
      // Orphan filter
      if (orphanFilter === "orphans" && !n.isOrphan) return false;
      if (orphanFilter === "connected" && n.isOrphan) return false;
      return true;
    });
    const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));
    const filteredEdges = graphData.edges.filter(
      (e) => filteredNodeIds.has(e.from) && filteredNodeIds.has(e.to)
    );

    // Convert to vis-network format with orphan styling and focused node enlargement
    const visNodes = filteredNodes.map((node) => {
      const isFocused = node.id === focusParam;
      const baseSize = 11;
      const focusedSize = Math.round(baseSize * 1.25); // 25% larger
      const stats = getNodeStats(node.id);

      // Build rich tooltip
      const tooltipLines = [
        `<strong>${node.type.toUpperCase()}</strong>: ${node.label}`,
        node.slug && node.slug !== node.label ? `<em>${node.slug}</em>` : "",
        node.group ? `Group: ${node.group}` : "",
        stats,
        node.isOrphan ? "<span style='color:#ef4444'>⚠ ORPHAN - No connections</span>" : "",
        "",
        "<span style='color:#9ca3af'>Click: Focus • Dbl-click: Open • Right-click: Menu</span>",
      ].filter(Boolean).join("<br/>");

      return {
        id: node.id,
        label: node.isOrphan ? `⚠ ${node.label}` : node.label,
        color: {
          background: node.isOrphan ? "#fef2f2" : nodeColors[node.type].background,
          border: node.isOrphan ? "#ef4444" : nodeColors[node.type].border,
          highlight: {
            background: nodeColors[node.type].border,
            border: nodeColors[node.type].text,
          },
        },
        shape: nodeShapes[node.type],
        font: {
          color: node.isOrphan ? "#dc2626" : nodeColors[node.type].text,
          size: isFocused ? focusedSize : baseSize,
          face: "system-ui, sans-serif",
          bold: isFocused ? { size: focusedSize, color: nodeColors[node.type].text } : undefined,
        },
        size: isFocused ? 20 : 16, // Make focused node physically larger
        borderWidth: isFocused ? 4 : (node.isOrphan ? 3 : 2),
        borderWidthSelected: 5,
        shapeProperties: node.isOrphan ? { borderDashes: [5, 5] } : {},
        title: tooltipLines,
        margin: isFocused
          ? { top: 10, bottom: 10, left: 10, right: 10 }
          : { top: 8, bottom: 8, left: 8, right: 8 },
        shadow: isFocused ? {
          enabled: true,
          color: nodeColors[node.type].border,
          size: 12,
          x: 0,
          y: 0,
        } : {
          enabled: true,
          color: "rgba(0,0,0,0.1)",
          size: 6,
          x: 2,
          y: 2,
        },
      };
    });

    const visEdges = filteredEdges.map((edge, i) => ({
      id: `edge-${i}`,
      from: edge.from,
      to: edge.to,
      color: { color: edgeColors[edge.type] || "#d1d5db", opacity: 0.5 },
      arrows: { to: { enabled: true, scaleFactor: 0.4 } },
      smooth: { enabled: true, type: "continuous", roundness: 0.3 },
      width: 1,
    }));

    const data: Data = {
      nodes: visNodes,
      edges: visEdges,
    };

    const options: Options = {
      physics: {
        enabled: true,
        solver: "forceAtlas2Based",
        forceAtlas2Based: {
          gravitationalConstant: -120,
          centralGravity: 0.005,
          springLength: 200,
          springConstant: 0.02,
          damping: 0.4,
          avoidOverlap: 0.8,
        },
        stabilization: {
          enabled: true,
          iterations: 300,
          updateInterval: 25,
        },
        maxVelocity: 50,
        minVelocity: 0.1,
      },
      interaction: {
        hover: true,
        tooltipDelay: 100,
        zoomView: true,
        dragView: true,
        dragNodes: true,
        multiselect: false,
        zoomSpeed: 0.3,
        keyboard: {
          enabled: false,
        },
        navigationButtons: false,
      },
      nodes: {
        shadow: {
          enabled: true,
          color: "rgba(0,0,0,0.1)",
          size: 6,
          x: 2,
          y: 2,
        },
        scaling: {
          min: 10,
          max: 30,
        },
      },
      edges: {
        shadow: false,
        width: 1,
      },
      layout: {
        improvedLayout: true,
        randomSeed: 42,
      },
      autoResize: true,
    };

    const isNewNetwork = !networkRef.current;

    if (networkRef.current) {
      // Re-enable physics for layout calculation on data change
      networkRef.current.setOptions({ physics: { enabled: true } });
      networkRef.current.setData(data);
    } else {
      networkRef.current = new Network(containerRef.current, data, options);
    }

    // Always re-register event handlers to capture fresh graphData
    networkRef.current.off("click");
    networkRef.current.off("doubleClick");
    networkRef.current.off("oncontext");

    // Click handler for centering
    networkRef.current.on("click", (params) => {
      setContextMenu(null); // Close context menu on any click
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0] as string;
        const node = graphData.nodes.find((n) => n.id === nodeId);
        if (node) {
          setSelectedNode(node);
          // Only update URL if different from current focus
          if (focusParam !== nodeId) {
            router.push(`/x/taxonomy-graph?focus=${encodeURIComponent(nodeId)}`);
          }
        }
      } else {
        setSelectedNode(null);
      }
    });

    // Double-click to navigate to entity
    networkRef.current.on("doubleClick", (params) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0] as string;
        const node = graphData.nodes.find((n) => n.id === nodeId);
        if (node) {
          navigateToEntity(node);
        }
      }
    });

    // Right-click context menu
    networkRef.current.on("oncontext", (params) => {
      params.event.preventDefault();
      const nodeId = networkRef.current?.getNodeAt(params.pointer.DOM) as string | undefined;
      if (nodeId) {
        const node = graphData.nodes.find((n) => n.id === nodeId);
        if (node) {
          setContextMenu({
            x: params.event.clientX,
            y: params.event.clientY,
            node,
          });
        }
      } else {
        setContextMenu(null);
      }
    });

    // Fit to screen after stabilization and stop physics
    networkRef.current.once("stabilizationIterationsDone", () => {
      // Stop physics to prevent constant movement
      networkRef.current?.setOptions({ physics: { enabled: false } });

      setTimeout(() => {
        networkRef.current?.redraw();
        networkRef.current?.fit({
          animation: { duration: 400, easingFunction: "easeInOutQuad" },
          maxZoomLevel: 1.2,
          minZoomLevel: 0.1,
        });
      }, 50);
    });

    // Center on focus node if specified
    if (focusParam && networkRef.current) {
      setTimeout(() => {
        networkRef.current?.focus(focusParam, {
          scale: 1.0,
          animation: {
            duration: 500,
            easingFunction: "easeInOutQuad",
          },
        });
      }, 600);
    }
  }, [graphData, visibleTypes, orphanFilter, focusParam, router, getNodeStats]);

  // Search handler
  useEffect(() => {
    if (!graphData || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const query = searchQuery.toLowerCase();
    const results = graphData.nodes.filter(
      (n) =>
        n.label.toLowerCase().includes(query) ||
        n.slug?.toLowerCase().includes(query)
    );
    setSearchResults(results.slice(0, 10));
  }, [searchQuery, graphData]);

  const handleSearchSelect = (node: GraphNode) => {
    setSearchQuery("");
    setSearchResults([]);
    router.push(`/x/taxonomy-graph?focus=${encodeURIComponent(node.id)}`);
  };

  const navigateToEntity = useCallback((node: GraphNode) => {
    const [type, id] = node.id.split(":");
    switch (type) {
      case "spec":
        // /x/specs uses ?id= for selection
        router.push(`/x/specs?id=${id}`);
        break;
      case "param":
        // /x/taxonomy with search filter for the parameter
        router.push(`/x/taxonomy?search=${encodeURIComponent(node.slug || node.label)}`);
        break;
      case "playbook":
        // /x/playbooks/[playbookId] for full detail view
        router.push(`/x/playbooks/${id}`);
        break;
      case "domain":
        // /x/domains uses ?id= for selection
        router.push(`/x/domains?id=${id}`);
        break;
      case "trigger":
        // Navigate to parent spec in /x/specs
        router.push(`/x/specs?id=${id.split("/")[0]}`);
        break;
      case "action":
        // Navigate to parent spec in /x/specs
        router.push(`/x/specs?id=${id.split("/")[0]}`);
        break;
      case "anchor":
        // Navigate to parent parameter in /x/taxonomy
        // The anchor label is the score, use the slug (example text) for search
        router.push(`/x/taxonomy?search=${encodeURIComponent(node.slug || "")}`);
        break;
    }
  }, [router]);

  // Context menu actions
  const handleContextAction = useCallback((action: string, node: GraphNode) => {
    setContextMenu(null);
    switch (action) {
      case "open":
        navigateToEntity(node);
        break;
      case "open-new-tab":
        // Build URL for new tab
        const [type, id] = node.id.split(":");
        let url = "";
        switch (type) {
          case "spec":
            url = `/x/specs?id=${id}`;
            break;
          case "param":
            url = `/x/taxonomy?search=${encodeURIComponent(node.slug || node.label)}`;
            break;
          case "playbook":
            url = `/x/playbooks/${id}`;
            break;
          case "domain":
            url = `/x/domains?id=${id}`;
            break;
          case "trigger":
          case "action":
            url = `/x/specs?id=${id.split("/")[0]}`;
            break;
          case "anchor":
            url = `/x/taxonomy?search=${encodeURIComponent(node.slug || "")}`;
            break;
          default:
            url = `/x/taxonomy`;
        }
        window.open(url, "_blank");
        break;
      case "copy-link":
        const linkUrl = `${window.location.origin}/x/taxonomy-graph?focus=${encodeURIComponent(node.id)}`;
        navigator.clipboard.writeText(linkUrl);
        break;
      case "focus":
        router.push(`/x/taxonomy-graph?focus=${encodeURIComponent(node.id)}`);
        break;
      case "show-connected":
        // Focus on this node with depth 1 to show only immediate connections
        router.push(`/x/taxonomy-graph?focus=${encodeURIComponent(node.id)}`);
        break;
      case "hide":
        // Toggle off this node's type
        setVisibleTypes(prev => {
          const next = new Set(prev);
          next.delete(node.type);
          return next;
        });
        break;
    }
  }, [router, navigateToEntity]);

  const toggleTypeFilter = (type: NodeType) => {
    setVisibleTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const clearFocus = () => {
    router.push("/x/taxonomy-graph");
    setSelectedNode(null);
  };

  return (
    <div
      className="flex flex-col bg-neutral-50 dark:bg-neutral-900"
      style={{
        // Break out of parent padding (px-6 py-6 = 24px each side)
        margin: "-24px",
        width: "calc(100% + 48px)",
        height: "100vh",
        maxWidth: "none",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-4 py-3">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            Taxonomy Graph
          </h1>
          {graphData && (
            <span className="text-sm text-neutral-500 dark:text-neutral-400">
              {graphData.counts.nodes} nodes, {graphData.counts.edges} edges
            </span>
          )}
          {graphData?.orphans && graphData.orphans.total > 0 && (
            <span className="text-sm text-red-500 font-medium">
              ⚠ {graphData.orphans.total} orphan{graphData.orphans.total > 1 ? "s" : ""}
            </span>
          )}
          {/* Orphan filter toggle */}
          <div className="flex items-center gap-1 rounded-md border border-neutral-200 dark:border-neutral-700 p-0.5">
            <button
              onClick={() => setOrphanFilter("all")}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                orphanFilter === "all"
                  ? "bg-neutral-200 dark:bg-neutral-600 text-neutral-900 dark:text-neutral-100"
                  : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setOrphanFilter("connected")}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                orphanFilter === "connected"
                  ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
                  : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              }`}
            >
              Connected
            </button>
            <button
              onClick={() => setOrphanFilter("orphans")}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                orphanFilter === "orphans"
                  ? "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300"
                  : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              }`}
            >
              Orphans
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search entities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64 rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 px-3 py-1.5 text-sm text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 mt-1 w-full rounded-md border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 shadow-lg z-50">
                {searchResults.map((node) => (
                  <button
                    key={node.id}
                    onClick={() => handleSearchSelect(node)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700"
                  >
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ backgroundColor: nodeColors[node.type].border }}
                    />
                    <span className="font-medium text-neutral-900 dark:text-neutral-100">
                      {node.label}
                    </span>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400 capitalize">
                      {node.type}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              showFilters
                ? "bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300"
                : "bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600"
            }`}
          >
            Filters
          </button>

          {/* Back button */}
          <button
            onClick={() => router.back()}
            className="rounded-md bg-neutral-100 dark:bg-neutral-700 px-3 py-1.5 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600 flex items-center gap-1.5"
            title="Go back (Backspace)"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                clipRule="evenodd"
              />
            </svg>
            Back
          </button>

          {/* Clear focus */}
          {focusParam && (
            <button
              onClick={clearFocus}
              className="rounded-md bg-neutral-100 dark:bg-neutral-700 px-3 py-1.5 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600"
            >
              Show All
            </button>
          )}
        </div>
      </div>

      {/* Filter bar */}
      {showFilters && (
        <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-4 py-2">
          <span className="text-sm text-neutral-500 dark:text-neutral-400 mr-2">
            Show:
          </span>
          {(["spec", "parameter", "playbook", "domain", "trigger", "action", "anchor"] as NodeType[]).map(
            (type) => (
              <button
                key={type}
                onClick={() => toggleTypeFilter(type)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors border ${
                  visibleTypes.has(type)
                    ? ""
                    : "bg-neutral-100 dark:bg-neutral-700 text-neutral-400 dark:text-neutral-500 border-neutral-200 dark:border-neutral-600"
                }`}
                style={
                  visibleTypes.has(type)
                    ? {
                        backgroundColor: nodeColors[type].background,
                        borderColor: nodeColors[type].border,
                        color: nodeColors[type].text,
                      }
                    : {}
                }
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: nodeColors[type].border,
                    opacity: visibleTypes.has(type) ? 1 : 0.4,
                  }}
                />
                <span className="capitalize">{type}s</span>
              </button>
            )
          )}
        </div>
      )}

      {/* Main content */}
      <div className="relative flex-1">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-50/80 dark:bg-neutral-900/80 z-10">
            <div className="flex flex-col items-center gap-2">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
              <span className="text-sm text-neutral-500 dark:text-neutral-400">
                Loading graph...
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4 text-red-600 dark:text-red-400">
              {error}
            </div>
          </div>
        )}

        {/* Graph container */}
        <div
          ref={containerRef}
          className="absolute inset-0"
          style={{ minHeight: 400 }}
        />

        {/* Zoom/Pan controls - bottom right */}
        <div className="absolute bottom-4 right-4 flex flex-col gap-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-1.5 shadow-lg">
          {/* Zoom controls */}
          <div className="flex gap-1">
            <button
              onClick={zoomIn}
              className="flex h-8 w-8 items-center justify-center rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300"
              title="Zoom in (+)"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12M6 12h12" />
              </svg>
            </button>
            <button
              onClick={zoomOut}
              className="flex h-8 w-8 items-center justify-center rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300"
              title="Zoom out (-)"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12h12" />
              </svg>
            </button>
            <button
              onClick={fitToScreen}
              className="flex h-8 w-8 items-center justify-center rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300"
              title="Fit to screen (0)"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>
          </div>
          {/* Divider */}
          <div className="border-t border-neutral-200 dark:border-neutral-700 my-0.5" />
          {/* Pan controls */}
          <div className="flex flex-col items-center gap-0.5">
            <button
              onClick={panUp}
              className="flex h-6 w-6 items-center justify-center rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300"
              title="Pan up (↑)"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>
            <div className="flex gap-0.5">
              <button
                onClick={panLeft}
                className="flex h-6 w-6 items-center justify-center rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300"
                title="Pan left (←)"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="h-6 w-6" />
              <button
                onClick={panRight}
                className="flex h-6 w-6 items-center justify-center rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300"
                title="Pan right (→)"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <button
              onClick={panDown}
              className="flex h-6 w-6 items-center justify-center rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300"
              title="Pan down (↓)"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Selected node info */}
        {selectedNode && (
          <div className="absolute bottom-4 left-4 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 shadow-lg max-w-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="inline-block w-3 h-3 rounded-full"
                    style={{ backgroundColor: nodeColors[selectedNode.type].border }}
                  />
                  <span className="text-xs font-medium uppercase" style={{ color: nodeColors[selectedNode.type].text }}>
                    {selectedNode.type}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                  {selectedNode.label}
                </h3>
                {selectedNode.slug && selectedNode.slug !== selectedNode.label && (
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    {selectedNode.slug}
                  </p>
                )}
                {/* Show stats for selected node */}
                <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
                  {getNodeStats(selectedNode.id)}
                </p>
              </div>
              <button
                onClick={() => navigateToEntity(selectedNode)}
                className="rounded-md bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-600"
              >
                Open
              </button>
            </div>
          </div>
        )}

        {/* Right-click context menu */}
        {contextMenu && (
          <div
            className="fixed rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-xl z-50 py-1 min-w-[180px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <div className="px-3 py-2 border-b border-neutral-200 dark:border-neutral-700">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ backgroundColor: nodeColors[contextMenu.node.type].border }}
                />
                <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate max-w-[150px]">
                  {contextMenu.node.label}
                </span>
              </div>
              <span className="text-xs text-neutral-500 capitalize">{contextMenu.node.type}</span>
            </div>
            <button
              onClick={() => handleContextAction("open", contextMenu.node)}
              className="w-full px-3 py-2 text-left text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              Open
            </button>
            <button
              onClick={() => handleContextAction("open-new-tab", contextMenu.node)}
              className="w-full px-3 py-2 text-left text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Open in new tab
            </button>
            <button
              onClick={() => handleContextAction("copy-link", contextMenu.node)}
              className="w-full px-3 py-2 text-left text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              Copy link
            </button>
            <div className="border-t border-neutral-200 dark:border-neutral-700 my-1" />
            <button
              onClick={() => handleContextAction("focus", contextMenu.node)}
              className="w-full px-3 py-2 text-left text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
              </svg>
              Focus on this node
            </button>
            <button
              onClick={() => handleContextAction("show-connected", contextMenu.node)}
              className="w-full px-3 py-2 text-left text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Show only connected
            </button>
            <div className="border-t border-neutral-200 dark:border-neutral-700 my-1" />
            <button
              onClick={() => handleContextAction("hide", contextMenu.node)}
              className="w-full px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
              Hide all {contextMenu.node.type}s
            </button>
          </div>
        )}

        {/* Legend - top right */}
        <div className="absolute top-4 right-4 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 shadow-lg min-w-[160px]">
          <div className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3">
            Filter by Type
          </div>
          <div className="flex flex-col gap-2">
            {(["spec", "parameter", "playbook", "domain", "trigger", "action", "anchor"] as NodeType[]).map(
              (type) => {
                const isVisible = visibleTypes.has(type);
                return (
                  <button
                    key={type}
                    onClick={() => toggleTypeFilter(type)}
                    className={`flex items-center gap-3 px-2 py-1.5 rounded-md transition-all cursor-pointer text-left ${
                      isVisible
                        ? "hover:opacity-80"
                        : "opacity-40 hover:opacity-60"
                    }`}
                    style={{
                      backgroundColor: isVisible ? nodeColors[type].background : "transparent",
                      border: `2px solid ${nodeColors[type].border}`,
                    }}
                  >
                    <span
                      className="w-4 h-4 rounded flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold"
                      style={{
                        backgroundColor: nodeColors[type].border,
                      }}
                    >
                      {isVisible ? "✓" : ""}
                    </span>
                    <span
                      className="text-sm font-medium capitalize"
                      style={{ color: isVisible ? nodeColors[type].text : "#9ca3af" }}
                    >
                      {type}s
                    </span>
                  </button>
                );
              }
            )}
          </div>
          <div className="border-t border-neutral-200 dark:border-neutral-700 mt-3 pt-3">
            <div className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed space-y-1">
              <div className="flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-700 rounded text-[10px] font-mono">+</kbd>
                <kbd className="px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-700 rounded text-[10px] font-mono">-</kbd>
                <span>Zoom</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-700 rounded text-[10px] font-mono">↑↓←→</kbd>
                <span>Pan</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-700 rounded text-[10px] font-mono">0</kbd>
                <span>Fit to screen</span>
              </div>
              <div className="pt-1 text-neutral-400">
                Click: Focus • Dbl-click: Open
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
