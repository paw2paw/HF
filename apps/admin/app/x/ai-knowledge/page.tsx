"use client";

import { useState, useEffect } from "react";
import { AdvancedBanner } from "@/components/shared/AdvancedBanner";

interface LearnedPattern {
  pattern: string;
  confidence: number;
  occurrences: number;
  examples: string[];
  domain?: string;
  callPoint: string;
}

interface KnowledgeStats {
  totalInteractions: number;
  successRate: number;
  topCallPoints: Array<{ callPoint: string; count: number }>;
  modelsUsed?: string;
}

interface KnowledgeData {
  patterns: LearnedPattern[];
  stats: KnowledgeStats;
}

export default function AIKnowledgePage() {
  const [loading, setLoading] = useState(true);
  const [knowledge, setKnowledge] = useState<KnowledgeData | null>(null);
  const [selectedCallPoint, setSelectedCallPoint] = useState<string>("all");
  const [minConfidence, setMinConfidence] = useState(0.5);

  useEffect(() => {
    loadKnowledge();
  }, []);

  const loadKnowledge = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/knowledge");
      const data = await res.json();
      if (data.ok) {
        setKnowledge(data.knowledge);
      }
    } catch (error) {
      console.error("Failed to load AI knowledge:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredPatterns = knowledge?.patterns.filter((p) => {
    if (selectedCallPoint !== "all" && p.callPoint !== selectedCallPoint) return false;
    if (p.confidence < minConfidence) return false;
    return true;
  });

  const callPoints = knowledge?.stats.topCallPoints.map((cp) => cp.callPoint) || [];
  const uniqueCallPoints = ["all", ...new Set(callPoints)];

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface-secondary)", padding: 24 }}>
      <AdvancedBanner />
      {/* Header */}
      <div style={{ marginBottom: 32, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 className="hf-page-title">
            AI Knowledge Dashboard
          </h1>
          <p style={{ fontSize: 16, color: "var(--text-secondary)", marginTop: 8 }}>
            What the AI has learned from user interactions
          </p>
        </div>
        <a
          href="/x/ai-config"
          style={{
            padding: "12px 24px",
            fontSize: 14,
            fontWeight: 600,
            borderRadius: 10,
            border: "1px solid var(--border-default)",
            background: "var(--surface-primary)",
            color: "var(--text-primary)",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 8,
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--surface-secondary)";
            e.currentTarget.style.borderColor = "var(--accent-primary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--surface-primary)";
            e.currentTarget.style.borderColor = "var(--border-default)";
          }}
        >
          ⚙️ AI Config
        </a>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 80 }}>
          <div
            style={{
              width: 60,
              height: 60,
              margin: "0 auto 24px",
              border: "4px solid var(--border-default)",
              borderTopColor: "var(--accent-primary)",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }}
          />
          <p style={{ color: "var(--text-muted)" }}>Loading AI knowledge...</p>
        </div>
      ) : knowledge ? (
        <>
          {/* Stats Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20, marginBottom: 32 }}>
            <div
              style={{
                background: "var(--surface-primary)",
                border: "1px solid var(--border-default)",
                borderRadius: 16,
                padding: 24,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8 }}>
                TOTAL INTERACTIONS
              </div>
              <div style={{ fontSize: 36, fontWeight: 800, color: "var(--accent-primary)" }}>
                {knowledge.stats.totalInteractions.toLocaleString()}
              </div>
            </div>

            <div
              style={{
                background: "var(--surface-primary)",
                border: "1px solid var(--border-default)",
                borderRadius: 16,
                padding: 24,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8 }}>
                SUCCESS RATE
              </div>
              <div style={{ fontSize: 36, fontWeight: 800, color: "var(--status-success-text)" }}>
                {(knowledge.stats.successRate * 100).toFixed(1)}%
              </div>
            </div>

            <div
              style={{
                background: "var(--surface-primary)",
                border: "1px solid var(--border-default)",
                borderRadius: 16,
                padding: 24,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8 }}>
                LEARNED PATTERNS
              </div>
              <div style={{ fontSize: 36, fontWeight: 800, color: "var(--badge-purple-text)" }}>
                {knowledge.patterns.length}
              </div>
            </div>

            <div
              style={{
                background: "var(--surface-primary)",
                border: "1px solid var(--border-default)",
                borderRadius: 16,
                padding: 24,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8 }}>
                AI MODELS USED
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)" }}>
                {knowledge.stats.modelsUsed || "—"}
              </div>
            </div>
          </div>

          {/* Top Call Points */}
          <div
            style={{
              background: "var(--surface-primary)",
              border: "1px solid var(--border-default)",
              borderRadius: 16,
              padding: 24,
              marginBottom: 32,
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>
              Top Call Points
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {knowledge.stats.topCallPoints.map((cp, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: "var(--accent-primary)",
                      color: "white",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                      fontWeight: 700,
                    }}
                  >
                    {i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                      {cp.callPoint}
                    </div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-muted)" }}>
                    {cp.count.toLocaleString()} interactions
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Filters */}
          <div
            style={{
              background: "var(--surface-primary)",
              border: "1px solid var(--border-default)",
              borderRadius: 16,
              padding: 20,
              marginBottom: 20,
              display: "flex",
              gap: 16,
              alignItems: "center",
            }}
          >
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
                CALL POINT
              </label>
              <select
                value={selectedCallPoint}
                onChange={(e) => setSelectedCallPoint(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  fontSize: 14,
                  borderRadius: 8,
                  border: "1px solid var(--border-default)",
                  background: "var(--surface-secondary)",
                  color: "var(--text-primary)",
                }}
              >
                {uniqueCallPoints.map((cp) => (
                  <option key={cp} value={cp}>
                    {cp === "all" ? "All Call Points" : cp}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
                MIN CONFIDENCE: {(minConfidence * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={minConfidence}
                onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
                style={{ width: "100%" }}
              />
            </div>

            <button
              onClick={loadKnowledge}
              style={{
                padding: "10px 20px",
                fontSize: 14,
                fontWeight: 600,
                borderRadius: 8,
                border: "1px solid var(--border-default)",
                background: "var(--surface-secondary)",
                color: "var(--text-primary)",
                cursor: "pointer",
                alignSelf: "flex-end",
              }}
            >
              🔄 Refresh
            </button>
          </div>

          {/* Learned Patterns */}
          <div
            style={{
              background: "var(--surface-primary)",
              border: "1px solid var(--border-default)",
              borderRadius: 16,
              overflow: "hidden",
            }}
          >
            <div style={{ padding: 24, borderBottom: "1px solid var(--border-default)" }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                Learned Patterns ({filteredPatterns?.length || 0})
              </h2>
            </div>

            {filteredPatterns && filteredPatterns.length > 0 ? (
              <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
                {filteredPatterns.map((pattern, i) => (
                  <div
                    key={i}
                    style={{
                      padding: 20,
                      background: "var(--surface-secondary)",
                      border: "1px solid var(--border-default)",
                      borderRadius: 12,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                          {pattern.pattern.replace(/_/g, " ")}
                        </h3>
                        <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              padding: "2px 8px",
                              borderRadius: 4,
                              background: "var(--surface-tertiary)",
                              color: "var(--text-muted)",
                            }}
                          >
                            {pattern.callPoint}
                          </span>
                          {pattern.domain && (
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                padding: "2px 8px",
                                borderRadius: 4,
                                background: "color-mix(in srgb, var(--badge-purple-text) 10%, transparent)",
                                color: "var(--badge-purple-text)",
                              }}
                            >
                              {pattern.domain}
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <div
                          style={{
                            fontSize: 24,
                            fontWeight: 800,
                            color:
                              pattern.confidence >= 0.7
                                ? "var(--status-success-text)"
                                : pattern.confidence >= 0.5
                                ? "var(--status-warning-text)"
                                : "var(--status-error-text)",
                          }}
                        >
                          {(pattern.confidence * 100).toFixed(0)}%
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>confidence</div>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
                      <div
                        style={{
                          padding: "8px 12px",
                          background: "var(--surface-tertiary)",
                          borderRadius: 8,
                          fontSize: 12,
                          color: "var(--text-secondary)",
                        }}
                      >
                        <strong>{pattern.occurrences}</strong> occurrences
                      </div>
                      <div
                        style={{
                          padding: "8px 12px",
                          background: "var(--surface-tertiary)",
                          borderRadius: 8,
                          fontSize: 12,
                          color: "var(--text-secondary)",
                        }}
                      >
                        <strong>{pattern.examples.length}</strong> examples
                      </div>
                    </div>

                    {pattern.examples.length > 0 && (
                      <details style={{ marginTop: 12 }}>
                        <summary
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: "var(--text-muted)",
                            cursor: "pointer",
                            userSelect: "none",
                          }}
                        >
                          Show examples
                        </summary>
                        <div style={{ marginTop: 8, paddingLeft: 12, borderLeft: "2px solid var(--border-default)" }}>
                          {pattern.examples.slice(0, 3).map((example, j) => (
                            <div
                              key={j}
                              style={{
                                fontSize: 12,
                                color: "var(--text-secondary)",
                                marginTop: 4,
                                fontStyle: "italic",
                              }}
                            >
                              "{example}"
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: 80, textAlign: "center" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
                <p style={{ fontSize: 16, color: "var(--text-muted)" }}>
                  No patterns found with current filters
                </p>
                <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 8 }}>
                  Try lowering the confidence threshold or selecting a different call point
                </p>
              </div>
            )}
          </div>
        </>
      ) : (
        <div style={{ textAlign: "center", padding: 80 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
          <p style={{ fontSize: 16, color: "var(--text-muted)" }}>Failed to load AI knowledge</p>
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
