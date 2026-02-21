"use client";

import React from "react";
import Link from "next/link";
import { TreeNode, nodeIcons, nodeColors } from "@/components/shared/ExplorerTree";
import { SpecRoleBadge } from "@/components/shared/SpecRoleBadge";
import { Spec, PlaybookItem, AvailableItems } from "./types";

// ============================================================
// Props
// ============================================================

export type ExplorerTabProps = {
  explorerLoading: boolean;
  explorerTree: TreeNode | null;
  expandedNodes: Set<string>;
  selectedNode: TreeNode | null;
  setSelectedNode: (node: TreeNode) => void;
  expandAllNodes: () => void;
  collapseAllNodes: () => void;
  handleTreeKeyDown: (e: React.KeyboardEvent) => void;
  toggleNodeExpand: (id: string) => void;
  systemSpecsHaveChanges: boolean;
  handleSaveSystemSpecs: () => void;
  savingSystemSpecs: boolean;
  availableItems: AvailableItems | null;
  systemSpecToggles: Map<string, boolean>;
  hasConfigOverride: (specId: string) => boolean;
  handleOpenConfigModal: (spec: Spec) => void;
  handleToggleSystemSpec: (specId: string) => void;
  routePrefix: string;
  items: PlaybookItem[];
  outputTypeBadge: (outputType: string) => React.ReactNode;
};

// ============================================================
// ExplorerTabContent
// ============================================================

export function ExplorerTabContent({
  explorerLoading,
  explorerTree,
  expandedNodes,
  selectedNode,
  setSelectedNode,
  expandAllNodes,
  collapseAllNodes,
  handleTreeKeyDown,
  toggleNodeExpand,
  systemSpecsHaveChanges,
  handleSaveSystemSpecs,
  savingSystemSpecs,
  availableItems,
  systemSpecToggles,
  hasConfigOverride,
  handleOpenConfigModal,
  handleToggleSystemSpec,
  routePrefix,
  items,
  outputTypeBadge,
}: ExplorerTabProps) {
  return (
        <div style={{ marginTop: 24 }}>
          {explorerLoading ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
              Loading playbook tree...
            </div>
          ) : !explorerTree ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
              Failed to load playbook structure
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "350px 1fr", gap: 24, height: "calc(100vh - 300px)" }}>
              {/* Left Panel: File Explorer Tree */}
              <div style={{
                background: "var(--background)",
                borderRadius: 8,
                border: "1px solid var(--border-default)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}>
                {/* Tree Header */}
                <div style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid var(--border-default)",
                  background: "var(--surface-primary)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}>
                  <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-secondary)" }}>Playbook Structure</span>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button
                      onClick={expandAllNodes}
                      style={{
                        padding: "4px 8px",
                        fontSize: 11,
                        background: "var(--status-info-bg)",
                        color: "var(--button-primary-bg)",
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
                        background: "var(--surface-secondary)",
                        color: "var(--text-muted)",
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
                  onFocus={(e) => {
                    // Auto-select root if nothing selected
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

              {/* Right Panel: Detail View or Group Specs Panel */}
              <div style={{
                background: "var(--surface-primary)",
                borderRadius: 8,
                border: "1px solid var(--border-default)",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}>
                {selectedNode ? (
                  // Check if this is a group node - show spec cards with toggles
                  (selectedNode.type === "group" || selectedNode.type === "output-group") && selectedNode.children && selectedNode.children.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                      {/* Group Header */}
                      <div style={{
                        padding: "16px 20px",
                        borderBottom: "1px solid var(--border-default)",
                        background: "var(--background)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}>
                        <div>
                          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
                            {selectedNode.name}
                          </h3>
                          <p style={{ margin: "4px 0 0 0", fontSize: 11, color: "var(--text-muted)" }}>
                            {selectedNode.meta?.count || selectedNode.children.length} specs
                            {selectedNode.meta?.enabledCount !== undefined &&
                              ` • ${selectedNode.meta.enabledCount} enabled`}
                          </p>
                        </div>
                        {systemSpecsHaveChanges && (
                          <button
                            onClick={handleSaveSystemSpecs}
                            disabled={savingSystemSpecs}
                            style={{
                              padding: "6px 12px",
                              fontSize: 12,
                              fontWeight: 500,
                              background: "var(--status-success-text)",
                              color: "white",
                              border: "none",
                              borderRadius: 4,
                              cursor: savingSystemSpecs ? "not-allowed" : "pointer",
                            }}
                          >
                            {savingSystemSpecs ? "Saving..." : "Save Changes"}
                          </button>
                        )}
                      </div>

                      {/* Spec Cards with Toggles */}
                      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
                        {(() => {
                          // Collect all spec nodes from children (handle nested output-groups)
                          const collectSpecs = (nodes: TreeNode[]): TreeNode[] => {
                            const specs: TreeNode[] = [];
                            for (const node of nodes) {
                              if (node.type === "spec") {
                                specs.push(node);
                              } else if (node.children) {
                                specs.push(...collectSpecs(node.children));
                              }
                            }
                            return specs;
                          };

                          const specNodes = collectSpecs(selectedNode.children || []);

                          // If this has output-groups, group by those
                          const hasSubGroups = selectedNode.children?.some(c => c.type === "output-group");

                          if (hasSubGroups) {
                            // Render grouped by output-group
                            return selectedNode.children?.map((subGroup) => {
                              if (subGroup.type !== "output-group") return null;
                              const subSpecs = collectSpecs(subGroup.children || []);
                              if (subSpecs.length === 0) return null;

                              return (
                                <div key={subGroup.id} style={{ marginBottom: 20 }}>
                                  <div style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: "var(--text-muted)",
                                    letterSpacing: "0.05em",
                                    marginBottom: 8,
                                    paddingBottom: 4,
                                    borderBottom: "1px solid var(--input-border)",
                                  }}>
                                    {subGroup.name}
                                  </div>
                                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                    {subSpecs.map((specNode) => {
                                      const spec = (availableItems?.systemSpecs || []).find(s => s.id === specNode.id);
                                      const isEnabled = systemSpecToggles.get(specNode.id) ?? true;
                                      const isGloballyActive = specNode.meta?.isActive !== false;
                                      const effectiveEnabled = isGloballyActive && isEnabled;
                                      const specHasOverride = hasConfigOverride(specNode.id);
                                      const specHasConfig = spec?.config && Object.keys(spec.config).length > 0;

                                      return (
                                        <div
                                          key={specNode.id}
                                          style={{
                                            padding: "12px 14px",
                                            background: !isGloballyActive
                                              ? "var(--status-error-bg)"
                                              : specHasOverride
                                                ? "var(--status-warning-bg)"
                                                : effectiveEnabled
                                                  ? "var(--surface-primary)"
                                                  : "var(--background)",
                                            border: !isGloballyActive
                                              ? "1px solid var(--status-error-border)"
                                              : specHasOverride
                                                ? "1px solid var(--status-warning-border)"
                                                : effectiveEnabled
                                                  ? "1px solid var(--status-success-border)"
                                                  : "1px solid var(--border-default)",
                                            borderRadius: 8,
                                            opacity: effectiveEnabled ? 1 : 0.6,
                                            transition: "all 0.15s",
                                          }}
                                        >
                                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                              <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4, flexWrap: "wrap" }}>
                                                <SpecRoleBadge role={specNode.meta?.specRole || spec?.specRole} size="sm" showIcon={false} />
                                                {outputTypeBadge(specNode.meta?.outputType || spec?.outputType || "")}
                                                {!isGloballyActive && (
                                                  <span style={{
                                                    fontSize: 9,
                                                    fontWeight: 600,
                                                    padding: "1px 4px",
                                                    background: "var(--button-destructive-bg)",
                                                    color: "white",
                                                    borderRadius: 3,
                                                    textTransform: "uppercase",
                                                  }}>
                                                    Inactive
                                                  </span>
                                                )}
                                              </div>
                                              <Link
                                                href={`${routePrefix}/specs/${specNode.id}`}
                                                style={{
                                                  fontWeight: 600,
                                                  fontSize: 13,
                                                  color: effectiveEnabled ? "var(--text-primary)" : "var(--text-muted)",
                                                  textDecoration: "none",
                                                  display: "block",
                                                  marginBottom: 4,
                                                }}
                                              >
                                                {specNode.name.replace(/^🚫\s*/, "")}
                                              </Link>
                                              {specNode.description && (
                                                <div style={{
                                                  fontSize: 11,
                                                  color: effectiveEnabled ? "var(--text-muted)" : "var(--text-placeholder)",
                                                  lineHeight: 1.4,
                                                  overflow: "hidden",
                                                  display: "-webkit-box",
                                                  WebkitLineClamp: 2,
                                                  WebkitBoxOrient: "vertical",
                                                }}>
                                                  {specNode.description}
                                                </div>
                                              )}
                                            </div>
                                            {/* Toggle controls */}
                                            {isGloballyActive && (
                                              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                                                {specHasConfig && (
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      if (spec) handleOpenConfigModal(spec);
                                                    }}
                                                    style={{
                                                      width: 28,
                                                      height: 28,
                                                      borderRadius: 6,
                                                      border: specHasOverride ? "2px solid var(--status-warning-text)" : "1px solid var(--input-border)",
                                                      background: specHasOverride ? "var(--status-warning-bg)" : "var(--surface-primary)",
                                                      cursor: "pointer",
                                                      display: "flex",
                                                      alignItems: "center",
                                                      justifyContent: "center",
                                                    }}
                                                    title={specHasOverride ? "Config overridden - click to edit" : "Configure spec settings"}
                                                  >
                                                    <span style={{ fontSize: 14 }}>⚙️</span>
                                                  </button>
                                                )}
                                                <button
                                                  onClick={() => handleToggleSystemSpec(specNode.id)}
                                                  style={{
                                                    width: 40,
                                                    height: 22,
                                                    borderRadius: 11,
                                                    border: "none",
                                                    background: isEnabled ? "var(--status-success-text)" : "var(--button-disabled-bg)",
                                                    cursor: "pointer",
                                                    position: "relative",
                                                    transition: "background 0.15s",
                                                  }}
                                                >
                                                  <div style={{
                                                    width: 18,
                                                    height: 18,
                                                    borderRadius: "50%",
                                                    background: "var(--surface-primary)",
                                                    position: "absolute",
                                                    top: 2,
                                                    left: isEnabled ? 20 : 2,
                                                    transition: "left 0.15s",
                                                    boxShadow: "0 1px 3px color-mix(in srgb, var(--text-primary) 20%, transparent)",
                                                  }} />
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            });
                          } else {
                            // Render flat list of specs
                            return (
                              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {specNodes.map((specNode) => {
                                  const spec = (availableItems?.systemSpecs || []).find(s => s.id === specNode.id) ||
                                               items.find(i => i.spec?.id === specNode.id)?.spec;
                                  const isSystemSpec = specNode.meta?.isSystemSpec;
                                  const isEnabled = isSystemSpec
                                    ? (systemSpecToggles.get(specNode.id) ?? true)
                                    : true;
                                  const isGloballyActive = specNode.meta?.isActive !== false;
                                  const effectiveEnabled = isGloballyActive && isEnabled;
                                  const specHasOverride = isSystemSpec && hasConfigOverride(specNode.id);
                                  const specHasConfig = spec?.config && Object.keys(spec.config).length > 0;

                                  return (
                                    <div
                                      key={specNode.id}
                                      style={{
                                        padding: "12px 14px",
                                        background: effectiveEnabled ? "var(--surface-primary)" : "var(--background)",
                                        border: effectiveEnabled
                                          ? "1px solid var(--status-success-border)"
                                          : "1px solid var(--border-default)",
                                        borderRadius: 8,
                                        opacity: effectiveEnabled ? 1 : 0.6,
                                      }}
                                    >
                                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                          <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4, flexWrap: "wrap" }}>
                                            <SpecRoleBadge role={specNode.meta?.specRole || spec?.specRole} size="sm" showIcon={false} />
                                            {outputTypeBadge(specNode.meta?.outputType || spec?.outputType || "")}
                                          </div>
                                          <Link
                                            href={`${routePrefix}/specs/${specNode.id}`}
                                            style={{
                                              fontWeight: 600,
                                              fontSize: 13,
                                              color: effectiveEnabled ? "var(--text-primary)" : "var(--text-muted)",
                                              textDecoration: "none",
                                              display: "block",
                                              marginBottom: 4,
                                            }}
                                          >
                                            {specNode.name.replace(/^🚫\s*/, "")}
                                          </Link>
                                          {specNode.description && (
                                            <div style={{
                                              fontSize: 11,
                                              color: effectiveEnabled ? "var(--text-muted)" : "var(--text-placeholder)",
                                              lineHeight: 1.4,
                                            }}>
                                              {specNode.description}
                                            </div>
                                          )}
                                        </div>
                                        {/* Toggle for system specs only */}
                                        {isSystemSpec && isGloballyActive && (
                                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                                            {specHasConfig && (
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  if (spec) handleOpenConfigModal(spec as Spec);
                                                }}
                                                style={{
                                                  width: 28,
                                                  height: 28,
                                                  borderRadius: 6,
                                                  border: specHasOverride ? "2px solid var(--status-warning-text)" : "1px solid var(--input-border)",
                                                  background: specHasOverride ? "var(--status-warning-bg)" : "var(--surface-primary)",
                                                  cursor: "pointer",
                                                  display: "flex",
                                                  alignItems: "center",
                                                  justifyContent: "center",
                                                }}
                                                title={specHasOverride ? "Config overridden" : "Configure"}
                                              >
                                                <span style={{ fontSize: 14 }}>⚙️</span>
                                              </button>
                                            )}
                                            <button
                                              onClick={() => handleToggleSystemSpec(specNode.id)}
                                              style={{
                                                width: 40,
                                                height: 22,
                                                borderRadius: 11,
                                                border: "none",
                                                background: isEnabled ? "var(--status-success-text)" : "var(--button-disabled-bg)",
                                                cursor: "pointer",
                                                position: "relative",
                                              }}
                                            >
                                              <div style={{
                                                width: 18,
                                                height: 18,
                                                borderRadius: "50%",
                                                background: "var(--surface-primary)",
                                                position: "absolute",
                                                top: 2,
                                                left: isEnabled ? 20 : 2,
                                                boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                                              }} />
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          }
                        })()}
                      </div>
                    </div>
                  ) : (
                    // Regular detail view for non-group nodes
                    <NodeDetailPanel node={selectedNode} />
                  )
                ) : (
                  <div style={{
                    padding: 48,
                    textAlign: "center",
                    color: "var(--text-placeholder)",
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
          )}
        </div>
  );
}

// ============================================================
// ExplorerTreeNode (private helper)
// ============================================================

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
          border: "1px solid var(--text-placeholder)",
          borderRadius: 2,
          background: "var(--surface-primary)",
          fontSize: 12,
          fontWeight: 700,
          color: "var(--text-muted)",
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
          {/* Vertical lines from parent levels */}
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
                  background: "var(--button-disabled-bg)",
                }}
              />
            )
          ))}
          {/* Horizontal connector to this node */}
          <div
            style={{
              position: "absolute",
              left: (depth - 1) * 20 + 8,
              top: 14,
              width: 12,
              height: 1,
              background: "var(--button-disabled-bg)",
            }}
          />
          {/* Vertical line segment for this level (if not last) */}
          {!isLast && (
            <div
              style={{
                position: "absolute",
                left: (depth - 1) * 20 + 8,
                top: 0,
                bottom: 0,
                width: 1,
                background: "var(--button-disabled-bg)",
              }}
            />
          )}
          {/* Vertical line to horizontal for this node */}
          <div
            style={{
              position: "absolute",
              left: (depth - 1) * 20 + 8,
              top: 0,
              height: 15,
              width: 1,
              background: "var(--button-disabled-bg)",
            }}
          />
        </>
      )}

      <div
        data-node-id={node.id}
        onClick={() => {
          onSelect(node);
        }}
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
          // Scroll into view when selected
          if (isSelected && el) {
            el.scrollIntoView({ block: "nearest", behavior: "smooth" });
          }
        }}
        onMouseEnter={(e) => {
          if (!isSelected) e.currentTarget.style.background = "var(--hover-bg)";
        }}
        onMouseLeave={(e) => {
          if (!isSelected) e.currentTarget.style.background = "transparent";
        }}
      >
        {/* Windows-style [+]/[-] Toggle Box */}
        <ToggleBox />

        {/* Node Icon */}
        <span style={{ flexShrink: 0, fontSize: 14 }}>{icon}</span>

        {/* Node Name */}
        <span style={{
          fontSize: 12,
          fontWeight: isSelected ? 600 : 400,
          color: isSelected ? colors.text : "var(--text-secondary)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {node.name}
        </span>

        {/* Child Count Badge */}
        {hasChildren && (
          <span style={{
            fontSize: 10,
            color: "var(--text-muted)",
            background: "var(--border-default)",
            padding: "1px 5px",
            borderRadius: 8,
            marginLeft: "auto",
            flexShrink: 0,
          }}>
            {node.children!.length}
          </span>
        )}
      </div>

      {/* Children */}
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

// ============================================================
// NodeDetailPanel (private helper)
// ============================================================

// Node Detail Panel Component
function NodeDetailPanel({ node }: { node: TreeNode }) {
  const icon = nodeIcons[node.type] || "📄";
  const colors = nodeColors[node.type] || nodeColors.config;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div style={{
        padding: "20px 24px",
        borderBottom: "1px solid var(--border-default)",
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
              color: "var(--text-primary)",
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
            <h3 style={{ margin: "0 0 8px 0", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
              Description
            </h3>
            <p style={{
              margin: 0,
              fontSize: 13,
              color: "var(--text-secondary)",
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
            <h3 style={{ margin: "0 0 12px 0", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
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
                      background: "var(--background)",
                      borderRadius: 6,
                      border: "1px solid var(--border-default)",
                    }}
                  >
                    <div style={{
                      fontSize: 10,
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      marginBottom: 4,
                      fontWeight: 500,
                    }}>
                      {key}
                    </div>
                    <div style={{
                      fontSize: 13,
                      color: "var(--text-primary)",
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

        {/* Full Template Content (for template-content nodes) */}
        {node.type === "template-content" && node.meta?.fullTemplate && (
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
              Full Template ({node.meta.length} chars)
            </h3>
            <pre style={{
              margin: 0,
              padding: 16,
              background: "var(--code-bg)",
              color: "var(--code-text)",
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

        {/* Full Description (for info nodes) */}
        {node.type === "info" && node.meta?.fullDescription && (
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
              Full Description
            </h3>
            <p style={{
              margin: 0,
              padding: 16,
              background: "var(--status-info-bg)",
              borderRadius: 8,
              border: "1px solid var(--status-info-border)",
              fontSize: 13,
              lineHeight: 1.6,
              color: "var(--status-info-text)",
              whiteSpace: "pre-wrap",
            }}>
              {node.meta.fullDescription}
            </p>
          </div>
        )}

        {/* Instruction Content (for instruction nodes) */}
        {node.type === "instruction" && node.meta?.fullText && (
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
              Instruction
            </h3>
            <p style={{
              margin: 0,
              padding: 16,
              background: "var(--status-success-bg)",
              borderRadius: 8,
              border: "1px solid var(--status-success-border)",
              fontSize: 13,
              lineHeight: 1.6,
              color: "var(--status-success-text)",
              whiteSpace: "pre-wrap",
            }}>
              {node.meta.fullText}
            </p>
          </div>
        )}

        {/* Children Summary */}
        {node.children && node.children.length > 0 && (
          <div>
            <h3 style={{ margin: "0 0 12px 0", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
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
                      gap: 10,
                    }}
                  >
                    <span>{childIcon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: childColors.text,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}>
                        {child.name}
                      </div>
                      {child.description && (
                        <div style={{
                          fontSize: 11,
                          color: "var(--text-muted)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}>
                          {child.description}
                        </div>
                      )}
                    </div>
                    <span style={{
                      fontSize: 9,
                      padding: "2px 6px",
                      background: "var(--surface-primary)",
                      borderRadius: 4,
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                    }}>
                      {child.type}
                    </span>
                  </div>
                );
              })}
              {node.children.length > 10 && (
                <div style={{
                  padding: 12,
                  textAlign: "center",
                  color: "var(--text-muted)",
                  fontSize: 12,
                  background: "var(--background)",
                  borderRadius: 6,
                }}>
                  ...and {node.children.length - 10} more items
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
