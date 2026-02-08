"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { entityColors } from "@/src/components/shared/uiColors";
import { useVisualizerSearch } from "@/hooks/useVisualizerSearch";
import { VisualizerSearch } from "@/components/shared/VisualizerSearch";

type NodeType = "spec" | "parameter" | "playbook" | "domain" | "trigger" | "action" | "anchor" | "promptSlug" | "behaviorTarget" | "range";

interface NodeDetail {
  label: string;
  value: string | number | boolean | null;
}

interface GraphNode {
  id: string;
  label: string;
  type: NodeType;
  slug?: string;
  isOrphan?: boolean;
  details?: NodeDetail[];
  x?: number;
  y?: number;
  z?: number;
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
  counts: { nodes: number; edges: number };
  orphans?: { total: number; byType: Record<string, number> };
}

// Colors from entityColors - each type gets a distinct color
const nodeColors: Record<NodeType, string> = {
  domain: entityColors.domain.accent,     // blue #3b82f6
  playbook: entityColors.playbook.accent, // amber #f59e0b
  spec: entityColors.spec.accent,         // emerald #10b981
  parameter: entityColors.parameter.accent, // violet #8b5cf6
  trigger: entityColors.goal.accent,      // cyan #06b6d4 - "when" conditions
  action: entityColors.prompt.accent,     // orange #f97316 - "then" outcomes
  anchor: entityColors.caller.accent,     // pink #ec4899 - behavioral anchors
  promptSlug: "#a855f7",                  // purple - prompt templates
  behaviorTarget: "#14b8a6",              // teal - target values
  range: "#84cc16",                       // lime - value ranges
};

// Shape types: hexagon = container, rounded-rect = behavior, circle = data, diamond = target
type ShapeType = "hexagon" | "rounded-rect" | "circle" | "diamond";
const nodeShapes: Record<NodeType, ShapeType> = {
  domain: "hexagon",
  playbook: "hexagon",
  spec: "rounded-rect",
  trigger: "rounded-rect",
  action: "rounded-rect",
  parameter: "circle",
  anchor: "circle",
  promptSlug: "rounded-rect",
  behaviorTarget: "diamond",
  range: "circle",
};

// Node sizes by type
const nodeSizes: Record<NodeType, number> = {
  domain: 14, playbook: 12, spec: 10, parameter: 8,
  trigger: 7, action: 7, anchor: 6,
  promptSlug: 9, behaviorTarget: 7, range: 5,
};

const edgeColors: Record<string, string> = {
  measures: entityColors.spec.accent,
  uses: entityColors.parameter.accent,
  contains: entityColors.playbook.accent,
  belongs_to: entityColors.domain.accent,
  has_trigger: entityColors.goal.accent,
  has_action: entityColors.prompt.accent,
  has_anchor: entityColors.caller.accent,
  targets: entityColors.domain.accent,
  used_by_slug: "#a855f7",      // parameter -> promptSlug
  has_range: "#84cc16",         // promptSlug -> range
  has_target: "#14b8a6",        // parameter -> behaviorTarget
  defines_target: "#f59e0b",    // playbook -> behaviorTarget
};

// 2D Canvas shape drawing functions
function drawShape2D(
  ctx: CanvasRenderingContext2D,
  shape: ShapeType,
  x: number,
  y: number,
  size: number,
  color: string,
  isOrphan: boolean
) {
  const fillColor = isOrphan ? "#ef4444" : color;
  ctx.fillStyle = fillColor;
  ctx.strokeStyle = isOrphan ? "#fca5a5" : color;
  ctx.lineWidth = 1.5;

  switch (shape) {
    case "hexagon": {
      const r = size;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 2;
        const px = x + r * Math.cos(angle);
        const py = y + r * Math.sin(angle);
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case "rounded-rect": {
      const w = size * 1.6;
      const h = size * 1.2;
      const radius = size * 0.3;
      ctx.beginPath();
      ctx.roundRect(x - w / 2, y - h / 2, w, h, radius);
      ctx.fill();
      ctx.stroke();
      break;
    }
    case "diamond": {
      const r = size * 0.9;
      ctx.beginPath();
      ctx.moveTo(x, y - r);       // top
      ctx.lineTo(x + r, y);       // right
      ctx.lineTo(x, y + r);       // bottom
      ctx.lineTo(x - r, y);       // left
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case "circle":
    default: {
      ctx.beginPath();
      ctx.arc(x, y, size * 0.7, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      break;
    }
  }
}

export default function TaxonomyGraphPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const searchStateRef = useRef<{ isMatch: (id: string) => boolean; isSearching: boolean; mode: "highlight" | "filter" }>({
    isMatch: () => true,
    isSearching: false,
    mode: "highlight",
  });
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEmbed = searchParams.get("embed") === "1";
  const focusParam = searchParams.get("focus");
  const depthParam = searchParams.get("depth");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<ApiResponse | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [visibleTypes, setVisibleTypes] = useState<Set<NodeType>>(
    () => new Set<NodeType>(["spec", "parameter", "playbook", "domain", "trigger", "action", "anchor", "promptSlug", "behaviorTarget", "range"])
  );
  const [is3D, setIs3D] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [minimal, setMinimal] = useState(true); // Default to minimal - exclude trigger/action implementation details

  // Search functionality
  const searchableNodes = useMemo(() =>
    (graphData?.nodes ?? []).map(n => ({ id: n.id, label: n.label, slug: n.slug, type: n.type })),
    [graphData?.nodes]
  );

  const handleSearchMatchChange = useCallback((nodeId: string | null) => {
    if (!nodeId || !graphRef.current || !graphData) return;
    const node = graphData.nodes.find(n => n.id === nodeId);
    if (node && node.x !== undefined) {
      if (is3D) {
        graphRef.current.cameraPosition(
          { x: node.x * 1.5, y: node.y! * 1.5, z: (node.z || 0) + 200 },
          { x: node.x, y: node.y, z: node.z || 0 },
          600
        );
      } else {
        graphRef.current.centerAt(node.x, node.y, 600);
        graphRef.current.zoom(2, 600);
      }
      setSelectedNode(node);
    }
  }, [graphData, is3D]);

  const search = useVisualizerSearch(searchableNodes, {
    onMatchChange: handleSearchMatchChange,
    searchFields: ["label", "slug"],
  });

  // Update search state ref and refresh graph when search changes
  useEffect(() => {
    searchStateRef.current = {
      isMatch: search.isMatch,
      isSearching: search.isSearching,
      mode: search.mode,
    };
    // Trigger graph re-render and update 3D opacity
    if (graphRef.current) {
      // For 3D mode, update node opacity dynamically
      if (is3D) {
        graphRef.current.nodeOpacity((node: GraphNode) => {
          if (!search.isSearching) return 0.95;
          if (search.mode === "filter" && !search.isMatch(node.id)) return 0;
          if (search.mode === "highlight" && !search.isMatch(node.id)) return 0.15;
          return 0.95;
        });
      }
      // Force re-render for 2D canvas
      graphRef.current.nodeColor(graphRef.current.nodeColor());
    }
  }, [search.isMatch, search.isSearching, search.mode, search.debouncedTerm, is3D]);

  // Detect theme from HTML class (respects user override) or system preference
  useEffect(() => {
    const checkDarkMode = () => {
      const root = document.documentElement;
      // Explicit light mode override takes precedence
      if (root.classList.contains("light")) {
        setIsDarkMode(false);
        return;
      }
      // Explicit dark mode override
      if (root.classList.contains("dark")) {
        setIsDarkMode(true);
        return;
      }
      // Fall back to system preference
      setIsDarkMode(window.matchMedia("(prefers-color-scheme: dark)").matches);
    };
    checkDarkMode();

    // Watch for changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener("change", checkDarkMode);

    // Watch for class changes on html element
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => {
      mediaQuery.removeEventListener("change", checkDarkMode);
      observer.disconnect();
    };
  }, []);

  // Fetch graph data on mount and when minimal changes
  useEffect(() => {
    const fetchGraph = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (focusParam) params.set("focus", focusParam);
        if (depthParam) params.set("depth", depthParam);
        if (minimal) params.set("minimal", "1");
        const url = params.toString() ? `/api/taxonomy-graph?${params}` : "/api/taxonomy-graph";
        const res = await fetch(url);
        const data: ApiResponse = await res.json();
        if (!data.ok) throw new Error("Failed to load graph");
        setGraphData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load graph");
      } finally {
        setLoading(false);
      }
    };
    fetchGraph();
  }, [focusParam, depthParam, minimal]);

  // Navigate to entity detail page
  const navigateToEntity = useCallback((node: GraphNode) => {
    const [type, id] = node.id.split(":");
    switch (type) {
      case "spec":
        router.push(`/x/specs?id=${id}`);
        break;
      case "param":
        router.push(`/data-dictionary?search=${encodeURIComponent(node.label)}`);
        break;
      case "playbook":
        router.push(`/x/playbooks/${id}`);
        break;
      case "domain":
        router.push(`/x/domains?id=${id}`);
        break;
      case "trigger":
      case "action": {
        const [specId] = id.split("/");
        router.push(`/x/specs?id=${specId}`);
        break;
      }
      case "anchor":
        router.push(`/data-dictionary?search=${encodeURIComponent(node.label)}`);
        break;
      case "promptSlug":
        router.push(`/x/taxonomy?tab=slugs&search=${encodeURIComponent(node.label)}`);
        break;
      case "target":
        // Navigate to data dictionary for the parameter this target belongs to
        const paramDetail = node.details?.find(d => d.label === "Parameter");
        if (paramDetail?.value) {
          router.push(`/data-dictionary?search=${encodeURIComponent(String(paramDetail.value))}`);
        }
        break;
      case "range": {
        // Navigate to the parent slug
        const [slugId] = id.split("/");
        router.push(`/x/taxonomy?tab=slugs&id=${slugId}`);
        break;
      }
    }
  }, [router]);

  // Center on node (works for both 2D and 3D)
  const centerOnNode = useCallback((node: any) => {
    if (!graphRef.current || node.x === undefined) return;
    if (is3D) {
      graphRef.current.cameraPosition(
        { x: node.x * 1.5, y: node.y * 1.5, z: (node.z || 0) + 200 },
        { x: node.x, y: node.y, z: node.z || 0 },
        600
      );
    } else {
      graphRef.current.centerAt(node.x, node.y, 600);
      graphRef.current.zoom(2, 600);
    }
  }, [is3D]);

  // Initialize graph (2D or 3D)
  useEffect(() => {
    if (!containerRef.current || !graphData) return;

    // Cleanup existing graph
    if (graphRef.current) {
      graphRef.current._destructor?.();
      graphRef.current = null;
    }

    const importPromise = is3D
      ? import("3d-force-graph")
      : import("force-graph");

    importPromise.then((module) => {
      const ForceGraph = module.default as any;

      // Prepare data
      const links = graphData.edges.map(e => ({
        source: e.from,
        target: e.to,
        type: e.type,
      }));

      // Theme colors - match app's dark:bg-neutral-900 (#171717)
      const bgColor = isDarkMode ? "#171717" : "#f5f5f5";
      const tooltipBg = isDarkMode ? "#1f2937" : "#ffffff";
      const tooltipBorder = isDarkMode ? "#374151" : "#e5e7eb";
      const tooltipText = isDarkMode ? "#e5e7eb" : "#374151";
      const tooltipLabel = isDarkMode ? "#9ca3af" : "#6b7280";
      const tooltipTitle = isDarkMode ? "white" : "#111827";

      // Common settings for both 2D and 3D
      const graph = ForceGraph()(containerRef.current!)
        .graphData({ nodes: [...graphData.nodes], links })
        .backgroundColor(bgColor)
        .nodeVal((node: GraphNode) => nodeSizes[node.type] || 8)
        .nodeLabel((node: GraphNode) => {
          const detailsHtml = node.details && node.details.length > 0
            ? `<div style="margin-top:8px;padding-top:8px;border-top:1px solid ${tooltipBorder}">
                ${node.details.map(d => `
                  <div style="display:flex;gap:8px;font-size:11px;margin-bottom:3px">
                    <span style="color:${tooltipLabel};min-width:80px">${d.label}:</span>
                    <span style="color:${tooltipText};max-width:200px;overflow:hidden;text-overflow:ellipsis">${d.value}</span>
                  </div>
                `).join("")}
              </div>`
            : "";
          return `
            <div style="background:${tooltipBg};padding:10px 14px;border-radius:8px;border:1px solid ${nodeColors[node.type]};max-width:320px;box-shadow:0 4px 12px rgba(0,0,0,${isDarkMode ? '0.3' : '0.1'})">
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
                <div style="width:8px;height:8px;border-radius:2px;background:${nodeColors[node.type]}"></div>
                <span style="color:${nodeColors[node.type]};font-size:10px;text-transform:uppercase;font-weight:600">${node.type}</span>
                ${node.isOrphan ? '<span style="color:#ef4444;font-size:9px;background:#7f1d1d;padding:1px 4px;border-radius:3px;margin-left:4px">ORPHAN</span>' : ""}
              </div>
              <div style="color:${tooltipTitle};font-weight:600;font-size:13px">${node.label}</div>
              ${node.slug && node.slug !== node.label ? `<div style="color:${tooltipLabel};font-size:11px;margin-top:2px">${node.slug}</div>` : ""}
              ${detailsHtml}
            </div>
          `;
        })
        .linkColor((link: any) => edgeColors[link.type] || "#666666")
        .linkWidth(1.5)
        .nodeVisibility((node: GraphNode) => visibleTypes.has(node.type))
        .linkVisibility((link: any) => {
          const source = typeof link.source === "object" ? link.source : graphData.nodes.find(n => n.id === link.source);
          const target = typeof link.target === "object" ? link.target : graphData.nodes.find(n => n.id === link.target);
          if (!source || !target) return true;
          return visibleTypes.has(source.type) && visibleTypes.has(target.type);
        })
        .onNodeClick((node: GraphNode) => {
          setSelectedNode(node);
          setTimeout(() => centerOnNode(node), 50);
        })
        .onNodeRightClick((node: GraphNode) => {
          navigateToEntity(node);
        })
        .enableNodeDrag(false);

      // Mode-specific settings
      if (is3D) {
        // 3D: Use Three.js objects for shapes
        import("three").then((THREE) => {
          graph
            .nodeThreeObject((node: GraphNode) => {
              const size = nodeSizes[node.type] || 8;
              const shape = nodeShapes[node.type] || "circle";
              const color = node.isOrphan ? "#ef4444" : (nodeColors[node.type] || "#888888");

              let geometry: any;
              switch (shape) {
                case "hexagon":
                  geometry = new THREE.CylinderGeometry(size, size, size * 0.25, 6);
                  break;
                case "rounded-rect":
                  geometry = new THREE.CapsuleGeometry(size * 0.4, size * 0.8, 4, 8);
                  break;
                case "diamond":
                  // Octahedron rotated to look like a diamond
                  geometry = new THREE.OctahedronGeometry(size * 0.6);
                  break;
                case "circle":
                default:
                  geometry = new THREE.SphereGeometry(size * 0.5, 16, 16);
                  break;
              }

              const material = new THREE.MeshLambertMaterial({
                color,
                transparent: true,
                opacity: 0.9,
              });

              return new THREE.Mesh(geometry, material);
            })
            .nodeOpacity(0.95)
            .linkOpacity(0.7)
            .enableNavigationControls(true)
            .showNavInfo(false);

          graph.cameraPosition({ x: 0, y: 0, z: 600 });
        });
      } else {
        // 2D: Use canvas for custom shapes
        graph
          .nodeCanvasObject((node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
            const { isMatch, isSearching, mode } = searchStateRef.current;
            const isNodeMatch = isMatch(node.id);

            // In filter mode, skip drawing non-matches entirely
            if (isSearching && mode === "filter" && !isNodeMatch) {
              return;
            }

            // In highlight mode, dim non-matches
            const opacity = isSearching && !isNodeMatch ? 0.15 : 1;
            ctx.globalAlpha = opacity;

            const size = nodeSizes[node.type] || 8;
            const shape = nodeShapes[node.type] || "circle";
            const color = nodeColors[node.type] || "#888888";
            drawShape2D(ctx, shape, node.x!, node.y!, size, color, !!node.isOrphan);

            ctx.globalAlpha = 1; // Reset alpha
          })
          .nodePointerAreaPaint((node: GraphNode, color: string, ctx: CanvasRenderingContext2D) => {
            const size = nodeSizes[node.type] || 8;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(node.x!, node.y!, size, 0, 2 * Math.PI);
            ctx.fill();
          })
          .linkDirectionalArrowLength(3)
          .linkDirectionalArrowRelPos(1);
      }

      // Performance tuning
      graph.d3Force("charge")?.strength(-50);
      graph.d3Force("link")?.distance(60);

      graphRef.current = graph;
    });

    return () => {
      if (graphRef.current) {
        graphRef.current._destructor?.();
        graphRef.current = null;
      }
    };
  }, [graphData, is3D, isDarkMode, navigateToEntity, centerOnNode]);

  // Update visibility when filters or search change
  useEffect(() => {
    if (!graphRef.current || !graphData) return;
    const { isMatch, isSearching, mode } = searchStateRef.current;

    graphRef.current
      .nodeVisibility((node: GraphNode) => {
        // Type filter always applies
        if (!visibleTypes.has(node.type)) return false;
        // In filter mode, hide non-matches
        if (isSearching && mode === "filter" && !isMatch(node.id)) return false;
        return true;
      })
      .linkVisibility((link: any) => {
        const source = typeof link.source === "object" ? link.source : graphData.nodes.find(n => n.id === link.source);
        const target = typeof link.target === "object" ? link.target : graphData.nodes.find(n => n.id === link.target);
        if (!source || !target) return true;
        // Type filter
        if (!visibleTypes.has(source.type) || !visibleTypes.has(target.type)) return false;
        // In filter mode, hide links to non-matches
        if (isSearching && mode === "filter") {
          if (!isMatch(source.id) || !isMatch(target.id)) return false;
        }
        return true;
      })
      .linkOpacity((link: any) => {
        if (!isSearching) return 0.7;
        const source = typeof link.source === "object" ? link.source : graphData.nodes.find(n => n.id === link.source);
        const target = typeof link.target === "object" ? link.target : graphData.nodes.find(n => n.id === link.target);
        if (!source || !target) return 0.7;
        // In highlight mode, dim links to non-matches
        if (mode === "highlight" && (!isMatch(source.id) || !isMatch(target.id))) {
          return 0.1;
        }
        return 0.7;
      });
  }, [visibleTypes, graphData, search.debouncedTerm, search.mode]);

  // Handle resize
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      if (graphRef.current && containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        graphRef.current.width(width).height(height);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "Escape") setSelectedNode(null);
      if (e.key === "0" && graphRef.current) {
        if (is3D) {
          graphRef.current.cameraPosition({ x: 0, y: 0, z: 600 }, { x: 0, y: 0, z: 0 }, 500);
        } else {
          graphRef.current.centerAt(0, 0, 500);
          graphRef.current.zoom(1, 500);
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [is3D]);

  const toggleType = (type: NodeType) => {
    setVisibleTypes(prev => {
      const next = new Set(prev);
      next.has(type) ? next.delete(type) : next.add(type);
      return next;
    });
  };

  // Connected nodes for panel
  const connectedNodes = useMemo(() => {
    if (!selectedNode || !graphData) return [];
    const connected = new Set<string>();
    graphData.edges.forEach(e => {
      if (e.from === selectedNode.id) connected.add(e.to);
      if (e.to === selectedNode.id) connected.add(e.from);
    });
    return graphData.nodes.filter(n => connected.has(n.id)).slice(0, 15);
  }, [selectedNode, graphData]);

  return (
    <div className="flex flex-col bg-neutral-100 dark:bg-neutral-900" style={{
      minHeight: isEmbed ? "100%" : "calc(100vh - 120px)",
      height: isEmbed ? "100vh" : undefined,
    }}>
      {/* Header - hidden in embed mode */}
      {!isEmbed && (
        <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-6 py-3">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Taxonomy Graph</h1>
            <span className={`text-xs font-medium px-2 py-0.5 rounded ${is3D ? "text-indigo-400 bg-indigo-900/30" : "text-emerald-400 bg-emerald-900/30"}`}>
              {is3D ? "3D" : "2D"}
            </span>
            {graphData && (
              <span className="text-sm text-neutral-500 dark:text-neutral-400">
                {graphData.counts.nodes} nodes, {graphData.counts.edges} edges
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.back()}
              className="rounded-md bg-neutral-200 dark:bg-neutral-700 px-3 py-1.5 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-600"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {/* Main */}
      <div className="relative flex-1">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-neutral-900/80 z-10">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="rounded-md bg-red-100 dark:bg-red-900/20 p-4 text-red-600 dark:text-red-400">{error}</div>
          </div>
        )}

        {/* Graph container */}
        <div ref={containerRef} className="absolute inset-0" />

        {/* Type filter panel - top right */}
        <div className="absolute top-4 right-4 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white/95 dark:bg-neutral-800/95 p-4 shadow-lg w-56">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Filter by Type</span>
              <button
                onClick={() => setVisibleTypes(new Set<NodeType>(["spec", "parameter", "playbook", "domain", "trigger", "action", "anchor", "promptSlug", "behaviorTarget", "range"]))}
                className="text-[10px] text-indigo-500 hover:text-indigo-400 font-medium"
              >
                all
              </button>
            </div>
            <div className="flex rounded-md overflow-hidden">
              <button
                onClick={() => setIs3D(false)}
                className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                  !is3D ? "bg-emerald-600 text-white" : "bg-neutral-200 dark:bg-neutral-600 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-500"
                }`}
              >
                2D
              </button>
              <button
                onClick={() => setIs3D(true)}
                className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                  is3D ? "bg-indigo-600 text-white" : "bg-neutral-200 dark:bg-neutral-600 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-500"
                }`}
              >
                3D
              </button>
            </div>
          </div>
          {/* Minimal mode toggle */}
          <div className="mb-3 flex items-center gap-2">
            <button
              onClick={() => setMinimal(!minimal)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors ${
                minimal
                  ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700"
                  : "bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400 border border-neutral-300 dark:border-neutral-600"
              }`}
              title="Hide triggers/actions (pipeline implementation details)"
            >
              <span>{minimal ? "✓" : "○"}</span>
              Minimal
            </button>
            <span className="text-[10px] text-neutral-500" title="Excludes trigger/action nodes which are pipeline implementation details">
              {minimal ? "Hiding impl. details" : ""}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            {(["domain", "playbook", "spec", "parameter", ...(minimal ? [] : ["trigger", "action"] as NodeType[]), "anchor", "promptSlug", "behaviorTarget", "range"] as NodeType[]).map(type => {
              const isVisible = visibleTypes.has(type);
              const color = nodeColors[type];
              const shape = nodeShapes[type];
              const displayName = type === "promptSlug" ? "Prompt Slugs"
                : type === "behaviorTarget" ? "Targets"
                : type === "range" ? "Ranges"
                : `${type}s`;
              return (
                <button
                  key={type}
                  onClick={() => toggleType(type)}
                  className="flex items-center gap-2 px-2 py-1 rounded text-left transition-all"
                  style={{
                    backgroundColor: isVisible ? `${color}20` : "transparent",
                    border: `1px solid ${isVisible ? color : "#404040"}`,
                    opacity: isVisible ? 1 : 0.5,
                  }}
                >
                  {/* Shape indicator */}
                  <svg width="12" height="12" viewBox="0 0 14 14">
                    {shape === "hexagon" ? (
                      <polygon
                        points="7,1 12.5,4 12.5,10 7,13 1.5,10 1.5,4"
                        fill={color}
                      />
                    ) : shape === "rounded-rect" ? (
                      <rect x="1" y="3" width="12" height="8" rx="2" fill={color} />
                    ) : shape === "diamond" ? (
                      <polygon points="7,1 13,7 7,13 1,7" fill={color} />
                    ) : (
                      <circle cx="7" cy="7" r="5" fill={color} />
                    )}
                  </svg>
                  <span className="text-xs capitalize" style={{ color: isVisible ? color : "#737373" }}>
                    {displayName}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="border-t border-neutral-200 dark:border-neutral-700 mt-3 pt-3">
            <VisualizerSearch search={search} placeholder="Search nodes..." />
          </div>
          <div className="border-t border-neutral-200 dark:border-neutral-700 mt-3 pt-3 text-xs text-neutral-500">
            <div>Click: Select + Center</div>
            <div>Right-click: Open detail</div>
            <div>{is3D ? "Drag: Rotate" : "Drag: Pan"}</div>
            <div>Scroll: Zoom</div>
            <div>0: Reset view</div>
          </div>
        </div>

        {/* Selected node panel - bottom left */}
        {selectedNode && (
          <div className="absolute bottom-4 left-4 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-lg w-72 max-h-[50vh] flex flex-col overflow-hidden">
            <div className="p-3 border-b border-neutral-200 dark:border-neutral-700">
              <div className="flex items-center gap-2 mb-1">
                <svg width="12" height="12" viewBox="0 0 14 14">
                  {nodeShapes[selectedNode.type] === "hexagon" ? (
                    <polygon points="7,1 12.5,4 12.5,10 7,13 1.5,10 1.5,4" fill={nodeColors[selectedNode.type]} />
                  ) : nodeShapes[selectedNode.type] === "rounded-rect" ? (
                    <rect x="1" y="3" width="12" height="8" rx="2" fill={nodeColors[selectedNode.type]} />
                  ) : nodeShapes[selectedNode.type] === "diamond" ? (
                    <polygon points="7,1 13,7 7,13 1,7" fill={nodeColors[selectedNode.type]} />
                  ) : (
                    <circle cx="7" cy="7" r="5" fill={nodeColors[selectedNode.type]} />
                  )}
                </svg>
                <span className="text-[10px] font-semibold uppercase" style={{ color: nodeColors[selectedNode.type] }}>
                  {selectedNode.type}
                </span>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="ml-auto text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                >×</button>
              </div>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{selectedNode.label}</h3>
              {selectedNode.slug && selectedNode.slug !== selectedNode.label && (
                <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{selectedNode.slug}</p>
              )}
              {/* Details section */}
              {selectedNode.details && selectedNode.details.length > 0 && (
                <div className="mt-2 pt-2 border-t border-neutral-200 dark:border-neutral-700 max-h-32 overflow-y-auto">
                  {selectedNode.details.slice(0, 8).map((detail, i) => (
                    <div key={i} className="flex gap-2 text-[11px] mb-1">
                      <span className="text-neutral-500 min-w-[70px] shrink-0">{detail.label}:</span>
                      <span className="text-neutral-700 dark:text-neutral-300 truncate" title={String(detail.value)}>
                        {typeof detail.value === "boolean" ? (detail.value ? "Yes" : "No") : detail.value}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={() => navigateToEntity(selectedNode)}
                className="mt-2 w-full text-xs text-center py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                Open Detail →
              </button>
            </div>
            {connectedNodes.length > 0 && (
              <div className="flex-1 overflow-y-auto">
                <div className="px-3 py-2 text-[10px] font-semibold uppercase text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-800/50 sticky top-0">
                  Connected ({connectedNodes.length})
                </div>
                {connectedNodes.map(node => (
                  <button
                    key={node.id}
                    onClick={() => {
                      setSelectedNode(node);
                      const graphNode = graphRef.current?.graphData()?.nodes?.find((n: any) => n.id === node.id);
                      if (graphNode) centerOnNode(graphNode);
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-neutral-100 dark:hover:bg-neutral-700/50 flex items-center gap-2"
                  >
                    <svg width="10" height="10" viewBox="0 0 14 14" className="flex-shrink-0">
                      {nodeShapes[node.type] === "hexagon" ? (
                        <polygon points="7,1 12.5,4 12.5,10 7,13 1.5,10 1.5,4" fill={nodeColors[node.type]} />
                      ) : nodeShapes[node.type] === "rounded-rect" ? (
                        <rect x="1" y="3" width="12" height="8" rx="2" fill={nodeColors[node.type]} />
                      ) : nodeShapes[node.type] === "diamond" ? (
                        <polygon points="7,1 13,7 7,13 1,7" fill={nodeColors[node.type]} />
                      ) : (
                        <circle cx="7" cy="7" r="5" fill={nodeColors[node.type]} />
                      )}
                    </svg>
                    <span className="text-xs text-neutral-700 dark:text-neutral-300 truncate flex-1">{node.label}</span>
                    <span className="text-[10px] text-neutral-500">{node.type}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Camera controls - bottom right */}
        <div className="absolute bottom-4 right-4 flex gap-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-1.5">
          <button
            onClick={() => {
              if (is3D) {
                graphRef.current?.cameraPosition({ x: 0, y: 0, z: 600 }, { x: 0, y: 0, z: 0 }, 500);
              } else {
                graphRef.current?.centerAt(0, 0, 500);
                graphRef.current?.zoom(1, 500);
              }
            }}
            className="h-8 w-8 flex items-center justify-center rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300"
            title="Reset view (0)"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
