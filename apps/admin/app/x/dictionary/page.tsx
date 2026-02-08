"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { FancySelect } from "@/components/shared/FancySelect";

type XRef = {
  id: string;
  key: string;
  value: string;
  source: string;
  category: string | null;
  description: string | null;
};

export default function DictionaryPage() {
  const [search, setSearch] = useState("");
  const [filterSource, setFilterSource] = useState("");

  const { data: xrefs, loading, error } = useApi<XRef[]>(
    "/api/data-dictionary/xrefs",
    { transform: (res) => (res.xrefs as XRef[]) || [] }
  );

  const sources = [...new Set((xrefs || []).map((x) => x.source))];

  const filteredXrefs = (xrefs || []).filter((x) => {
    if (filterSource && x.source !== filterSource) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return x.key.toLowerCase().includes(q) || x.value.toLowerCase().includes(q);
  });

  const groupedByCategory = filteredXrefs.reduce((acc, x) => {
    const cat = x.category || "Uncategorized";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(x);
    return acc;
  }, {} as Record<string, XRef[]>);

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Data Dictionary</h1>
        <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
          Cross-references and variables available in prompt templates
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <input
          type="text"
          placeholder="Search keys or values..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: "8px 12px", border: "1px solid var(--border-strong)", borderRadius: 6, width: 250, background: "var(--surface-primary)", color: "var(--text-primary)" }}
        />
        <FancySelect
          value={filterSource}
          onChange={setFilterSource}
          placeholder="All Sources"
          clearable={!!filterSource}
          searchable={sources.length > 5}
          style={{ minWidth: 160 }}
          options={[
            { value: "", label: "All Sources" },
            ...sources.map((s) => ({ value: s, label: s })),
          ]}
        />
      </div>

      {error && (
        <div style={{ padding: 16, background: "var(--status-error-bg)", color: "var(--status-error-text)", borderRadius: 8, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading...</div>
      ) : filteredXrefs.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", background: "var(--surface-secondary)", borderRadius: 12, border: "1px solid var(--border-default)" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📖</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-secondary)" }}>
            {search || filterSource ? "No entries match filters" : "No dictionary entries yet"}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {Object.entries(groupedByCategory)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([category, items]) => (
              <div key={category}>
                <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {category}
                </h2>
                <div style={{ background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 8, overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "var(--surface-secondary)" }}>
                        <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 500, borderBottom: "1px solid var(--border-default)" }}>Key</th>
                        <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 500, borderBottom: "1px solid var(--border-default)" }}>Value</th>
                        <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 500, borderBottom: "1px solid var(--border-default)", width: 100 }}>Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((xref) => (
                        <tr key={xref.id}>
                          <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border-subtle)", fontFamily: "monospace", color: "var(--accent-primary)" }}>
                            {xref.key}
                          </td>
                          <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border-subtle)", maxWidth: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-primary)" }}>
                            {xref.value}
                          </td>
                          <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border-subtle)", color: "var(--text-muted)" }}>
                            {xref.source}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
