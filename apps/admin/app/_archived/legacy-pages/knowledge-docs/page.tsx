"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { SourcePageHeader } from "@/components/shared/SourcePageHeader";

type KnowledgeDoc = {
  id: string;
  sourcePath: string;
  title: string | null;
  contentSha: string;
  status: string;
  ingestedAt: string | null;
  chunksExpected: number | null;
  chunksCreated: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    chunks: number;
  };
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: "#f3f4f6", text: "#6b7280" },
  IN_PROGRESS: { bg: "#dbeafe", text: "#2563eb" },
  COMPLETED: { bg: "#ecfdf5", text: "#10b981" },
  FAILED: { bg: "#fef2f2", text: "#dc2626" },
};

export default function KnowledgeDocsPage() {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/knowledge-docs")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setDocs(data.docs || []);
        } else {
          setError(data.error || "Failed to load knowledge docs");
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
      <SourcePageHeader
        title="Knowledge Docs"
        description="Ingested documents for RAG retrieval"
        dataNodeId="data:knowledge"
        count={docs.length}
      />

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Loading...</div>
      ) : error ? (
        <div style={{ padding: 20, background: "#fef2f2", color: "#dc2626", borderRadius: 8 }}>
          {error}
        </div>
      ) : docs.length === 0 ? (
        <div
          style={{
            padding: 40,
            textAlign: "center",
            background: "#f9fafb",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>📚</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#374151" }}>No knowledge docs yet</div>
          <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
            Run knowledge ingestion to import documents
          </div>
        </div>
      ) : (
        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
                  Title / Path
                </th>
                <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
                  Status
                </th>
                <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
                  Chunks
                </th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
                  Content Hash
                </th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
                  Ingested
                </th>
              </tr>
            </thead>
            <tbody>
              {docs.map((doc) => {
                const statusStyle = STATUS_COLORS[doc.status] || STATUS_COLORS.PENDING;
                return (
                  <tr key={doc.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "12px 16px" }}>
                      <Link
                        href={`/knowledge-docs/${doc.id}`}
                        style={{ textDecoration: "none", color: "inherit" }}
                      >
                        <div style={{ fontSize: 14, fontWeight: 500, color: "#2563eb" }}>
                          {doc.title || doc.sourcePath.split("/").pop()}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "#9ca3af",
                            fontFamily: "monospace",
                            maxWidth: 300,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {doc.sourcePath}
                        </div>
                      </Link>
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      <span
                        style={{
                          fontSize: 10,
                          padding: "2px 8px",
                          background: statusStyle.bg,
                          color: statusStyle.text,
                          borderRadius: 4,
                          fontWeight: 600,
                        }}
                      >
                        {doc.status}
                      </span>
                      {doc.errorMessage && (
                        <div style={{ fontSize: 10, color: "#dc2626", marginTop: 4 }}>
                          {doc.errorMessage.slice(0, 50)}...
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center", fontSize: 14 }}>
                      <Link
                        href={`/knowledge-docs/${doc.id}`}
                        style={{ color: "#2563eb", textDecoration: "none" }}
                      >
                        {doc.chunksCreated}
                        {doc.chunksExpected != null && (
                          <span style={{ color: "#9ca3af" }}>/{doc.chunksExpected}</span>
                        )}
                      </Link>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 10, fontFamily: "monospace", color: "#6b7280" }}>
                      {doc.contentSha.slice(0, 12)}...
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: "#6b7280" }}>
                      {doc.ingestedAt ? new Date(doc.ingestedAt).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
