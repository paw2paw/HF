"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type AnalysisProfile = {
  id: string;
  name: string;
  isLocked: boolean;
  usageCount: number;
};

type CompiledSet = {
  id: string;
  name: string;
  description?: string | null;
  version: string;
  status: "DRAFT" | "COMPILING" | "READY" | "ERROR" | "SUPERSEDED";
  compiledAt?: string | null;
  validationPassed: boolean;
  measureSpecCount: number;
  learnSpecCount: number;
  parameterCount: number;
  anchorCount: number;
  runCount: number;
  analysisProfile: AnalysisProfile;
  createdAt: string;
};

type SpecSummary = {
  id: string;
  slug: string;
  name: string;
  domain: string | null;
  triggerCount: number;
};

type ParameterSummary = {
  parameterId: string;
  name: string;
  isEnriched: boolean;
  anchorCount: number;
  specCount: number;
};

type CompiledSetDetail = CompiledSet & {
  specs: {
    measure: SpecSummary[];
    learn: SpecSummary[];
  };
  parameters: ParameterSummary[];
  summary: {
    measureSpecCount: number;
    learnSpecCount: number;
    parameterCount: number;
    enrichedParameterCount: number;
    totalAnchors: number;
  };
};

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  DRAFT: { bg: "#fef3c7", text: "#92400e", border: "#fcd34d" },
  COMPILING: { bg: "#dbeafe", text: "#1e40af", border: "#93c5fd" },
  READY: { bg: "#d1fae5", text: "#065f46", border: "#6ee7b7" },
  ERROR: { bg: "#fee2e2", text: "#991b1b", border: "#fca5a5" },
  SUPERSEDED: { bg: "#e5e7eb", text: "#4b5563", border: "#9ca3af" },
};

export default function CompiledSetsPage() {
  const [sets, setSets] = useState<CompiledSet[]>([]);
  const [profiles, setProfiles] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedSet, setSelectedSet] = useState<CompiledSetDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [compiling, setCompiling] = useState<string | null>(null);
  const [compilationResult, setCompilationResult] = useState<any>(null);

  // New set form state
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newProfileId, setNewProfileId] = useState("");

  const fetchSets = useCallback(async () => {
    try {
      const res = await fetch("/api/compiled-sets");
      const data = await res.json();
      if (data.ok) {
        setSets(data.sets || []);
      } else {
        setError(data.error || "Failed to load compiled sets");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProfiles = useCallback(async () => {
    try {
      const res = await fetch("/api/analysis-profiles");
      const data = await res.json();
      if (data.ok) {
        setProfiles(data.profiles || []);
      }
    } catch (err) {
      // Ignore
    }
  }, []);

  useEffect(() => {
    fetchSets();
    fetchProfiles();
  }, [fetchSets, fetchProfiles]);

  const handleCreate = async () => {
    if (!newName.trim() || !newProfileId) {
      setError("Name and profile are required");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/compiled-sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDescription.trim() || undefined,
          analysisProfileId: newProfileId,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setShowCreateForm(false);
        setNewName("");
        setNewDescription("");
        setNewProfileId("");
        await fetchSets();
        // Auto-select the new set
        handleSelectSet(data.compiledSet.id);
      } else {
        setError(data.error || "Failed to create");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleSelectSet = async (id: string) => {
    setLoadingDetail(true);
    setCompilationResult(null);
    try {
      const res = await fetch(`/api/compiled-sets/${id}`);
      const data = await res.json();
      if (data.ok) {
        setSelectedSet({ ...data.compiledSet, specs: data.specs, parameters: data.parameters, summary: data.summary });
      } else {
        setError(data.error || "Failed to load details");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCompile = async (id: string, force = false) => {
    setCompiling(id);
    setCompilationResult(null);
    try {
      const res = await fetch(`/api/compiled-sets/${id}/compile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const data = await res.json();
      setCompilationResult(data);
      if (data.ok) {
        await fetchSets();
        handleSelectSet(id);
      }
    } catch (err: any) {
      setCompilationResult({ ok: false, error: err.message });
    } finally {
      setCompiling(null);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/compiled-sets/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        setSets((prev) => prev.filter((s) => s.id !== id));
        if (selectedSet?.id === id) {
          setSelectedSet(null);
        }
      } else {
        setError(data.error || "Failed to delete");
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Compiled Analysis Sets</h1>
          <p style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
            Validated, production-ready analysis configurations with enriched parameters
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          style={{
            padding: "10px 20px",
            background: "#3b82f6",
            border: "none",
            borderRadius: 8,
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          + New Compiled Set
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{ padding: 16, background: "#fef2f2", color: "#dc2626", borderRadius: 8, marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontWeight: 600 }}>×</button>
        </div>
      )}

      {/* Create form modal */}
      {showCreateForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div style={{ background: "#fff", padding: 24, borderRadius: 12, width: 480, maxWidth: "90vw" }}>
            <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>Create Compiled Set</h2>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4, color: "#374151" }}>Name *</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g., Full Analysis v1.0"
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14 }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4, color: "#374151" }}>Analysis Profile *</label>
              <select
                value={newProfileId}
                onChange={(e) => setNewProfileId(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14 }}
              >
                <option value="">Select a profile...</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4, color: "#374151" }}>Description</label>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Optional description..."
                rows={2}
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, resize: "vertical" }}
              />
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                onClick={() => { setShowCreateForm(false); setNewName(""); setNewDescription(""); setNewProfileId(""); }}
                style={{ padding: "8px 16px", background: "#fff", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                style={{ padding: "8px 16px", background: "#3b82f6", border: "none", borderRadius: 6, color: "#fff", fontSize: 14, fontWeight: 600, cursor: creating ? "not-allowed" : "pointer", opacity: creating ? 0.7 : 1 }}
              >
                {creating ? "Creating..." : "Create Draft"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content: list + detail */}
      <div style={{ display: "grid", gridTemplateColumns: "400px 1fr", gap: 24 }}>
        {/* Left: List */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Compiled Sets ({sets.length})</span>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Loading...</div>
          ) : sets.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📦</div>
              <div>No compiled sets yet</div>
            </div>
          ) : (
            <div style={{ maxHeight: 600, overflowY: "auto" }}>
              {sets.map((set) => {
                const colors = STATUS_COLORS[set.status] || STATUS_COLORS.DRAFT;
                const isSelected = selectedSet?.id === set.id;
                return (
                  <div
                    key={set.id}
                    onClick={() => handleSelectSet(set.id)}
                    style={{
                      padding: "12px 16px",
                      borderBottom: "1px solid #f3f4f6",
                      cursor: "pointer",
                      background: isSelected ? "#eff6ff" : "#fff",
                      borderLeft: isSelected ? "3px solid #3b82f6" : "3px solid transparent",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, flex: 1 }}>{set.name}</span>
                      <span style={{
                        padding: "2px 8px",
                        fontSize: 11,
                        fontWeight: 600,
                        borderRadius: 4,
                        background: colors.bg,
                        color: colors.text,
                        border: `1px solid ${colors.border}`,
                      }}>
                        {set.status}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>
                      Profile: {set.analysisProfile.name}
                    </div>
                    <div style={{ fontSize: 11, color: "#9ca3af", display: "flex", gap: 12 }}>
                      <span>{set.measureSpecCount} MEASURE</span>
                      <span>{set.learnSpecCount} LEARN</span>
                      <span>{set.parameterCount} params</span>
                      {set.runCount > 0 && <span style={{ color: "#059669" }}>{set.runCount} runs</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Detail */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
          {loadingDetail ? (
            <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Loading details...</div>
          ) : !selectedSet ? (
            <div style={{ padding: 60, textAlign: "center", color: "#6b7280" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>👈</div>
              <div style={{ fontSize: 16 }}>Select a compiled set to view details</div>
            </div>
          ) : (
            <div>
              {/* Detail header */}
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>{selectedSet.name}</h2>
                    {selectedSet.description && (
                      <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>{selectedSet.description}</p>
                    )}
                    <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
                      Profile: <Link href={`/analysis-profiles/${selectedSet.analysisProfile.id}/configure`} style={{ color: "#3b82f6" }}>{selectedSet.analysisProfile.name}</Link>
                      {selectedSet.analysisProfile.isLocked && (
                        <span style={{ marginLeft: 8, color: "#f59e0b" }}>🔒 Locked</span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {selectedSet.status === "DRAFT" && (
                      <>
                        <button
                          onClick={() => handleCompile(selectedSet.id)}
                          disabled={compiling === selectedSet.id}
                          style={{
                            padding: "8px 16px",
                            background: "#059669",
                            border: "none",
                            borderRadius: 6,
                            color: "#fff",
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: compiling ? "not-allowed" : "pointer",
                            opacity: compiling ? 0.7 : 1,
                          }}
                        >
                          {compiling === selectedSet.id ? "Compiling..." : "Compile"}
                        </button>
                        <button
                          onClick={() => handleDelete(selectedSet.id, selectedSet.name)}
                          style={{
                            padding: "8px 16px",
                            background: "#fff",
                            border: "1px solid #fecaca",
                            borderRadius: 6,
                            color: "#dc2626",
                            fontSize: 13,
                            fontWeight: 500,
                            cursor: "pointer",
                          }}
                        >
                          Delete
                        </button>
                      </>
                    )}
                    {selectedSet.status === "ERROR" && (
                      <button
                        onClick={() => handleCompile(selectedSet.id, true)}
                        disabled={compiling === selectedSet.id}
                        style={{
                          padding: "8px 16px",
                          background: "#f59e0b",
                          border: "none",
                          borderRadius: 6,
                          color: "#fff",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: compiling ? "not-allowed" : "pointer",
                        }}
                      >
                        {compiling === selectedSet.id ? "Compiling..." : "Force Compile"}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Compilation result */}
              {compilationResult && (
                <div style={{
                  padding: 16,
                  margin: 16,
                  borderRadius: 8,
                  background: compilationResult.ok ? "#d1fae5" : "#fef2f2",
                  border: `1px solid ${compilationResult.ok ? "#6ee7b7" : "#fca5a5"}`,
                }}>
                  <div style={{ fontWeight: 600, marginBottom: 8, color: compilationResult.ok ? "#065f46" : "#991b1b" }}>
                    {compilationResult.ok ? "Compilation Successful" : "Compilation Failed"}
                  </div>
                  {compilationResult.message && (
                    <div style={{ fontSize: 13, marginBottom: 8 }}>{compilationResult.message}</div>
                  )}
                  {compilationResult.errors?.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: "#991b1b" }}>Errors:</div>
                      {compilationResult.errors.map((e: any, i: number) => (
                        <div key={i} style={{ fontSize: 12, padding: "4px 8px", background: "#fff", borderRadius: 4, marginBottom: 4 }}>
                          <strong>{e.name}</strong>: {e.error}
                        </div>
                      ))}
                    </div>
                  )}
                  {compilationResult.warnings?.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: "#92400e" }}>Warnings:</div>
                      {compilationResult.warnings.map((w: any, i: number) => (
                        <div key={i} style={{ fontSize: 12, padding: "4px 8px", background: "#fef3c7", borderRadius: 4, marginBottom: 4 }}>
                          <strong>{w.name}</strong>: {w.error}
                        </div>
                      ))}
                    </div>
                  )}
                  {compilationResult.summary && (
                    <div style={{ marginTop: 8, fontSize: 12, color: "#065f46" }}>
                      {compilationResult.summary.measureSpecs} MEASURE specs, {compilationResult.summary.learnSpecs} LEARN specs, {compilationResult.summary.parameters} parameters ({compilationResult.summary.enrichedParameters} enriched), {compilationResult.summary.totalAnchors} anchors
                    </div>
                  )}
                </div>
              )}

              {/* Stats grid */}
              <div style={{ padding: 16, display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
                {[
                  { label: "MEASURE Specs", value: selectedSet.summary.measureSpecCount, color: "#8b5cf6" },
                  { label: "LEARN Specs", value: selectedSet.summary.learnSpecCount, color: "#06b6d4" },
                  { label: "Parameters", value: selectedSet.summary.parameterCount, color: "#3b82f6" },
                  { label: "Enriched", value: selectedSet.summary.enrichedParameterCount, color: "#10b981" },
                  { label: "Anchors", value: selectedSet.summary.totalAnchors, color: "#f59e0b" },
                ].map((stat) => (
                  <div key={stat.label} style={{ padding: 12, background: "#f9fafb", borderRadius: 8, textAlign: "center" }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Tabs: Specs | Parameters */}
              <div style={{ borderTop: "1px solid #e5e7eb" }}>
                <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb" }}>
                  <TabButton active label="MEASURE Specs" count={selectedSet.specs.measure.length} color="#8b5cf6" />
                  <TabButton label="LEARN Specs" count={selectedSet.specs.learn.length} color="#06b6d4" />
                  <TabButton label="Parameters" count={selectedSet.parameters.length} color="#3b82f6" />
                </div>

                {/* MEASURE specs */}
                <div style={{ padding: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#8b5cf6", marginBottom: 12, textTransform: "uppercase" }}>
                    MEASURE Specs ({selectedSet.specs.measure.length})
                  </div>
                  {selectedSet.specs.measure.length === 0 ? (
                    <div style={{ fontSize: 13, color: "#6b7280", fontStyle: "italic" }}>No MEASURE specs</div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                      {selectedSet.specs.measure.map((spec) => (
                        <div key={spec.id} style={{ padding: 10, background: "#faf5ff", borderRadius: 6, border: "1px solid #e9d5ff" }}>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{spec.name}</div>
                          <div style={{ fontSize: 11, color: "#6b7280" }}>
                            {spec.domain && <span>{spec.domain} · </span>}
                            {spec.triggerCount} triggers
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ fontSize: 12, fontWeight: 600, color: "#06b6d4", marginBottom: 12, marginTop: 24, textTransform: "uppercase" }}>
                    LEARN Specs ({selectedSet.specs.learn.length})
                  </div>
                  {selectedSet.specs.learn.length === 0 ? (
                    <div style={{ fontSize: 13, color: "#6b7280", fontStyle: "italic" }}>No LEARN specs</div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                      {selectedSet.specs.learn.map((spec) => (
                        <div key={spec.id} style={{ padding: 10, background: "#ecfeff", borderRadius: 6, border: "1px solid #a5f3fc" }}>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{spec.name}</div>
                          <div style={{ fontSize: 11, color: "#6b7280" }}>
                            {spec.domain && <span>{spec.domain} · </span>}
                            {spec.triggerCount} triggers
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ fontSize: 12, fontWeight: 600, color: "#3b82f6", marginBottom: 12, marginTop: 24, textTransform: "uppercase" }}>
                    Parameters ({selectedSet.parameters.length})
                  </div>
                  {selectedSet.parameters.length === 0 ? (
                    <div style={{ fontSize: 13, color: "#6b7280", fontStyle: "italic" }}>No parameters attached to MEASURE specs</div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                      {selectedSet.parameters.map((param) => (
                        <div key={param.parameterId} style={{ padding: 10, background: "#eff6ff", borderRadius: 6, border: "1px solid #bfdbfe" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 500 }}>{param.name}</span>
                            {param.isEnriched && (
                              <span style={{ fontSize: 10, padding: "1px 4px", background: "#d1fae5", color: "#065f46", borderRadius: 3 }}>enriched</span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                            {param.anchorCount} anchors · used in {param.specCount} spec{param.specCount !== 1 ? "s" : ""}
                          </div>
                          {param.anchorCount < 3 && (
                            <div style={{ fontSize: 10, color: "#f59e0b", marginTop: 4 }}>
                              ⚠ Needs more anchors (min 3 recommended)
                            </div>
                          )}
                          {!param.isEnriched && (
                            <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>
                              Consider enriching for better RAG context
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Info box */}
      <div style={{ marginTop: 24, padding: 16, background: "#eff6ff", borderRadius: 8, border: "1px solid #bfdbfe" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#1e40af", marginBottom: 4 }}>
          About Compiled Analysis Sets
        </div>
        <div style={{ fontSize: 12, color: "#1e40af", lineHeight: 1.5 }}>
          Compiled sets are validated, production-ready configurations. Compilation validates that all MEASURE specs have parameters with scoring anchors,
          and optionally enriches parameter definitions with KB context. Once a compiled set is used in analysis runs,
          its source Analysis Profile is locked to preserve reproducibility.
        </div>
      </div>
    </div>
  );
}

function TabButton({ label, count, color, active }: { label: string; count: number; color: string; active?: boolean }) {
  return (
    <button
      style={{
        padding: "12px 16px",
        background: active ? "#fff" : "transparent",
        border: "none",
        borderBottom: active ? `2px solid ${color}` : "2px solid transparent",
        fontSize: 13,
        fontWeight: active ? 600 : 400,
        color: active ? color : "#6b7280",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      {label}
      <span style={{
        padding: "2px 6px",
        background: active ? color : "#e5e7eb",
        color: active ? "#fff" : "#6b7280",
        borderRadius: 10,
        fontSize: 11,
        fontWeight: 600,
      }}>
        {count}
      </span>
    </button>
  );
}
