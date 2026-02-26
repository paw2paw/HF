"use client";

import { useState, useCallback } from "react";
import { ChevronRight } from "lucide-react";

// ── Types ────────────────────────────────────────────

export interface KnowledgeNode {
  id: string;
  text: string;
  category: string;
  depth: number;
  childCount: number;
  children: KnowledgeNode[];
}

export interface SourceTree {
  sourceId: string;
  sourceName: string;
  tree: KnowledgeNode[];
}

export interface KnowledgeMapStats {
  totalTopics: number;
  totalPoints: number;
  structuredSources: number;
  totalSources: number;
}

interface KnowledgeMapTreeProps {
  sources: SourceTree[];
  stats?: KnowledgeMapStats;
  /** Depths ≤ this value start expanded (default: 1 = overview + topics) */
  initialExpandDepth?: number;
}

// ── Component ────────────────────────────────────────

export default function KnowledgeMapTree({
  sources,
  stats,
  initialExpandDepth = 1,
}: KnowledgeMapTreeProps) {
  if (sources.length === 0) {
    return <div className="hf-km-empty">No structured content yet</div>;
  }

  const showSourceLabels = sources.length > 1;

  return (
    <div>
      {stats && (
        <div className="hf-km-stats">
          <span><strong>{stats.totalTopics}</strong> topics</span>
          <span><strong>{stats.totalPoints}</strong> teaching points</span>
          <span><strong>{stats.structuredSources}</strong> of {stats.totalSources} sources structured</span>
        </div>
      )}
      <div className="hf-km-tree">
        {sources.map((source) => (
          <div key={source.sourceId}>
            {showSourceLabels && (
              <div className="hf-km-source-label">{source.sourceName}</div>
            )}
            {source.tree.map((node) => (
              <TreeNode
                key={node.id}
                node={node}
                initialExpandDepth={initialExpandDepth}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── TreeNode ────────────────────────────────────────

function TreeNode({
  node,
  initialExpandDepth,
}: {
  node: KnowledgeNode;
  initialExpandDepth: number;
}) {
  const [expanded, setExpanded] = useState(node.depth <= initialExpandDepth);
  const hasChildren = node.children.length > 0;

  const toggle = useCallback(() => setExpanded((prev) => !prev), []);

  const depthClass = node.depth <= 3 ? `hf-km-node--depth${node.depth}` : "hf-km-node--depth3";

  return (
    <div>
      <div className={`hf-km-node ${depthClass}`}>
        {hasChildren ? (
          <span
            className={`hf-km-toggle hf-chevron--sm${expanded ? " hf-chevron--open" : ""}`}
            onClick={toggle}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") toggle(); }}
          >
            <ChevronRight size={14} />
          </span>
        ) : (
          <span className="hf-km-toggle" style={{ visibility: "hidden" }}>
            <ChevronRight size={14} />
          </span>
        )}
        <span>{node.text}</span>
        {hasChildren && (
          <span className="hf-km-badge">{node.childCount}</span>
        )}
      </div>
      {hasChildren && expanded && (
        <div className="hf-km-children">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              initialExpandDepth={initialExpandDepth}
            />
          ))}
        </div>
      )}
    </div>
  );
}
