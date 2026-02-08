"use client";

import { useState, useEffect, useCallback } from "react";
import {
  TreeNode,
  ExplorerTreeNode as SharedExplorerTreeNode,
  NodeDetailPanel as SharedNodeDetailPanel,
  useTreeSearch,
} from "@/components/shared/ExplorerTree";
import { VisualizerSearch } from "@/components/shared/VisualizerSearch";

interface PlaybookExplorerProps {
  playbookId: string;
  height?: string;
}

export function PlaybookExplorer({ playbookId, height = "calc(100vh - 200px)" }: PlaybookExplorerProps) {
  const [explorerTree, setExplorerTree] = useState<TreeNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);

  // Fetch explorer tree
  const fetchExplorerTree = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/playbooks/${playbookId}/tree`);
      const data = await res.json();
      if (data.ok) {
        setExplorerTree(data.tree);
        // Auto-expand first two levels and select root
        const toExpand = new Set<string>();
        if (data.tree) {
          toExpand.add(data.tree.id);
          data.tree.children?.forEach((child: TreeNode) => {
            toExpand.add(child.id);
          });
          setSelectedNode(data.tree);
        }
        setExpandedNodes(toExpand);
      }
    } catch (err: unknown) {
      console.error("Error fetching explorer tree:", err);
    } finally {
      setLoading(false);
    }
  }, [playbookId]);

  useEffect(() => {
    fetchExplorerTree();
  }, [fetchExplorerTree]);

  const toggleNodeExpand = (id: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAllNodes = () => {
    if (!explorerTree) return;
    const allIds = new Set<string>();
    const collectIds = (node: TreeNode) => {
      allIds.add(node.id);
      node.children?.forEach(collectIds);
    };
    collectIds(explorerTree);
    setExpandedNodes(allIds);
  };

  const collapseAllNodes = () => {
    if (!explorerTree) return;
    setExpandedNodes(new Set([explorerTree.id]));
  };

  // Expand a specific node (for search auto-expand)
  const expandToNode = useCallback((nodeId: string) => {
    setExpandedNodes((prev) => {
      if (prev.has(nodeId)) return prev;
      const next = new Set(prev);
      next.add(nodeId);
      return next;
    });
  }, []);

  // Tree search
  const { search, treeSearchState } = useTreeSearch(explorerTree, {
    onMatchChange: (nodeId) => {
      if (nodeId && explorerTree) {
        // Find and select the matching node
        const findNode = (node: TreeNode): TreeNode | null => {
          if (node.id === nodeId) return node;
          for (const child of node.children || []) {
            const found = findNode(child);
            if (found) return found;
          }
          return null;
        };
        const matchedNode = findNode(explorerTree);
        if (matchedNode) setSelectedNode(matchedNode);
      }
    },
    onExpandToNode: expandToNode,
  });

  // Get flattened list of visible nodes for keyboard navigation
  const getVisibleNodes = useCallback((): TreeNode[] => {
    if (!explorerTree) return [];
    const result: TreeNode[] = [];
    const traverse = (node: TreeNode) => {
      result.push(node);
      if (node.children && expandedNodes.has(node.id)) {
        node.children.forEach(traverse);
      }
    };
    traverse(explorerTree);
    return result;
  }, [explorerTree, expandedNodes]);

  // Find parent node for a given node
  const findParentNode = useCallback((targetId: string, root: TreeNode | null): TreeNode | null => {
    if (!root) return null;
    const searchNode = (node: TreeNode): TreeNode | null => {
      if (node.children) {
        for (const child of node.children) {
          if (child.id === targetId) return node;
          const found = searchNode(child);
          if (found) return found;
        }
      }
      return null;
    };
    return searchNode(root);
  }, []);

  // Keyboard navigation for tree
  const handleTreeKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!selectedNode || !explorerTree) return;

    const visibleNodes = getVisibleNodes();
    const currentIndex = visibleNodes.findIndex(n => n.id === selectedNode.id);
    if (currentIndex === -1) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (currentIndex < visibleNodes.length - 1) {
          setSelectedNode(visibleNodes[currentIndex + 1]);
        }
        break;

      case "ArrowUp":
        e.preventDefault();
        if (currentIndex > 0) {
          setSelectedNode(visibleNodes[currentIndex - 1]);
        }
        break;

      case "ArrowRight":
        e.preventDefault();
        if (selectedNode.children && selectedNode.children.length > 0) {
          if (!expandedNodes.has(selectedNode.id)) {
            toggleNodeExpand(selectedNode.id);
          } else {
            setSelectedNode(selectedNode.children[0]);
          }
        }
        break;

      case "ArrowLeft":
        e.preventDefault();
        if (selectedNode.children && selectedNode.children.length > 0 && expandedNodes.has(selectedNode.id)) {
          toggleNodeExpand(selectedNode.id);
        } else {
          const parent = findParentNode(selectedNode.id, explorerTree);
          if (parent) {
            setSelectedNode(parent);
          }
        }
        break;

      case "Enter":
      case " ":
        e.preventDefault();
        if (selectedNode.children && selectedNode.children.length > 0) {
          toggleNodeExpand(selectedNode.id);
        }
        break;
    }
  }, [selectedNode, explorerTree, expandedNodes, getVisibleNodes, findParentNode, toggleNodeExpand]);

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: "#6b7280" }}>
        Loading playbook tree...
      </div>
    );
  }

  if (!explorerTree) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: "#6b7280" }}>
        Failed to load playbook structure
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "350px 1fr", gap: 24, height }}>
      {/* Left Panel: File Explorer Tree */}
      <div style={{
        background: "#f9fafb",
        borderRadius: 8,
        border: "1px solid #e5e7eb",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* Tree Header */}
        <div style={{
          padding: "12px 16px",
          borderBottom: "1px solid #e5e7eb",
          background: "white",
        }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: "#374151" }}>Playbook Structure</span>
            <div style={{ display: "flex", gap: 4 }}>
              <button
                onClick={expandAllNodes}
                style={{
                  padding: "4px 8px",
                  fontSize: 11,
                  background: "#e0e7ff",
                  color: "#4338ca",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                }}
                title="Expand all nodes in the tree"
              >
                + Expand All
              </button>
              <button
                onClick={collapseAllNodes}
                style={{
                  padding: "4px 8px",
                  fontSize: 11,
                  background: "#f3f4f6",
                  color: "#6b7280",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                }}
                title="Collapse all nodes in the tree"
              >
                − Collapse All
              </button>
            </div>
          </div>
          {/* Search */}
          <VisualizerSearch search={search} placeholder="Search tree..." />
        </div>
        {/* Tree Content */}
        <div
          tabIndex={0}
          onKeyDown={handleTreeKeyDown}
          style={{
            flex: 1,
            overflowY: "auto",
            padding: 8,
            outline: "none",
          }}
          onFocus={() => {
            if (!selectedNode && explorerTree) {
              setSelectedNode(explorerTree);
            }
          }}
        >
          <SharedExplorerTreeNode
            node={explorerTree}
            depth={0}
            expandedNodes={expandedNodes}
            selectedNode={selectedNode}
            onToggle={toggleNodeExpand}
            onSelect={setSelectedNode}
            searchState={treeSearchState}
          />
        </div>
      </div>

      {/* Right Panel: Detail View */}
      <div style={{
        background: "white",
        borderRadius: 8,
        border: "1px solid #e5e7eb",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}>
        {selectedNode ? (
          <SharedNodeDetailPanel node={selectedNode} />
        ) : (
          <div style={{
            padding: 48,
            textAlign: "center",
            color: "#9ca3af",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
          }}>
            <span style={{ fontSize: 48, marginBottom: 16 }}>🌳</span>
            <p style={{ fontSize: 14 }}>Select an item from the tree to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default PlaybookExplorer;
