"use client";

import { useState, useEffect } from "react";

type XRef = {
  id: string;
  key: string;
  value: string;
  source: string;
  category: string | null;
  description: string | null;
};

export default function DictionaryPage() {
  const [xrefs, setXrefs] = useState<XRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterSource, setFilterSource] = useState("");

  useEffect(() => {
    fetch("/api/data-dictionary/xrefs")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setXrefs(data.xrefs || []);
        else setError(data.error);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  const sources = [...new Set(xrefs.map((x) => x.source))];

  const filteredXrefs = xrefs.filter((x) => {
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
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1f2937", margin: 0 }}>Data Dictionary</h1>
        <p style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
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
          style={{ padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6, width: 250 }}
        />
        <select
          value={filterSource}
          onChange={(e) => setFilterSource(e.target.value)}
          style={{ padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6 }}
        >
          <option value="">All Sources</option>
          {sources.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {error && (
        <div style={{ padding: 16, background: "#fef2f2", color: "#dc2626", borderRadius: 8, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Loading...</div>
      ) : filteredXrefs.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", background: "#f9fafb", borderRadius: 12, border: "1px solid #e5e7eb" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📖</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#374151" }}>
            {search || filterSource ? "No entries match filters" : "No dictionary entries yet"}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {Object.entries(groupedByCategory)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([category, items]) => (
              <div key={category}>
                <h2 style={{ fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {category}
                </h2>
                <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#f9fafb" }}>
                        <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 500, borderBottom: "1px solid #e5e7eb" }}>Key</th>
                        <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 500, borderBottom: "1px solid #e5e7eb" }}>Value</th>
                        <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 500, borderBottom: "1px solid #e5e7eb", width: 100 }}>Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((xref) => (
                        <tr key={xref.id}>
                          <td style={{ padding: "10px 12px", borderBottom: "1px solid #f3f4f6", fontFamily: "monospace", color: "#4f46e5" }}>
                            {xref.key}
                          </td>
                          <td style={{ padding: "10px 12px", borderBottom: "1px solid #f3f4f6", maxWidth: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {xref.value}
                          </td>
                          <td style={{ padding: "10px 12px", borderBottom: "1px solid #f3f4f6", color: "#6b7280" }}>
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
