"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { SourcePageHeader } from "@/components/shared/SourcePageHeader";

// =============================================================================
// TYPES
// =============================================================================

type CallerWithPrompt = {
  id: string;
  name: string | null;
  externalId: string | null;
  callerId: string | null;
  nextPrompt: string | null;
  nextPromptComposedAt: string | null;
  nextPromptInputs: {
    targetCount?: number;
    memoryCount?: number;
    composedAt?: string;
  } | null;
  caller?: {
    name: string | null;
    email: string | null;
    _count?: {
      calls: number;
      memories: number;
    };
  } | null;
  segment?: {
    name: string;
  } | null;
};

type FilterOption = "all" | "ready" | "needs-update" | "none";

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function PromptsGalleryPage() {
  const [callers, setCallers] = useState<CallerWithPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI State
  const [selectedCaller, setSelectedCaller] = useState<CallerWithPrompt | null>(null);
  const [filter, setFilter] = useState<FilterOption>("all");
  const [search, setSearch] = useState("");
  const [composing, setComposing] = useState(false);
  const [composeResult, setComposeResult] = useState<any>(null);

  // Fetch callers with prompts
  useEffect(() => {
    const fetchCallers = async () => {
      try {
        const res = await fetch("/api/prompts/gallery");
        const data = await res.json();

        if (data.ok) {
          setCallers(data.callers || []);
          // Auto-select first caller with prompt
          const firstWithPrompt = data.callers?.find((c: CallerWithPrompt) => c.nextPrompt);
          if (firstWithPrompt) {
            setSelectedCaller(firstWithPrompt);
          }
        } else {
          setError(data.error || "Failed to load prompts");
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCallers();
  }, []);

  // Filter callers
  const filteredCallers = callers.filter((caller) => {
    // Search filter
    if (search) {
      const s = search.toLowerCase();
      const name = caller.name || caller.caller?.name || caller.externalId || "";
      if (!name.toLowerCase().includes(s)) return false;
    }

    // Status filter
    if (filter === "ready" && !caller.nextPrompt) return false;
    if (filter === "none" && caller.nextPrompt) return false;
    if (filter === "needs-update") {
      if (!caller.nextPromptComposedAt) return true;
      const composedAt = new Date(caller.nextPromptComposedAt);
      const hoursAgo = (Date.now() - composedAt.getTime()) / (1000 * 60 * 60);
      return hoursAgo > 24;
    }

    return true;
  });

  // Compose prompts for all
  const handleComposeAll = async () => {
    setComposing(true);
    setComposeResult(null);

    try {
      const res = await fetch("/api/ops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opid: "prompt:compose-next",
          settings: {
            forceRecompose: true,
            verbose: true,
          },
        }),
      });

      const data = await res.json();
      setComposeResult(data);

      // Refresh the list
      const refreshRes = await fetch("/api/prompts/gallery");
      const refreshData = await refreshRes.json();
      if (refreshData.ok) {
        setCallers(refreshData.callers || []);
      }
    } catch (err: any) {
      setComposeResult({ success: false, error: err.message });
    } finally {
      setComposing(false);
    }
  };

  // Get caller display name
  const getCallerName = (caller: CallerWithPrompt) => {
    return caller.name || caller.caller?.name || caller.caller?.email || caller.externalId || "Unknown";
  };

  // Get prompt age
  const getPromptAge = (caller: CallerWithPrompt) => {
    if (!caller.nextPromptComposedAt) return null;
    const composedAt = new Date(caller.nextPromptComposedAt);
    const hoursAgo = Math.floor((Date.now() - composedAt.getTime()) / (1000 * 60 * 60));
    if (hoursAgo < 1) return "Just now";
    if (hoursAgo < 24) return `${hoursAgo}h ago`;
    const daysAgo = Math.floor(hoursAgo / 24);
    return `${daysAgo}d ago`;
  };

  // Stats
  const stats = {
    total: callers.length,
    withPrompt: callers.filter((c) => c.nextPrompt).length,
    needsUpdate: callers.filter((c) => {
      if (!c.nextPromptComposedAt) return false;
      const hoursAgo = (Date.now() - new Date(c.nextPromptComposedAt).getTime()) / (1000 * 60 * 60);
      return hoursAgo > 24;
    }).length,
  };

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <div style={{ padding: 24, maxWidth: 1600, margin: "0 auto" }}>
      <SourcePageHeader
        title="Prompt Gallery"
        description="View and manage composed prompts for all callers"
        dataNodeId="prompts"
        count={stats.withPrompt}
      />

      {/* Stats Bar */}
      <div
        style={{
          display: "flex",
          gap: 16,
          marginBottom: 24,
          padding: 16,
          background: "#f9fafb",
          borderRadius: 12,
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#374151" }}>{stats.total}</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>Total Callers</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#10b981" }}>{stats.withPrompt}</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>With Prompt</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#f59e0b" }}>{stats.needsUpdate}</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>Needs Update (24h+)</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#dc2626" }}>
            {stats.total - stats.withPrompt}
          </div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>No Prompt</div>
        </div>
        <div style={{ display: "flex", alignItems: "center" }}>
          <button
            onClick={handleComposeAll}
            disabled={composing}
            style={{
              padding: "10px 20px",
              background: composing ? "#9ca3af" : "#4f46e5",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: composing ? "not-allowed" : "pointer",
              fontWeight: 500,
              fontSize: 14,
            }}
          >
            {composing ? "Composing..." : "Compose All"}
          </button>
        </div>
      </div>

      {/* Compose Result */}
      {composeResult && (
        <div
          style={{
            padding: 16,
            marginBottom: 20,
            background: composeResult.success ? "#f0fdf4" : "#fef2f2",
            border: `1px solid ${composeResult.success ? "#bbf7d0" : "#fecaca"}`,
            borderRadius: 8,
            fontSize: 14,
          }}
        >
          {composeResult.success ? (
            <span>
              ✓ Composed {composeResult.result?.promptsComposed || 0} prompts (
              {composeResult.result?.skipped || 0} skipped)
            </span>
          ) : (
            <span style={{ color: "#dc2626" }}>Error: {composeResult.error}</span>
          )}
          <button
            onClick={() => setComposeResult(null)}
            style={{
              marginLeft: 12,
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#6b7280",
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Main Layout */}
      <div style={{ display: "grid", gridTemplateColumns: "350px 1fr", gap: 24 }}>
        {/* Left Panel - Caller List */}
        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            maxHeight: "calc(100vh - 300px)",
          }}
        >
          {/* Search & Filter */}
          <div style={{ padding: 16, borderBottom: "1px solid #e5e7eb" }}>
            <input
              type="text"
              placeholder="Search callers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                fontSize: 14,
                marginBottom: 12,
              }}
            />
            <div style={{ display: "flex", gap: 6 }}>
              {[
                { id: "all", label: "All" },
                { id: "ready", label: "Ready" },
                { id: "needs-update", label: "Stale" },
                { id: "none", label: "None" },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id as FilterOption)}
                  style={{
                    flex: 1,
                    padding: "6px 10px",
                    fontSize: 12,
                    background: filter === f.id ? "#4f46e5" : "#f3f4f6",
                    color: filter === f.id ? "white" : "#6b7280",
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Caller List */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {loading ? (
              <div style={{ padding: 20, textAlign: "center", color: "#6b7280" }}>Loading...</div>
            ) : error ? (
              <div style={{ padding: 20, color: "#dc2626" }}>{error}</div>
            ) : filteredCallers.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: "#6b7280" }}>
                No callers match your filter
              </div>
            ) : (
              <div>
                {filteredCallers.map((caller) => {
                  const isSelected = selectedCaller?.id === caller.id;
                  const hasPrompt = !!caller.nextPrompt;
                  const age = getPromptAge(caller);

                  return (
                    <div
                      key={caller.id}
                      onClick={() => setSelectedCaller(caller)}
                      style={{
                        padding: 14,
                        borderBottom: "1px solid #f3f4f6",
                        cursor: "pointer",
                        background: isSelected ? "#eef2ff" : "transparent",
                        transition: "background 0.1s ease",
                      }}
                    >
                      <div
                        style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}
                      >
                        <div style={{ fontWeight: 500, fontSize: 14 }}>{getCallerName(caller)}</div>
                        {hasPrompt ? (
                          <span
                            style={{
                              fontSize: 10,
                              padding: "2px 6px",
                              background: "#dcfce7",
                              color: "#166534",
                              borderRadius: 4,
                            }}
                          >
                            ✓ Ready
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: 10,
                              padding: "2px 6px",
                              background: "#fee2e2",
                              color: "#991b1b",
                              borderRadius: 4,
                            }}
                          >
                            No prompt
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 12, color: "#6b7280" }}>
                        {caller.caller?._count?.calls !== undefined && (
                          <span>{caller.caller._count.calls} calls</span>
                        )}
                        {caller.caller?._count?.memories !== undefined && (
                          <span>{caller.caller._count.memories} memories</span>
                        )}
                        {age && <span>{age}</span>}
                      </div>
                      {caller.segment && (
                        <div style={{ marginTop: 4 }}>
                          <span
                            style={{
                              fontSize: 10,
                              padding: "2px 6px",
                              background: "#e0e7ff",
                              color: "#4338ca",
                              borderRadius: 4,
                            }}
                          >
                            {caller.segment.name}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Prompt Display */}
        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {!selectedCaller ? (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#9ca3af",
              }}
            >
              Select a caller to view their prompt
            </div>
          ) : (
            <>
              {/* Header */}
              <div
                style={{
                  padding: 20,
                  borderBottom: "1px solid #e5e7eb",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>
                    {getCallerName(selectedCaller)}
                  </h2>
                  <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
                    {selectedCaller.nextPromptComposedAt
                      ? `Composed ${new Date(selectedCaller.nextPromptComposedAt).toLocaleString()}`
                      : "No prompt composed"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Link
                    href={`/callers/${selectedCaller.callerId || selectedCaller.id}`}
                    style={{
                      padding: "8px 14px",
                      background: "#f3f4f6",
                      color: "#374151",
                      borderRadius: 6,
                      textDecoration: "none",
                      fontSize: 13,
                    }}
                  >
                    View Profile
                  </Link>
                  <button
                    onClick={() => {
                      if (selectedCaller.nextPrompt) {
                        navigator.clipboard.writeText(selectedCaller.nextPrompt);
                      }
                    }}
                    disabled={!selectedCaller.nextPrompt}
                    style={{
                      padding: "8px 14px",
                      background: selectedCaller.nextPrompt ? "#4f46e5" : "#9ca3af",
                      color: "white",
                      border: "none",
                      borderRadius: 6,
                      cursor: selectedCaller.nextPrompt ? "pointer" : "not-allowed",
                      fontSize: 13,
                    }}
                  >
                    Copy Prompt
                  </button>
                </div>
              </div>

              {/* Prompt Inputs Summary */}
              {selectedCaller.nextPromptInputs && (
                <div
                  style={{
                    padding: 12,
                    background: "#f0fdf4",
                    borderBottom: "1px solid #e5e7eb",
                    display: "flex",
                    gap: 20,
                    fontSize: 13,
                  }}
                >
                  <span>🎯 {selectedCaller.nextPromptInputs.targetCount || 0} targets</span>
                  <span>💭 {selectedCaller.nextPromptInputs.memoryCount || 0} memories</span>
                  {selectedCaller.nextPrompt && (
                    <span>📝 {selectedCaller.nextPrompt.length} chars</span>
                  )}
                </div>
              )}

              {/* Prompt Content */}
              <div style={{ flex: 1, padding: 20, overflowY: "auto" }}>
                {selectedCaller.nextPrompt ? (
                  <div
                    style={{
                      background: "#f9fafb",
                      border: "1px solid #e5e7eb",
                      borderRadius: 10,
                      padding: 20,
                      fontSize: 14,
                      lineHeight: 1.7,
                      whiteSpace: "pre-wrap",
                      fontFamily: "system-ui, sans-serif",
                    }}
                  >
                    {selectedCaller.nextPrompt}
                  </div>
                ) : (
                  <div
                    style={{
                      textAlign: "center",
                      padding: 40,
                      color: "#9ca3af",
                    }}
                  >
                    <div style={{ fontSize: 48, marginBottom: 16 }}>✨</div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
                      No prompt composed
                    </div>
                    <div style={{ fontSize: 14, marginBottom: 16 }}>
                      This caller needs analysis and behavior targets to compose a prompt.
                    </div>
                    <Link
                      href={`/analyze`}
                      style={{
                        display: "inline-block",
                        padding: "10px 20px",
                        background: "#4f46e5",
                        color: "white",
                        borderRadius: 8,
                        textDecoration: "none",
                      }}
                    >
                      Go to Analyze →
                    </Link>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
