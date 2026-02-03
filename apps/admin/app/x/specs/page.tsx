"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type Spec = {
  id: string;
  slug: string;
  name: string;
  scope: string;
  outputType: string;
  specRole: string;
  description: string | null;
};

export default function SpecsPage() {
  const [specs, setSpecs] = useState<Spec[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterScope, setFilterScope] = useState("");
  const [filterOutputType, setFilterOutputType] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const params = new URLSearchParams();
    if (filterScope) params.set("scope", filterScope);
    if (filterOutputType) params.set("outputType", filterOutputType);

    fetch(`/api/analysis-specs?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setSpecs(data.specs || []);
        else setError(data.error);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [filterScope, filterOutputType]);

  const filteredSpecs = specs.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q);
  });

  const outputTypeColors: Record<string, { bg: string; text: string }> = {
    LEARN: { bg: "#ede9fe", text: "#4c1d95" },
    MEASURE: { bg: "#dcfce7", text: "#14532d" },
    ADAPT: { bg: "#fef3c7", text: "#78350f" },
    COMPOSE: { bg: "#fce7f3", text: "#9d174d" },
  };

  const scopeColors: Record<string, { bg: string; text: string }> = {
    SYSTEM: { bg: "#e5e7eb", text: "#1f2937" },
    DOMAIN: { bg: "#dbeafe", text: "#1e3a8a" },
    CALLER: { bg: "#fce7f3", text: "#9d174d" },
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#111827", margin: 0 }}>Analysis Specs</h1>
        <p style={{ fontSize: 14, color: "#4b5563", marginTop: 4 }}>
          Specifications for measuring, learning, and adapting
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6, width: 200 }}
        />
        <select
          value={filterScope}
          onChange={(e) => setFilterScope(e.target.value)}
          style={{ padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6 }}
        >
          <option value="">All Scopes</option>
          <option value="SYSTEM">System</option>
          <option value="DOMAIN">Domain</option>
          <option value="CALLER">Caller</option>
        </select>
        <select
          value={filterOutputType}
          onChange={(e) => setFilterOutputType(e.target.value)}
          style={{ padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6 }}
        >
          <option value="">All Types</option>
          <option value="MEASURE">Measure</option>
          <option value="LEARN">Learn</option>
          <option value="ADAPT">Adapt</option>
          <option value="COMPOSE">Compose</option>
          <option value="AGGREGATE">Aggregate</option>
          <option value="REWARD">Reward</option>
        </select>
      </div>

      {error && (
        <div style={{ padding: 16, background: "#fef2f2", color: "#dc2626", borderRadius: 8, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Loading...</div>
      ) : filteredSpecs.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", background: "#f3f4f6", borderRadius: 12, border: "1px solid #d1d5db" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎯</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#1f2937" }}>
            {search || filterScope || filterOutputType ? "No specs match filters" : "No specs yet"}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filteredSpecs.map((spec) => (
            <Link key={spec.id} href={`/x/specs/${spec.id}`} style={{ textDecoration: "none", color: "inherit" }}>
              <div
                style={{
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  padding: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  cursor: "pointer",
                  transition: "border-color 0.15s",
                }}
                onMouseOver={(e) => (e.currentTarget.style.borderColor = "#4f46e5")}
                onMouseOut={(e) => (e.currentTarget.style.borderColor = "#e5e7eb")}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "3px 8px",
                    background: scopeColors[spec.scope]?.bg,
                    color: scopeColors[spec.scope]?.text,
                    borderRadius: 4,
                    minWidth: 55,
                    textAlign: "center",
                  }}
                >
                  {spec.scope}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "3px 8px",
                    background: outputTypeColors[spec.outputType]?.bg || "#e5e7eb",
                    color: outputTypeColors[spec.outputType]?.text || "#374151",
                    borderRadius: 4,
                    minWidth: 65,
                    textAlign: "center",
                  }}
                >
                  {spec.outputType}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{spec.name}</div>
                  <div style={{ fontSize: 12, color: "#4b5563", fontFamily: "monospace" }}>{spec.slug}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
