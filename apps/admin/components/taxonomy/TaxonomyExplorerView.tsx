"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  TreeNode,
  ExplorerTreeNode as SharedExplorerTreeNode,
  NodeDetailPanel as SharedNodeDetailPanel,
  useTreeSearch,
  collectAllNodeIds,
  getVisibleNodes,
  findParentNode,
} from "@/components/shared/ExplorerTree";
import { VisualizerSearch } from "@/components/shared/VisualizerSearch";

interface Stats {
  domains: number;
  playbooks: number;
  specs: number;
  parameters: number;
  promptSlugs: number;
  orphanSpecs: number;
  orphanParameters: number;
}

export default function TaxonomyExplorerView() {
  const router = useRouter();
  const [treeData, setTreeData] = useState<TreeNode | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);

  // Fetch tree data
  useEffect(() => {
    const fetchTree = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/taxonomy-tree");
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || "Failed to load tree");

        // Wrap array of roots in a synthetic root node
        const syntheticRoot: TreeNode = {
          id: "taxonomy-root",
          type: "root",
          name: `Taxonomy (${data.stats.domains} domains, ${data.stats.specs} specs, ${data.stats.parameters} parameters)`,
          children: data.tree,
        };

        setTreeData(syntheticRoot);
        setStats(data.stats);

        // Auto-expand root + all domain nodes (top 2 levels)
        const toExpand = new Set<string>();
        toExpand.add(syntheticRoot.id);
        for (const child of data.tree) {
          toExpand.add(child.id);
        }
        setExpandedNodes(toExpand);
        setSelectedNode(syntheticRoot);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load taxonomy tree");
      } finally {
        setLoading(false);
      }
    };
    fetchTree();
  }, []);

  const toggleNodeExpand = useCallback((id: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAllNodes = useCallback(() => {
    if (!treeData) return;
    setExpandedNodes(collectAllNodeIds(treeData));
  }, [treeData]);

  const collapseAllNodes = useCallback(() => {
    if (!treeData) return;
    setExpandedNodes(new Set([treeData.id]));
  }, [treeData]);

  const expandToNode = useCallback((nodeId: string) => {
    setExpandedNodes((prev) => {
      if (prev.has(nodeId)) return prev;
      const next = new Set(prev);
      next.add(nodeId);
      return next;
    });
  }, []);

  // Tree search
  const { search, treeSearchState } = useTreeSearch(treeData, {
    onMatchChange: (nodeId) => {
      if (nodeId && treeData) {
        const findNode = (node: TreeNode): TreeNode | null => {
          if (node.id === nodeId) return node;
          for (const child of node.children || []) {
            const found = findNode(child);
            if (found) return found;
          }
          return null;
        };
        const matchedNode = findNode(treeData);
        if (matchedNode) setSelectedNode(matchedNode);
      }
    },
    onExpandToNode: expandToNode,
  });

  // Keyboard navigation
  const handleTreeKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!selectedNode || !treeData) return;

      const visibleNodes = getVisibleNodes(treeData, expandedNodes);
      const currentIndex = visibleNodes.findIndex((n) => n.id === selectedNode.id);
      if (currentIndex === -1) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          if (currentIndex < visibleNodes.length - 1) setSelectedNode(visibleNodes[currentIndex + 1]);
          break;
        case "ArrowUp":
          e.preventDefault();
          if (currentIndex > 0) setSelectedNode(visibleNodes[currentIndex - 1]);
          break;
        case "ArrowRight":
          e.preventDefault();
          if (selectedNode.children?.length) {
            if (!expandedNodes.has(selectedNode.id)) toggleNodeExpand(selectedNode.id);
            else setSelectedNode(selectedNode.children[0]);
          }
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (selectedNode.children?.length && expandedNodes.has(selectedNode.id)) {
            toggleNodeExpand(selectedNode.id);
          } else {
            const parent = findParentNode(selectedNode.id, treeData);
            if (parent) setSelectedNode(parent);
          }
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          if (selectedNode.children?.length) toggleNodeExpand(selectedNode.id);
          break;
      }
    },
    [selectedNode, treeData, expandedNodes, toggleNodeExpand]
  );

  // Double-click → navigate to entity detail page
  const navigateToEntity = useCallback(
    (node: TreeNode) => {
      switch (node.type) {
        case "domain":
          router.push(`/x/domains?id=${node.id}`);
          break;
        case "playbook":
          router.push(`/x/playbooks/${node.id}`);
          break;
        case "spec":
          router.push(`/x/specs?id=${node.id}`);
          break;
        case "parameter":
          router.push(`/x/dictionary?search=${encodeURIComponent(node.meta?.parameterId || node.name)}`);
          break;
      }
    },
    [router]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (error || !treeData) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="rounded-md bg-red-100 dark:bg-red-900/20 p-4 text-red-600 dark:text-red-400">
          {error || "Failed to load taxonomy tree"}
        </div>
      </div>
    );
  }

  const orphanCount = (stats?.orphanSpecs || 0) + (stats?.orphanParameters || 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Stats bar */}
      {stats && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 16px", borderBottom: "1px solid var(--border-default)", fontSize: 11, color: "var(--text-muted)" }}>
          <span><strong>{stats.domains}</strong> domains</span>
          <span style={{ color: "var(--border-default)" }}>|</span>
          <span><strong>{stats.playbooks}</strong> playbooks</span>
          <span style={{ color: "var(--border-default)" }}>|</span>
          <span><strong>{stats.specs}</strong> specs</span>
          <span style={{ color: "var(--border-default)" }}>|</span>
          <span><strong>{stats.parameters}</strong> parameters</span>
          {orphanCount > 0 && (
            <>
              <span style={{ color: "var(--border-default)" }}>|</span>
              <span style={{ color: "var(--status-warning-text)" }}>{orphanCount} orphans</span>
            </>
          )}
        </div>
      )}

      {/* Two-panel layout */}
      <div style={{ display: "grid", gridTemplateColumns: "350px 1fr", gap: 0, flex: 1, minHeight: 0 }}>
        {/* Left Panel: Tree */}
        <div style={{ display: "flex", flexDirection: "column", borderRight: "1px solid var(--border-default)", background: "var(--surface-secondary)", overflow: "hidden" }}>
          {/* Tree Header */}
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-default)", background: "var(--surface-primary)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)" }}>
                Structure
              </span>
              <div style={{ display: "flex", gap: 4 }}>
                <button
                  onClick={expandAllNodes}
                  style={{
                    padding: "2px 8px",
                    fontSize: 11,
                    fontWeight: 600,
                    background: "var(--surface-selected)",
                    color: "var(--accent-primary)",
                    border: "1px solid var(--accent-primary)",
                    borderRadius: 4,
                    cursor: "pointer",
                  }}
                >
                  + Expand All
                </button>
                <button
                  onClick={collapseAllNodes}
                  style={{
                    padding: "2px 8px",
                    fontSize: 11,
                    fontWeight: 600,
                    background: "var(--surface-primary)",
                    color: "var(--text-muted)",
                    border: "1px solid var(--border-default)",
                    borderRadius: 4,
                    cursor: "pointer",
                  }}
                >
                  − Collapse
                </button>
              </div>
            </div>
            <VisualizerSearch search={search} placeholder="Search tree..." />
          </div>
          {/* Tree Content */}
          <div
            tabIndex={0}
            onKeyDown={handleTreeKeyDown}
            style={{ flex: 1, overflowY: "auto", padding: 8, outline: "none" }}
            onFocus={() => {
              if (!selectedNode && treeData) setSelectedNode(treeData);
            }}
          >
            <SharedExplorerTreeNode
              node={treeData}
              depth={0}
              expandedNodes={expandedNodes}
              selectedNode={selectedNode}
              onToggle={toggleNodeExpand}
              onSelect={setSelectedNode}
              onDoubleClick={navigateToEntity}
              searchState={treeSearchState}
            />
          </div>
        </div>

        {/* Right Panel: Detail */}
        <div style={{ display: "flex", flexDirection: "column", background: "var(--surface-primary)", overflow: "hidden" }}>
          {selectedNode ? (
            <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
              <SharedNodeDetailPanel node={selectedNode} />
              {/* Navigation button for navigable types */}
              {["domain", "playbook", "spec", "parameter"].includes(selectedNode.type) && (
                <div style={{ padding: "12px 24px", borderTop: "1px solid var(--border-default)" }}>
                  <button
                    onClick={() => navigateToEntity(selectedNode)}
                    style={{
                      width: "100%",
                      fontSize: 12,
                      fontWeight: 600,
                      textAlign: "center",
                      padding: "8px 0",
                      borderRadius: 6,
                      background: "var(--accent-primary)",
                      color: "#fff",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    Open Detail →
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-placeholder)" }}>
              <span style={{ fontSize: 48, marginBottom: 16 }}>🌳</span>
              <p style={{ fontSize: 13, margin: 0 }}>Select an item from the tree to view details</p>
              <p style={{ fontSize: 11, marginTop: 4, color: "var(--text-muted)" }}>Double-click to navigate to detail page</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
