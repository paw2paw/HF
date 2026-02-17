"use client";

import Link from "next/link";

// ─── Types ───────────────────────────────────────────────────────────────────

type SlugNodeType = {
  id: string;
  type: "category" | "spec" | "variable" | "value" | "produces";
  name: string;
  path?: string;
  value?: string | number | boolean | null;
  specId?: string;
  specSlug?: string;
  children?: SlugNodeType[];
  meta?: Record<string, any>;
};

export type SlugsTabContentProps = {
  slugsLoading: boolean;
  slugsData: { tree: SlugNodeType[]; counts: Record<string, number> } | null;
  activeFilter: string | null;
  setActiveFilter: (filter: string | null) => void;
  toggleFilter: (filter: string) => void;
  expandedSlugNodes: Set<string>;
  toggleSlugNodeExpand: (id: string) => void;
  routePrefix: string;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const slugCategoryIcons: Record<string, string> = {
  IDENTITY: "\u{1F3AD}",
  CONTENT: "\u{1F4D6}",
  VOICE: "\u{1F399}\uFE0F",
  MEASURE: "\u{1F4CA}",
  LEARN: "\u{1F9E0}",
  ADAPT: "\u{1F504}",
  REWARD: "\u2B50",
  GUARDRAIL: "\u{1F6E1}\uFE0F",
  COMPOSE: "\u{1F9E9}",
};

const slugCategoryColors: Record<string, { bg: string; border: string; headerBg: string }> = {
  IDENTITY: { bg: "var(--badge-blue-bg)", border: "var(--status-info-border)", headerBg: "var(--badge-blue-bg)" },
  CONTENT: { bg: "var(--badge-green-bg)", border: "var(--status-success-border)", headerBg: "var(--badge-green-bg)" },
  VOICE: { bg: "var(--status-warning-bg)", border: "var(--status-warning-border)", headerBg: "var(--badge-yellow-bg)" },
  MEASURE: { bg: "var(--status-success-bg)", border: "var(--status-success-border)", headerBg: "var(--status-success-bg)" },
  LEARN: { bg: "var(--badge-purple-bg)", border: "var(--badge-purple-text)", headerBg: "var(--badge-purple-bg)" },
  ADAPT: { bg: "var(--badge-yellow-bg)", border: "var(--status-warning-border)", headerBg: "var(--badge-yellow-bg)" },
  REWARD: { bg: "var(--badge-yellow-bg)", border: "var(--status-warning-border)", headerBg: "var(--badge-yellow-bg)" },
  GUARDRAIL: { bg: "var(--status-error-bg)", border: "var(--status-error-border)", headerBg: "var(--status-error-bg)" },
  COMPOSE: { bg: "var(--badge-pink-bg)", border: "var(--badge-pink-border)", headerBg: "var(--badge-pink-bg)" },
};

// ─── Main Component ──────────────────────────────────────────────────────────

export function SlugsTabContent({
  slugsLoading,
  slugsData,
  activeFilter,
  setActiveFilter,
  toggleFilter,
  expandedSlugNodes,
  toggleSlugNodeExpand,
  routePrefix,
}: SlugsTabContentProps) {
  return (
        <div style={{ marginTop: 24 }}>
          {slugsLoading ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
              Loading template variables...
            </div>
          ) : !slugsData ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
              Failed to load slugs data
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Summary - Clickable Filters */}
              <div style={{
                padding: 16,
                background: "var(--background)",
                borderRadius: 8,
                border: "1px solid var(--border-default)",
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                alignItems: "center",
              }}>
                <button
                  onClick={() => setActiveFilter(null)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: activeFilter === null ? "2px solid var(--button-primary-bg)" : "1px solid var(--border-default)",
                    background: activeFilter === null ? "var(--status-info-bg)" : "var(--surface-primary)",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    minWidth: 70,
                  }}
                >
                  <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 2 }}>All</div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: activeFilter === null ? "var(--button-primary-bg)" : "var(--text-primary)" }}>{slugsData.counts.total}</div>
                </button>
                {[
                  { key: "IDENTITY", label: "\u{1F3AD} Identity", count: slugsData.counts.identity },
                  { key: "CONTENT", label: "\u{1F4D6} Content", count: slugsData.counts.content },
                  { key: "VOICE", label: "\u{1F399}\uFE0F Voice", count: slugsData.counts.voice },
                  { key: "MEASURE", label: "\u{1F4CA} Measure", count: slugsData.counts.measure },
                  { key: "LEARN", label: "\u{1F9E0} Learn", count: slugsData.counts.learn },
                  { key: "ADAPT", label: "\u{1F504} Adapt", count: slugsData.counts.adapt },
                  { key: "REWARD", label: "\u2B50 Reward", count: slugsData.counts.reward || 0 },
                  { key: "GUARDRAIL", label: "\u{1F6E1}\uFE0F Guard", count: slugsData.counts.guardrail || 0 },
                  { key: "COMPOSE", label: "\u{1F9E9} Compose", count: slugsData.counts.compose || 0 },
                ].map(stat => (
                  <button
                    key={stat.key}
                    onClick={() => toggleFilter(stat.key)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: activeFilter === stat.key ? "2px solid var(--button-primary-bg)" : "1px solid var(--border-default)",
                      background: activeFilter === stat.key ? "var(--status-info-bg)" : "var(--surface-primary)",
                      cursor: stat.count > 0 ? "pointer" : "default",
                      opacity: stat.count > 0 ? 1 : 0.5,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      minWidth: 70,
                    }}
                    disabled={stat.count === 0}
                  >
                    <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 2 }}>{stat.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: activeFilter === stat.key ? "var(--button-primary-bg)" : "var(--text-primary)" }}>{stat.count}</div>
                  </button>
                ))}
              </div>

              {/* Tree View */}
              <div style={{
                background: "var(--surface-primary)",
                borderRadius: 8,
                border: "1px solid var(--border-default)",
                overflow: "hidden",
                maxHeight: "calc(100vh - 400px)",
                overflowY: "auto",
              }}>
                {slugsData.tree
                  .filter(category => !activeFilter || category.name.toUpperCase() === activeFilter)
                  .map((category) => (
                  <SlugTreeCategory
                    key={category.id}
                    category={category}
                    expanded={expandedSlugNodes.has(category.id)}
                    expandedNodes={expandedSlugNodes}
                    onToggle={toggleSlugNodeExpand}
                    routePrefix={routePrefix}
                  />
                ))}
                {slugsData.tree.length === 0 && (
                  <div style={{ padding: 48, textAlign: "center", color: "var(--text-placeholder)" }}>
                    No specs configured for this playbook
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
  );
}

// ─── Helper Components ───────────────────────────────────────────────────────

function SlugTreeCategory({
  category,
  expanded,
  expandedNodes,
  onToggle,
  routePrefix,
}: {
  category: SlugNodeType;
  expanded: boolean;
  expandedNodes: Set<string>;
  onToggle: (id: string) => void;
  routePrefix: string;
}) {
  const icon = slugCategoryIcons[category.name] || "\u{1F4CB}";
  const colors = slugCategoryColors[category.name] || { bg: "var(--background)", border: "var(--border-default)", headerBg: "var(--surface-secondary)" };

  return (
    <div style={{ borderBottom: "1px solid var(--border-default)" }}>
      {/* Category Header */}
      <div
        onClick={() => onToggle(category.id)}
        style={{
          padding: "14px 16px",
          background: colors.headerBg,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {expanded ? "\u25BC" : "\u25B6"}
        </span>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>{category.name}</span>
        <span style={{
          fontSize: 11,
          padding: "2px 8px",
          background: "var(--surface-primary)",
          borderRadius: 10,
          color: "var(--text-muted)",
        }}>
          {category.children?.length || 0} specs
        </span>
        {category.meta?.description && (
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{category.meta.description}</span>
        )}
      </div>

      {/* Category Content */}
      {expanded && category.children && category.children.length > 0 && (
        <div style={{ background: colors.bg, padding: "8px 16px 16px 16px" }}>
          {category.children.map((spec) => (
            <SlugTreeSpec
              key={spec.id}
              spec={spec}
              expanded={expandedNodes.has(spec.id)}
              expandedNodes={expandedNodes}
              onToggle={onToggle}
              routePrefix={routePrefix}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SlugTreeSpec({
  spec,
  expanded,
  expandedNodes,
  onToggle,
  routePrefix,
}: {
  spec: SlugNodeType;
  expanded: boolean;
  expandedNodes: Set<string>;
  onToggle: (id: string) => void;
  routePrefix: string;
}) {
  const hasChildren = spec.children && spec.children.length > 0;

  return (
    <div style={{
      marginTop: 8,
      background: "var(--surface-primary)",
      borderRadius: 8,
      border: "1px solid var(--border-default)",
      overflow: "hidden",
    }}>
      {/* Spec Header */}
      <div
        onClick={() => hasChildren && onToggle(spec.id)}
        style={{
          padding: "10px 14px",
          cursor: hasChildren ? "pointer" : "default",
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: expanded ? "var(--background)" : "var(--surface-primary)",
        }}
      >
        {hasChildren && (
          <span style={{ fontSize: 10, color: "var(--text-placeholder)", width: 12 }}>
            {expanded ? "\u25BC" : "\u25B6"}
          </span>
        )}
        {!hasChildren && <span style={{ width: 12 }} />}
        <span style={{ fontSize: 14 }}>{"\u{1F4CB}"}</span>
        {spec.specId ? (
          <Link href={`${routePrefix}/specs/${spec.specId}`} onClick={(e) => e.stopPropagation()} style={{ fontWeight: 500, fontSize: 13, flex: 1, textDecoration: "none", color: "inherit" }}>{spec.name}</Link>
        ) : (
          <span style={{ fontWeight: 500, fontSize: 13, flex: 1 }}>{spec.name}</span>
        )}
        {spec.specSlug && spec.specId && (
          <Link
            href={`${routePrefix}/specs/${spec.specId}`}
            onClick={(e) => e.stopPropagation()}
            style={{
              fontSize: 10,
              padding: "2px 6px",
              background: "var(--surface-secondary)",
              borderRadius: 4,
              color: "var(--button-primary-bg)",
              textDecoration: "none",
            }}
          >
            {spec.specSlug}
          </Link>
        )}
        {spec.meta?.scope && (
          <span style={{
            fontSize: 9,
            padding: "2px 6px",
            background: spec.meta.scope === "SYSTEM" ? "var(--badge-blue-bg)" : "var(--status-success-bg)",
            color: spec.meta.scope === "SYSTEM" ? "var(--status-info-text)" : "var(--status-success-text)",
            borderRadius: 4,
          }}>
            {spec.meta.scope}
          </span>
        )}
      </div>

      {/* Spec Variables */}
      {expanded && spec.children && spec.children.length > 0 && (
        <div style={{ padding: "0 14px 14px 40px" }}>
          {spec.children.map((node) => (
            <SlugTreeNodeComponent
              key={node.id}
              node={node}
              depth={0}
              expanded={expandedNodes.has(node.id)}
              expandedNodes={expandedNodes}
              onToggle={onToggle}
              routePrefix={routePrefix}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SlugTreeNodeComponent({
  node,
  depth,
  expanded,
  expandedNodes,
  onToggle,
  routePrefix,
}: {
  node: SlugNodeType;
  depth: number;
  expanded: boolean;
  expandedNodes: Set<string>;
  onToggle: (id: string) => void;
  routePrefix: string;
}) {
  const hasChildren = node.children && node.children.length > 0;
  const isProduces = node.type === "produces";

  // Truncate value for display
  const displayValue = (() => {
    if (node.value === undefined || node.value === null) return null;
    const str = String(node.value);
    return str.length > 60 ? str.substring(0, 60) + "..." : str;
  })();

  return (
    <div style={{ marginTop: depth === 0 ? 8 : 4 }}>
      <div
        onClick={() => hasChildren && onToggle(node.id)}
        style={{
          padding: "6px 10px",
          paddingLeft: 10 + depth * 16,
          cursor: hasChildren ? "pointer" : "default",
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
          background: isProduces ? "var(--status-warning-bg)" : (depth % 2 === 0 ? "var(--background)" : "var(--surface-primary)"),
          borderRadius: 4,
          fontSize: 12,
        }}
      >
        {hasChildren && (
          <span style={{ fontSize: 9, color: "var(--text-placeholder)", marginTop: 3 }}>
            {expanded ? "\u25BC" : "\u25B6"}
          </span>
        )}
        {!hasChildren && <span style={{ width: 9 }} />}

        {isProduces ? (
          <>
            <span style={{ color: "var(--status-warning-text)", fontWeight: 500 }}>{"\u2192"} {node.name}:</span>
            <span style={{ color: "var(--text-muted)", fontSize: 10 }}>{node.meta?.outputType}</span>
          </>
        ) : (
          <>
            <span style={{ fontFamily: "monospace", color: "var(--button-primary-bg)" }}>
              {node.path || node.name}
            </span>
            {displayValue !== null && (
              <span style={{
                flex: 1,
                color: "var(--text-secondary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}>
                {"\u2192"} {displayValue}
              </span>
            )}
            {node.meta?.isArray && (
              <span style={{
                fontSize: 10,
                padding: "1px 5px",
                background: "var(--status-info-bg)",
                color: "var(--button-primary-bg)",
                borderRadius: 3,
              }}>
                [{node.meta.count}]
              </span>
            )}
            {node.meta?.linkTo && (
              <Link
                href={node.meta.linkTo}
                onClick={(e) => e.stopPropagation()}
                style={{
                  fontSize: 10,
                  color: "var(--button-primary-bg)",
                  textDecoration: "none",
                }}
              >
                {"\u2192"}
              </Link>
            )}
          </>
        )}
      </div>

      {/* Children */}
      {expanded && node.children && node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <SlugTreeNodeComponent
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expandedNodes.has(child.id)}
              expandedNodes={expandedNodes}
              onToggle={onToggle}
              routePrefix={routePrefix}
            />
          ))}
        </div>
      )}
    </div>
  );
}
