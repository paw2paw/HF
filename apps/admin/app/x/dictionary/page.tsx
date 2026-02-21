"use client";

import { useState, useMemo } from "react";
import { useApi } from "@/hooks/useApi";
import { FancySelect } from "@/components/shared/FancySelect";
import { UnifiedAssistantPanel } from "@/components/shared/UnifiedAssistantPanel";
import { useAssistant, useAssistantKeyboardShortcut } from "@/hooks/useAssistant";

// ── Types matching /api/data-dictionary/parameters response ──

type SpecRef = {
  id: string;
  slug: string;
  name: string;
  outputType: string;
  scope: string;
  domain: string | null;
  isActive: boolean;
  actionCount: number;
  triggers: string[];
};

type PlaybookRef = {
  id: string;
  name: string;
  status: string;
  domain: { id: string; name: string; slug: string } | null;
};

type PromptSlugRef = {
  id: string;
  slug: string;
  name: string;
  memoryCategory: string | null;
  memoryMode: string | null;
  weight: number | null;
  mode: string | null;
  rangeCount: number;
};

type BehaviorTargetRef = {
  id: string;
  scope: string;
  targetValue: number;
  confidence: number | null;
  source: string;
  playbook: { id: string; name: string } | null;
};

type ScoringAnchorRef = {
  id: string;
  score: number;
  example: string | null;
  rationale: string | null;
  isGold: boolean;
};

type EnrichedParameter = {
  id: string;
  parameterId: string;
  name: string;
  domainGroup: string | null;
  definition: string | null;
  isActive: boolean;
  specs: SpecRef[];
  playbooks: PlaybookRef[];
  promptSlugs: PromptSlugRef[];
  behaviorTargets: BehaviorTargetRef[];
  scoringAnchors: ScoringAnchorRef[];
  _counts: {
    specs: number;
    activeSpecs: number;
    playbooks: number;
    behaviorTargets: number;
    promptSlugs: number;
    scoringAnchors: number;
  };
};

type Summary = {
  total: number;
  active: number;
  withSpecs: number;
  withPlaybooks: number;
  withTargets: number;
  withAnchors: number;
  orphaned: number;
  byDomainGroup: Record<string, number>;
};

type ApiResult = {
  parameters: EnrichedParameter[];
  summary: Summary;
};

// ── Colors ──

const DOMAIN_COLORS: Record<string, string> = {
  companion: "var(--badge-purple-text)",
  communication: "var(--badge-cyan-text)",
  personality: "var(--badge-yellow-text)",
  learning: "var(--status-success-text)",
  voice: "var(--accent-primary)",
  memory: "var(--badge-pink-text)",
  math: "var(--status-warning-text)",
};

function domainColor(group: string | null): string {
  if (!group) return "var(--text-muted)";
  const key = group.toLowerCase();
  for (const [k, v] of Object.entries(DOMAIN_COLORS)) {
    if (key.includes(k)) return v;
  }
  return "var(--text-secondary)";
}

// ── Stat Card ──

function StatCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div
      style={{
        padding: "14px 16px",
        border: "1px solid var(--border-default)",
        borderRadius: 10,
        background: "var(--surface-primary)",
      }}
    >
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4, fontWeight: 500 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: accent || "var(--button-primary-bg)" }}>
        {value}
      </div>
    </div>
  );
}

// ── Pill Badge ──

function Pill({ label, count, color }: { label: string; count: number; color: string }) {
  if (count === 0) return null;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        fontSize: 11,
        fontWeight: 500,
        borderRadius: 10,
        color,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
        whiteSpace: "nowrap",
      }}
    >
      {label}
      <span style={{ fontWeight: 700 }}>{count}</span>
    </span>
  );
}

// ── Relationship section in expanded detail ──

function RelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "var(--text-muted)",
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function RelChip({ label, sub, color }: { label: string; sub?: string; color: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 10px",
        fontSize: 12,
        fontWeight: 500,
        borderRadius: 6,
        color,
        background: `color-mix(in srgb, ${color} 10%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 20%, transparent)`,
        marginRight: 6,
        marginBottom: 4,
      }}
    >
      {label}
      {sub && (
        <span style={{ fontSize: 10, opacity: 0.7, fontWeight: 400 }}>{sub}</span>
      )}
    </span>
  );
}

// ── Main Page ──

export default function DictionaryPage() {
  const [search, setSearch] = useState("");
  const [filterDomain, setFilterDomain] = useState("");
  const [showOrphans, setShowOrphans] = useState(false);
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // AI Assistant
  const assistant = useAssistant({
    defaultTab: "chat",
    layout: "popout",
    enabledTabs: ["chat", "data"],
  });
  useAssistantKeyboardShortcut(assistant.toggle);

  const { data, loading, error } = useApi<ApiResult>(
    "/api/data-dictionary/parameters",
    {
      transform: (res) => ({
        parameters: (res.parameters as EnrichedParameter[]) || [],
        summary: (res.summary as Summary) || {
          total: 0, active: 0, withSpecs: 0, withPlaybooks: 0,
          withTargets: 0, withAnchors: 0, orphaned: 0, byDomainGroup: {},
        },
      }),
    }
  );

  const parameters = data?.parameters || [];
  const summary = data?.summary;

  // Domain group options
  const domainGroups = useMemo(() => {
    const groups = [...new Set(parameters.map((p) => p.domainGroup).filter(Boolean))] as string[];
    return groups.sort();
  }, [parameters]);

  // Filtered list
  const filtered = useMemo(() => {
    return parameters.filter((p) => {
      if (filterDomain && p.domainGroup !== filterDomain) return false;
      if (showOrphans) {
        const c = p._counts;
        if (c.specs > 0 || c.playbooks > 0 || c.behaviorTargets > 0 || c.promptSlugs > 0) return false;
      }
      if (showActiveOnly && !p.isActive) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          p.parameterId.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          (p.definition || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [parameters, filterDomain, showOrphans, showActiveOnly, search]);

  // Group by domain
  const grouped = useMemo(() => {
    const acc: Record<string, EnrichedParameter[]> = {};
    for (const p of filtered) {
      const cat = p.domainGroup || "Uncategorized";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(p);
    }
    return acc;
  }, [filtered]);

  const totalRelationships = (p: EnrichedParameter) =>
    p._counts.specs + p._counts.playbooks + p._counts.behaviorTargets + p._counts.promptSlugs + p._counts.scoringAnchors;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h1 className="hf-page-title">
            Data Dictionary
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
            Parameters, cross-references, and relationships across specs and playbooks
          </p>
        </div>
        <button
          onClick={() => assistant.open(undefined, { page: "/x/dictionary" })}
          style={{
            padding: "8px 14px",
            fontSize: 13,
            fontWeight: 500,
            background: "var(--badge-purple-bg)",
            color: "var(--badge-purple-text)",
            border: "1px solid color-mix(in srgb, var(--badge-purple-text) 20%, transparent)",
            borderRadius: 6,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexShrink: 0,
          }}
          title="Ask AI Assistant (Cmd+Shift+K)"
        >
          Ask AI
        </button>
      </div>

      {/* Summary Stats */}
      {summary && !loading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 20 }}>
          <StatCard label="Total" value={summary.total} />
          <StatCard label="Active" value={summary.active} accent="var(--status-success-text)" />
          <StatCard label="With Specs" value={summary.withSpecs} accent="var(--accent-primary)" />
          <StatCard label="With Playbooks" value={summary.withPlaybooks} accent="var(--accent-primary)" />
          <StatCard label="With Targets" value={summary.withTargets} accent="var(--badge-yellow-text)" />
          <StatCard label="Orphaned" value={summary.orphaned} accent={summary.orphaned > 0 ? "var(--status-error-text)" : "var(--text-muted)"} />
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Search keys, names, or definitions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            minWidth: 200,
            padding: "8px 12px",
            fontSize: 14,
            border: "1px solid var(--border-default)",
            borderRadius: 8,
            background: "var(--surface-primary)",
            color: "var(--text-primary)",
            outline: "none",
          }}
        />
        <FancySelect
          value={filterDomain}
          onChange={setFilterDomain}
          placeholder="All Domains"
          clearable={!!filterDomain}
          searchable={domainGroups.length > 5}
          style={{ minWidth: 160 }}
          options={[
            { value: "", label: "All Domains" },
            ...domainGroups.map((g) => ({ value: g, label: g })),
          ]}
        />
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            color: "var(--text-muted)",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          <input
            type="checkbox"
            checked={showOrphans}
            onChange={(e) => setShowOrphans(e.target.checked)}
            style={{ accentColor: "var(--status-error-text)" }}
          />
          Orphans only
        </label>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            color: "var(--text-muted)",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          <input
            type="checkbox"
            checked={showActiveOnly}
            onChange={(e) => setShowActiveOnly(e.target.checked)}
            style={{ accentColor: "var(--status-success-text)" }}
          />
          Active only
        </label>
      </div>

      {/* Results count */}
      {!loading && (
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
          {filtered.length} parameter{filtered.length !== 1 ? "s" : ""}
          {(search || filterDomain || showOrphans || showActiveOnly) && ` (filtered from ${parameters.length})`}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ padding: 16, background: "var(--status-error-bg)", color: "var(--status-error-text)", borderRadius: 8, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading parameters...</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", background: "var(--surface-secondary)", borderRadius: 12, border: "1px solid var(--border-default)" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>
            {showOrphans ? "\u26A0\uFE0F" : "\uD83D\uDD0D"}
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-secondary)" }}>
            {search || filterDomain || showOrphans || showActiveOnly
              ? "No parameters match filters"
              : "No parameters found"}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 8 }}>
            {showOrphans ? "All parameters have at least one relationship" : "Try adjusting your search or filters"}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {Object.entries(grouped)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([category, items]) => (
              <div key={category}>
                {/* Category header */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <h2
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: domainColor(category === "Uncategorized" ? null : category),
                      margin: 0,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {category}
                  </h2>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>
                    {items.length}
                  </span>
                </div>

                {/* Table */}
                <div
                  style={{
                    background: "var(--surface-primary)",
                    border: "1px solid var(--border-default)",
                    borderRadius: 8,
                    overflow: "hidden",
                  }}
                >
                  {/* Header row */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "24px minmax(180px, 1fr) minmax(200px, 2fr) auto",
                      gap: 8,
                      padding: "8px 12px",
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      color: "var(--text-muted)",
                      background: "var(--surface-secondary)",
                      borderBottom: "1px solid var(--border-default)",
                    }}
                  >
                    <div />
                    <div>Key</div>
                    <div>Name</div>
                    <div style={{ textAlign: "right" }}>Links</div>
                  </div>

                  {/* Data rows */}
                  {items.map((param) => {
                    const isExpanded = expandedId === param.id;
                    const relCount = totalRelationships(param);

                    return (
                      <div key={param.id}>
                        {/* Row */}
                        <div
                          onClick={() => setExpandedId(isExpanded ? null : param.id)}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "24px minmax(180px, 1fr) minmax(200px, 2fr) auto",
                            gap: 8,
                            padding: "10px 12px",
                            fontSize: 13,
                            cursor: "pointer",
                            background: isExpanded
                              ? "color-mix(in srgb, var(--text-primary) 5%, transparent)"
                              : "var(--surface-primary)",
                            borderBottom: isExpanded ? "none" : "1px solid var(--border-subtle)",
                            transition: "background 0.1s",
                            alignItems: "center",
                          }}
                        >
                          {/* Active indicator */}
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                background: param.isActive ? "var(--status-success-text)" : "var(--border-default)",
                                flexShrink: 0,
                              }}
                              title={param.isActive ? "Active" : "Inactive"}
                            />
                          </div>

                          {/* Key */}
                          <div
                            style={{
                              fontFamily: "monospace",
                              fontSize: 12,
                              color: "var(--button-primary-bg)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={`{{${param.parameterId}}}`}
                          >
                            {"{{"}
                            {param.parameterId}
                            {"}}"}
                          </div>

                          {/* Name + definition preview */}
                          <div style={{ overflow: "hidden" }}>
                            <div
                              style={{
                                color: "var(--text-primary)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                fontWeight: 500,
                              }}
                            >
                              {param.name}
                            </div>
                            {param.definition && !isExpanded && (
                              <div
                                style={{
                                  fontSize: 11,
                                  color: "var(--text-muted)",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  marginTop: 2,
                                }}
                              >
                                {param.definition}
                              </div>
                            )}
                          </div>

                          {/* Relationship pills */}
                          <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
                            <Pill label="Specs" count={param._counts.specs} color="var(--accent-primary)" />
                            <Pill label="Playbooks" count={param._counts.playbooks} color="var(--accent-primary)" />
                            <Pill label="Targets" count={param._counts.behaviorTargets} color="var(--badge-yellow-text)" />
                            <Pill label="Slugs" count={param._counts.promptSlugs} color="var(--badge-cyan-text)" />
                            <Pill label="Anchors" count={param._counts.scoringAnchors} color="var(--badge-purple-text)" />
                            {relCount === 0 && (
                              <span style={{ fontSize: 11, color: "var(--status-error-text)", fontWeight: 500 }}>
                                orphan
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Expanded detail */}
                        {isExpanded && (
                          <div
                            style={{
                              padding: "16px 16px 16px 44px",
                              background: "color-mix(in srgb, var(--text-primary) 3%, transparent)",
                              borderBottom: "1px solid var(--border-default)",
                            }}
                          >
                            {/* Definition */}
                            {param.definition && (
                              <div
                                style={{
                                  fontSize: 13,
                                  color: "var(--text-secondary)",
                                  marginBottom: 16,
                                  lineHeight: 1.5,
                                  maxWidth: 700,
                                }}
                              >
                                {param.definition}
                              </div>
                            )}

                            {/* Specs */}
                            {param.specs.length > 0 && (
                              <RelSection title={`Specs (${param.specs.length})`}>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                  {param.specs.map((s) => (
                                    <RelChip
                                      key={s.id}
                                      label={s.slug}
                                      sub={`${s.actionCount} action${s.actionCount !== 1 ? "s" : ""}`}
                                      color={s.isActive ? "var(--accent-primary)" : "var(--text-muted)"}
                                    />
                                  ))}
                                </div>
                              </RelSection>
                            )}

                            {/* Playbooks */}
                            {param.playbooks.length > 0 && (
                              <RelSection title={`Playbooks (${param.playbooks.length})`}>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                  {param.playbooks.map((pb) => (
                                    <RelChip
                                      key={pb.id}
                                      label={pb.name}
                                      sub={pb.domain?.name || undefined}
                                      color="var(--accent-primary)"
                                    />
                                  ))}
                                </div>
                              </RelSection>
                            )}

                            {/* Prompt Slugs */}
                            {param.promptSlugs.length > 0 && (
                              <RelSection title={`Prompt Slugs (${param.promptSlugs.length})`}>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                  {param.promptSlugs.map((ps) => (
                                    <RelChip
                                      key={ps.id}
                                      label={ps.slug}
                                      sub={ps.rangeCount > 0 ? `${ps.rangeCount} range${ps.rangeCount !== 1 ? "s" : ""}` : undefined}
                                      color="var(--badge-cyan-text)"
                                    />
                                  ))}
                                </div>
                              </RelSection>
                            )}

                            {/* Behavior Targets */}
                            {param.behaviorTargets.length > 0 && (
                              <RelSection title={`Behavior Targets (${param.behaviorTargets.length})`}>
                                <div
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                                    gap: 8,
                                  }}
                                >
                                  {param.behaviorTargets.map((bt) => (
                                    <div
                                      key={bt.id}
                                      style={{
                                        padding: "8px 10px",
                                        fontSize: 12,
                                        borderRadius: 6,
                                        border: "1px solid color-mix(in srgb, var(--badge-yellow-text) 20%, transparent)",
                                        background: "color-mix(in srgb, var(--badge-yellow-text) 5%, transparent)",
                                      }}
                                    >
                                      <div style={{ fontWeight: 600, color: "var(--badge-yellow-text)" }}>
                                        Target: {bt.targetValue}
                                        {bt.confidence != null && (
                                          <span style={{ fontWeight: 400, marginLeft: 6, opacity: 0.7 }}>
                                            ({Math.round(bt.confidence * 100)}% conf)
                                          </span>
                                        )}
                                      </div>
                                      <div style={{ color: "var(--text-muted)", marginTop: 2 }}>
                                        {bt.scope}
                                        {bt.playbook && <> &middot; {bt.playbook.name}</>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </RelSection>
                            )}

                            {/* Scoring Anchors */}
                            {param.scoringAnchors.length > 0 && (
                              <RelSection title={`Scoring Anchors (${param.scoringAnchors.length})`}>
                                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                  {param.scoringAnchors.map((sa) => (
                                    <div
                                      key={sa.id}
                                      style={{
                                        display: "flex",
                                        alignItems: "baseline",
                                        gap: 8,
                                        fontSize: 12,
                                        padding: "4px 0",
                                      }}
                                    >
                                      <span
                                        style={{
                                          fontWeight: 700,
                                          color: "var(--badge-purple-text)",
                                          minWidth: 20,
                                          textAlign: "right",
                                        }}
                                      >
                                        {sa.score}
                                      </span>
                                      {sa.isGold && (
                                        <span
                                          style={{
                                            fontSize: 10,
                                            fontWeight: 600,
                                            color: "var(--trust-l5-text)",
                                            background: "color-mix(in srgb, var(--trust-l5-text) 12%, transparent)",
                                            padding: "1px 5px",
                                            borderRadius: 4,
                                          }}
                                        >
                                          GOLD
                                        </span>
                                      )}
                                      <span style={{ color: "var(--text-secondary)" }}>
                                        {sa.example || sa.rationale || "—"}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </RelSection>
                            )}

                            {/* No relationships */}
                            {relCount === 0 && (
                              <div
                                style={{
                                  fontSize: 13,
                                  color: "var(--status-error-text)",
                                  padding: "8px 12px",
                                  background: "var(--status-error-bg)",
                                  borderRadius: 6,
                                  fontWeight: 500,
                                }}
                              >
                                Orphaned parameter — not referenced by any spec, playbook, prompt slug, or target
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* AI Assistant */}
      <UnifiedAssistantPanel
        visible={assistant.isOpen}
        onClose={assistant.close}
        context={assistant.context}
        location={assistant.location}
        {...assistant.options}
      />
    </div>
  );
}
