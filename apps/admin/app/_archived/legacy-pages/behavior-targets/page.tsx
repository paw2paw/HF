"use client";

import { useState, useEffect } from "react";
import { SourcePageHeader } from "@/components/shared/SourcePageHeader";

type BehaviorTarget = {
  id: string;
  parameterId: string;
  scope: "SYSTEM" | "SEGMENT" | "CALLER";
  targetValue: number;
  confidence: number;
  source: "SEED" | "LEARNED" | "MANUAL";
  segmentId: string | null;
  callerIdentityId: string | null;
  effectiveFrom: string;
  effectiveUntil: string | null;
  observationCount: number;
  lastLearnedAt: string | null;
  parameter: {
    parameterId: string;
    name: string | null;
    domainGroup: string | null;
    parameterType: string | null;
  };
  segment?: {
    id: string;
    name: string | null;
  } | null;
  callerIdentity?: {
    id: string;
    name: string | null;
  } | null;
};

type BehaviorParameter = {
  parameterId: string;
  name: string | null;
  domainGroup: string | null;
};

export default function BehaviorTargetsPage() {
  const [targets, setTargets] = useState<BehaviorTarget[]>([]);
  const [behaviorParams, setBehaviorParams] = useState<BehaviorParameter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scopeFilter, setScopeFilter] = useState<string>("all");
  const [showInactive, setShowInactive] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [formParameterId, setFormParameterId] = useState("");
  const [formScope, setFormScope] = useState<"SYSTEM" | "SEGMENT" | "CALLER">("SYSTEM");
  const [formTargetValue, setFormTargetValue] = useState(0.5);
  const [formConfidence, setFormConfidence] = useState(0.5);
  const [formSubmitting, setFormSubmitting] = useState(false);

  const loadTargets = () => {
    const params = new URLSearchParams();
    if (!showInactive) params.set("activeOnly", "true");

    fetch(`/api/behavior-targets?${params}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setTargets(data.targets || []);
        } else {
          setError(data.error || "Failed to load targets");
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  };

  const loadBehaviorParams = () => {
    fetch("/api/parameters?filter=" + encodeURIComponent(JSON.stringify({ parameterType: "BEHAVIOR" })))
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setBehaviorParams(data);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadTargets();
    loadBehaviorParams();
  }, [showInactive]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/behavior-targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parameterId: formParameterId,
          scope: formScope,
          targetValue: formTargetValue,
          confidence: formConfidence,
          source: "MANUAL",
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setShowForm(false);
        setFormParameterId("");
        setFormTargetValue(0.5);
        setFormConfidence(0.5);
        loadTargets();
      } else {
        setError(data.error);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setFormSubmitting(false);
    }
  };

  const filteredTargets = targets.filter((t) => {
    if (scopeFilter === "all") return true;
    return t.scope === scopeFilter;
  });

  const getScopeLabel = (target: BehaviorTarget) => {
    if (target.scope === "SYSTEM") return "System-wide";
    if (target.scope === "SEGMENT") return target.segment?.name || "Segment";
    if (target.scope === "CALLER") return target.callerIdentity?.name || "Caller";
    return target.scope;
  };

  const getSourceBadge = (source: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      SEED: { bg: "#e0f2fe", text: "#0369a1" },
      LEARNED: { bg: "#dcfce7", text: "#16a34a" },
      MANUAL: { bg: "#fef3c7", text: "#d97706" },
    };
    const c = colors[source] || { bg: "#f3f4f6", text: "#6b7280" };
    return (
      <span
        style={{
          fontSize: 10,
          padding: "2px 6px",
          background: c.bg,
          color: c.text,
          borderRadius: 4,
          fontWeight: 500,
        }}
      >
        {source}
      </span>
    );
  };

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
      <SourcePageHeader
        title="Behavior Targets"
        description="Set target values for BEHAVIOR parameters. These targets are used by the REWARD op to compute reward scores."
        dataNodeId="data:behavior-targets"
        count={targets.length}
      />

      {/* Filters & Actions */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
        <select
          value={scopeFilter}
          onChange={(e) => setScopeFilter(e.target.value)}
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid #e5e7eb",
            fontSize: 14,
          }}
        >
          <option value="all">All Scopes</option>
          <option value="SYSTEM">System</option>
          <option value="SEGMENT">Segment</option>
          <option value="CALLER">Caller</option>
        </select>

        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, color: "#6b7280" }}>
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Show inactive
        </label>

        <div style={{ flex: 1 }} />

        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            padding: "8px 16px",
            background: showForm ? "#6b7280" : "#4f46e5",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          {showForm ? "Cancel" : "+ New Target"}
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div
          style={{
            marginBottom: 24,
            padding: 20,
            background: "#f9fafb",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: "#1f2937" }}>
            Create New Behavior Target
          </div>
          <form onSubmit={handleSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "#374151" }}>
                  Parameter
                </label>
                <select
                  value={formParameterId}
                  onChange={(e) => setFormParameterId(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid #e5e7eb",
                    fontSize: 14,
                  }}
                >
                  <option value="">Select a BEHAVIOR parameter...</option>
                  {behaviorParams.map((p) => (
                    <option key={p.parameterId} value={p.parameterId}>
                      {p.name || p.parameterId}
                      {p.domainGroup ? ` (${p.domainGroup})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "#374151" }}>
                  Scope
                </label>
                <select
                  value={formScope}
                  onChange={(e) => setFormScope(e.target.value as any)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid #e5e7eb",
                    fontSize: 14,
                  }}
                >
                  <option value="SYSTEM">System (applies to all)</option>
                  <option value="SEGMENT" disabled>Segment (coming soon)</option>
                  <option value="CALLER" disabled>Caller (coming soon)</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "#374151" }}>
                  Target Value: {formTargetValue.toFixed(2)}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={formTargetValue}
                  onChange={(e) => setFormTargetValue(parseFloat(e.target.value))}
                  style={{ width: "100%" }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#9ca3af" }}>
                  <span>0.0 (Low)</span>
                  <span>1.0 (High)</span>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "#374151" }}>
                  Confidence: {formConfidence.toFixed(2)}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={formConfidence}
                  onChange={(e) => setFormConfidence(parseFloat(e.target.value))}
                  style={{ width: "100%" }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#9ca3af" }}>
                  <span>0.0 (Uncertain)</span>
                  <span>1.0 (Certain)</span>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
              <button
                type="submit"
                disabled={formSubmitting || !formParameterId}
                style={{
                  padding: "10px 20px",
                  background: formSubmitting || !formParameterId ? "#d1d5db" : "#4f46e5",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: formSubmitting || !formParameterId ? "not-allowed" : "pointer",
                }}
              >
                {formSubmitting ? "Creating..." : "Create Target"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ padding: 16, background: "#fef2f2", color: "#dc2626", borderRadius: 8, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Loading...</div>
      ) : filteredTargets.length === 0 ? (
        <div
          style={{
            padding: 40,
            textAlign: "center",
            background: "#f9fafb",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎯</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#374151" }}>
            No behavior targets {scopeFilter !== "all" ? `for ${scopeFilter} scope` : ""}
          </div>
          <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
            Create targets to define ideal behavior values for your agent
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filteredTargets.map((target) => (
            <div
              key={target.id}
              style={{
                background: target.effectiveUntil ? "#f9fafb" : "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: 16,
                opacity: target.effectiveUntil ? 0.6 : 1,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#1f2937" }}>
                    {target.parameter?.name || target.parameterId}
                  </div>
                  {target.parameter?.domainGroup && (
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                      {target.parameter.domainGroup}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span
                    style={{
                      fontSize: 10,
                      padding: "2px 8px",
                      background: target.scope === "SYSTEM" ? "#dbeafe" : target.scope === "SEGMENT" ? "#fce7f3" : "#d1fae5",
                      color: target.scope === "SYSTEM" ? "#1e40af" : target.scope === "SEGMENT" ? "#be185d" : "#059669",
                      borderRadius: 4,
                      fontWeight: 500,
                    }}
                  >
                    {getScopeLabel(target)}
                  </span>
                  {getSourceBadge(target.source)}
                  {target.effectiveUntil && (
                    <span
                      style={{
                        fontSize: 10,
                        padding: "2px 6px",
                        background: "#f3f4f6",
                        color: "#6b7280",
                        borderRadius: 4,
                      }}
                    >
                      INACTIVE
                    </span>
                  )}
                </div>
              </div>

              {/* Target Value Bar */}
              <div style={{ marginTop: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: "#6b7280" }}>Target Value</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#4f46e5" }}>
                    {(target.targetValue * 100).toFixed(0)}%
                  </span>
                </div>
                <div
                  style={{
                    height: 8,
                    background: "#e5e7eb",
                    borderRadius: 4,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${target.targetValue * 100}%`,
                      background: "linear-gradient(90deg, #818cf8, #4f46e5)",
                      borderRadius: 4,
                    }}
                  />
                </div>
              </div>

              {/* Confidence Bar */}
              <div style={{ marginTop: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: "#6b7280" }}>Confidence</span>
                  <span style={{ fontSize: 12, color: "#6b7280" }}>
                    {(target.confidence * 100).toFixed(0)}%
                  </span>
                </div>
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
                      width: `${target.confidence * 100}%`,
                      background: "#10b981",
                      borderRadius: 2,
                    }}
                  />
                </div>
              </div>

              {/* Footer */}
              <div style={{ marginTop: 12, display: "flex", gap: 16, fontSize: 11, color: "#9ca3af" }}>
                <span>Effective from {new Date(target.effectiveFrom).toLocaleDateString()}</span>
                {target.observationCount > 0 && (
                  <span>{target.observationCount} observations</span>
                )}
                {target.lastLearnedAt && (
                  <span>Last learned {new Date(target.lastLearnedAt).toLocaleDateString()}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
