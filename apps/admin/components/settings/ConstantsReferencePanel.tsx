"use client";

import { useState, useMemo } from "react";
import { Braces, Search } from "lucide-react";
import type { PanelProps } from "@/lib/settings-panels";
import manifest from "@/lib/constants-manifest.json";
import "./constants-panel.css";

interface ConstantEntry {
  name: string;
  value: string;
  group: string;
  description: string;
  file: string;
  line: number;
}

/**
 * Read-only reference panel showing all @system-constant annotated
 * operational constants from the codebase. Generated at build time
 * by scripts/generate-constants-manifest.ts.
 */
export function ConstantsReferencePanel(_props: PanelProps) {
  const [filter, setFilter] = useState("");

  const constants = manifest.constants as ConstantEntry[];

  // Filter by search term across name, group, description, file
  const filtered = useMemo(() => {
    if (!filter.trim()) return constants;
    const q = filter.toLowerCase();
    return constants.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.group.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.file.toLowerCase().includes(q)
    );
  }, [constants, filter]);

  // Group by group field
  const grouped = useMemo(() => {
    const map = new Map<string, ConstantEntry[]>();
    for (const c of filtered) {
      const list = map.get(c.group) ?? [];
      list.push(c);
      map.set(c.group, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  return (
    <div className="hf-card">
      {/* Header */}
      <div className="cp-header">
        <div className="cp-header-icon">
          <Braces size={18} strokeWidth={1.5} />
        </div>
        <h2 className="cp-title">System Constants</h2>
        <span className="cp-file">{manifest.count} constants</span>
      </div>
      <p className="cp-desc">
        Read-only reference of annotated operational constants. Add{" "}
        <code>@system-constant</code> JSDoc to any constant, then run{" "}
        <code>npm run generate:constants</code>.
      </p>

      {/* Search */}
      <div className="cp-search">
        <div style={{ position: "relative" }}>
          <Search
            size={14}
            strokeWidth={1.5}
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-muted)",
              pointerEvents: "none",
            }}
          />
          <input
            className="hf-input"
            type="text"
            placeholder="Filter constants..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ paddingLeft: 30, width: "100%" }}
          />
        </div>
      </div>

      {/* Content */}
      {grouped.length === 0 ? (
        <div className="cp-empty">
          No constants match &ldquo;{filter}&rdquo;
        </div>
      ) : (
        grouped.map(([group, entries]) => (
          <div key={group}>
            <div className="cp-group-header">{group}</div>
            {entries.map((c) => (
              <div key={`${c.file}:${c.line}`} className="cp-row">
                <span className="cp-name">{c.name}</span>
                <span className="cp-value">= {c.value}</span>
                <div className="cp-meta">
                  <div className="cp-description">{c.description}</div>
                  <div className="cp-file">
                    {c.file}:{c.line}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))
      )}

      {/* Footer */}
      <div className="cp-footer">
        <Braces size={12} strokeWidth={1.5} />
        <span>
          Generated {new Date(manifest.generated).toLocaleDateString()} &middot;{" "}
          {filtered.length} of {manifest.count} shown
        </span>
      </div>
    </div>
  );
}
