"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { FancySelect } from "@/components/shared/FancySelect";

type ContentFragment = {
  id: string;
  specSlug: string;
  specName: string;
  specRole: string | null;
  path: string;
  label: string;
  value: string;
  length: number;
  category: string;
  isPromptConsumed: boolean;
  depth: number;
};

type ExtractionStats = {
  totalFragments: number;
  promptConsumed: number;
  metadataOnly: number;
  byCategory: Record<string, number>;
  bySpec: Record<string, number>;
  totalChars: number;
};

type ApiResponse = {
  fragments: ContentFragment[];
  stats: ExtractionStats;
};

const CATEGORY_COLORS: Record<string, string> = {
  identity: "#4338ca",
  voice: "#0891b2",
  content: "#059669",
  pedagogy: "#d97706",
  adaptation: "#8b5cf6",
  targets: "#2563eb",
  orchestration: "#6366f1",
  guardrails: "#be185d",
  measurement: "#4f46e5",
  config: "#737373",
};

export default function ContentExplorerPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [specFilter, setSpecFilter] = useState("");
  const [promptOnly, setPromptOnly] = useState(false);

  // Expanded fragment for editing
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/content-fragments");
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Client-side filtering
  const filtered = useMemo(() => {
    if (!data) return [];
    let result = data.fragments;

    if (categoryFilter) {
      result = result.filter(f => f.category === categoryFilter);
    }
    if (specFilter) {
      result = result.filter(f => f.specSlug === specFilter);
    }
    if (promptOnly) {
      result = result.filter(f => f.isPromptConsumed);
    }
    if (search.trim()) {
      const s = search.toLowerCase();
      result = result.filter(f =>
        f.value.toLowerCase().includes(s) ||
        f.label.toLowerCase().includes(s) ||
        f.path.toLowerCase().includes(s) ||
        f.specSlug.toLowerCase().includes(s)
      );
    }

    return result;
  }, [data, categoryFilter, specFilter, promptOnly, search]);

  // Derive filter options from data
  const categoryOptions = useMemo(() => {
    if (!data) return [];
    const cats = Object.keys(data.stats.byCategory).sort();
    return [
      { value: "", label: "All Categories" },
      ...cats.map(c => ({
        value: c,
        label: `${c.charAt(0).toUpperCase() + c.slice(1)} (${data.stats.byCategory[c]})`,
      })),
    ];
  }, [data]);

  const specOptions = useMemo(() => {
    if (!data) return [];
    const specs = Object.entries(data.stats.bySpec)
      .sort((a, b) => b[1] - a[1]);
    return [
      { value: "", label: "All Specs" },
      ...specs.map(([slug, count]) => ({
        value: slug,
        label: `${slug} (${count})`,
      })),
    ];
  }, [data]);

  const handleExpand = (fragment: ContentFragment) => {
    if (expandedId === fragment.id) {
      setExpandedId(null);
    } else {
      setExpandedId(fragment.id);
      setEditValue(fragment.value);
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
          Content Explorer
        </h1>
        <p style={{ color: "var(--text-muted)" }}>Loading fragments...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
          Content Explorer
        </h1>
        <p style={{ color: "#dc2626" }}>Error: {error}</p>
      </div>
    );
  }

  const stats = data!.stats;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
          Content Explorer
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
          All text fragments extracted from spec configs. Toggle &quot;Prompt-Used Only&quot; to see what actually reaches the AI.
        </p>
      </div>

      {/* Stats cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 12,
        marginBottom: 24,
      }}>
        <StatCard label="Total Fragments" value={stats.totalFragments} />
        <StatCard label="Prompt-Used" value={stats.promptConsumed} color="#059669" />
        <StatCard label="Metadata Only" value={stats.metadataOnly} color="#737373" />
        <StatCard label="Total Characters" value={`${(stats.totalChars / 1000).toFixed(0)}K`} />
      </div>

      {/* Category breakdown */}
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        marginBottom: 20,
      }}>
        {Object.entries(stats.byCategory).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(categoryFilter === cat ? "" : cat)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "3px 10px",
              fontSize: 12,
              fontWeight: 500,
              borderRadius: 12,
              border: `1px solid ${categoryFilter === cat ? CATEGORY_COLORS[cat] || "#666" : "var(--border-default)"}`,
              background: categoryFilter === cat
                ? `color-mix(in srgb, ${CATEGORY_COLORS[cat] || "#666"} 15%, transparent)`
                : "transparent",
              color: CATEGORY_COLORS[cat] || "var(--text-muted)",
              cursor: "pointer",
            }}
          >
            {cat} <span style={{ opacity: 0.7 }}>{count}</span>
          </button>
        ))}
      </div>

      {/* Filters bar */}
      <div style={{
        display: "flex",
        gap: 12,
        alignItems: "center",
        marginBottom: 16,
        flexWrap: "wrap",
      }}>
        <input
          type="text"
          placeholder="Search fragments..."
          value={search}
          onChange={e => setSearch(e.target.value)}
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
        <div style={{ width: 200 }}>
          <FancySelect
            value={specFilter}
            onChange={setSpecFilter}
            options={specOptions}
            placeholder="All Specs"
          />
        </div>
        <label style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 13,
          color: "var(--text-muted)",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}>
          <input
            type="checkbox"
            checked={promptOnly}
            onChange={e => setPromptOnly(e.target.checked)}
            style={{ accentColor: "#059669" }}
          />
          Prompt-Used Only
        </label>
      </div>

      {/* Results count */}
      <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>
        Showing {filtered.length} of {stats.totalFragments} fragments
      </div>

      {/* Fragment table */}
      <div style={{
        border: "1px solid var(--border-default)",
        borderRadius: 12,
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "90px 140px 1fr 60px 60px",
          gap: 8,
          padding: "10px 16px",
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "var(--text-muted)",
          background: "var(--surface-secondary)",
          borderBottom: "1px solid var(--border-default)",
        }}>
          <div>Category</div>
          <div>Spec</div>
          <div>Fragment</div>
          <div style={{ textAlign: "right" }}>Chars</div>
          <div style={{ textAlign: "center" }}>Used</div>
        </div>

        {/* Rows */}
        <div style={{ maxHeight: "calc(100vh - 420px)", overflowY: "auto" }}>
          {filtered.length === 0 && (
            <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>
              No fragments match your filters.
            </div>
          )}
          {filtered.map(fragment => (
            <React.Fragment key={fragment.id}>
              <div
                onClick={() => handleExpand(fragment)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "90px 140px 1fr 60px 60px",
                  gap: 8,
                  padding: "8px 16px",
                  fontSize: 13,
                  borderBottom: "1px solid var(--border-default)",
                  cursor: "pointer",
                  background: expandedId === fragment.id
                    ? "color-mix(in srgb, var(--text-primary) 5%, transparent)"
                    : "var(--surface-primary)",
                  transition: "background 0.1s",
                }}
              >
                {/* Category pill */}
                <div>
                  <span style={{
                    display: "inline-block",
                    padding: "2px 8px",
                    fontSize: 11,
                    fontWeight: 500,
                    borderRadius: 10,
                    color: CATEGORY_COLORS[fragment.category] || "#666",
                    background: `color-mix(in srgb, ${CATEGORY_COLORS[fragment.category] || "#666"} 12%, transparent)`,
                  }}>
                    {fragment.category}
                  </span>
                </div>

                {/* Spec slug */}
                <div style={{
                  color: "var(--text-muted)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontSize: 12,
                }}>
                  {fragment.specSlug.replace("spec-", "")}
                </div>

                {/* Label + value preview */}
                <div style={{ overflow: "hidden" }}>
                  <div style={{
                    fontWeight: 500,
                    color: "var(--text-primary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>
                    {fragment.label}
                  </div>
                  <div style={{
                    color: "var(--text-muted)",
                    fontSize: 12,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    marginTop: 2,
                  }}>
                    {fragment.value.substring(0, 120)}
                  </div>
                </div>

                {/* Length */}
                <div style={{ textAlign: "right", color: "var(--text-muted)", fontSize: 12 }}>
                  {fragment.length}
                </div>

                {/* Prompt consumed indicator */}
                <div style={{ textAlign: "center" }}>
                  {fragment.isPromptConsumed ? (
                    <span style={{ color: "#059669", fontWeight: 600 }}>YES</span>
                  ) : (
                    <span style={{ color: "var(--text-muted)", opacity: 0.5 }}>no</span>
                  )}
                </div>
              </div>

              {/* Expanded row: full text view */}
              {expandedId === fragment.id && (
                <div style={{
                  padding: "12px 16px 12px 106px",
                  borderBottom: "1px solid var(--border-default)",
                  background: "color-mix(in srgb, var(--text-primary) 3%, transparent)",
                }}>
                  <div style={{
                    display: "flex",
                    gap: 8,
                    marginBottom: 8,
                    fontSize: 11,
                    color: "var(--text-muted)",
                  }}>
                    <span>Path: <code style={{ fontFamily: "monospace" }}>{fragment.path}</code></span>
                    <span>|</span>
                    <span>Spec: {fragment.specName}</span>
                    <span>|</span>
                    <span>Role: {fragment.specRole || "—"}</span>
                  </div>
                  <textarea
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    style={{
                      width: "100%",
                      minHeight: 80,
                      padding: 10,
                      fontSize: 13,
                      fontFamily: "inherit",
                      border: "1px solid var(--border-default)",
                      borderRadius: 6,
                      background: "var(--surface-primary)",
                      color: "var(--text-primary)",
                      resize: "vertical",
                      outline: "none",
                    }}
                  />
                  <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "flex-end" }}>
                    <button
                      onClick={() => setExpandedId(null)}
                      style={{
                        padding: "6px 14px",
                        fontSize: 12,
                        border: "1px solid var(--border-default)",
                        borderRadius: 6,
                        background: "var(--surface-primary)",
                        color: "var(--text-muted)",
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                    {editValue !== fragment.value && (
                      <button
                        style={{
                          padding: "6px 14px",
                          fontSize: 12,
                          border: "none",
                          borderRadius: 6,
                          background: "#059669",
                          color: "#fff",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Save (coming soon)
                      </button>
                    )}
                  </div>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{
      padding: "14px 16px",
      border: "1px solid var(--border-default)",
      borderRadius: 10,
      background: "var(--surface-primary)",
    }}>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || "var(--text-primary)" }}>{value}</div>
    </div>
  );
}
