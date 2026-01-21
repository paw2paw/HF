"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { SourcePageHeader } from "@/components/shared/SourcePageHeader";

type KnowledgeChunk = {
  id: string;
  docId: string;
  chunkIndex: number;
  startChar: number;
  endChar: number;
  content: string;
  tokens: number | null;
  createdAt: string;
  doc?: {
    title: string | null;
    sourcePath: string;
  };
  embedding?: {
    id: string;
  } | null;
};

type KnowledgeDoc = {
  id: string;
  title: string | null;
  sourcePath: string;
  chunksCreated: number;
};

export default function ChunksPage() {
  const [chunks, setChunks] = useState<KnowledgeChunk[]>([]);
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedDocId, setSelectedDocId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [embeddingFilter, setEmbeddingFilter] = useState<"all" | "with" | "without">("all");

  // Pagination
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const limit = 50;

  // Expanded chunks
  const [expandedChunk, setExpandedChunk] = useState<string | null>(null);

  // Load docs for filter dropdown
  useEffect(() => {
    fetch("/api/knowledge-docs?limit=500")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setDocs(data.docs || []);
        }
      })
      .catch(() => {});
  }, []);

  // Load chunks
  const loadChunks = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("offset", String(offset));
    if (selectedDocId) params.set("docId", selectedDocId);
    if (searchQuery) params.set("search", searchQuery);
    if (embeddingFilter !== "all") params.set("hasEmbedding", embeddingFilter === "with" ? "true" : "false");

    fetch(`/api/knowledge-chunks?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setChunks(data.chunks || []);
          setTotal(data.total || 0);
        } else {
          setError(data.error || "Failed to load chunks");
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [offset, selectedDocId, searchQuery, embeddingFilter]);

  useEffect(() => {
    loadChunks();
  }, [loadChunks]);

  // Reset offset when filters change
  useEffect(() => {
    setOffset(0);
  }, [selectedDocId, searchQuery, embeddingFilter]);

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
      <SourcePageHeader
        title="Knowledge Chunks"
        description="All document chunks for RAG retrieval"
        dataNodeId="data:chunks"
        count={total}
      />

      {/* Filters */}
      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 20,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {/* Document filter */}
        <select
          value={selectedDocId}
          onChange={(e) => setSelectedDocId(e.target.value)}
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid #e5e7eb",
            fontSize: 13,
            minWidth: 200,
          }}
        >
          <option value="">All documents</option>
          {docs.map((doc) => (
            <option key={doc.id} value={doc.id}>
              {doc.title || doc.sourcePath.split("/").pop()} ({doc.chunksCreated})
            </option>
          ))}
        </select>

        {/* Embedding filter */}
        <select
          value={embeddingFilter}
          onChange={(e) => setEmbeddingFilter(e.target.value as any)}
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid #e5e7eb",
            fontSize: 13,
          }}
        >
          <option value="all">All chunks</option>
          <option value="with">With embedding</option>
          <option value="without">Without embedding</option>
        </select>

        {/* Search */}
        <input
          type="text"
          placeholder="Search content..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid #e5e7eb",
            fontSize: 13,
            width: 200,
          }}
        />

        {/* Clear filters */}
        {(selectedDocId || searchQuery || embeddingFilter !== "all") && (
          <button
            onClick={() => {
              setSelectedDocId("");
              setSearchQuery("");
              setEmbeddingFilter("all");
            }}
            style={{
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid #e5e7eb",
              background: "#fff",
              fontSize: 13,
              cursor: "pointer",
              color: "#6b7280",
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: 20, background: "#fef2f2", color: "#dc2626", borderRadius: 8, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Loading...</div>
      ) : chunks.length === 0 ? (
        <div
          style={{
            padding: 40,
            textAlign: "center",
            background: "#f9fafb",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>📄</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#374151" }}>No chunks found</div>
          <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
            {selectedDocId || searchQuery ? "Try adjusting your filters" : "Run knowledge ingestion to create chunks"}
          </div>
        </div>
      ) : (
        <>
          {/* Chunks List */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
            {chunks.map((chunk) => {
              const isExpanded = expandedChunk === chunk.id;
              const docTitle = chunk.doc?.title || chunk.doc?.sourcePath?.split("/").pop() || "Unknown";
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
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#6b7280",
                          background: "#f3f4f6",
                          padding: "2px 8px",
                          borderRadius: 4,
                          flexShrink: 0,
                        }}
                      >
                        #{chunk.chunkIndex}
                      </span>
                      <Link
                        href={`/knowledge-docs/${chunk.docId}`}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          fontSize: 13,
                          color: "#2563eb",
                          textDecoration: "none",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {docTitle}
                      </Link>
                      <span style={{ fontSize: 12, color: "#9ca3af", flexShrink: 0 }}>
                        {chunk.startChar.toLocaleString()}-{chunk.endChar.toLocaleString()}
                      </span>
                      {chunk.tokens && (
                        <span style={{ fontSize: 11, color: "#9ca3af", flexShrink: 0 }}>
                          ~{chunk.tokens} tok
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {chunk.embedding ? (
                        <span
                          style={{
                            fontSize: 10,
                            padding: "2px 6px",
                            background: "#ecfdf5",
                            color: "#10b981",
                            borderRadius: 4,
                          }}
                        >
                          embedded
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: 10,
                            padding: "2px 6px",
                            background: "#f3f4f6",
                            color: "#9ca3af",
                            borderRadius: 4,
                          }}
                        >
                          no embed
                        </span>
                      )}
                      <span style={{ fontSize: 12, color: "#9ca3af" }}>{isExpanded ? "▼" : "▶"}</span>
                    </div>
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
                          maxHeight: 300,
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 12,
              }}
            >
              <button
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "1px solid #e5e7eb",
                  background: offset === 0 ? "#f3f4f6" : "#fff",
                  cursor: offset === 0 ? "not-allowed" : "pointer",
                  fontSize: 13,
                  color: offset === 0 ? "#9ca3af" : "#374151",
                }}
              >
                Previous
              </button>
              <span style={{ fontSize: 13, color: "#6b7280" }}>
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setOffset(offset + limit)}
                disabled={currentPage >= totalPages}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "1px solid #e5e7eb",
                  background: currentPage >= totalPages ? "#f3f4f6" : "#fff",
                  cursor: currentPage >= totalPages ? "not-allowed" : "pointer",
                  fontSize: 13,
                  color: currentPage >= totalPages ? "#9ca3af" : "#374151",
                }}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
