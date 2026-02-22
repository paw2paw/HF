"use client";

import { useState, useEffect } from "react";
import { AdvancedBanner } from "@/components/shared/AdvancedBanner";
import "./ai-knowledge.css";

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

  const confidenceColor = (c: number) =>
    c >= 0.7
      ? "var(--status-success-text)"
      : c >= 0.5
      ? "var(--status-warning-text)"
      : "var(--status-error-text)";

  return (
    <div className="aik-page">
      <AdvancedBanner />
      {/* Header */}
      <div className="aik-header">
        <div>
          <h1 className="hf-page-title">
            AI Knowledge Dashboard
          </h1>
          <p className="aik-subtitle">
            What the AI has learned from user interactions
          </p>
        </div>
        <a href="/x/ai-config" className="aik-config-link">
          ⚙️ AI Config
        </a>
      </div>

      {loading ? (
        <div className="aik-loading">
          <div className="aik-spinner" />
          <p className="hf-text-muted">Loading AI knowledge...</p>
        </div>
      ) : knowledge ? (
        <>
          {/* Stats Cards */}
          <div className="aik-stats-grid">
            <div className="hf-card">
              <div className="aik-stat-label">TOTAL INTERACTIONS</div>
              <div className="aik-stat-value aik-stat-value-accent">
                {knowledge.stats.totalInteractions.toLocaleString()}
              </div>
            </div>

            <div className="hf-card">
              <div className="aik-stat-label">SUCCESS RATE</div>
              <div className="aik-stat-value aik-stat-value-success">
                {(knowledge.stats.successRate * 100).toFixed(1)}%
              </div>
            </div>

            <div className="hf-card">
              <div className="aik-stat-label">LEARNED PATTERNS</div>
              <div className="aik-stat-value aik-stat-value-purple">
                {knowledge.patterns.length}
              </div>
            </div>

            <div className="hf-card">
              <div className="aik-stat-label">AI MODELS USED</div>
              <div className="aik-stat-value-models">
                {knowledge.stats.modelsUsed || "—"}
              </div>
            </div>
          </div>

          {/* Top Call Points */}
          <div className="hf-card aik-callpoints-card">
            <h2 className="aik-callpoints-title">
              Top Call Points
            </h2>
            <div className="hf-flex-col hf-gap-md">
              {knowledge.stats.topCallPoints.map((cp, i) => (
                <div key={i} className="aik-callpoint-row">
                  <div className="aik-callpoint-rank">
                    {i + 1}
                  </div>
                  <div className="hf-flex-1">
                    <div className="aik-callpoint-name">
                      {cp.callPoint}
                    </div>
                  </div>
                  <div className="aik-callpoint-count">
                    {cp.count.toLocaleString()} interactions
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Filters */}
          <div className="aik-filter-bar">
            <div className="hf-flex-1">
              <label className="hf-label">
                CALL POINT
              </label>
              <select
                value={selectedCallPoint}
                onChange={(e) => setSelectedCallPoint(e.target.value)}
                className="aik-select"
              >
                {uniqueCallPoints.map((cp) => (
                  <option key={cp} value={cp}>
                    {cp === "all" ? "All Call Points" : cp}
                  </option>
                ))}
              </select>
            </div>

            <div className="hf-flex-1">
              <label className="hf-label">
                MIN CONFIDENCE: {(minConfidence * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={minConfidence}
                onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
                className="aik-range"
              />
            </div>

            <button onClick={loadKnowledge} className="aik-refresh-btn">
              🔄 Refresh
            </button>
          </div>

          {/* Learned Patterns */}
          <div className="aik-patterns-card">
            <div className="aik-patterns-header">
              <h2 className="aik-patterns-title">
                Learned Patterns ({filteredPatterns?.length || 0})
              </h2>
            </div>

            {filteredPatterns && filteredPatterns.length > 0 ? (
              <div className="aik-patterns-list">
                {filteredPatterns.map((pattern, i) => (
                  <div key={i} className="aik-pattern-item">
                    <div className="aik-pattern-header">
                      <div className="hf-flex-1">
                        <h3 className="aik-pattern-name">
                          {pattern.pattern.replace(/_/g, " ")}
                        </h3>
                        <div className="aik-pattern-tags">
                          <span className="aik-tag">
                            {pattern.callPoint}
                          </span>
                          {pattern.domain && (
                            <span className="aik-tag aik-tag-purple">
                              {pattern.domain}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="aik-confidence">
                        <div
                          className="aik-confidence-value"
                          style={{ color: confidenceColor(pattern.confidence) }}
                        >
                          {(pattern.confidence * 100).toFixed(0)}%
                        </div>
                        <div className="aik-confidence-label">confidence</div>
                      </div>
                    </div>

                    <div className="aik-pattern-metrics">
                      <div className="aik-metric-pill">
                        <strong>{pattern.occurrences}</strong> occurrences
                      </div>
                      <div className="aik-metric-pill">
                        <strong>{pattern.examples.length}</strong> examples
                      </div>
                    </div>

                    {pattern.examples.length > 0 && (
                      <details className="aik-examples-toggle">
                        <summary className="aik-examples-summary">
                          Show examples
                        </summary>
                        <div className="aik-examples-list">
                          {pattern.examples.slice(0, 3).map((example, j) => (
                            <div key={j} className="aik-example-item">
                              &quot;{example}&quot;
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="aik-empty">
                <div className="aik-empty-icon">🔍</div>
                <p className="aik-empty-text">
                  No patterns found with current filters
                </p>
                <p className="aik-empty-hint">
                  Try lowering the confidence threshold or selecting a different call point
                </p>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="aik-empty">
          <div className="aik-empty-icon">❌</div>
          <p className="aik-empty-text">Failed to load AI knowledge</p>
        </div>
      )}
    </div>
  );
}
