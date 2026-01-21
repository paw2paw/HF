"use client";

import { useState, useEffect } from "react";

type KnowledgeArtifact = {
  id: string;
  type: string;
  title: string;
  content: string;
  tags: string[];
  version: string;
  confidence: number | null;
  sourceChunkIds: string[];
  createdAt: string;
  updatedAt: string;
  parameter?: { name: string; parameterId: string } | null;
};

const TYPE_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  SCORING_GUIDE: { bg: "#dbeafe", text: "#2563eb", icon: "📏" },
  EXAMPLES: { bg: "#fef3c7", text: "#d97706", icon: "📋" },
  RESEARCH_SUMMARY: { bg: "#ede9fe", text: "#7c3aed", icon: "🔬" },
  PROMPT_TEMPLATE: { bg: "#ecfdf5", text: "#10b981", icon: "📝" },
  CALIBRATION_DATA: { bg: "#fce7f3", text: "#db2777", icon: "🎯" },
};

export default function KnowledgeArtifactsPage() {
  const [artifacts, setArtifacts] = useState<KnowledgeArtifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/knowledge-artifacts")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setArtifacts(data.artifacts || []);
        } else {
          setError(data.error || "Failed to load artifacts");
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Knowledge Artifacts</h1>
        <p style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
          Curated knowledge for parameter scoring and analysis
        </p>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Loading...</div>
      ) : error ? (
        <div style={{ padding: 20, background: "#fef2f2", color: "#dc2626", borderRadius: 8 }}>
          {error}
        </div>
      ) : artifacts.length === 0 ? (
        <div
          style={{
            padding: 40,
            textAlign: "center",
            background: "#f9fafb",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>🧾</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#374151" }}>No knowledge artifacts yet</div>
          <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
            Create artifacts to guide parameter scoring
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(400px, 1fr))", gap: 16 }}>
          {artifacts.map((artifact) => {
            const typeStyle = TYPE_COLORS[artifact.type] || TYPE_COLORS.SCORING_GUIDE;
            return (
              <div
                key={artifact.id}
                style={{
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 16,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 20 }}>{typeStyle.icon}</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{artifact.title}</div>
                      <div style={{ fontSize: 11, color: "#9ca3af" }}>v{artifact.version}</div>
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      padding: "2px 8px",
                      background: typeStyle.bg,
                      color: typeStyle.text,
                      borderRadius: 4,
                      fontWeight: 600,
                    }}
                  >
                    {artifact.type.replace(/_/g, " ")}
                  </span>
                </div>

                {artifact.parameter && (
                  <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
                    Parameter: <span style={{ fontWeight: 500 }}>{artifact.parameter.name}</span>
                  </div>
                )}

                <div
                  style={{
                    fontSize: 13,
                    color: "#374151",
                    marginBottom: 12,
                    maxHeight: 100,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {artifact.content.slice(0, 200)}...
                </div>

                {artifact.tags.length > 0 && (
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
                    {artifact.tags.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          fontSize: 10,
                          padding: "2px 6px",
                          background: "#f3f4f6",
                          borderRadius: 4,
                          color: "#6b7280",
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <div style={{ fontSize: 10, color: "#9ca3af", display: "flex", gap: 12 }}>
                  <span>{artifact.sourceChunkIds.length} source chunks</span>
                  {artifact.confidence != null && (
                    <span>{Math.round(artifact.confidence * 100)}% confidence</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
