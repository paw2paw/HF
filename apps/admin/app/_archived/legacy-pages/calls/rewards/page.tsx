"use client";

import { useState, useEffect } from "react";

type RewardScore = {
  id: string;
  overallScore: number;
  clarityScore: number | null;
  empathyScore: number | null;
  resolutionScore: number | null;
  efficiencyScore: number | null;
  coherenceScore: number | null;
  modelVersion: string;
  scoredAt: string;
  scoredBy: string | null;
  customerSatisfaction: number | null;
  taskCompleted: boolean | null;
  escalated: boolean | null;
  call: {
    source: string;
    transcript: string;
  };
};

function ScoreBadge({ value, label }: { value: number | null; label: string }) {
  if (value == null) return null;
  const pct = Math.round(value * 100);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "4px 8px",
        background: pct > 66 ? "#ecfdf5" : pct > 33 ? "#fffbeb" : "#fef2f2",
        borderRadius: 4,
      }}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: pct > 66 ? "#10b981" : pct > 33 ? "#f59e0b" : "#ef4444",
        }}
      >
        {pct}%
      </div>
      <div style={{ fontSize: 9, color: "#6b7280" }}>{label}</div>
    </div>
  );
}

export default function RewardScoresPage() {
  const [scores, setScores] = useState<RewardScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/calls/rewards")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setScores(data.scores || []);
        } else {
          setError(data.error || "Failed to load scores");
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Reward Scores</h1>
        <p style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
          Multi-dimensional reward model scores for calls
        </p>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Loading...</div>
      ) : error ? (
        <div style={{ padding: 20, background: "#fef2f2", color: "#dc2626", borderRadius: 8 }}>
          {error}
        </div>
      ) : scores.length === 0 ? (
        <div
          style={{
            padding: 40,
            textAlign: "center",
            background: "#f9fafb",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏆</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#374151" }}>No reward scores yet</div>
          <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
            Run the reward model on calls to generate scores
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {scores.map((score) => (
            <div
              key={score.id}
              style={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: 16,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        fontSize: 11,
                        padding: "2px 8px",
                        background: "#e0e7ff",
                        color: "#4338ca",
                        borderRadius: 4,
                      }}
                    >
                      {score.call.source}
                    </span>
                    <span style={{ fontSize: 11, color: "#9ca3af" }}>
                      {score.modelVersion}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                    Scored {new Date(score.scoredAt).toLocaleString()}
                    {score.scoredBy && ` by ${score.scoredBy}`}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 700,
                    color: score.overallScore > 0.66 ? "#10b981" : score.overallScore > 0.33 ? "#f59e0b" : "#ef4444",
                  }}
                >
                  {Math.round(score.overallScore * 100)}%
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                <ScoreBadge value={score.clarityScore} label="Clarity" />
                <ScoreBadge value={score.empathyScore} label="Empathy" />
                <ScoreBadge value={score.resolutionScore} label="Resolution" />
                <ScoreBadge value={score.efficiencyScore} label="Efficiency" />
                <ScoreBadge value={score.coherenceScore} label="Coherence" />
              </div>

              <div style={{ display: "flex", gap: 12, fontSize: 11 }}>
                {score.customerSatisfaction != null && (
                  <span style={{ color: "#6b7280" }}>
                    CSAT: {Math.round(score.customerSatisfaction * 100)}%
                  </span>
                )}
                {score.taskCompleted != null && (
                  <span style={{ color: score.taskCompleted ? "#10b981" : "#ef4444" }}>
                    {score.taskCompleted ? "✓ Completed" : "✗ Not Completed"}
                  </span>
                )}
                {score.escalated != null && score.escalated && (
                  <span style={{ color: "#f59e0b" }}>⚠ Escalated</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
