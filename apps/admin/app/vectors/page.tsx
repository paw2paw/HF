"use client";

import { useState, useEffect } from "react";

type VectorStats = {
  totalEmbeddings: number;
  byModel: Record<string, number>;
  byDimensions: Record<string, number>;
  recentEmbeddings: Array<{
    id: string;
    model: string;
    dimensions: number;
    createdAt: string;
    chunk: {
      content: string;
      doc: {
        title: string | null;
        sourcePath: string;
      };
    };
  }>;
};

export default function VectorsPage() {
  const [stats, setStats] = useState<VectorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/vectors")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setStats(data.stats);
        } else {
          setError(data.error || "Failed to load vector stats");
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Vector Embeddings</h1>
        <p style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
          Semantic embeddings for knowledge retrieval
        </p>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Loading...</div>
      ) : error ? (
        <div style={{ padding: 20, background: "#fef2f2", color: "#dc2626", borderRadius: 8 }}>
          {error}
        </div>
      ) : !stats || stats.totalEmbeddings === 0 ? (
        <div
          style={{
            padding: 40,
            textAlign: "center",
            background: "#f9fafb",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>🧬</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#374151" }}>No vector embeddings yet</div>
          <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
            Ingest knowledge docs to create embeddings
          </div>
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
            <div
              style={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: 16,
              }}
            >
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Total Embeddings</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{stats.totalEmbeddings.toLocaleString()}</div>
            </div>

            {Object.entries(stats.byModel).map(([model, count]) => (
              <div
                key={model}
                style={{
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 16,
                }}
              >
                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>{model}</div>
                <div style={{ fontSize: 28, fontWeight: 700 }}>{count.toLocaleString()}</div>
              </div>
            ))}

            {Object.entries(stats.byDimensions).map(([dims, count]) => (
              <div
                key={dims}
                style={{
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 16,
                }}
              >
                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>{dims}d vectors</div>
                <div style={{ fontSize: 28, fontWeight: 700 }}>{count.toLocaleString()}</div>
              </div>
            ))}
          </div>

          {/* Recent Embeddings */}
          {stats.recentEmbeddings.length > 0 && (
            <div
              style={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              <div style={{ padding: "12px 16px", borderBottom: "1px solid #e5e7eb", fontWeight: 600, fontSize: 14 }}>
                Recent Embeddings
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
                      Source
                    </th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
                      Content Preview
                    </th>
                    <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
                      Model
                    </th>
                    <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
                      Dimensions
                    </th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentEmbeddings.map((emb) => (
                    <tr key={emb.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>
                          {emb.chunk.doc.title || emb.chunk.doc.sourcePath.split("/").pop()}
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 12, color: "#6b7280", maxWidth: 300 }}>
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {emb.chunk.content.slice(0, 80)}...
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "center" }}>
                        <span
                          style={{
                            fontSize: 10,
                            padding: "2px 8px",
                            background: "#e0e7ff",
                            color: "#4338ca",
                            borderRadius: 4,
                          }}
                        >
                          {emb.model}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "center", fontSize: 12, color: "#6b7280" }}>
                        {emb.dimensions}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 12, color: "#6b7280" }}>
                        {new Date(emb.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
