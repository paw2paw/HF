"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { SourcePageHeader } from "@/components/shared/SourcePageHeader";

interface TreeNode {
  id: string;
  type: string;
  name: string;
  description?: string;
  meta?: Record<string, any>;
  children?: TreeNode[];
}

interface TreeStats {
  totalItems: number;
  specCount: number;
  templateCount: number;
  parameterCount: number;
  targetCount: number;
}

// Icons for different node types
const nodeIcons: Record<string, string> = {
  playbook: "📚",
  group: "📁",
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
  block: "🧱",
};

// Colors for different node types
const nodeColors: Record<string, string> = {
  playbook: "bg-purple-100 border-purple-300 text-purple-800",
  group: "bg-blue-50 border-blue-200 text-blue-700",
  spec: "bg-green-50 border-green-200 text-green-700",
  trigger: "bg-yellow-50 border-yellow-200 text-yellow-700",
  action: "bg-orange-50 border-orange-200 text-orange-700",
  parameter: "bg-indigo-50 border-indigo-200 text-indigo-700",
  "anchor-group": "bg-pink-50 border-pink-200 text-pink-700",
  anchor: "bg-pink-50 border-pink-200 text-pink-600",
  "target-group": "bg-teal-50 border-teal-200 text-teal-700",
  target: "bg-teal-50 border-teal-200 text-teal-600",
  config: "bg-gray-50 border-gray-200 text-gray-600",
  template: "bg-amber-50 border-amber-200 text-amber-700",
  block: "bg-amber-50 border-amber-200 text-amber-600",
};

function TreeNodeComponent({
  node,
  depth = 0,
  expandedNodes,
  toggleExpand,
}: {
  node: TreeNode;
  depth?: number;
  expandedNodes: Set<string>;
  toggleExpand: (id: string) => void;
}) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedNodes.has(node.id);
  const icon = nodeIcons[node.type] || "📄";
  const colorClass = nodeColors[node.type] || "bg-gray-50 border-gray-200 text-gray-700";

  return (
    <div className="tree-node">
      <div
        className={`flex items-start gap-2 p-2 rounded border mb-1 cursor-pointer hover:shadow-sm transition-shadow ${colorClass}`}
        style={{ marginLeft: `${depth * 20}px` }}
        onClick={() => hasChildren && toggleExpand(node.id)}
      >
        {/* Expand/collapse toggle */}
        <span className="w-4 text-center flex-shrink-0">
          {hasChildren ? (isExpanded ? "▼" : "▶") : "•"}
        </span>

        {/* Icon */}
        <span className="flex-shrink-0">{icon}</span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{node.name}</div>
          {node.description && (
            <div className="text-xs opacity-70 mt-0.5 line-clamp-2">
              {node.description}
            </div>
          )}
          {node.meta && Object.keys(node.meta).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {Object.entries(node.meta)
                .filter(([k, v]) => v !== null && v !== undefined && !["id"].includes(k))
                .slice(0, 5)
                .map(([key, value]) => (
                  <span
                    key={key}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-white/50 border border-current/20"
                  >
                    {key}: {typeof value === "boolean" ? (value ? "✓" : "✗") : String(value).slice(0, 20)}
                  </span>
                ))}
            </div>
          )}
        </div>

        {/* Type badge */}
        <span className="text-[10px] uppercase opacity-50 flex-shrink-0">
          {node.type}
        </span>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="tree-children">
          {node.children!.map((child) => (
            <TreeNodeComponent
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedNodes={expandedNodes}
              toggleExpand={toggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function PlaybookTreePage({
  params,
}: {
  params: Promise<{ playbookId: string }>;
}) {
  const { playbookId } = use(params);
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [stats, setStats] = useState<TreeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchTree = async () => {
      try {
        const res = await fetch(`/api/playbooks/${playbookId}/tree`);
        const data = await res.json();

        if (data.ok) {
          setTree(data.tree);
          setStats(data.stats);
          // Auto-expand first two levels
          const toExpand = new Set<string>();
          if (data.tree) {
            toExpand.add(data.tree.id);
            data.tree.children?.forEach((child: TreeNode) => {
              toExpand.add(child.id);
            });
          }
          setExpandedNodes(toExpand);
        } else {
          setError(data.error);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTree();
  }, [playbookId]);

  const toggleExpand = (id: string) => {
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

  const expandAll = () => {
    if (!tree) return;
    const allIds = new Set<string>();
    const collectIds = (node: TreeNode) => {
      allIds.add(node.id);
      node.children?.forEach(collectIds);
    };
    collectIds(tree);
    setExpandedNodes(allIds);
  };

  const collapseAll = () => {
    if (!tree) return;
    setExpandedNodes(new Set([tree.id]));
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">Loading playbook tree...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-red-600">Error: {error}</div>
        <Link href="/playbooks" className="text-blue-600 hover:underline mt-2 inline-block">
          ← Back to Playbooks
        </Link>
      </div>
    );
  }

  if (!tree) {
    return (
      <div className="p-6">
        <div>Playbook not found</div>
        <Link href="/playbooks" className="text-blue-600 hover:underline mt-2 inline-block">
          ← Back to Playbooks
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6">
      <SourcePageHeader
        title={`Playbook Tree: ${tree.name}`}
        description="Complete hierarchical view of all specs, parameters, anchors, and targets"
      />

      {/* Stats bar */}
      {stats && (
        <div className="flex flex-wrap gap-4 mb-4 p-3 bg-neutral-100 rounded-lg text-sm">
          <span>📋 {stats.specCount} Specs</span>
          <span>📝 {stats.templateCount} Templates</span>
          <span>📐 {stats.parameterCount} Parameters</span>
          <span>🎯 {stats.targetCount} Targets</span>
          <span className="text-neutral-500">|</span>
          <span className="text-neutral-600">Total Items: {stats.totalItems}</span>
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={expandAll}
          className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
        >
          Expand All
        </button>
        <button
          onClick={collapseAll}
          className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
        >
          Collapse All
        </button>
        <Link
          href="/playbooks"
          className="px-3 py-1.5 text-sm bg-neutral-100 text-neutral-700 rounded hover:bg-neutral-200 ml-auto"
        >
          ← Back to Playbooks
        </Link>
      </div>

      {/* Tree */}
      <div className="border rounded-lg p-4 bg-white overflow-x-auto">
        <TreeNodeComponent
          node={tree}
          expandedNodes={expandedNodes}
          toggleExpand={toggleExpand}
        />
      </div>

      {/* Legend */}
      <div className="mt-6 p-4 bg-neutral-50 rounded-lg">
        <h3 className="font-medium mb-2 text-sm">Legend</h3>
        <div className="flex flex-wrap gap-3 text-xs">
          {Object.entries(nodeIcons).map(([type, icon]) => (
            <span key={type} className={`px-2 py-1 rounded ${nodeColors[type] || "bg-gray-50"}`}>
              {icon} {type}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
