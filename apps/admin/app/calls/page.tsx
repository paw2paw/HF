"use client";

import { useState, useEffect, useCallback } from "react";
import { SourcePageHeader } from "@/components/shared/SourcePageHeader";

type Call = {
  id: string;
  source: string;
  externalId: string | null;
  transcript: string;
  createdAt: string;
  userId: string | null;
  controlSetId: string | null;
  user?: { name: string | null; email: string | null; id: string } | null;
  controlSet?: { name: string } | null;
  _count?: {
    scores: number;
  };
};

type RunConfig = {
  id: string;
  name: string;
  description: string | null;
  version: string;
  status: "DRAFT" | "COMPILING" | "READY" | "ERROR" | "SUPERSEDED";
  measureSpecCount: number;
  learnSpecCount: number;
  parameterCount: number;
};

type AnalysisResult = {
  ok: boolean;
  callId: string;
  userId: string | null;
  model: string;
  analysisTime: number;
  measures: Record<string, number>;
  learned: Array<{ category: string; key: string; value: string; evidence: string }>;
  stored: { callScoresCreated: number; userMemoriesCreated: number } | null;
  summary: {
    specsAnalyzed: number;
    measureSpecs: number;
    learnSpecs: number;
    parametersScored: number;
    factsLearned: number;
  };
};

export default function CallsPage() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Analysis modal state
  const [showAnalyseModal, setShowAnalyseModal] = useState(false);
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [runConfigs, setRunConfigs] = useState<RunConfig[]>([]);
  const [loadingConfigs, setLoadingConfigs] = useState(false);
  const [selectedConfigId, setSelectedConfigId] = useState<string>("");
  const [analysing, setAnalysing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [storeResults, setStoreResults] = useState(true);

  // Fetch calls
  const fetchCalls = useCallback(() => {
    fetch("/api/calls")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setCalls(data.calls || []);
        } else {
          setError(data.error || "Failed to load calls");
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchCalls();
  }, [fetchCalls]);

  // Fetch run configs when modal opens
  const fetchRunConfigs = useCallback(async () => {
    setLoadingConfigs(true);
    try {
      const res = await fetch("/api/compiled-sets?status=READY");
      const data = await res.json();
      if (data.ok) {
        setRunConfigs(data.sets || []);
        // Auto-select first config
        if (data.sets?.length > 0) {
          setSelectedConfigId(data.sets[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load run configs:", err);
    } finally {
      setLoadingConfigs(false);
    }
  }, []);

  // Open analyse modal
  const handleAnalyseClick = (call: Call) => {
    setSelectedCall(call);
    setShowAnalyseModal(true);
    setAnalysisResult(null);
    fetchRunConfigs();
  };

  // Run analysis
  const handleRunAnalysis = async () => {
    if (!selectedCall || !selectedConfigId) return;

    setAnalysing(true);
    setError(null);

    try {
      // First get the spec IDs from the compiled set
      const configRes = await fetch(`/api/compiled-sets/${selectedConfigId}`);
      const configData = await configRes.json();

      if (!configData.ok) {
        throw new Error(configData.error || "Failed to load config details");
      }

      // Get spec slugs from the compiled set
      const specSlugs: string[] = [
        ...(configData.specs?.measure || []).map((s: any) => s.slug),
        ...(configData.specs?.learn || []).map((s: any) => s.slug),
      ];

      // Run analysis
      const res = await fetch("/api/analysis/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: selectedCall.transcript,
          callId: selectedCall.id,
          userId: selectedCall.user?.id || selectedCall.userId,
          specs: specSlugs.length > 0 ? specSlugs : undefined,
          storeResults,
        }),
      });

      const result = await res.json();

      if (!result.ok) {
        throw new Error(result.error || "Analysis failed");
      }

      setAnalysisResult(result);

      // Refresh calls to update scores count
      if (storeResults) {
        fetchCalls();
      }
    } catch (err: any) {
      setError(err.message || "Analysis failed");
    } finally {
      setAnalysing(false);
    }
  };

  // Close modal
  const handleCloseModal = () => {
    setShowAnalyseModal(false);
    setSelectedCall(null);
    setAnalysisResult(null);
    setSelectedConfigId("");
  };

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
      <SourcePageHeader
        title="Calls"
        description="Call transcripts imported from various sources"
        dataNodeId="data:calls"
        count={calls.length}
      />

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Loading...</div>
      ) : error ? (
        <div style={{ padding: 20, background: "#fef2f2", color: "#dc2626", borderRadius: 8 }}>
          {error}
        </div>
      ) : calls.length === 0 ? (
        <div
          style={{
            padding: 40,
            textAlign: "center",
            background: "#f9fafb",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>📞</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#374151" }}>No calls yet</div>
          <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
            Import transcripts to create call records
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
                  Source
                </th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
                  User
                </th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
                  Control Set
                </th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
                  Transcript Preview
                </th>
                <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
                  Scores
                </th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
                  Created
                </th>
                <th style={{ padding: "12px 16px", textAlign: "right", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {calls.map((call) => (
                <tr key={call.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "12px 16px" }}>
                    <span
                      style={{
                        fontSize: 11,
                        padding: "2px 8px",
                        background: "#e0e7ff",
                        color: "#4338ca",
                        borderRadius: 4,
                        fontWeight: 500,
                      }}
                    >
                      {call.source}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 14 }}>
                    {call.user?.name || call.user?.email || <span style={{ color: "#9ca3af" }}>—</span>}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 14, color: "#6b7280" }}>
                    {call.controlSet?.name || <span style={{ color: "#9ca3af" }}>—</span>}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: "#6b7280", maxWidth: 300 }}>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {call.transcript.slice(0, 100)}...
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 14, textAlign: "center" }}>
                    {call._count?.scores || 0}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: "#6b7280" }}>
                    {new Date(call.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right" }}>
                    <button
                      onClick={() => handleAnalyseClick(call)}
                      style={{
                        padding: "6px 12px",
                        fontSize: 12,
                        fontWeight: 500,
                        background: "#4f46e5",
                        color: "white",
                        border: "none",
                        borderRadius: 6,
                        cursor: "pointer",
                      }}
                    >
                      Analyse
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Analyse Modal */}
      {showAnalyseModal && selectedCall && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
          onClick={handleCloseModal}
        >
          <div
            style={{
              background: "white",
              borderRadius: 12,
              width: "100%",
              maxWidth: 700,
              maxHeight: "90vh",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid #e5e7eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Analyse Call</h2>
                <p style={{ fontSize: 12, color: "#6b7280", margin: "4px 0 0" }}>
                  {selectedCall.user?.name || selectedCall.user?.email || "Unknown user"} • {selectedCall.source}
                </p>
              </div>
              <button
                onClick={handleCloseModal}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 20,
                  cursor: "pointer",
                  color: "#6b7280",
                }}
              >
                ×
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
              {!analysisResult ? (
                <>
                  {/* Run Config Selection */}
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: "block", fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
                      Run Config
                    </label>
                    {loadingConfigs ? (
                      <div style={{ padding: 12, color: "#6b7280" }}>Loading configs...</div>
                    ) : runConfigs.length === 0 ? (
                      <div
                        style={{
                          padding: 16,
                          background: "#fef3c7",
                          border: "1px solid #fbbf24",
                          borderRadius: 8,
                          fontSize: 14,
                        }}
                      >
                        <strong>No Run Configs available.</strong>
                        <br />
                        <span style={{ color: "#92400e" }}>
                          Create and compile a Run Config in the Run Configs page first.
                        </span>
                      </div>
                    ) : (
                      <select
                        value={selectedConfigId}
                        onChange={(e) => setSelectedConfigId(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          fontSize: 14,
                          border: "1px solid #d1d5db",
                          borderRadius: 8,
                        }}
                      >
                        {runConfigs.map((config) => (
                          <option key={config.id} value={config.id}>
                            {config.name} (v{config.version}) – {config.measureSpecCount} measure, {config.learnSpecCount} learn
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Options */}
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={storeResults}
                        onChange={(e) => setStoreResults(e.target.checked)}
                        style={{ width: 16, height: 16 }}
                      />
                      <span style={{ fontSize: 14 }}>Store results (CallScores + UserMemories)</span>
                    </label>
                  </div>

                  {/* Transcript Preview */}
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: "block", fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
                      Transcript Preview
                    </label>
                    <div
                      style={{
                        background: "#f9fafb",
                        border: "1px solid #e5e7eb",
                        borderRadius: 8,
                        padding: 12,
                        fontSize: 13,
                        maxHeight: 200,
                        overflowY: "auto",
                        whiteSpace: "pre-wrap",
                        fontFamily: "monospace",
                      }}
                    >
                      {selectedCall.transcript.slice(0, 1000)}
                      {selectedCall.transcript.length > 1000 && "..."}
                    </div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                      {selectedCall.transcript.length} characters
                    </div>
                  </div>

                  {/* Error display */}
                  {error && (
                    <div
                      style={{
                        padding: 12,
                        background: "#fef2f2",
                        border: "1px solid #fecaca",
                        borderRadius: 8,
                        color: "#dc2626",
                        marginBottom: 16,
                        fontSize: 14,
                      }}
                    >
                      {error}
                    </div>
                  )}
                </>
              ) : (
                /* Analysis Results */
                <div>
                  {/* Summary */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(4, 1fr)",
                      gap: 12,
                      marginBottom: 20,
                    }}
                  >
                    <div style={{ background: "#f0fdf4", padding: 12, borderRadius: 8, textAlign: "center" }}>
                      <div style={{ fontSize: 24, fontWeight: 700, color: "#16a34a" }}>
                        {analysisResult.summary.parametersScored}
                      </div>
                      <div style={{ fontSize: 11, color: "#166534" }}>Parameters Scored</div>
                    </div>
                    <div style={{ background: "#fef3c7", padding: 12, borderRadius: 8, textAlign: "center" }}>
                      <div style={{ fontSize: 24, fontWeight: 700, color: "#d97706" }}>
                        {analysisResult.summary.factsLearned}
                      </div>
                      <div style={{ fontSize: 11, color: "#92400e" }}>Facts Learned</div>
                    </div>
                    <div style={{ background: "#ede9fe", padding: 12, borderRadius: 8, textAlign: "center" }}>
                      <div style={{ fontSize: 24, fontWeight: 700, color: "#7c3aed" }}>
                        {analysisResult.analysisTime}ms
                      </div>
                      <div style={{ fontSize: 11, color: "#5b21b6" }}>Analysis Time</div>
                    </div>
                    <div style={{ background: "#dbeafe", padding: 12, borderRadius: 8, textAlign: "center" }}>
                      <div style={{ fontSize: 24, fontWeight: 700, color: "#2563eb" }}>
                        {analysisResult.summary.specsAnalyzed}
                      </div>
                      <div style={{ fontSize: 11, color: "#1e40af" }}>Specs Analysed</div>
                    </div>
                  </div>

                  {/* Storage info */}
                  {analysisResult.stored && (
                    <div
                      style={{
                        background: "#f0fdf4",
                        border: "1px solid #bbf7d0",
                        borderRadius: 8,
                        padding: 12,
                        marginBottom: 16,
                        fontSize: 13,
                      }}
                    >
                      ✓ Stored: {analysisResult.stored.callScoresCreated} call scores,{" "}
                      {analysisResult.stored.userMemoriesCreated} memories
                    </div>
                  )}

                  {/* Measures */}
                  {Object.keys(analysisResult.measures).length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Measures</h4>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {Object.entries(analysisResult.measures).map(([paramId, score]) => (
                          <div
                            key={paramId}
                            style={{
                              background: "#f3f4f6",
                              padding: "6px 10px",
                              borderRadius: 6,
                              fontSize: 12,
                            }}
                          >
                            <span style={{ color: "#6b7280" }}>{paramId}:</span>{" "}
                            <span style={{ fontWeight: 600 }}>{(score as number).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Learned Facts */}
                  {analysisResult.learned.length > 0 && (
                    <div>
                      <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Learned Facts</h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {analysisResult.learned.map((fact, idx) => (
                          <div
                            key={idx}
                            style={{
                              background: "#fffbeb",
                              border: "1px solid #fde68a",
                              padding: 10,
                              borderRadius: 6,
                              fontSize: 13,
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                              <span
                                style={{
                                  fontSize: 10,
                                  padding: "2px 6px",
                                  background: "#fbbf24",
                                  color: "#78350f",
                                  borderRadius: 4,
                                  fontWeight: 500,
                                }}
                              >
                                {fact.category}
                              </span>
                              <span style={{ fontWeight: 500 }}>{fact.key}</span>
                            </div>
                            <div>{fact.value}</div>
                            {fact.evidence && (
                              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4, fontStyle: "italic" }}>
                                "{fact.evidence}"
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: "12px 20px",
                borderTop: "1px solid #e5e7eb",
                display: "flex",
                justifyContent: "flex-end",
                gap: 12,
              }}
            >
              {!analysisResult ? (
                <>
                  <button
                    onClick={handleCloseModal}
                    style={{
                      padding: "8px 16px",
                      fontSize: 14,
                      background: "#f3f4f6",
                      border: "1px solid #d1d5db",
                      borderRadius: 6,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRunAnalysis}
                    disabled={analysing || !selectedConfigId}
                    style={{
                      padding: "8px 20px",
                      fontSize: 14,
                      fontWeight: 500,
                      background: analysing || !selectedConfigId ? "#9ca3af" : "#4f46e5",
                      color: "white",
                      border: "none",
                      borderRadius: 6,
                      cursor: analysing || !selectedConfigId ? "not-allowed" : "pointer",
                    }}
                  >
                    {analysing ? "Analysing..." : "Run Analysis"}
                  </button>
                </>
              ) : (
                <button
                  onClick={handleCloseModal}
                  style={{
                    padding: "8px 20px",
                    fontSize: 14,
                    fontWeight: 500,
                    background: "#4f46e5",
                    color: "white",
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                  }}
                >
                  Done
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
