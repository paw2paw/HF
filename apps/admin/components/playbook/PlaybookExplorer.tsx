"use client";

import { useState, useEffect, useCallback } from "react";

// Tree node type for Explorer
export interface TreeNode {
  id: string;
  type: string;
  name: string;
  description?: string;
  meta?: Record<string, any>;
  children?: TreeNode[];
}

// Icons for different node types
const nodeIcons: Record<string, string> = {
  playbook: "📚",
  group: "📁",
  "output-group": "📂",
  spec: "📋",
  trigger: "⚡",
  action: "▶️",
  parameter: "📐",
  "anchor-group": "📍",
  anchor: "🎚️",
  "target-group": "🎯",
  target: "🎯",
  config: "⚙️",
  scoring: "📊",
  thresholds: "📏",
  slug: "🏷️",
  "param-ref": "🔗",
  template: "📝",
  "template-content": "📜",
  block: "🧱",
  info: "ℹ️",
  "learn-config": "🧠",
  "config-item": "•",
  instruction: "📋",
};

// Colors for different node types
const nodeColors: Record<string, { bg: string; border: string; text: string; selectedBg: string }> = {
  playbook: { bg: "#f3e8ff", border: "#c084fc", text: "#7c3aed", selectedBg: "#ede9fe" },
  group: { bg: "#eff6ff", border: "#93c5fd", text: "#2563eb", selectedBg: "#dbeafe" },
  "output-group": { bg: "#f1f5f9", border: "#94a3b8", text: "#475569", selectedBg: "#e2e8f0" },
  spec: { bg: "#f0fdf4", border: "#86efac", text: "#16a34a", selectedBg: "#dcfce7" },
  trigger: { bg: "#fef9c3", border: "#fde047", text: "#ca8a04", selectedBg: "#fef08a" },
  action: { bg: "#ffedd5", border: "#fdba74", text: "#ea580c", selectedBg: "#fed7aa" },
  parameter: { bg: "#eef2ff", border: "#a5b4fc", text: "#4f46e5", selectedBg: "#e0e7ff" },
  "anchor-group": { bg: "#fdf2f8", border: "#f9a8d4", text: "#db2777", selectedBg: "#fce7f3" },
  anchor: { bg: "#fdf2f8", border: "#f9a8d4", text: "#be185d", selectedBg: "#fce7f3" },
  "target-group": { bg: "#f0fdfa", border: "#5eead4", text: "#0d9488", selectedBg: "#ccfbf1" },
  target: { bg: "#f0fdfa", border: "#5eead4", text: "#0f766e", selectedBg: "#ccfbf1" },
  config: { bg: "#f9fafb", border: "#d1d5db", text: "#6b7280", selectedBg: "#f3f4f6" },
  template: { bg: "#fffbeb", border: "#fcd34d", text: "#b45309", selectedBg: "#fef3c7" },
  "template-content": { bg: "#fefce8", border: "#facc15", text: "#a16207", selectedBg: "#fef9c3" },
  block: { bg: "#fffbeb", border: "#fcd34d", text: "#92400e", selectedBg: "#fef3c7" },
  info: { bg: "#f0f9ff", border: "#7dd3fc", text: "#0284c7", selectedBg: "#e0f2fe" },
  "learn-config": { bg: "#fdf4ff", border: "#e879f9", text: "#a21caf", selectedBg: "#fae8ff" },
  "config-item": { bg: "#f9fafb", border: "#d1d5db", text: "#4b5563", selectedBg: "#f3f4f6" },
  instruction: { bg: "#ecfdf5", border: "#6ee7b7", text: "#047857", selectedBg: "#d1fae5" },
};

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
    } catch (err: any) {
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
    const search = (node: TreeNode): TreeNode | null => {
      if (node.children) {
        for (const child of node.children) {
          if (child.id === targetId) return node;
          const found = search(child);
          if (found) return found;
        }
      }
      return null;
    };
    return search(root);
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
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
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
          <ExplorerTreeNode
            node={explorerTree}
            depth={0}
            expandedNodes={expandedNodes}
            selectedNode={selectedNode}
            onToggle={toggleNodeExpand}
            onSelect={setSelectedNode}
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
          <NodeDetailPanel node={selectedNode} />
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

// Explorer Tree Node Component
function ExplorerTreeNode({
  node,
  depth,
  expandedNodes,
  selectedNode,
  onToggle,
  onSelect,
  isLast = false,
  parentLines = [],
}: {
  node: TreeNode;
  depth: number;
  expandedNodes: Set<string>;
  selectedNode: TreeNode | null;
  onToggle: (id: string) => void;
  onSelect: (node: TreeNode) => void;
  isLast?: boolean;
  parentLines?: boolean[];
}) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedNodes.has(node.id);
  const isSelected = selectedNode?.id === node.id;
  const icon = nodeIcons[node.type] || "📄";
  const colors = nodeColors[node.type] || nodeColors.config;

  // Windows Explorer style [+]/[-] toggle box
  const ToggleBox = () => {
    if (!hasChildren) {
      return <span style={{ width: 16, height: 16, display: "inline-block" }} />;
    }
    return (
      <span
        onClick={(e) => {
          e.stopPropagation();
          onToggle(node.id);
        }}
        style={{
          width: 16,
          height: 16,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          border: "1px solid #9ca3af",
          borderRadius: 2,
          background: "#fff",
          fontSize: 12,
          fontWeight: 700,
          color: "#6b7280",
          cursor: "pointer",
          flexShrink: 0,
          lineHeight: 1,
          fontFamily: "monospace",
        }}
        title={isExpanded ? "Collapse" : "Expand"}
      >
        {isExpanded ? "−" : "+"}
      </span>
    );
  };

  return (
    <div style={{ position: "relative" }}>
      {/* Tree connector lines */}
      {depth > 0 && (
        <>
          {parentLines.map((showLine, i) => (
            showLine && (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: i * 20 + 8,
                  top: 0,
                  bottom: 0,
                  width: 1,
                  background: "#d1d5db",
                }}
              />
            )
          ))}
          <div
            style={{
              position: "absolute",
              left: (depth - 1) * 20 + 8,
              top: 14,
              width: 12,
              height: 1,
              background: "#d1d5db",
            }}
          />
          {!isLast && (
            <div
              style={{
                position: "absolute",
                left: (depth - 1) * 20 + 8,
                top: 0,
                bottom: 0,
                width: 1,
                background: "#d1d5db",
              }}
            />
          )}
          <div
            style={{
              position: "absolute",
              left: (depth - 1) * 20 + 8,
              top: 0,
              height: 15,
              width: 1,
              background: "#d1d5db",
            }}
          />
        </>
      )}

      <div
        data-node-id={node.id}
        onClick={() => onSelect(node)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 8px",
          marginLeft: depth * 20,
          borderRadius: 4,
          cursor: "pointer",
          background: isSelected ? colors.selectedBg : "transparent",
          border: isSelected ? `1px solid ${colors.border}` : "1px solid transparent",
          transition: "background 0.1s",
          position: "relative",
        }}
        ref={(el) => {
          if (isSelected && el) {
            el.scrollIntoView({ block: "nearest", behavior: "smooth" });
          }
        }}
        onMouseEnter={(e) => {
          if (!isSelected) e.currentTarget.style.background = "#f3f4f6";
        }}
        onMouseLeave={(e) => {
          if (!isSelected) e.currentTarget.style.background = "transparent";
        }}
      >
        <ToggleBox />
        <span style={{ flexShrink: 0, fontSize: 14 }}>{icon}</span>
        <span style={{
          fontSize: 12,
          fontWeight: isSelected ? 600 : 400,
          color: isSelected ? colors.text : "#374151",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {node.name}
        </span>
        {hasChildren && (
          <span style={{
            fontSize: 10,
            color: "#6b7280",
            background: "#e5e7eb",
            padding: "1px 5px",
            borderRadius: 8,
            marginLeft: "auto",
            flexShrink: 0,
          }}>
            {node.children!.length}
          </span>
        )}
      </div>

      {hasChildren && isExpanded && (
        <div>
          {node.children!.map((child, index) => (
            <ExplorerTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedNodes={expandedNodes}
              selectedNode={selectedNode}
              onToggle={onToggle}
              onSelect={onSelect}
              isLast={index === node.children!.length - 1}
              parentLines={[...parentLines, !isLast]}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Node Detail Panel Component
function NodeDetailPanel({ node }: { node: TreeNode }) {
  const icon = nodeIcons[node.type] || "📄";
  const colors = nodeColors[node.type] || nodeColors.config;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div style={{
        padding: "20px 24px",
        borderBottom: "1px solid #e5e7eb",
        background: colors.bg,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 32 }}>{icon}</span>
          <div>
            <span style={{
              fontSize: 10,
              textTransform: "uppercase",
              color: colors.text,
              fontWeight: 600,
              letterSpacing: "0.05em",
            }}>
              {node.type}
            </span>
            <h2 style={{
              margin: "4px 0 0 0",
              fontSize: 18,
              fontWeight: 600,
              color: "#111827",
            }}>
              {node.name}
            </h2>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
        {/* Description */}
        {node.description && (
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ margin: "0 0 8px 0", fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>
              Description
            </h3>
            <p style={{
              margin: 0,
              fontSize: 13,
              color: "#374151",
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
            }}>
              {node.description}
            </p>
          </div>
        )}

        {/* Metadata */}
        {node.meta && Object.keys(node.meta).length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>
              Properties
            </h3>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              gap: 12,
            }}>
              {Object.entries(node.meta)
                .filter(([k, v]) => v !== null && v !== undefined && k !== "fullTemplate" && k !== "fullDescription" && k !== "fullText")
                .map(([key, value]) => (
                  <div
                    key={key}
                    style={{
                      padding: "10px 12px",
                      background: "#f9fafb",
                      borderRadius: 6,
                      border: "1px solid #e5e7eb",
                    }}
                  >
                    <div style={{
                      fontSize: 10,
                      color: "#6b7280",
                      textTransform: "uppercase",
                      marginBottom: 4,
                      fontWeight: 500,
                    }}>
                      {key}
                    </div>
                    <div style={{
                      fontSize: 13,
                      color: "#111827",
                      fontWeight: 500,
                      wordBreak: "break-word",
                    }}>
                      {typeof value === "boolean"
                        ? (value ? "✓ Yes" : "✗ No")
                        : typeof value === "number"
                        ? value.toLocaleString()
                        : Array.isArray(value)
                        ? value.join(", ")
                        : typeof value === "object"
                        ? JSON.stringify(value)
                        : String(value)
                      }
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Full Template Content */}
        {node.type === "template-content" && node.meta?.fullTemplate && (
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>
              Full Template ({node.meta.length} chars)
            </h3>
            <pre style={{
              margin: 0,
              padding: 16,
              background: "#1f2937",
              color: "#f3f4f6",
              borderRadius: 8,
              fontSize: 12,
              lineHeight: 1.6,
              overflow: "auto",
              maxHeight: 400,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}>
              {node.meta.fullTemplate}
            </pre>
          </div>
        )}

        {/* Full Description */}
        {node.type === "info" && node.meta?.fullDescription && (
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>
              Full Description
            </h3>
            <p style={{
              margin: 0,
              padding: 16,
              background: "#f0f9ff",
              borderRadius: 8,
              border: "1px solid #7dd3fc",
              fontSize: 13,
              lineHeight: 1.6,
              color: "#0c4a6e",
              whiteSpace: "pre-wrap",
            }}>
              {node.meta.fullDescription}
            </p>
          </div>
        )}

        {/* Instruction Content */}
        {node.type === "instruction" && node.meta?.fullText && (
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>
              Instruction
            </h3>
            <p style={{
              margin: 0,
              padding: 16,
              background: "#ecfdf5",
              borderRadius: 8,
              border: "1px solid #6ee7b7",
              fontSize: 13,
              lineHeight: 1.6,
              color: "#065f46",
              whiteSpace: "pre-wrap",
            }}>
              {node.meta.fullText}
            </p>
          </div>
        )}

        {/* Children Summary */}
        {node.children && node.children.length > 0 && (
          <div>
            <h3 style={{ margin: "0 0 12px 0", fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>
              Contains ({node.children.length} items)
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {node.children.slice(0, 10).map((child) => {
                const childIcon = nodeIcons[child.type] || "📄";
                const childColors = nodeColors[child.type] || nodeColors.config;
                return (
                  <div
                    key={child.id}
                    style={{
                      padding: "10px 12px",
                      background: childColors.bg,
                      borderRadius: 6,
                      border: `1px solid ${childColors.border}`,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span style={{ fontSize: 14 }}>{childIcon}</span>
                    <span style={{ fontSize: 12, color: childColors.text, fontWeight: 500 }}>
                      {child.name}
                    </span>
                    <span style={{
                      fontSize: 10,
                      color: "#9ca3af",
                      marginLeft: "auto",
                      textTransform: "uppercase",
                    }}>
                      {child.type}
                    </span>
                  </div>
                );
              })}
              {node.children.length > 10 && (
                <div style={{ fontSize: 12, color: "#6b7280", fontStyle: "italic" }}>
                  +{node.children.length - 10} more items...
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PlaybookExplorer;
