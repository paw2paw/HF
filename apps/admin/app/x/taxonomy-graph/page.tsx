"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Maximize2 } from "lucide-react";

const TaxonomyExplorerView = dynamic(
  () => import("@/components/taxonomy/TaxonomyExplorerView"),
  { ssr: false, loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
    </div>
  )}
);
import { entityColors } from "@/src/components/shared/uiColors";
import { useVisualizerSearch } from "@/hooks/useVisualizerSearch";
import { VisualizerSearch } from "@/components/shared/VisualizerSearch";
import { drawIconNode, renderIconToCanvas, spriteTextureCache, NodeIcon } from "@/components/shared/VisualizerIcons";
import { encodeTaxonomyNode, type VisualMode } from "@/lib/graph/visual-encoding";
import { AdvancedBanner } from "@/components/shared/AdvancedBanner";

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
  anchorCount?: number;
  confidence?: number;
  source?: string;
  minValue?: number;
  maxValue?: number;
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
  const activeTab = searchParams.get("tab") || "graph";
  const focusParam = searchParams.get("focus");
  const depthParam = searchParams.get("depth");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<ApiResponse | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [visibleTypes, setVisibleTypes] = useState<Set<NodeType>>(
    () => new Set<NodeType>(["spec", "parameter", "playbook", "domain", "trigger", "action", "anchor", "promptSlug", "behaviorTarget", "range"])
  );
  const [is3D, setIs3D] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [minimal, setMinimal] = useState(true); // Default to minimal - exclude trigger/action implementation details
  const [visualMode, setVisualMode] = useState<VisualMode>("simple");

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

  // Fetch graph data on mount and when minimal changes (skip when explorer tab is active)
  useEffect(() => {
    if (activeTab !== "graph") return;
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
  }, [focusParam, depthParam, minimal, activeTab]);

  // Navigate to entity detail page
  const navigateToEntity = useCallback((node: GraphNode) => {
    const [type, id] = node.id.split(":");
    switch (type) {
      case "spec":
        router.push(`/x/specs?id=${id}`);
        break;
      case "param":
        router.push(`/x/dictionary?search=${encodeURIComponent(node.label)}`);
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
        router.push(`/x/dictionary?search=${encodeURIComponent(node.label)}`);
        break;
      case "promptSlug":
        router.push(`/x/dictionary?search=${encodeURIComponent(node.label)}`);
        break;
      case "target": {
        // Navigate to data dictionary for the parameter this target belongs to
        const paramDetail = node.details?.find(d => d.label === "Parameter");
        if (paramDetail?.value) {
          router.push(`/x/dictionary?search=${encodeURIComponent(String(paramDetail.value))}`);
        }
        break;
      }
      case "range": {
        // Navigate to the parent slug in dictionary
        const [slugId] = id.split("/");
        router.push(`/x/dictionary?search=${encodeURIComponent(slugId)}`);
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
      const tooltipBg = "var(--surface-primary)";
      const tooltipBorder = "var(--border-default)";
      const tooltipText = "var(--text-secondary)";
      const tooltipLabel = "var(--text-muted)";
      const tooltipTitle = "var(--text-primary)";

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
              const color = node.isOrphan ? "#ef4444" : (nodeColors[node.type] || "#888888");
              const encoded = encodeTaxonomyNode(node, visualMode, nodeSizes[node.type] || 8, color);
              const cacheKey = `${node.type}:${encoded.color}:${encoded.ring?.color || ""}`;

              let texture = spriteTextureCache.get(cacheKey);
              if (!texture) {
                const canvas = renderIconToCanvas(node.type, encoded.color, 64, encoded.ring);
                texture = new THREE.CanvasTexture(canvas);
                spriteTextureCache.set(cacheKey, texture);
              }

              const material = new THREE.SpriteMaterial({
                map: texture,
                transparent: true,
                opacity: encoded.opacity,
              });
              const sprite = new THREE.Sprite(material);
              sprite.scale.set(encoded.radius * 1.5, encoded.radius * 1.5, 1);
              return sprite;
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

            const baseOpacity = isSearching && !isNodeMatch ? 0.15 : 1;
            const color = node.isOrphan ? "#ef4444" : (nodeColors[node.type] || "#888888");
            const encoded = encodeTaxonomyNode(node, visualMode, nodeSizes[node.type] || 8, color);

            ctx.globalAlpha = baseOpacity === 1 ? encoded.opacity : baseOpacity;

            drawIconNode(ctx, node.type, node.x!, node.y!, encoded.radius, encoded.color, encoded.ring);

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
  }, [graphData, is3D, isDarkMode, navigateToEntity, centerOnNode, visualMode]);

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
    <div style={{
      height: "100vh",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      background: "var(--surface-secondary)",
    }}>
      <AdvancedBanner />
      {/* Header - hidden in embed mode */}
      {!isEmbed && (
        <div
          style={{
            background: "var(--surface-primary)",
            border: "1px solid var(--border-default)",
            borderRadius: 8,
            padding: "12px 16px",
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <h1 className="hf-section-title">Taxonomy</h1>
              {/* Tabs */}
              <div style={{ display: "flex", gap: 4 }}>
                <button
                  onClick={() => router.push("/x/taxonomy-graph")}
                  style={{
                    padding: "4px 12px",
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: 6,
                    border: activeTab === "graph" ? "1px solid var(--accent-primary)" : "1px solid var(--border-default)",
                    background: activeTab === "graph" ? "var(--surface-selected)" : "var(--surface-primary)",
                    color: activeTab === "graph" ? "var(--accent-primary)" : "var(--text-muted)",
                    cursor: "pointer",
                  }}
                >
                  Graph
                </button>
                <button
                  onClick={() => router.push("/x/taxonomy-graph?tab=explorer")}
                  style={{
                    padding: "4px 12px",
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: 6,
                    border: activeTab === "explorer" ? "1px solid var(--accent-primary)" : "1px solid var(--border-default)",
                    background: activeTab === "explorer" ? "var(--surface-selected)" : "var(--surface-primary)",
                    color: activeTab === "explorer" ? "var(--accent-primary)" : "var(--text-muted)",
                    cursor: "pointer",
                  }}
                >
                  Explorer
                </button>
              </div>
              {activeTab === "graph" && (
                <>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 500,
                    padding: "2px 8px",
                    borderRadius: 4,
                    background: is3D ? "color-mix(in srgb, var(--accent-primary) 10%, transparent)" : "color-mix(in srgb, var(--status-success-text) 10%, transparent)",
                    color: is3D ? "var(--accent-primary)" : "var(--status-success-text)",
                  }}>
                    {is3D ? "3D" : "2D"}
                  </span>
                  {graphData && (
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {graphData.counts.nodes} nodes, {graphData.counts.edges} edges
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main */}
      {activeTab === "explorer" ? (
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
          <TaxonomyExplorerView />
        </div>
      ) : (
      <div className="relative" style={{ flex: 1, minHeight: 0 }}>
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
        <div className="absolute top-4 right-4 rounded-lg border-2 border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 backdrop-blur-sm p-4 shadow-xl w-56">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100">Filter by Type</span>
              <button
                onClick={() => setVisibleTypes(new Set<NodeType>(["spec", "parameter", "playbook", "domain", "trigger", "action", "anchor", "promptSlug", "behaviorTarget", "range"]))}
                className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-semibold"
              >
                all
              </button>
            </div>
            <div className="flex rounded-md overflow-hidden border-2 border-neutral-300 dark:border-neutral-600">
              <button
                onClick={() => setIs3D(false)}
                className={`px-3 py-1.5 text-xs font-bold transition-all ${
                  !is3D ? "bg-emerald-600 text-white shadow-inner" : "bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600"
                }`}
              >
                2D
              </button>
              <button
                onClick={() => setIs3D(true)}
                className={`px-3 py-1.5 text-xs font-bold transition-all ${
                  is3D ? "bg-indigo-600 text-white shadow-inner" : "bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600"
                }`}
              >
                3D
              </button>
            </div>
          </div>
          {/* Mode toggles */}
          <div className="mb-3 flex items-center gap-2">
            <button
              onClick={() => setMinimal(!minimal)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all hover:scale-[1.02] ${
                minimal
                  ? "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border-2 border-amber-400 dark:border-amber-600 shadow-sm"
                  : "bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 border-2 border-neutral-300 dark:border-neutral-600"
              }`}
              title="Hide triggers/actions (pipeline implementation details)"
            >
              <span className="text-sm">{minimal ? "✓" : "○"}</span>
              Minimal
            </button>
            <button
              onClick={() => setVisualMode(v => v === "simple" ? "rich" : "simple")}
              className={`px-3 py-1.5 text-xs font-bold rounded-md border-2 transition-all ${
                visualMode === "rich"
                  ? "bg-amber-600 text-white border-amber-500 shadow-inner"
                  : "bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-neutral-600 hover:bg-neutral-200 dark:hover:bg-neutral-600"
              }`}
            >
              Detailed
            </button>
          </div>
          <div className="flex flex-col gap-1">
            {(["domain", "playbook", "spec", "parameter", ...(minimal ? [] : ["trigger", "action"] as NodeType[]), "anchor", "promptSlug", "behaviorTarget", "range"] as NodeType[]).map(type => {
              const isVisible = visibleTypes.has(type);
              const color = nodeColors[type];
              const displayName = type === "promptSlug" ? "Prompt Slugs"
                : type === "behaviorTarget" ? "Targets"
                : type === "range" ? "Ranges"
                : `${type}s`;
              const bgColor = isVisible
                ? `color-mix(in srgb, ${color} 19%, transparent)`
                : "var(--surface-secondary)";
              const borderColor = isVisible ? color : "var(--border-strong)";
              const textColor = isVisible
                ? "var(--text-primary)"
                : "var(--text-muted)";
              return (
                <button
                  key={type}
                  onClick={() => toggleType(type)}
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-left transition-all hover:scale-[1.02]"
                  style={{
                    backgroundColor: bgColor,
                    border: `2px solid ${borderColor}`,
                    opacity: isVisible ? 1 : 0.6,
                  }}
                >
                  <NodeIcon type={type} color={isVisible ? color : "var(--text-muted)"} size={14} />
                  <span className="text-xs font-semibold capitalize" style={{ color: textColor }}>
                    {displayName}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="border-t-2 border-neutral-200 dark:border-neutral-700 mt-3 pt-3">
            <VisualizerSearch search={search} placeholder="Search nodes..." />
          </div>
          <div className="border-t-2 border-neutral-200 dark:border-neutral-700 mt-3 pt-3 text-xs text-neutral-600 dark:text-neutral-400 space-y-1">
            <div className="font-medium">Keyboard Shortcuts:</div>
            <div className="flex justify-between"><span className="font-semibold">Click</span> <span>Select + Center</span></div>
            <div className="flex justify-between"><span className="font-semibold">Right-click</span> <span>Open detail</span></div>
            <div className="flex justify-between"><span className="font-semibold">{is3D ? "Drag" : "Drag"}</span> <span>{is3D ? "Rotate" : "Pan"}</span></div>
            <div className="flex justify-between"><span className="font-semibold">Scroll</span> <span>Zoom</span></div>
            <div className="flex justify-between"><span className="font-semibold">0</span> <span>Reset view</span></div>
          </div>
        </div>

        {/* Selected node panel - bottom left */}
        {selectedNode && (
          <div className="absolute bottom-4 left-4 rounded-lg border-2 border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 backdrop-blur-sm shadow-xl w-72 max-h-[50vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b-2 border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
              <div className="flex items-center gap-2 mb-2">
                <NodeIcon type={selectedNode.type} color={nodeColors[selectedNode.type]} size={14} />
                <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: nodeColors[selectedNode.type] }}>
                  {selectedNode.type}
                </span>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="ml-auto text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 text-xl leading-none font-bold"
                >×</button>
              </div>
              <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">{selectedNode.label}</h3>
              {selectedNode.slug && selectedNode.slug !== selectedNode.label && (
                <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400 truncate mt-1">{selectedNode.slug}</p>
              )}
              {/* Details section */}
              {selectedNode.details && selectedNode.details.length > 0 && (
                <div className="mt-3 pt-3 border-t-2 border-neutral-200 dark:border-neutral-700 max-h-32 overflow-y-auto">
                  {selectedNode.details.slice(0, 8).map((detail, i) => (
                    <div key={i} className="flex gap-2 text-[11px] mb-1.5">
                      <span className="text-neutral-600 dark:text-neutral-400 min-w-[70px] shrink-0 font-semibold">{detail.label}:</span>
                      <span className="text-neutral-900 dark:text-neutral-100 truncate font-medium" title={String(detail.value)}>
                        {typeof detail.value === "boolean" ? (detail.value ? "Yes" : "No") : detail.value}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={() => navigateToEntity(selectedNode)}
                className="mt-2 w-full text-xs font-semibold text-center py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-all hover:shadow-md"
              >
                Open Detail →
              </button>
            </div>
            {connectedNodes.length > 0 && (
              <div className="flex-1 overflow-y-auto">
                <div className="px-3 py-2 text-[11px] font-bold uppercase text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800/80 sticky top-0 border-b border-neutral-200 dark:border-neutral-700">
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
                    className="w-full px-3 py-2.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-700/60 flex items-center gap-2 transition-colors border-b border-neutral-100 dark:border-neutral-800 last:border-0"
                  >
                    <NodeIcon type={node.type} color={nodeColors[node.type]} size={10} />
                    <span className="text-xs font-medium text-neutral-900 dark:text-neutral-100 truncate flex-1">{node.label}</span>
                    <span className="text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase">{node.type}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Camera controls - bottom right */}
        <div className="absolute bottom-4 right-4 flex gap-1 rounded-lg border-2 border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 backdrop-blur-sm p-1.5 shadow-lg">
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
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      )}
    </div>
  );
}
