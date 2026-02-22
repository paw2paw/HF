"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { FancySelect } from "@/components/shared/FancySelect";
import { AdvancedBanner } from "@/components/shared/AdvancedBanner";
import "./content-explorer.css";

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
  identity: "var(--identity-accent, #4338ca)",
  voice: "var(--badge-cyan-text, #0891b2)",
  content: "var(--status-success-text, #059669)",
  pedagogy: "var(--status-warning-text, #d97706)",
  adaptation: "var(--accent-secondary, #8b5cf6)",
  targets: "var(--accent-primary, #2563eb)",
  orchestration: "var(--badge-indigo-text, #6366f1)",
  guardrails: "var(--badge-pink-text, #be185d)",
  measurement: "var(--accent-primary, #4f46e5)",
  config: "var(--text-muted, #737373)",
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
      <div className="ce-page">
        <div className="ce-header-loading">
          <h1 className="hf-page-title">
            Content Explorer
          </h1>
        </div>
        <p className="ce-subtitle">Loading fragments...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ce-page">
        <div className="ce-header-loading">
          <h1 className="hf-page-title">
            Content Explorer
          </h1>
        </div>
        <p className="ce-error-text">Error: {error}</p>
      </div>
    );
  }

  const stats = data!.stats;

  return (
    <div className="ce-page">
      <AdvancedBanner />
      {/* Header */}
      <div className="ce-header">
        <h1 className="hf-page-title">
          Content Explorer
        </h1>
        <p className="ce-subtitle">
          All text fragments extracted from spec configs. Toggle &quot;Prompt-Used Only&quot; to see what actually reaches the AI.
        </p>
      </div>

      {/* Stats cards */}
      <div className="ce-stats-grid">
        <StatCard label="Total Fragments" value={stats.totalFragments} />
        <StatCard label="Prompt-Used" value={stats.promptConsumed} color="var(--status-success-text)" />
        <StatCard label="Metadata Only" value={stats.metadataOnly} color="var(--text-muted)" />
        <StatCard label="Total Characters" value={`${(stats.totalChars / 1000).toFixed(0)}K`} />
      </div>

      {/* Category breakdown */}
      <div className="ce-category-bar">
        {Object.entries(stats.byCategory).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(categoryFilter === cat ? "" : cat)}
            className="ce-category-pill"
            style={{
              borderColor: categoryFilter === cat ? CATEGORY_COLORS[cat] || "var(--text-muted)" : undefined,
              background: categoryFilter === cat
                ? `color-mix(in srgb, ${CATEGORY_COLORS[cat] || "var(--text-muted)"} 15%, transparent)`
                : undefined,
              color: CATEGORY_COLORS[cat] || "var(--text-muted)",
            }}
          >
            {cat} <span className="ce-category-count">{count}</span>
          </button>
        ))}
      </div>

      {/* Filters bar */}
      <div className="ce-filters-bar">
        <input
          type="text"
          placeholder="Search fragments..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="ce-search-input"
        />
        <div className="ce-spec-filter-wrap">
          <FancySelect
            value={specFilter}
            onChange={setSpecFilter}
            options={specOptions}
            placeholder="All Specs"
          />
        </div>
        <label className="ce-checkbox-label">
          <input
            type="checkbox"
            checked={promptOnly}
            onChange={e => setPromptOnly(e.target.checked)}
          />
          Prompt-Used Only
        </label>
      </div>

      {/* Results count */}
      <div className="ce-results-count">
        Showing {filtered.length} of {stats.totalFragments} fragments
      </div>

      {/* Fragment table */}
      <div className="ce-table">
        {/* Header */}
        <div className="ce-table-header">
          <div>Category</div>
          <div>Spec</div>
          <div>Fragment</div>
          <div className="ce-col-right">Chars</div>
          <div className="ce-col-center">Used</div>
        </div>

        {/* Rows */}
        <div className="ce-table-body">
          {filtered.length === 0 && (
            <div className="ce-empty">
              No fragments match your filters.
            </div>
          )}
          {filtered.map(fragment => (
            <React.Fragment key={fragment.id}>
              <div
                onClick={() => handleExpand(fragment)}
                className={`ce-row ${expandedId === fragment.id ? "ce-row-expanded" : ""}`}
              >
                {/* Category pill */}
                <div>
                  <span
                    className="ce-fragment-pill"
                    style={{
                      color: CATEGORY_COLORS[fragment.category] || "var(--text-muted)",
                      background: `color-mix(in srgb, ${CATEGORY_COLORS[fragment.category] || "var(--text-muted)"} 12%, transparent)`,
                    }}
                  >
                    {fragment.category}
                  </span>
                </div>

                {/* Spec slug */}
                <div className="ce-spec-slug">
                  {fragment.specSlug.replace("spec-", "")}
                </div>

                {/* Label + value preview */}
                <div className="ce-fragment-content">
                  <div className="ce-fragment-label">
                    {fragment.label}
                  </div>
                  <div className="ce-fragment-preview">
                    {fragment.value.substring(0, 120)}
                  </div>
                </div>

                {/* Length */}
                <div className="ce-fragment-length">
                  {fragment.length}
                </div>

                {/* Prompt consumed indicator */}
                <div className="ce-prompt-indicator">
                  {fragment.isPromptConsumed ? (
                    <span className="ce-prompt-yes">YES</span>
                  ) : (
                    <span className="ce-prompt-no">no</span>
                  )}
                </div>
              </div>

              {/* Expanded row: full text view */}
              {expandedId === fragment.id && (
                <div className="ce-expanded-panel">
                  <div className="ce-expanded-meta">
                    <span>Path: <code>{fragment.path}</code></span>
                    <span>|</span>
                    <span>Spec: {fragment.specName}</span>
                    <span>|</span>
                    <span>Role: {fragment.specRole || "\u2014"}</span>
                  </div>
                  <textarea
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    className="ce-expanded-textarea"
                  />
                  <div className="ce-expanded-actions">
                    <button
                      onClick={() => setExpandedId(null)}
                      className="ce-btn-cancel"
                    >
                      Cancel
                    </button>
                    {editValue !== fragment.value && (
                      <button className="ce-btn-save">
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
    <div className="ce-stat-card">
      <div className="ce-stat-label">{label}</div>
      <div className="ce-stat-value" style={color ? { color } : undefined}>{value}</div>
    </div>
  );
}
