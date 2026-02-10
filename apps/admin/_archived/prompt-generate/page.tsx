"use client";

import { useState, useEffect } from "react";
import { theme } from "@/lib/styles/theme";

interface Stack {
  id: string;
  name: string;
  status: string;
  isDefault: boolean;
  itemCount: number;
}

interface User {
  id: string;
  name: string | null;
  email: string | null;
  hasPersonality: boolean;
  memoryCount: number;
  callCount: number;
}

interface SlugMatch {
  slugSlug: string;
  slugName: string;
  sourceType: string;
  rangeLabel?: string;
  promptText: string;
  parameters: Array<{
    parameterId: string;
    value: number;
    weight: number;
    mode: string;
  }>;
  effectiveValue?: number;
  priority: number;
}

interface GenerationResult {
  prompt: string;
  stackId: string;
  stackName: string;
  matches: SlugMatch[];
  composedAt: string;
  user?: {
    id: string;
    name: string | null;
    email: string | null;
  };
  parameterValues?: Record<string, number>;
  memoryCount?: number;
}

// New spec-based composition types
interface SpecPrompt {
  specId: string;
  specSlug: string;
  specName: string;
  outputType: string;
  domain: string | null;
  renderedPrompt: string;
  templateUsed: string;
  context: {
    value?: number;
    label?: string;
    parameterId?: string;
    parameterName?: string;
  };
}

interface SpecCompositionResult {
  ok: boolean;
  prompt: string;
  prompts: SpecPrompt[];
  metadata: {
    totalSpecs: number;
    specsWithTemplates: number;
    promptsRendered: number;
    memoriesIncluded: number;
    composedAt: string;
    parameterValuesUsed: Record<string, number>;
  };
}

export default function PromptGeneratePage() {
  const [stacks, setStacks] = useState<Stack[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selection state
  const [selectedStackId, setSelectedStackId] = useState<string>("");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [mode, setMode] = useState<"user" | "preview">("user");

  // Composition engine toggle: "stack" (legacy) or "spec" (new)
  const [engine, setEngine] = useState<"stack" | "spec">("spec");

  // Preview mode state
  const [previewParams, setPreviewParams] = useState<Record<string, number>>({
    "B5-O": 0.5,
    "B5-C": 0.5,
    "B5-E": 0.5,
    "B5-A": 0.5,
    "B5-N": 0.5,
  });
  const [previewMemories, setPreviewMemories] = useState<string>("");

  // Result state
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [specResult, setSpecResult] = useState<SpecCompositionResult | null>(null);

  // Load initial data
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/prompt/generate");
        const data = await res.json();
        if (!data.ok) throw new Error(data.error);

        setStacks(data.stacks);
        setUsers(data.users);

        // Set defaults
        const defaultStack = data.stacks.find((s: Stack) => s.isDefault) || data.stacks[0];
        if (defaultStack) setSelectedStackId(defaultStack.id);

        const userWithData = data.users.find((u: User) => u.hasPersonality || u.memoryCount > 0);
        if (userWithData) setSelectedUserId(userWithData.id);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Generate prompt
  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    setResult(null);
    setSpecResult(null);

    try {
      if (engine === "spec") {
        // New spec-based composition
        const body: any = {
          parameterValues: mode === "preview" ? previewParams : undefined,
          userId: mode === "user" ? selectedUserId : undefined,
          includeMemories: true,
        };

        const res = await fetch("/api/prompt/compose-from-specs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const data = await res.json();
        if (!data.ok) throw new Error(data.error);

        setSpecResult(data);
      } else {
        // Legacy stack-based composition
        let body: any;

        if (mode === "user" && selectedUserId) {
          body = {
            userId: selectedUserId,
            stackId: selectedStackId || undefined,
          };
        } else {
          // Preview mode
          const memories: Record<string, any[]> = {};
          if (previewMemories.trim()) {
            // Parse simple format: "FACT: key=value, key2=value2"
            const lines = previewMemories.split("\n").filter((l) => l.trim());
            for (const line of lines) {
              const match = line.match(/^(\w+):\s*(.+)$/);
              if (match) {
                const category = match[1];
                const pairs = match[2].split(",").map((p) => p.trim());
                if (!memories[category]) memories[category] = [];
                for (const pair of pairs) {
                  const [key, ...valueParts] = pair.split("=");
                  if (key && valueParts.length > 0) {
                    memories[category].push({
                      key: key.trim(),
                      value: valueParts.join("=").trim(),
                    });
                  }
                }
              }
            }
          }

          body = {
            stackId: selectedStackId,
            parameterValues: previewParams,
            memories: Object.keys(memories).length > 0 ? memories : undefined,
          };
        }

        const res = await fetch("/api/prompt/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const data = await res.json();
        if (!data.ok) throw new Error(data.error);

        setResult(data);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading...</div>
    );
  }

  return (
    <div style={{ ...theme.page, maxWidth: 1600 }}>
      <h1 style={{ ...theme.h1, fontSize: 24, marginBottom: 8 }}>
        Prompt Composition Preview
      </h1>
      <p style={{ ...theme.subtitle, marginBottom: 24 }}>
        Preview prompts using Spec-Based (new) or Stack-Based (legacy) composition
      </p>

      {error && (
        <div style={theme.errorAlert}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "400px 1fr", gap: 24 }}>
        {/* Left: Controls */}
        <div>
          {/* Engine Toggle */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Composition Engine
            </label>
            <div
              style={{
                display: "flex",
                gap: 8,
                marginTop: 6,
                padding: 4,
                background: "var(--surface-secondary)",
                borderRadius: 8,
              }}
            >
              <button
                onClick={() => setEngine("spec")}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontWeight: 500,
                  fontSize: 13,
                  background: engine === "spec" ? "#10b981" : "transparent",
                  color: engine === "spec" ? "white" : "var(--text-primary)",
                }}
              >
                Spec-Based (New)
              </button>
              <button
                onClick={() => setEngine("stack")}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontWeight: 500,
                  fontSize: 13,
                  background: engine === "stack" ? "var(--accent-primary)" : "transparent",
                  color: engine === "stack" ? "var(--accent-primary-text)" : "var(--text-primary)",
                }}
              >
                Stack-Based
              </button>
            </div>
          </div>

          {/* Mode Toggle */}
          <div
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 16,
              padding: 4,
              background: "var(--surface-secondary)",
              borderRadius: 8,
            }}
          >
            <button
              onClick={() => setMode("user")}
              style={{
                flex: 1,
                padding: "8px 16px",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontWeight: 500,
                background: mode === "user" ? "var(--accent-primary)" : "transparent",
                color: mode === "user" ? "var(--accent-primary-text)" : "var(--text-primary)",
              }}
            >
              For User
            </button>
            <button
              onClick={() => setMode("preview")}
              style={{
                flex: 1,
                padding: "8px 16px",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontWeight: 500,
                background: mode === "preview" ? "var(--accent-primary)" : "transparent",
                color: mode === "preview" ? "var(--accent-primary-text)" : "var(--text-primary)",
              }}
            >
              Preview Mode
            </button>
          </div>

          {/* Stack Selection (only for stack-based engine) */}
          {engine === "stack" && (
            <div style={{ ...theme.card, marginBottom: 16 }}>
              <label style={{ ...theme.label, fontSize: 14, fontWeight: 600, marginBottom: 8, color: "var(--text-primary)" }}>
                Prompt Stack
              </label>
              <select
                value={selectedStackId}
                onChange={(e) => setSelectedStackId(e.target.value)}
                style={{ ...theme.select, padding: "10px 12px" }}
              >
                {stacks.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.isDefault && "(Default)"} [{s.status}] ({s.itemCount} items)
                  </option>
                ))}
              </select>
            </div>
          )}

          {mode === "user" ? (
            /* User Selection */
            <div style={{ ...theme.card, marginBottom: 16 }}>
              <label style={{ ...theme.label, fontSize: 14, fontWeight: 600, marginBottom: 8, color: "var(--text-primary)" }}>
                Select User
              </label>
              {users.length === 0 ? (
                <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
                  No users with personality or memory data found.
                </div>
              ) : (
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  style={{ ...theme.select, padding: "10px 12px" }}
                >
                  <option value="">-- Select a user --</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name || u.email || u.id}
                      {u.hasPersonality && " 🧠"}
                      {u.memoryCount > 0 && ` 💭${u.memoryCount}`}
                      {u.callCount > 0 && ` 📞${u.callCount}`}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : (
            /* Preview Mode Controls */
            <>
              <div style={{ ...theme.card, marginBottom: 16 }}>
                <label style={{ ...theme.label, fontSize: 14, fontWeight: 600, marginBottom: 12, color: "var(--text-primary)" }}>
                  Parameter Values
                </label>
                {Object.entries(previewParams).map(([key, value]) => (
                  <div key={key} style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 13, color: "var(--text-primary)" }}>{key}</span>
                      <span style={{ fontSize: 13, fontFamily: "monospace", color: "var(--text-secondary)" }}>{value.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={value}
                      onChange={(e) =>
                        setPreviewParams({ ...previewParams, [key]: parseFloat(e.target.value) })
                      }
                      style={{ width: "100%" }}
                    />
                  </div>
                ))}
              </div>

              <div style={{ ...theme.card, marginBottom: 16 }}>
                <label style={{ ...theme.label, fontSize: 14, fontWeight: 600, marginBottom: 8, color: "var(--text-primary)" }}>
                  Memories (optional)
                </label>
                <textarea
                  value={previewMemories}
                  onChange={(e) => setPreviewMemories(e.target.value)}
                  placeholder={`FACT: location=London, job=Engineer\nPREFERENCE: contact=email\nTOPIC: interest=hiking`}
                  style={{
                    ...theme.textarea,
                    height: 80,
                    fontSize: 12,
                  }}
                />
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                  Format: CATEGORY: key=value, key2=value2
                </div>
              </div>
            </>
          )}

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={generating || (mode === "user" && !selectedUserId)}
            style={{
              ...theme.btnPrimary,
              width: "100%",
              padding: "14px 24px",
              fontSize: 16,
              opacity: generating || (mode === "user" && !selectedUserId) ? 0.6 : 1,
              cursor: generating || (mode === "user" && !selectedUserId) ? "not-allowed" : "pointer",
            }}
          >
            {generating ? "Generating..." : "Generate Prompt"}
          </button>
        </div>

        {/* Right: Results */}
        <div>
          {specResult ? (
            /* Spec-based results */
            <div>
              {/* Summary */}
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  marginBottom: 16,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ background: "#10b981", padding: "8px 16px", borderRadius: 8, color: "white" }}>
                  <span style={{ fontSize: 12 }}>Engine:</span>{" "}
                  <span style={{ fontWeight: 600 }}>Spec-Based</span>
                </div>
                <div style={{ background: "var(--status-success-bg)", padding: "8px 16px", borderRadius: 8, color: "var(--status-success-text)" }}>
                  <span style={{ fontSize: 12 }}>Specs Rendered:</span>{" "}
                  <span style={{ fontWeight: 600 }}>{specResult.metadata.promptsRendered}</span>
                </div>
                <div style={{ background: "var(--status-info-bg)", padding: "8px 16px", borderRadius: 8, color: "var(--status-info-text)" }}>
                  <span style={{ fontSize: 12 }}>Total Active Specs:</span>{" "}
                  <span style={{ fontWeight: 600 }}>{specResult.metadata.totalSpecs}</span>
                </div>
                {specResult.metadata.memoriesIncluded > 0 && (
                  <div style={{ background: "var(--status-warning-bg)", padding: "8px 16px", borderRadius: 8, color: "var(--status-warning-text)" }}>
                    <span style={{ fontSize: 12 }}>Memories:</span>{" "}
                    <span style={{ fontWeight: 600 }}>{specResult.metadata.memoriesIncluded}</span>
                  </div>
                )}
              </div>

              {/* Parameter values used */}
              {specResult.metadata.parameterValuesUsed && Object.keys(specResult.metadata.parameterValuesUsed).length > 0 && (
                <div
                  style={{
                    background: "var(--surface-secondary)",
                    padding: 12,
                    borderRadius: 8,
                    marginBottom: 16,
                    fontSize: 13,
                    color: "var(--text-primary)",
                  }}
                >
                  <strong>Parameters Used:</strong>{" "}
                  {Object.entries(specResult.metadata.parameterValuesUsed)
                    .map(([k, v]) => `${k}=${(v as number).toFixed(2)}`)
                    .join(", ")}
                </div>
              )}

              {/* The Combined Prompt */}
              <div
                style={{
                  ...theme.card,
                  marginBottom: 16,
                  padding: 0,
                }}
              >
                <div
                  style={{
                    padding: "12px 16px",
                    borderBottom: "1px solid var(--border-default)",
                    background: "var(--surface-secondary)",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                  }}
                >
                  Combined Prompt (from {specResult.prompts.length} specs)
                </div>
                <div
                  style={{
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
                  {specResult.prompt || (
                    <span style={{ color: "var(--text-muted)" }}>No prompt content generated</span>
                  )}
                </div>
              </div>

              {/* Individual Spec Prompts */}
              {specResult.prompts.length > 0 && (
                <div
                  style={{
                    ...theme.card,
                    padding: 0,
                  }}
                >
                  <div
                    style={{
                      padding: "12px 16px",
                      borderBottom: "1px solid var(--border-default)",
                      background: "var(--surface-secondary)",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                    }}
                  >
                    Individual Spec Prompts ({specResult.prompts.length})
                  </div>
                  <div style={{ padding: 16, maxHeight: 400, overflowY: "auto" }}>
                    {specResult.prompts.map((sp, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: 12,
                          background: "var(--surface-secondary)",
                          borderRadius: 6,
                          marginBottom: 8,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <span
                            style={{
                              padding: "2px 8px",
                              background: sp.outputType === "MEASURE" ? "#6366f1" : "#10b981",
                              color: "white",
                              borderRadius: 4,
                              fontSize: 10,
                            }}
                          >
                            {sp.outputType}
                          </span>
                          {sp.domain && (
                            <span
                              style={{
                                padding: "2px 8px",
                                background: "var(--status-info-bg)",
                                color: "var(--status-info-text)",
                                borderRadius: 4,
                                fontSize: 10,
                              }}
                            >
                              {sp.domain}
                            </span>
                          )}
                          <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{sp.specName}</span>
                          {sp.context.label && (
                            <span
                              style={{
                                padding: "2px 6px",
                                background:
                                  sp.context.label === "high" ? "#dcfce7" :
                                  sp.context.label === "low" ? "#fef2f2" : "#fef9c3",
                                color:
                                  sp.context.label === "high" ? "#166534" :
                                  sp.context.label === "low" ? "#991b1b" : "#854d0e",
                                borderRadius: 4,
                                fontSize: 10,
                                fontWeight: 600,
                              }}
                            >
                              {sp.context.label} ({sp.context.value?.toFixed(2)})
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>
                          {sp.specSlug}
                          {sp.context.parameterId && ` → ${sp.context.parameterId}`}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "var(--text-primary)",
                            background: "var(--surface-primary)",
                            padding: 8,
                            borderRadius: 4,
                            border: "1px solid var(--border-default)",
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {sp.renderedPrompt}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : result ? (
            /* Legacy stack-based results */
            <div>
              {/* Summary */}
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  marginBottom: 16,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ background: "var(--status-info-bg)", padding: "8px 16px", borderRadius: 8, color: "var(--status-info-text)" }}>
                  <span style={{ fontSize: 12 }}>Stack:</span>{" "}
                  <span style={{ fontWeight: 600 }}>{result.stackName}</span>
                </div>
                <div style={{ background: "var(--status-success-bg)", padding: "8px 16px", borderRadius: 8, color: "var(--status-success-text)" }}>
                  <span style={{ fontSize: 12 }}>Dynamic Matches:</span>{" "}
                  <span style={{ fontWeight: 600 }}>{result.matches.length}</span>
                </div>
                {result.memoryCount !== undefined && (
                  <div style={{ background: "var(--status-warning-bg)", padding: "8px 16px", borderRadius: 8, color: "var(--status-warning-text)" }}>
                    <span style={{ fontSize: 12 }}>Memories:</span>{" "}
                    <span style={{ fontWeight: 600 }}>{result.memoryCount}</span>
                  </div>
                )}
              </div>

              {/* User info if present */}
              {result.user && (
                <div
                  style={{
                    background: "var(--surface-secondary)",
                    padding: 12,
                    borderRadius: 8,
                    marginBottom: 16,
                    fontSize: 13,
                    color: "var(--text-primary)",
                  }}
                >
                  <strong>User:</strong> {result.user.name || result.user.email || result.user.id}
                  {result.parameterValues && (
                    <div style={{ marginTop: 8 }}>
                      <strong>Parameters:</strong>{" "}
                      {Object.entries(result.parameterValues)
                        .map(([k, v]) => `${k}=${(v as number).toFixed(2)}`)
                        .join(", ")}
                    </div>
                  )}
                </div>
              )}

              {/* The Generated Prompt */}
              <div
                style={{
                  ...theme.card,
                  marginBottom: 16,
                  padding: 0,
                }}
              >
                <div
                  style={{
                    padding: "12px 16px",
                    borderBottom: "1px solid var(--border-default)",
                    background: "var(--surface-secondary)",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                  }}
                >
                  Generated Prompt
                </div>
                <div
                  style={{
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
                  {result.prompt || (
                    <span style={{ color: "var(--text-muted)" }}>No prompt content generated</span>
                  )}
                </div>
              </div>

              {/* Dynamic Matches */}
              {result.matches.length > 0 && (
                <div
                  style={{
                    ...theme.card,
                    padding: 0,
                  }}
                >
                  <div
                    style={{
                      padding: "12px 16px",
                      borderBottom: "1px solid var(--border-default)",
                      background: "var(--surface-secondary)",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                    }}
                  >
                    Dynamic Prompts Matched ({result.matches.length})
                  </div>
                  <div style={{ padding: 16, maxHeight: 300, overflowY: "auto" }}>
                    {result.matches.map((match, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: 12,
                          background: "var(--surface-secondary)",
                          borderRadius: 6,
                          marginBottom: 8,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <span
                            style={{
                              padding: "2px 8px",
                              background:
                                match.sourceType === "COMPOSITE" ? "#f59e0b" : "#6366f1",
                              color: "white",
                              borderRadius: 4,
                              fontSize: 10,
                            }}
                          >
                            {match.sourceType}
                          </span>
                          <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{match.slugName}</span>
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
                        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                          {match.parameters.map((p) => (
                            <span key={p.parameterId} style={{ marginRight: 8 }}>
                              {p.parameterId}={p.value.toFixed(2)}
                            </span>
                          ))}
                          {match.effectiveValue !== undefined && (
                            <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>
                              → {match.effectiveValue.toFixed(2)}
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            marginTop: 8,
                            fontSize: 12,
                            color: "var(--text-primary)",
                            background: "var(--surface-primary)",
                            padding: 8,
                            borderRadius: 4,
                            border: "1px solid var(--border-default)",
                          }}
                        >
                          {match.promptText.substring(0, 150)}
                          {match.promptText.length > 150 && "..."}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div
              style={{
                height: "100%",
                minHeight: 400,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#f9fafb",
                borderRadius: 12,
                border: "2px dashed #e5e7eb",
              }}
            >
              <div style={{ textAlign: "center", color: "#9ca3af" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📝</div>
                <div style={{ fontSize: 16, fontWeight: 500 }}>Generated Prompt</div>
                <div style={{ fontSize: 14, marginTop: 8 }}>
                  Select a user or set parameters, then click Generate
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
