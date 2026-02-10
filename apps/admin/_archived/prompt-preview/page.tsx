"use client";

import React, { useState, useEffect, useCallback } from "react";
import { theme, categoryColors } from "@/lib/styles/theme";

interface Stack {
  id: string;
  name: string;
  status: string;
  isDefault: boolean;
  itemCount: number;
}

interface Parameter {
  parameterId: string;
  name: string;
  domainGroup: string;
  interpretationLow: string | null;
  interpretationHigh: string | null;
}

interface SlugMatch {
  slug: string;
  name: string;
  sourceType: string;
  rangeLabel: string | null;
  effectiveValue: number | null;
  priority: number;
  promptText: string;
  parameters: Array<{
    parameterId: string;
    value: number;
    weight: number;
    mode: string;
  }>;
}

export default function PromptPreviewPage() {
  const [stacks, setStacks] = useState<Stack[]>([]);
  const [parameters, setParameters] = useState<Parameter[]>([]);
  const [selectedStackId, setSelectedStackId] = useState<string>("");
  const [parameterValues, setParameterValues] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);
  const [result, setResult] = useState<{
    prompt: string;
    matches: SlugMatch[];
    stackName: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load initial data
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/prompt/preview");
        const data = await res.json();
        if (!data.ok) throw new Error(data.error);

        setStacks(data.stacks);
        setParameters(data.parameters);

        // Set default stack
        const defaultStack = data.stacks.find((s: Stack) => s.isDefault) || data.stacks[0];
        if (defaultStack) {
          setSelectedStackId(defaultStack.id);
        }

        // Initialize parameter values to 0.5 (middle)
        const initialValues: Record<string, number> = {};
        for (const p of data.parameters) {
          initialValues[p.parameterId] = 0.5;
        }
        setParameterValues(initialValues);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Compose prompt when stack or values change
  const composePrompt = useCallback(async () => {
    if (!selectedStackId) return;

    setComposing(true);
    setError(null);

    try {
      const res = await fetch("/api/prompt/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stackId: selectedStackId,
          parameterValues,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);

      setResult({
        prompt: data.prompt,
        matches: data.matches,
        stackName: data.stackName,
      });
    } catch (err: any) {
      setError(err.message);
      setResult(null);
    } finally {
      setComposing(false);
    }
  }, [selectedStackId, parameterValues]);

  // Auto-compose on changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (selectedStackId) {
        composePrompt();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [selectedStackId, parameterValues, composePrompt]);

  const updateParameter = (parameterId: string, value: number) => {
    setParameterValues((prev) => ({
      ...prev,
      [parameterId]: value,
    }));
  };

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
        Loading...
      </div>
    );
  }

  // Group parameters by domain
  const paramsByDomain = parameters.reduce((acc, p) => {
    const domain = p.domainGroup || "Other";
    if (!acc[domain]) acc[domain] = [];
    acc[domain].push(p);
    return acc;
  }, {} as Record<string, Parameter[]>);

  return (
    <div style={{ ...theme.page, maxWidth: 1400 }}>
      <h1 style={{ ...theme.h1, fontSize: 24, marginBottom: 8 }}>
        Prompt Preview
      </h1>
      <p style={{ ...theme.subtitle, marginBottom: 24 }}>
        Test how prompts are composed by adjusting parameter values
      </p>

      {error && (
        <div style={theme.errorAlert}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "350px 1fr", gap: "24px" }}>
        {/* Left: Controls */}
        <div>
          {/* Stack selector */}
          <div style={{ ...theme.card, borderRadius: 8, marginBottom: 16 }}>
            <label style={{ ...theme.label, fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
              Prompt Stack
            </label>
            <select
              value={selectedStackId}
              onChange={(e) => setSelectedStackId(e.target.value)}
              style={{ ...theme.select, padding: "8px 12px", fontSize: 14 }}
            >
              {stacks.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.isDefault && "(Default)"} [{s.status}] ({s.itemCount} items)
                </option>
              ))}
            </select>
          </div>

          {/* Parameter sliders */}
          <div
            style={{
              ...theme.card,
              borderRadius: 8,
              maxHeight: "calc(100vh - 280px)",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                Parameter Values
              </span>
              <button
                onClick={() => {
                  const reset: Record<string, number> = {};
                  for (const p of parameters) {
                    reset[p.parameterId] = 0.5;
                  }
                  setParameterValues(reset);
                }}
                style={{
                  ...theme.btnSmall,
                  border: "1px solid var(--border-default)",
                }}
              >
                Reset All
              </button>
            </div>

            {Object.entries(paramsByDomain).map(([domain, params]) => (
              <div key={domain} style={{ marginBottom: 16 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    textTransform: "uppercase",
                    marginBottom: 8,
                    paddingBottom: 4,
                    borderBottom: "1px solid var(--border-default)",
                  }}
                >
                  {domain}
                </div>
                {params.map((p) => (
                  <div key={p.parameterId} style={{ marginBottom: 12 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 13,
                        marginBottom: 4,
                        color: "var(--text-primary)",
                      }}
                    >
                      <span title={p.parameterId}>{p.name || p.parameterId}</span>
                      <span style={{ fontFamily: "monospace", color: "var(--text-secondary)" }}>
                        {(parameterValues[p.parameterId] || 0).toFixed(2)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={parameterValues[p.parameterId] || 0}
                      onChange={(e) =>
                        updateParameter(p.parameterId, parseFloat(e.target.value))
                      }
                      style={{ width: "100%" }}
                    />
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 10,
                        color: "var(--text-muted)",
                      }}
                    >
                      <span>{p.interpretationLow || "Low"}</span>
                      <span>{p.interpretationHigh || "High"}</span>
                    </div>
                  </div>
                ))}
              </div>
            ))}

            {parameters.length === 0 && (
              <div style={{ color: "var(--text-secondary)", fontSize: 13, textAlign: "center" }}>
                No parameters linked to any slugs yet.
                <br />
                Link parameters to dynamic prompts first.
              </div>
            )}
          </div>
        </div>

        {/* Right: Output */}
        <div>
          {/* Composed Prompt */}
          <div style={{ ...theme.card, borderRadius: 8, marginBottom: 16 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                Composed Prompt
                {result && (
                  <span style={{ fontWeight: 400, color: "var(--text-secondary)", marginLeft: 8 }}>
                    ({result.stackName})
                  </span>
                )}
              </span>
              {composing && (
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Composing...</span>
              )}
            </div>
            <div
              style={{
                background: "var(--surface-secondary)",
                border: "1px solid var(--border-default)",
                borderRadius: 6,
                padding: 16,
                fontFamily: "monospace",
                fontSize: 13,
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
                maxHeight: 400,
                overflowY: "auto",
                color: "var(--text-primary)",
              }}
            >
              {result?.prompt || (
                <span style={{ color: "var(--text-muted)" }}>
                  Adjust parameters above to see the composed prompt...
                </span>
              )}
            </div>
          </div>

          {/* Matched Slugs */}
          <div style={{ ...theme.card, borderRadius: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, display: "block", marginBottom: 12, color: "var(--text-primary)" }}>
              Matched Slugs ({result?.matches.length || 0})
            </span>

            {result?.matches.length === 0 && (
              <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                No dynamic prompts matched the current parameter values.
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {result?.matches.map((match, idx) => (
                <div
                  key={idx}
                  style={{
                    background: "var(--surface-secondary)",
                    border: "1px solid var(--border-default)",
                    borderRadius: 6,
                    padding: 12,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 12,
                        fontSize: 10,
                        fontWeight: 500,
                        backgroundColor: categoryColors[match.sourceType] || "#6366f1",
                        color: "white",
                      }}
                    >
                      {match.sourceType}
                    </span>
                    <span style={{ fontWeight: 500, fontSize: 14, color: "var(--text-primary)" }}>{match.name}</span>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>({match.slug})</span>
                    {match.rangeLabel && (
                      <span
                        style={{
                          padding: "2px 6px",
                          background: "var(--status-info-bg)",
                          color: "var(--status-info-text)",
                          borderRadius: 4,
                          fontSize: 10,
                        }}
                      >
                        {match.rangeLabel}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>
                    {match.parameters.map((p) => (
                      <span key={p.parameterId} style={{ marginRight: 12 }}>
                        {p.parameterId}: {p.value.toFixed(2)} (w={p.weight}, {p.mode})
                      </span>
                    ))}
                    {match.effectiveValue !== null && (
                      <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>
                        → Effective: {match.effectiveValue.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--text-primary)",
                      background: "var(--surface-primary)",
                      padding: 8,
                      borderRadius: 4,
                      border: "1px solid var(--border-default)",
                    }}
                  >
                    {match.promptText.substring(0, 200)}
                    {match.promptText.length > 200 && "..."}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
