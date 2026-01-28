"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { SourcePageHeader } from "@/components/shared/SourcePageHeader";

type Caller = {
  id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  externalId: string | null;
  createdAt: string;
  nextPrompt: string | null;
  nextPromptComposedAt: string | null;
  domain?: {
    id: string;
    slug: string;
    name: string;
  } | null;
  personality?: {
    openness: number | null;
    conscientiousness: number | null;
    extraversion: number | null;
    agreeableness: number | null;
    neuroticism: number | null;
    confidenceScore: number | null;
  } | null;
  _count?: {
    calls: number;
    memories: number;
    personalityObservations: number;
  };
};

export default function CallersPage() {
  const [callers, setCallers] = useState<Caller[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [resetConfirm, setResetConfirm] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [snapshotModal, setSnapshotModal] = useState<Caller | null>(null);
  const [snapshotLabel, setSnapshotLabel] = useState("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchCallers = () => {
    fetch("/api/callers?withPersonality=true&withCounts=true")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setCallers(data.callers || []);
        } else {
          setError(data.error || "Failed to load callers");
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchCallers();
  }, []);

  // Auto-clear success message
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const getCallerLabel = (caller: Caller) => {
    return caller.name || caller.email || caller.phone || caller.externalId || "Unknown";
  };

  const filteredCallers = callers.filter((caller) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      caller.name?.toLowerCase().includes(s) ||
      caller.email?.toLowerCase().includes(s) ||
      caller.phone?.toLowerCase().includes(s) ||
      caller.externalId?.toLowerCase().includes(s)
    );
  });

  const getPersonalityBadge = (caller: Caller) => {
    if (!caller.personality || caller.personality.confidenceScore === null) return null;
    const traits = [];
    if (caller.personality.openness !== null && caller.personality.openness > 0.6) traits.push("Open");
    if (caller.personality.extraversion !== null && caller.personality.extraversion > 0.6) traits.push("Extraverted");
    if (caller.personality.agreeableness !== null && caller.personality.agreeableness > 0.6) traits.push("Agreeable");
    if (caller.personality.conscientiousness !== null && caller.personality.conscientiousness > 0.6) traits.push("Conscientious");
    if (caller.personality.neuroticism !== null && caller.personality.neuroticism > 0.6) traits.push("Neurotic");
    return traits.length > 0 ? traits.slice(0, 2).join(", ") : "Balanced";
  };

  const hasAnalysisData = (caller: Caller) => {
    return (caller._count?.memories || 0) > 0 ||
           (caller._count?.personalityObservations || 0) > 0 ||
           caller.personality?.confidenceScore !== null;
  };

  const handleReset = async (callerId: string) => {
    setActionLoading(callerId);
    try {
      const res = await fetch(`/api/callers/${callerId}/reset`, { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setSuccessMessage(`Reset complete: ${data.deleted.scores} scores, ${data.deleted.memories} memories deleted`);
        fetchCallers(); // Refresh data
      } else {
        setError(data.error || "Failed to reset");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(null);
      setResetConfirm(null);
    }
  };

  const handleDownload = (caller: Caller) => {
    const label = encodeURIComponent(snapshotLabel.trim().replace(/\s+/g, "-") || "");
    const url = `/api/callers/${caller.id}/snapshot${label ? `?label=${label}` : ""}`;
    window.open(url, "_blank");
    setSnapshotModal(null);
    setSnapshotLabel("");
  };

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
      <SourcePageHeader
        title="Callers"
        description="All callers with their calls, memories, and personality profiles"
        dataNodeId="data:users"
        count={callers.length}
      />

      {/* Success Message */}
      {successMessage && (
        <div style={{
          padding: "12px 16px",
          background: "#f0fdf4",
          color: "#166534",
          borderRadius: 8,
          marginBottom: 20,
          border: "1px solid #bbf7d0",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}>
          <span>✓</span> {successMessage}
        </div>
      )}

      {/* Search */}
      <div style={{ marginBottom: 20 }}>
        <input
          type="text"
          placeholder="Search by name, email, phone, or ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            fontSize: 14,
            width: 300,
          }}
        />
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: 20, background: "#fef2f2", color: "#dc2626", borderRadius: 8, marginBottom: 20 }}>
          {error}
          <button
            onClick={() => setError(null)}
            style={{ marginLeft: 16, textDecoration: "underline", cursor: "pointer", background: "none", border: "none", color: "inherit" }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Loading...</div>
      ) : filteredCallers.length === 0 ? (
        <div
          style={{
            padding: 40,
            textAlign: "center",
            background: "#f9fafb",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>👥</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#374151" }}>
            {search ? "No callers match your search" : "No callers yet"}
          </div>
          <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
            {search ? "Try a different search term" : "Callers are created when processing transcripts"}
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 16 }}>
          {filteredCallers.map((caller) => (
            <div
              key={caller.id}
              style={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: 20,
                transition: "all 0.15s ease",
              }}
            >
              {/* Caller Header */}
              <Link href={`/callers/${caller.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, cursor: "pointer" }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: "#1f2937" }}>
                      {getCallerLabel(caller)}
                    </div>
                    {caller.email && caller.name && (
                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{caller.email}</div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    {caller.domain && (
                      <span
                        style={{
                          fontSize: 10,
                          padding: "3px 8px",
                          background: "#dbeafe",
                          color: "#2563eb",
                          borderRadius: 4,
                          fontWeight: 500,
                        }}
                      >
                        {caller.domain.name}
                      </span>
                    )}
                    {getPersonalityBadge(caller) && (
                      <span
                        style={{
                          fontSize: 10,
                          padding: "3px 8px",
                          background: "#f3e8ff",
                          color: "#7c3aed",
                          borderRadius: 4,
                          fontWeight: 500,
                        }}
                      >
                        {getPersonalityBadge(caller)}
                      </span>
                    )}
                  </div>
                </div>
              </Link>

              {/* Stats Row */}
              <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 14 }}>📞</span>
                  <span style={{ fontSize: 13, color: "#6b7280" }}>
                    {caller._count?.calls || 0} calls
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 14 }}>💭</span>
                  <span style={{ fontSize: 13, color: "#6b7280" }}>
                    {caller._count?.memories || 0} memories
                  </span>
                </div>
                {caller.nextPrompt && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 14 }}>✨</span>
                    <span style={{ fontSize: 13, color: "#10b981" }}>Prompt ready</span>
                  </div>
                )}
              </div>

              {/* Personality Mini-Chart */}
              {caller.personality && caller.personality.confidenceScore !== null && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", gap: 4 }}>
                    {[
                      { label: "O", value: caller.personality.openness, color: "#3b82f6" },
                      { label: "C", value: caller.personality.conscientiousness, color: "#10b981" },
                      { label: "E", value: caller.personality.extraversion, color: "#f59e0b" },
                      { label: "A", value: caller.personality.agreeableness, color: "#ec4899" },
                      { label: "N", value: caller.personality.neuroticism, color: "#8b5cf6" },
                    ].map((trait) => (
                      <div key={trait.label} style={{ flex: 1 }}>
                        <div
                          style={{
                            height: 4,
                            background: "#e5e7eb",
                            borderRadius: 2,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${(trait.value || 0) * 100}%`,
                              background: trait.color,
                              borderRadius: 2,
                            }}
                          />
                        </div>
                        <div style={{ fontSize: 9, color: "#9ca3af", textAlign: "center", marginTop: 2 }}>
                          {trait.label}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{
                display: "flex",
                gap: 8,
                marginTop: 12,
                paddingTop: 12,
                borderTop: "1px solid #f3f4f6"
              }}>
                <button
                  onClick={() => setSnapshotModal(caller)}
                  disabled={actionLoading === caller.id}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    fontSize: 12,
                    fontWeight: 500,
                    background: "#f0fdf4",
                    color: "#166534",
                    border: "1px solid #bbf7d0",
                    borderRadius: 6,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  <span>📥</span> Download
                </button>

                {resetConfirm === caller.id ? (
                  <div style={{ display: "flex", gap: 4, flex: 1 }}>
                    <button
                      onClick={() => handleReset(caller.id)}
                      disabled={actionLoading === caller.id}
                      style={{
                        flex: 1,
                        padding: "8px 8px",
                        fontSize: 11,
                        fontWeight: 600,
                        background: "#dc2626",
                        color: "#fff",
                        border: "none",
                        borderRadius: 6,
                        cursor: actionLoading === caller.id ? "wait" : "pointer",
                      }}
                    >
                      {actionLoading === caller.id ? "..." : "Confirm"}
                    </button>
                    <button
                      onClick={() => setResetConfirm(null)}
                      disabled={actionLoading === caller.id}
                      style={{
                        padding: "8px 8px",
                        fontSize: 11,
                        background: "#f3f4f6",
                        color: "#6b7280",
                        border: "none",
                        borderRadius: 6,
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setResetConfirm(caller.id)}
                    disabled={!hasAnalysisData(caller) || actionLoading === caller.id}
                    title={hasAnalysisData(caller) ? "Reset all analysis (keep calls)" : "No analysis data to reset"}
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      fontSize: 12,
                      fontWeight: 500,
                      background: hasAnalysisData(caller) ? "#fef2f2" : "#f9fafb",
                      color: hasAnalysisData(caller) ? "#dc2626" : "#9ca3af",
                      border: `1px solid ${hasAnalysisData(caller) ? "#fecaca" : "#e5e7eb"}`,
                      borderRadius: 6,
                      cursor: hasAnalysisData(caller) ? "pointer" : "not-allowed",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    <span>🔄</span> Reset
                  </button>
                )}
              </div>

              {/* Footer */}
              <div style={{ marginTop: 8, fontSize: 11, color: "#9ca3af" }}>
                Added {new Date(caller.createdAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Snapshot Modal */}
      {snapshotModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setSnapshotModal(null)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 24,
              width: 400,
              maxWidth: "90vw",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 8px 0", fontSize: 18, fontWeight: 600 }}>
              Download Snapshot
            </h3>
            <p style={{ margin: "0 0 16px 0", fontSize: 14, color: "#6b7280" }}>
              Download analysis data for <strong>{getCallerLabel(snapshotModal)}</strong>
            </p>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
                Label (optional)
              </label>
              <input
                type="text"
                placeholder="e.g., playbook-v1, baseline, test-run-3"
                value={snapshotLabel}
                onChange={(e) => setSnapshotLabel(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 6,
                  border: "1px solid #e5e7eb",
                  fontSize: 14,
                }}
              />
              <p style={{ margin: "6px 0 0 0", fontSize: 12, color: "#9ca3af" }}>
                Label helps identify this snapshot when comparing multiple runs
              </p>
            </div>

            <div style={{
              background: "#f8fafc",
              padding: 12,
              borderRadius: 8,
              marginBottom: 16,
              fontSize: 13,
              color: "#475569",
            }}>
              <strong>Comparison Workflow:</strong>
              <ol style={{ margin: "8px 0 0 0", paddingLeft: 20, lineHeight: 1.6 }}>
                <li>Download snapshot (label: "baseline")</li>
                <li>Reset caller analysis</li>
                <li>Change playbook/settings</li>
                <li>Re-run analysis</li>
                <li>Download snapshot (label: "variant-a")</li>
                <li>Use <code style={{ background: "#e2e8f0", padding: "2px 4px", borderRadius: 3 }}>diff</code> or JSON comparison tool</li>
              </ol>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => {
                  setSnapshotModal(null);
                  setSnapshotLabel("");
                }}
                style={{
                  padding: "10px 16px",
                  fontSize: 14,
                  background: "#f3f4f6",
                  color: "#374151",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDownload(snapshotModal)}
                style={{
                  padding: "10px 16px",
                  fontSize: 14,
                  fontWeight: 500,
                  background: "#4f46e5",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                Download JSON
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
