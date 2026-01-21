"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { SourcePageHeader } from "@/components/shared/SourcePageHeader";

type UserMemory = {
  id: string;
  userId: string;
  callId: string | null;
  category: string;
  source: string;
  key: string;
  value: string;
  normalizedKey: string | null;
  evidence: string | null;
  context: string | null;
  confidence: number;
  expiresAt: string | null;
  supersededById: string | null;
  extractedAt: string;
  extractedBy: string | null;
  user?: {
    id: string;
    name: string | null;
    email: string | null;
    externalId: string | null;
  };
  call?: {
    id: string;
    source: string;
    createdAt: string;
  } | null;
  supersededBy?: {
    id: string;
    key: string;
    value: string;
    extractedAt: string;
  } | null;
};

type UserMemorySummary = {
  id: string;
  userId: string;
  factCount: number;
  preferenceCount: number;
  eventCount: number;
  topicCount: number;
  keyFacts: { key: string; value: string; confidence: number }[];
  topTopics: { topic: string; lastMentioned: string }[];
  preferences: Record<string, string>;
  lastMemoryAt: string | null;
  user?: {
    id: string;
    name: string | null;
    email: string | null;
    externalId: string | null;
  };
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  FACT: { bg: "#dbeafe", text: "#2563eb" },
  PREFERENCE: { bg: "#fef3c7", text: "#d97706" },
  EVENT: { bg: "#dcfce7", text: "#16a34a" },
  TOPIC: { bg: "#f3e8ff", text: "#9333ea" },
  RELATIONSHIP: { bg: "#fce7f3", text: "#db2777" },
  CONTEXT: { bg: "#e5e7eb", text: "#4b5563" },
};

const SOURCE_LABELS: Record<string, string> = {
  EXTRACTED: "Auto-extracted",
  INFERRED: "Inferred",
  STATED: "User stated",
  CORRECTED: "Corrected",
};

export default function MemoriesPage() {
  const [view, setView] = useState<"memories" | "summaries">("memories");
  const [memories, setMemories] = useState<UserMemory[]>([]);
  const [summaries, setSummaries] = useState<UserMemorySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const limit = 50;

  // Expanded memory
  const [expandedMemory, setExpandedMemory] = useState<string | null>(null);

  // Users list for filter
  const [users, setUsers] = useState<{ id: string; name: string | null; email: string | null }[]>([]);

  // Load users for filter dropdown
  useEffect(() => {
    fetch("/api/users?limit=500")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setUsers(data.users || []);
        }
      })
      .catch(() => {});
  }, []);

  // Load memories
  const loadMemories = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("offset", String(offset));
    if (selectedUserId) params.set("userId", selectedUserId);
    if (selectedCategory) params.set("category", selectedCategory);
    if (searchQuery) params.set("search", searchQuery);

    fetch(`/api/memories?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setMemories(data.memories || []);
          setTotal(data.total || 0);
        } else {
          setError(data.error || "Failed to load memories");
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [offset, selectedUserId, selectedCategory, searchQuery]);

  // Load summaries
  const loadSummaries = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("offset", String(offset));
    if (selectedUserId) params.set("userId", selectedUserId);

    fetch(`/api/memories/summaries?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setSummaries(data.summaries || []);
          setTotal(data.total || 0);
        } else {
          setError(data.error || "Failed to load summaries");
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [offset, selectedUserId]);

  useEffect(() => {
    if (view === "memories") {
      loadMemories();
    } else {
      loadSummaries();
    }
  }, [view, loadMemories, loadSummaries]);

  // Reset offset when filters change
  useEffect(() => {
    setOffset(0);
  }, [selectedUserId, selectedCategory, searchQuery, view]);

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  const getUserLabel = (user: { name: string | null; email: string | null; externalId: string | null } | undefined) => {
    if (!user) return "Unknown";
    return user.name || user.email || user.externalId || "Unknown";
  };

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
      <SourcePageHeader
        title="User Memories"
        description="Extracted facts, preferences, and context from call transcripts"
        dataNodeId="data:memories"
        count={total}
      />

      {/* View Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button
          onClick={() => setView("memories")}
          style={{
            padding: "8px 16px",
            borderRadius: 6,
            border: "1px solid #e5e7eb",
            background: view === "memories" ? "#4f46e5" : "#fff",
            color: view === "memories" ? "#fff" : "#374151",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          All Memories
        </button>
        <button
          onClick={() => setView("summaries")}
          style={{
            padding: "8px 16px",
            borderRadius: 6,
            border: "1px solid #e5e7eb",
            background: view === "summaries" ? "#4f46e5" : "#fff",
            color: view === "summaries" ? "#fff" : "#374151",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          User Summaries
        </button>
      </div>

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
        {/* User filter */}
        <select
          value={selectedUserId}
          onChange={(e) => setSelectedUserId(e.target.value)}
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid #e5e7eb",
            fontSize: 13,
            minWidth: 200,
          }}
        >
          <option value="">All users</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {getUserLabel(user)}
            </option>
          ))}
        </select>

        {/* Category filter (only for memories view) */}
        {view === "memories" && (
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid #e5e7eb",
              fontSize: 13,
            }}
          >
            <option value="">All categories</option>
            <option value="FACT">Facts</option>
            <option value="PREFERENCE">Preferences</option>
            <option value="EVENT">Events</option>
            <option value="TOPIC">Topics</option>
            <option value="RELATIONSHIP">Relationships</option>
            <option value="CONTEXT">Context</option>
          </select>
        )}

        {/* Search (only for memories view) */}
        {view === "memories" && (
          <input
            type="text"
            placeholder="Search key/value..."
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
        )}

        {/* Clear filters */}
        {(selectedUserId || selectedCategory || searchQuery) && (
          <button
            onClick={() => {
              setSelectedUserId("");
              setSelectedCategory("");
              setSearchQuery("");
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
      ) : view === "memories" ? (
        /* Memories List */
        memories.length === 0 ? (
          <div
            style={{
              padding: 40,
              textAlign: "center",
              background: "#f9fafb",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 16 }}>🧠</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#374151" }}>No memories found</div>
            <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
              {selectedUserId || searchQuery ? "Try adjusting your filters" : "Run the Memory Extractor agent to extract memories from calls"}
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {memories.map((memory) => {
                const isExpanded = expandedMemory === memory.id;
                const categoryStyle = CATEGORY_COLORS[memory.category] || CATEGORY_COLORS.FACT;
                return (
                  <div
                    key={memory.id}
                    style={{
                      background: "#fff",
                      border: "1px solid #e5e7eb",
                      borderRadius: 8,
                      overflow: "hidden",
                    }}
                  >
                    {/* Memory Header */}
                    <button
                      onClick={() => setExpandedMemory(isExpanded ? null : memory.id)}
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
                            fontSize: 10,
                            fontWeight: 600,
                            padding: "2px 8px",
                            background: categoryStyle.bg,
                            color: categoryStyle.text,
                            borderRadius: 4,
                            flexShrink: 0,
                          }}
                        >
                          {memory.category}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
                          {memory.key}
                        </span>
                        <span style={{ fontSize: 13, color: "#6b7280" }}>
                          = "{memory.value}"
                        </span>
                        <span style={{ fontSize: 11, color: "#9ca3af", flexShrink: 0 }}>
                          {getUserLabel(memory.user)}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span
                          style={{
                            fontSize: 10,
                            padding: "2px 6px",
                            background: "#f3f4f6",
                            color: "#6b7280",
                            borderRadius: 4,
                          }}
                        >
                          {(memory.confidence * 100).toFixed(0)}%
                        </span>
                        <span style={{ fontSize: 12, color: "#9ca3af" }}>{isExpanded ? "▼" : "▶"}</span>
                      </div>
                    </button>

                    {/* Memory Details */}
                    {isExpanded && (
                      <div
                        style={{
                          padding: 16,
                          borderTop: "1px solid #e5e7eb",
                          background: "#fafafa",
                          fontSize: 13,
                        }}
                      >
                        <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "8px 16px" }}>
                          <span style={{ fontWeight: 500, color: "#6b7280" }}>Source:</span>
                          <span>{SOURCE_LABELS[memory.source] || memory.source}</span>

                          <span style={{ fontWeight: 500, color: "#6b7280" }}>Normalized Key:</span>
                          <span style={{ fontFamily: "monospace" }}>{memory.normalizedKey || "—"}</span>

                          {memory.evidence && (
                            <>
                              <span style={{ fontWeight: 500, color: "#6b7280" }}>Evidence:</span>
                              <span style={{ fontStyle: "italic", color: "#4b5563" }}>"{memory.evidence}"</span>
                            </>
                          )}

                          {memory.context && (
                            <>
                              <span style={{ fontWeight: 500, color: "#6b7280" }}>Context:</span>
                              <span>{memory.context}</span>
                            </>
                          )}

                          <span style={{ fontWeight: 500, color: "#6b7280" }}>Extracted At:</span>
                          <span>{new Date(memory.extractedAt).toLocaleString()}</span>

                          <span style={{ fontWeight: 500, color: "#6b7280" }}>Extracted By:</span>
                          <span>{memory.extractedBy || "—"}</span>

                          {memory.expiresAt && (
                            <>
                              <span style={{ fontWeight: 500, color: "#6b7280" }}>Expires:</span>
                              <span>{new Date(memory.expiresAt).toLocaleString()}</span>
                            </>
                          )}

                          {memory.call && (
                            <>
                              <span style={{ fontWeight: 500, color: "#6b7280" }}>Source Call:</span>
                              <Link
                                href={`/calls/${memory.call.id}`}
                                style={{ color: "#2563eb", textDecoration: "none" }}
                              >
                                {memory.call.source} ({new Date(memory.call.createdAt).toLocaleDateString()})
                              </Link>
                            </>
                          )}

                          {memory.supersededBy && (
                            <>
                              <span style={{ fontWeight: 500, color: "#dc2626" }}>Superseded By:</span>
                              <span style={{ color: "#dc2626" }}>
                                {memory.supersededBy.key} = "{memory.supersededBy.value}"
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )
      ) : (
        /* Summaries View */
        summaries.length === 0 ? (
          <div
            style={{
              padding: 40,
              textAlign: "center",
              background: "#f9fafb",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#374151" }}>No summaries found</div>
            <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
              Run the Memory Extractor agent with aggregation enabled
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {summaries.map((summary) => (
              <div
                key={summary.id}
                style={{
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 20,
                }}
              >
                {/* User Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: "#374151" }}>
                      {getUserLabel(summary.user)}
                    </div>
                    <div style={{ fontSize: 12, color: "#9ca3af" }}>
                      Last memory: {summary.lastMemoryAt ? new Date(summary.lastMemoryAt).toLocaleString() : "—"}
                    </div>
                  </div>
                  <Link
                    href={`/people/${summary.userId}`}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 6,
                      background: "#f3f4f6",
                      color: "#374151",
                      fontSize: 12,
                      textDecoration: "none",
                    }}
                  >
                    View Profile
                  </Link>
                </div>

                {/* Stats */}
                <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
                  {[
                    { label: "Facts", count: summary.factCount, color: CATEGORY_COLORS.FACT },
                    { label: "Preferences", count: summary.preferenceCount, color: CATEGORY_COLORS.PREFERENCE },
                    { label: "Events", count: summary.eventCount, color: CATEGORY_COLORS.EVENT },
                    { label: "Topics", count: summary.topicCount, color: CATEGORY_COLORS.TOPIC },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      style={{
                        padding: "8px 12px",
                        background: stat.color.bg,
                        borderRadius: 6,
                        textAlign: "center",
                      }}
                    >
                      <div style={{ fontSize: 18, fontWeight: 600, color: stat.color.text }}>{stat.count}</div>
                      <div style={{ fontSize: 11, color: stat.color.text }}>{stat.label}</div>
                    </div>
                  ))}
                </div>

                {/* Key Facts */}
                {summary.keyFacts && summary.keyFacts.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 8 }}>Key Facts</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {summary.keyFacts.slice(0, 6).map((fact, i) => (
                        <span
                          key={i}
                          style={{
                            padding: "4px 8px",
                            background: "#f3f4f6",
                            borderRadius: 4,
                            fontSize: 12,
                          }}
                        >
                          <strong>{fact.key}:</strong> {fact.value}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Preferences */}
                {summary.preferences && Object.keys(summary.preferences).length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 8 }}>Preferences</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {Object.entries(summary.preferences).slice(0, 6).map(([key, value]) => (
                        <span
                          key={key}
                          style={{
                            padding: "4px 8px",
                            background: CATEGORY_COLORS.PREFERENCE.bg,
                            borderRadius: 4,
                            fontSize: 12,
                            color: CATEGORY_COLORS.PREFERENCE.text,
                          }}
                        >
                          <strong>{key}:</strong> {value}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 12,
            marginTop: 20,
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
    </div>
  );
}
