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

interface CallersPageProps {
  routePrefix?: string;
}

export function CallersPage({ routePrefix = "" }: CallersPageProps) {
  const [callers, setCallers] = useState<Caller[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [resetConfirm, setResetConfirm] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [snapshotModal, setSnapshotModal] = useState<Caller | null>(null);
  const [snapshotLabel, setSnapshotLabel] = useState("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Merge callers state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedCallers, setSelectedCallers] = useState<Set<string>>(new Set());
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeTarget, setMergeTarget] = useState<string | null>(null);
  const [merging, setMerging] = useState(false);

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

  const toggleCallerSelection = (callerId: string) => {
    setSelectedCallers((prev) => {
      const next = new Set(prev);
      if (next.has(callerId)) {
        next.delete(callerId);
      } else {
        next.add(callerId);
      }
      return next;
    });
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedCallers(new Set());
    setShowMergeModal(false);
    setMergeTarget(null);
  };

  const getSelectedCallersList = () => {
    return callers.filter((c) => selectedCallers.has(c.id));
  };

  const handleMerge = async () => {
    if (!mergeTarget || selectedCallers.size < 2) return;

    const sourceIds = Array.from(selectedCallers).filter((id) => id !== mergeTarget);

    setMerging(true);
    try {
      const res = await fetch("/api/callers/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetCallerId: mergeTarget,
          sourceCallerIds: sourceIds,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setSuccessMessage(
          `Merged ${sourceIds.length} caller(s) into ${data.targetCaller?.name || data.targetCaller?.email || "target"}. ` +
          `Moved ${data.merged?.calls || 0} calls, ${data.merged?.memories || 0} memories.`
        );
        exitSelectionMode();
        fetchCallers();
      } else {
        setError(data.error || "Failed to merge callers");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to merge callers");
    } finally {
      setMerging(false);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
      <SourcePageHeader
        title="Callers"
        description="All callers with their calls, memories, and personality profiles"
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

      {/* Search and Actions */}
      <div style={{ marginBottom: 20, display: "flex", gap: 12, alignItems: "center" }}>
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
        <button
          onClick={() => {
            if (selectionMode) {
              exitSelectionMode();
            } else {
              setSelectionMode(true);
            }
          }}
          style={{
            padding: "10px 16px",
            fontSize: 14,
            fontWeight: 500,
            background: selectionMode ? "#4f46e5" : "#f3f4f6",
            color: selectionMode ? "#fff" : "#374151",
            border: selectionMode ? "none" : "1px solid #e5e7eb",
            borderRadius: 8,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {selectionMode ? "Cancel Selection" : "Select to Merge"}
        </button>
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
              onClick={selectionMode ? () => toggleCallerSelection(caller.id) : undefined}
              style={{
                background: "#fff",
                border: selectedCallers.has(caller.id)
                  ? "2px solid #4f46e5"
                  : "1px solid #e5e7eb",
                borderRadius: 12,
                padding: selectedCallers.has(caller.id) ? 19 : 20,
                transition: "all 0.15s ease",
                cursor: selectionMode ? "pointer" : "default",
                position: "relative",
              }}
            >
              {/* Selection checkbox */}
              {selectionMode && (
                <div
                  style={{
                    position: "absolute",
                    top: 12,
                    left: 12,
                    width: 20,
                    height: 20,
                    borderRadius: 4,
                    border: selectedCallers.has(caller.id)
                      ? "none"
                      : "2px solid #d1d5db",
                    background: selectedCallers.has(caller.id) ? "#4f46e5" : "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  {selectedCallers.has(caller.id) && "✓"}
                </div>
              )}

              {/* Caller Header */}
              <Link
                href={selectionMode ? "#" : `${routePrefix}/callers/${caller.id}`}
                onClick={(e) => selectionMode && e.preventDefault()}
                style={{ textDecoration: "none", color: "inherit" }}
              >
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
                <li>Download snapshot (label: &quot;baseline&quot;)</li>
                <li>Reset caller analysis</li>
                <li>Change playbook/settings</li>
                <li>Re-run analysis</li>
                <li>Download snapshot (label: &quot;variant-a&quot;)</li>
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

      {/* Floating Action Bar - when 2+ callers selected */}
      {selectionMode && selectedCallers.size >= 2 && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#1f2937",
            color: "#fff",
            padding: "12px 24px",
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            gap: 16,
            boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
            zIndex: 1000,
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 500 }}>
            {selectedCallers.size} callers selected
          </span>
          <button
            onClick={() => {
              setMergeTarget(null);
              setShowMergeModal(true);
            }}
            disabled={selectedCallers.size < 2}
            style={{
              padding: "8px 16px",
              fontSize: 14,
              fontWeight: 600,
              background: selectedCallers.size < 2 ? "#9ca3af" : "#4f46e5",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: selectedCallers.size < 2 ? "not-allowed" : "pointer",
              opacity: selectedCallers.size < 2 ? 0.6 : 1,
            }}
          >
            Merge Selected {selectedCallers.size >= 2 ? `(${selectedCallers.size})` : ""}
          </button>
          <button
            onClick={exitSelectionMode}
            style={{
              padding: "8px 16px",
              fontSize: 14,
              background: "transparent",
              color: "#9ca3af",
              border: "1px solid #4b5563",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Merge Modal */}
      {showMergeModal && (
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
            zIndex: 1001,
          }}
          onClick={() => !merging && setShowMergeModal(false)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 24,
              width: 500,
              maxWidth: "90vw",
              maxHeight: "80vh",
              overflow: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 8px 0", fontSize: 18, fontWeight: 600 }}>
              Merge {selectedCallers.size} Callers
            </h3>
            <p style={{ margin: "0 0 20px 0", fontSize: 14, color: "#6b7280" }}>
              Select which caller will receive all merged data. The other{" "}
              {selectedCallers.size - 1} caller{selectedCallers.size > 2 ? "s" : ""} will be deleted.
            </p>

            {!mergeTarget && (
              <div style={{
                padding: "12px 16px",
                background: "#fef3c7",
                border: "1px solid #fbbf24",
                borderRadius: 8,
                marginBottom: 16,
                fontSize: 14,
                color: "#92400e",
              }}>
                ⚠️ Please select a target caller below
              </div>
            )}

            {/* Target selection */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 10, color: "#374151" }}>
                Merge into:
              </label>
              {getSelectedCallersList().map((caller) => (
                <label
                  key={caller.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: 12,
                    marginBottom: 8,
                    background: mergeTarget === caller.id ? "#eef2ff" : "#f9fafb",
                    border: mergeTarget === caller.id ? "2px solid #4f46e5" : "1px solid #e5e7eb",
                    borderRadius: 8,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="mergeTarget"
                    value={caller.id}
                    checked={mergeTarget === caller.id}
                    onChange={() => setMergeTarget(caller.id)}
                    style={{ marginTop: 2 }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "#1f2937" }}>
                      {getCallerLabel(caller)}
                    </div>
                    {caller.email && caller.name && (
                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                        {caller.email}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4, display: "flex", gap: 12 }}>
                      <span>{caller._count?.calls || 0} calls</span>
                      <span>{caller._count?.memories || 0} memories</span>
                    </div>
                  </div>
                </label>
              ))}
            </div>

            {/* Warning */}
            <div
              style={{
                background: "#fef3c7",
                border: "1px solid #fcd34d",
                borderRadius: 8,
                padding: 12,
                marginBottom: 20,
                fontSize: 13,
                color: "#92400e",
              }}
            >
              <strong>Warning:</strong> This action cannot be undone. The{" "}
              {selectedCallers.size - 1} non-target caller(s) will be permanently
              deleted after their data is moved.
            </div>

            {/* Summary */}
            {mergeTarget && (
              <div
                style={{
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 20,
                  fontSize: 13,
                  color: "#166534",
                }}
              >
                <strong>Data to be merged:</strong>
                <ul style={{ margin: "8px 0 0 0", paddingLeft: 20 }}>
                  <li>
                    {getSelectedCallersList()
                      .filter((c) => c.id !== mergeTarget)
                      .reduce((sum, c) => sum + (c._count?.calls || 0), 0)}{" "}
                    calls
                  </li>
                  <li>
                    {getSelectedCallersList()
                      .filter((c) => c.id !== mergeTarget)
                      .reduce((sum, c) => sum + (c._count?.memories || 0), 0)}{" "}
                    memories
                  </li>
                  <li>
                    {getSelectedCallersList()
                      .filter((c) => c.id !== mergeTarget)
                      .reduce((sum, c) => sum + (c._count?.personalityObservations || 0), 0)}{" "}
                    personality observations
                  </li>
                </ul>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowMergeModal(false)}
                disabled={merging}
                style={{
                  padding: "10px 16px",
                  fontSize: 14,
                  background: "#f3f4f6",
                  color: "#374151",
                  border: "none",
                  borderRadius: 6,
                  cursor: merging ? "not-allowed" : "pointer",
                  opacity: merging ? 0.5 : 1,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleMerge}
                disabled={!mergeTarget || merging}
                title={!mergeTarget ? "Please select a target caller first" : ""}
                style={{
                  padding: "10px 16px",
                  fontSize: 14,
                  fontWeight: 500,
                  background: !mergeTarget || merging ? "#d1d5db" : "#4f46e5",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  cursor: !mergeTarget || merging ? "not-allowed" : "pointer",
                }}
              >
                {merging ? "Merging..." : "Merge Callers"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
