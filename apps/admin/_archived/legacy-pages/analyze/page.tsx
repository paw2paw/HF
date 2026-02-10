"use client";

import { useState, useEffect, useCallback } from "react";
import { SourcePageHeader } from "@/components/shared/SourcePageHeader";
import { AIConfigButton } from "@/components/shared/AIConfigButton";

// =============================================================================
// TYPES
// =============================================================================

type Caller = {
  id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  externalId: string | null;
  createdAt: string;
  nextPrompt: string | null;
  nextPromptComposedAt: string | null;
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

type Call = {
  id: string;
  source: string;
  externalId: string | null;
  transcript: string;
  createdAt: string;
  callerId: string | null;
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
  callerId: string | null;
  model: string;
  analysisTime: number;
  measures: Record<string, number>;
  learned: Array<{ category: string; key: string; value: string; evidence: string }>;
  stored: { callScoresCreated: number; callerMemoriesCreated: number; analysisRunId: string | null } | null;
  adapt?: {
    previousCallId?: string;
    callSequence: number;
    scores: Array<{
      parameterId: string;
      parameterName: string;
      type: string;
      score: number;
      evidence?: string;
    }>;
  } | null;
  summary: {
    specsAnalyzed: number;
    measureSpecs: number;
    learnSpecs: number;
    parametersScored: number;
    factsLearned: number;
    adaptScoresComputed: number;
  };
};

type SystemReadiness = {
  database: { ok: boolean; message: string };
  analysisSpecs: { ok: boolean; count: number; required: number };
  parameters: { ok: boolean; count: number };
  runConfigs: { ok: boolean; count: number };
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function AnalyzePage() {
  // Step state
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // System readiness
  const [readiness, setReadiness] = useState<SystemReadiness | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(true);

  // Callers
  const [callers, setCallers] = useState<Caller[]>([]);
  const [callersLoading, setCallersLoading] = useState(true);
  const [callerSearch, setCallerSearch] = useState("");
  const [selectedCaller, setSelectedCaller] = useState<Caller | null>(null);

  // Run configs
  const [runConfigs, setRunConfigs] = useState<RunConfig[]>([]);
  const [runConfigsLoading, setRunConfigsLoading] = useState(false);
  const [selectedConfigId, setSelectedConfigId] = useState<string>("");

  // Calls for selected caller
  const [calls, setCalls] = useState<Call[]>([]);
  const [callsLoading, setCallsLoading] = useState(false);
  const [selectedCallIds, setSelectedCallIds] = useState<Set<string>>(new Set());
  const [analysisMode, setAnalysisMode] = useState<"single" | "multi">("single");

  // Analysis execution
  const [analysing, setAnalysing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([]);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [storeResults, setStoreResults] = useState(true);

  // =============================================================================
  // DATA FETCHING
  // =============================================================================

  // Check system readiness using the dedicated endpoint
  useEffect(() => {
    const checkReadiness = async () => {
      try {
        const res = await fetch("/api/system/readiness");
        const data = await res.json();

        if (data.ok) {
          setReadiness({
            database: data.checks.database,
            analysisSpecs: data.checks.analysisSpecs,
            parameters: data.checks.parameters,
            runConfigs: data.checks.runConfigs,
          });
        } else {
          throw new Error(data.error);
        }
      } catch {
        setReadiness({
          database: { ok: false, message: "Connection failed" },
          analysisSpecs: { ok: false, count: 0, required: 1 },
          parameters: { ok: false, count: 0 },
          runConfigs: { ok: false, count: 0 },
        });
      } finally {
        setReadinessLoading(false);
      }
    };
    checkReadiness();
  }, []);

  // Fetch callers
  useEffect(() => {
    fetch("/api/callers?withPersonality=true&withCounts=true")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setCallers(data.callers || []);
        }
        setCallersLoading(false);
      })
      .catch(() => setCallersLoading(false));
  }, []);

  // Fetch run configs
  const fetchRunConfigs = useCallback(async () => {
    setRunConfigsLoading(true);
    try {
      const res = await fetch("/api/compiled-sets?status=READY");
      const data = await res.json();
      if (data.ok) {
        setRunConfigs(data.sets || []);
        if (data.sets?.length > 0 && !selectedConfigId) {
          setSelectedConfigId(data.sets[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load run configs:", err);
    } finally {
      setRunConfigsLoading(false);
    }
  }, [selectedConfigId]);

  // Fetch calls for selected caller
  const fetchCallerCalls = useCallback(async (callerId: string) => {
    setCallsLoading(true);
    try {
      const res = await fetch(`/api/calls?callerId=${callerId}&limit=50`);
      const data = await res.json();
      if (data.ok) {
        setCalls(data.calls || []);
      }
    } catch (err) {
      console.error("Failed to load calls:", err);
    } finally {
      setCallsLoading(false);
    }
  }, []);

  // When caller is selected, fetch their calls and configs
  useEffect(() => {
    if (selectedCaller) {
      fetchCallerCalls(selectedCaller.id);
      fetchRunConfigs();
    }
  }, [selectedCaller, fetchCallerCalls, fetchRunConfigs]);

  // =============================================================================
  // HANDLERS
  // =============================================================================

  const handleSelectCaller = (caller: Caller) => {
    setSelectedCaller(caller);
    setSelectedCallIds(new Set());
    setAnalysisResults([]);
    setAnalysisError(null);
    setStep(2);
  };

  const handleToggleCall = (callId: string) => {
    setSelectedCallIds((prev) => {
      const next = new Set(prev);
      if (next.has(callId)) {
        next.delete(callId);
      } else {
        next.add(callId);
      }
      return next;
    });
  };

  const handleSelectAllCalls = () => {
    if (selectedCallIds.size === calls.length) {
      setSelectedCallIds(new Set());
    } else {
      setSelectedCallIds(new Set(calls.map((c) => c.id)));
    }
  };

  const handleRunAnalysis = async () => {
    if (!selectedCaller || !selectedConfigId || selectedCallIds.size === 0) return;

    setAnalysing(true);
    setAnalysisError(null);
    setAnalysisResults([]);

    try {
      // Get spec slugs from compiled set
      const configRes = await fetch(`/api/compiled-sets/${selectedConfigId}`);
      const configData = await configRes.json();

      if (!configData.ok) {
        throw new Error(configData.error || "Failed to load config details");
      }

      const specSlugs: string[] = [
        ...(configData.specs?.measure || []).map((s: any) => s.slug),
        ...(configData.specs?.learn || []).map((s: any) => s.slug),
      ];

      // Get selected calls
      const selectedCalls = calls.filter((c) => selectedCallIds.has(c.id));
      const results: AnalysisResult[] = [];

      // Run analysis for each call
      for (const call of selectedCalls) {
        try {
          const res = await fetch("/api/analysis/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              transcript: call.transcript,
              callId: call.id,
              callerId: selectedCaller.id,
              specs: specSlugs.length > 0 ? specSlugs : undefined,
              storeResults,
            }),
          });

          const result = await res.json();
          if (result.ok) {
            results.push(result);
          } else {
            results.push({
              ...result,
              callId: call.id,
              error: result.error,
            });
          }
        } catch (err: any) {
          results.push({
            ok: false,
            callId: call.id,
            error: err.message,
          } as any);
        }
      }

      setAnalysisResults(results);
      setStep(3);
    } catch (err: any) {
      setAnalysisError(err.message || "Analysis failed");
    } finally {
      setAnalysing(false);
    }
  };

  const handleReset = () => {
    setSelectedCaller(null);
    setSelectedCallIds(new Set());
    setAnalysisResults([]);
    setAnalysisError(null);
    setStep(1);
  };

  // =============================================================================
  // HELPERS
  // =============================================================================

  const getCallerLabel = (caller: Caller) => {
    return caller.name || caller.email || caller.phone || caller.externalId || "Unknown";
  };

  const filteredCallers = callers.filter((caller) => {
    if (!callerSearch) return true;
    const s = callerSearch.toLowerCase();
    return (
      caller.name?.toLowerCase().includes(s) ||
      caller.email?.toLowerCase().includes(s) ||
      caller.phone?.toLowerCase().includes(s) ||
      caller.externalId?.toLowerCase().includes(s)
    );
  });

  const allReady = readiness?.analysisSpecs.ok && readiness?.runConfigs.ok;

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <SourcePageHeader
        title="Analyze"
        description="Run analysis on calls to extract personality scores and memories"
        dataNodeId="analyze"
        count={selectedCallIds.size}
      />

      {/* System Readiness Banner */}
      {!readinessLoading && !allReady && (
        <div
          style={{
            background: "#fef3c7",
            border: "1px solid #fbbf24",
            borderRadius: 12,
            padding: 16,
            marginBottom: 24,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 8, color: "#92400e" }}>
            Prerequisites Required
          </div>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16 }}>{readiness?.analysisSpecs.ok ? "✅" : "⚠️"}</span>
              <span style={{ fontSize: 13, color: "#78350f" }}>
                Analysis Specs: {readiness?.analysisSpecs.count || 0} active
                {!readiness?.analysisSpecs.ok && (
                  <a href="/analysis-specs" style={{ marginLeft: 8, color: "#2563eb" }}>
                    Create one →
                  </a>
                )}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16 }}>{readiness?.runConfigs.ok ? "✅" : "⚠️"}</span>
              <span style={{ fontSize: 13, color: "#78350f" }}>
                Run Configs: {readiness?.runConfigs.count || 0} ready
                {!readiness?.runConfigs.ok && (
                  <a href="/run-configs" style={{ marginLeft: 8, color: "#2563eb" }}>
                    Create one →
                  </a>
                )}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Step Indicator */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 24,
          padding: 16,
          background: "#f9fafb",
          borderRadius: 12,
        }}
      >
        {[
          { num: 1, label: "Select Caller", icon: "👤" },
          { num: 2, label: "Configure & Select Calls", icon: "⚙️" },
          { num: 3, label: "Results", icon: "📊" },
        ].map((s, i) => (
          <div
            key={s.num}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 16px",
              background: step === s.num ? "#4f46e5" : step > s.num ? "#10b981" : "#fff",
              color: step >= s.num ? "#fff" : "#6b7280",
              borderRadius: 8,
              border: step === s.num ? "none" : "1px solid #e5e7eb",
              cursor: step > s.num ? "pointer" : "default",
              transition: "all 0.15s ease",
            }}
            onClick={() => {
              if (s.num === 1 && step > 1) handleReset();
              if (s.num === 2 && step === 3) setStep(2);
            }}
          >
            <span style={{ fontSize: 20 }}>{s.icon}</span>
            <div>
              <div style={{ fontSize: 11, opacity: 0.8 }}>Step {s.num}</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{s.label}</div>
            </div>
            {i < 2 && (
              <div style={{ marginLeft: "auto", fontSize: 18, opacity: 0.5 }}>→</div>
            )}
          </div>
        ))}
      </div>

      {/* STEP 1: Select Caller */}
      {step === 1 && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <input
              type="text"
              placeholder="Search callers by name, email, phone..."
              value={callerSearch}
              onChange={(e) => setCallerSearch(e.target.value)}
              style={{
                padding: "12px 16px",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                fontSize: 14,
                width: "100%",
                maxWidth: 400,
              }}
            />
          </div>

          {callersLoading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
              Loading callers...
            </div>
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
                {callerSearch ? "No callers match your search" : "No callers yet"}
              </div>
              <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
                Process transcripts first to create caller records
              </div>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 12,
              }}
            >
              {filteredCallers.map((caller) => (
                <div
                  key={caller.id}
                  onClick={() => handleSelectCaller(caller)}
                  style={{
                    background: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                    padding: 16,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#a5b4fc";
                    e.currentTarget.style.boxShadow = "0 2px 8px rgba(79, 70, 229, 0.1)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#e5e7eb";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>
                    {getCallerLabel(caller)}
                  </div>
                  <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#6b7280" }}>
                    <span>📞 {caller._count?.calls || 0} calls</span>
                    <span>💭 {caller._count?.memories || 0} memories</span>
                    {caller.nextPrompt && <span style={{ color: "#10b981" }}>✨ Prompt ready</span>}
                  </div>
                  {/* Mini personality chart */}
                  {caller.personality && caller.personality.confidenceScore !== null && (
                    <div style={{ marginTop: 10, display: "flex", gap: 3 }}>
                      {[
                        { v: caller.personality.openness, c: "#3b82f6" },
                        { v: caller.personality.conscientiousness, c: "#10b981" },
                        { v: caller.personality.extraversion, c: "#f59e0b" },
                        { v: caller.personality.agreeableness, c: "#ec4899" },
                        { v: caller.personality.neuroticism, c: "#8b5cf6" },
                      ].map((t, i) => (
                        <div key={i} style={{ flex: 1, height: 3, background: "#e5e7eb", borderRadius: 2 }}>
                          <div
                            style={{
                              height: "100%",
                              width: `${(t.v || 0) * 100}%`,
                              background: t.c,
                              borderRadius: 2,
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* STEP 2: Configure & Select Calls */}
      {step === 2 && selectedCaller && (
        <div>
          {/* Selected Caller Header */}
          <div
            style={{
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: 10,
              padding: 16,
              marginBottom: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ fontSize: 11, color: "#16a34a", fontWeight: 500, marginBottom: 4 }}>
                SELECTED CALLER
              </div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{getCallerLabel(selectedCaller)}</div>
              <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
                {selectedCaller._count?.calls || 0} calls • {selectedCaller._count?.memories || 0} memories
              </div>
            </div>
            <button
              onClick={handleReset}
              style={{
                padding: "6px 12px",
                fontSize: 12,
                background: "#fff",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              Change Caller
            </button>
          </div>

          {/* Run Config Selection */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
              Analysis Configuration
            </label>
            {runConfigsLoading ? (
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
                <a href="/run-configs" style={{ color: "#2563eb" }}>
                  Create a Run Config →
                </a>
              </div>
            ) : (
              <select
                value={selectedConfigId}
                onChange={(e) => setSelectedConfigId(e.target.value)}
                style={{
                  width: "100%",
                  maxWidth: 500,
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
          <div style={{ marginBottom: 20, display: "flex", gap: 24, alignItems: "center" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={storeResults}
                onChange={(e) => setStoreResults(e.target.checked)}
                style={{ width: 16, height: 16 }}
              />
              <span style={{ fontSize: 14 }}>Store results (Scores + Memories)</span>
            </label>
          </div>

          {/* Calls Selection */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <label style={{ fontSize: 14, fontWeight: 600 }}>
                Select Calls ({selectedCallIds.size} of {calls.length} selected)
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={handleSelectAllCalls}
                  style={{
                    padding: "6px 12px",
                    fontSize: 12,
                    background: "#f3f4f6",
                    border: "1px solid #d1d5db",
                    borderRadius: 6,
                    cursor: "pointer",
                  }}
                >
                  {selectedCallIds.size === calls.length ? "Deselect All" : "Select All"}
                </button>
              </div>
            </div>

            {callsLoading ? (
              <div style={{ padding: 20, textAlign: "center", color: "#6b7280" }}>
                Loading calls...
              </div>
            ) : calls.length === 0 ? (
              <div
                style={{
                  padding: 24,
                  textAlign: "center",
                  background: "#f9fafb",
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                }}
              >
                No calls found for this caller
              </div>
            ) : (
              <div
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  overflow: "hidden",
                  maxHeight: 300,
                  overflowY: "auto",
                }}
              >
                {calls.map((call) => (
                  <div
                    key={call.id}
                    onClick={() => handleToggleCall(call.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 16px",
                      borderBottom: "1px solid #f3f4f6",
                      cursor: "pointer",
                      background: selectedCallIds.has(call.id) ? "#eef2ff" : "#fff",
                      transition: "background 0.1s ease",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedCallIds.has(call.id)}
                      onChange={() => {}}
                      style={{ width: 16, height: 16 }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span
                          style={{
                            fontSize: 10,
                            padding: "2px 6px",
                            background: "#e0e7ff",
                            color: "#4338ca",
                            borderRadius: 4,
                            fontWeight: 500,
                          }}
                        >
                          {call.source}
                        </span>
                        <span style={{ fontSize: 12, color: "#6b7280" }}>
                          {new Date(call.createdAt).toLocaleDateString()}
                        </span>
                        {(call._count?.scores || 0) > 0 && (
                          <span style={{ fontSize: 11, color: "#10b981" }}>
                            ✓ {call._count?.scores} scores
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "#6b7280",
                          marginTop: 4,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: 600,
                        }}
                      >
                        {call.transcript.slice(0, 100)}...
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Error */}
          {analysisError && (
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
              {analysisError}
            </div>
          )}

          {/* Run Button */}
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button
              onClick={handleRunAnalysis}
              disabled={analysing || !selectedConfigId || selectedCallIds.size === 0}
              style={{
                padding: "12px 24px",
                fontSize: 15,
                fontWeight: 600,
                background:
                  analysing || !selectedConfigId || selectedCallIds.size === 0 ? "#9ca3af" : "#4f46e5",
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor:
                  analysing || !selectedConfigId || selectedCallIds.size === 0 ? "not-allowed" : "pointer",
              }}
            >
              {analysing
                ? "Analysing..."
                : `Run Analysis on ${selectedCallIds.size} Call${selectedCallIds.size !== 1 ? "s" : ""}`}
            </button>
            <AIConfigButton callPoint="analysis.measure" label="Analysis AI Config" size="md" />
          </div>
        </div>
      )}

      {/* STEP 3: Results */}
      {step === 3 && (
        <div>
          {/* Summary */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 12,
              marginBottom: 24,
            }}
          >
            <div style={{ background: "#f0fdf4", padding: 16, borderRadius: 10, textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#16a34a" }}>
                {analysisResults.filter((r) => r.ok).length}
              </div>
              <div style={{ fontSize: 12, color: "#166534" }}>Calls Analysed</div>
            </div>
            <div style={{ background: "#ede9fe", padding: 16, borderRadius: 10, textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#7c3aed" }}>
                {analysisResults.reduce((sum, r) => sum + (r.summary?.parametersScored || 0), 0)}
              </div>
              <div style={{ fontSize: 12, color: "#5b21b6" }}>Total Scores</div>
            </div>
            <div style={{ background: "#fef3c7", padding: 16, borderRadius: 10, textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#d97706" }}>
                {analysisResults.reduce((sum, r) => sum + (r.summary?.factsLearned || 0), 0)}
              </div>
              <div style={{ fontSize: 12, color: "#92400e" }}>Facts Learned</div>
            </div>
            <div style={{ background: "#dbeafe", padding: 16, borderRadius: 10, textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#2563eb" }}>
                {analysisResults.reduce((sum, r) => sum + (r.analysisTime || 0), 0)}ms
              </div>
              <div style={{ fontSize: 12, color: "#1e40af" }}>Total Time</div>
            </div>
          </div>

          {/* Storage confirmation */}
          {storeResults && analysisResults.some((r) => r.stored) && (
            <div
              style={{
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: 8,
                padding: 12,
                marginBottom: 20,
                fontSize: 13,
              }}
            >
              ✓ Results stored: {analysisResults.reduce((s, r) => s + (r.stored?.callScoresCreated || 0), 0)} scores,{" "}
              {analysisResults.reduce((s, r) => s + (r.stored?.callerMemoriesCreated || 0), 0)} memories
            </div>
          )}

          {/* Per-call results */}
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Results by Call</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {analysisResults.map((result, idx) => {
                const call = calls.find((c) => c.id === result.callId);
                return (
                  <div
                    key={result.callId || idx}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 10,
                      padding: 16,
                      background: result.ok ? "#fff" : "#fef2f2",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                      <div>
                        <span
                          style={{
                            fontSize: 10,
                            padding: "2px 6px",
                            background: result.ok ? "#dcfce7" : "#fecaca",
                            color: result.ok ? "#166534" : "#dc2626",
                            borderRadius: 4,
                            fontWeight: 500,
                          }}
                        >
                          {result.ok ? "SUCCESS" : "ERROR"}
                        </span>
                        <span style={{ marginLeft: 8, fontSize: 13, color: "#6b7280" }}>
                          {call ? new Date(call.createdAt).toLocaleDateString() : result.callId}
                        </span>
                      </div>
                      {result.analysisTime && (
                        <span style={{ fontSize: 12, color: "#6b7280" }}>{result.analysisTime}ms</span>
                      )}
                    </div>

                    {result.ok && (
                      <>
                        {/* Measures */}
                        {Object.keys(result.measures || {}).length > 0 && (
                          <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 6 }}>MEASURES</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                              {Object.entries(result.measures).map(([paramId, score]) => (
                                <span
                                  key={paramId}
                                  style={{
                                    fontSize: 11,
                                    padding: "4px 8px",
                                    background: "#f3f4f6",
                                    borderRadius: 4,
                                  }}
                                >
                                  {paramId}: <strong>{(score as number).toFixed(2)}</strong>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Learned */}
                        {(result.learned || []).length > 0 && (
                          <div>
                            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 6 }}>LEARNED</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                              {result.learned.map((fact, i) => (
                                <span
                                  key={i}
                                  style={{
                                    fontSize: 11,
                                    padding: "4px 8px",
                                    background: "#fef3c7",
                                    borderRadius: 4,
                                  }}
                                >
                                  <strong>{fact.key}:</strong> {fact.value}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={() => setStep(2)}
              style={{
                padding: "10px 20px",
                fontSize: 14,
                background: "#f3f4f6",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              ← Analyze More Calls
            </button>
            <button
              onClick={handleReset}
              style={{
                padding: "10px 20px",
                fontSize: 14,
                background: "#4f46e5",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              Start Over
            </button>
            <a
              href={`/callers/${selectedCaller?.id}`}
              style={{
                padding: "10px 20px",
                fontSize: 14,
                background: "#10b981",
                color: "white",
                border: "none",
                borderRadius: 6,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              View Caller Profile →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
