"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type KnowledgeChunk = {
  id: string;
  docId: string;
  chunkIndex: number;
  startChar: number;
  endChar: number;
  content: string;
  tokens: number | null;
  doc?: {
    title: string | null;
    sourcePath: string;
  };
};

type KnowledgeDoc = {
  id: string;
  title: string | null;
  sourcePath: string;
  status: string;
  chunksCreated: number;
};

export default function KnowledgeDocDetailPage() {
  const params = useParams();
  const docId = params.docId as string;

  const [doc, setDoc] = useState<KnowledgeDoc | null>(null);
  const [chunks, setChunks] = useState<KnowledgeChunk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedChunk, setExpandedChunk] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/knowledge-docs?id=${docId}`).then((r) => r.json()),
      fetch(`/api/knowledge-chunks?docId=${docId}&limit=500`).then((r) => r.json()),
    ])
      .then(([docData, chunksData]) => {
        if (docData.ok && docData.docs?.length > 0) {
          setDoc(docData.docs[0]);
        }
        if (chunksData.ok) {
          setChunks(chunksData.chunks || []);
        }
        if (!docData.ok) {
          setError(docData.error || "Failed to load document");
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [docId]);

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "#6b7280" }}>
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ padding: 20, background: "#fef2f2", color: "#dc2626", borderRadius: 8 }}>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 16 }}>
        <Link
          href="/knowledge-docs"
          style={{ color: "#6b7280", fontSize: 13, textDecoration: "none" }}
        >
          Knowledge Docs
        </Link>
        <span style={{ color: "#9ca3af", margin: "0 8px" }}>/</span>
        <span style={{ color: "#374151", fontSize: 13, fontWeight: 500 }}>
          {doc?.title || "Document"}
        </span>
      </div>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
          {doc?.title || doc?.sourcePath?.split("/").pop() || "Unknown"}
        </h1>
        <p
          style={{
            fontSize: 12,
            color: "#6b7280",
            marginTop: 4,
            fontFamily: "monospace",
          }}
        >
          {doc?.sourcePath}
        </p>
        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
          <span
            style={{
              fontSize: 12,
              padding: "2px 8px",
              background: doc?.status === "COMPLETED" ? "#ecfdf5" : "#f3f4f6",
              color: doc?.status === "COMPLETED" ? "#10b981" : "#6b7280",
              borderRadius: 4,
              fontWeight: 500,
            }}
          >
            {doc?.status}
          </span>
          <span style={{ fontSize: 12, color: "#6b7280" }}>
            {chunks.length} chunks
          </span>
        </div>
      </div>

      {/* Chunks List */}
      {chunks.length === 0 ? (
        <div
          style={{
            padding: 40,
            textAlign: "center",
            background: "#f9fafb",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 12 }}>📄</div>
          <div style={{ fontSize: 14, color: "#6b7280" }}>No chunks found</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {chunks.map((chunk) => {
            const isExpanded = expandedChunk === chunk.id;
            return (
              <div
                key={chunk.id}
                style={{
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  overflow: "hidden",
                }}
              >
                {/* Chunk Header */}
                <button
                  onClick={() => setExpandedChunk(isExpanded ? null : chunk.id)}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: isExpanded ? "#f9fafb" : "#fff",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#6b7280",
                        background: "#f3f4f6",
                        padding: "2px 8px",
                        borderRadius: 4,
                      }}
                    >
                      #{chunk.chunkIndex}
                    </span>
                    <span style={{ fontSize: 13, color: "#374151" }}>
                      chars {chunk.startChar.toLocaleString()}-{chunk.endChar.toLocaleString()}
                    </span>
                    {chunk.tokens && (
                      <span style={{ fontSize: 11, color: "#9ca3af" }}>
                        ~{chunk.tokens} tokens
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 12, color: "#9ca3af" }}>
                    {isExpanded ? "▼" : "▶"}
                  </span>
                </button>

                {/* Chunk Content */}
                {isExpanded && (
                  <div
                    style={{
                      padding: 16,
                      borderTop: "1px solid #e5e7eb",
                      background: "#fafafa",
                    }}
                  >
                    <pre
                      style={{
                        fontSize: 12,
                        lineHeight: 1.6,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        margin: 0,
                        fontFamily: "ui-monospace, monospace",
                        color: "#374151",
                        maxHeight: 400,
                        overflow: "auto",
                      }}
                    >
                      {chunk.content}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
