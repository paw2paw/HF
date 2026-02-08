"use client";

import { useState, useEffect } from "react";

type CallScore = {
  id: string;
  score: number | null;
  confidence: number | null;
  evidence: string | null;
  createdAt: string;
  call: {
    source: string;
    transcript: string;
  };
  parameter: {
    name: string;
    parameterId: string;
  };
  run: {
    status: string;
  };
};

export default function CallScoresPage() {
  const [scores, setScores] = useState<CallScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/calls/scores")
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
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Call Scores</h1>
        <p style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
          Parameter scores from call analysis runs
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
          <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#374151" }}>No call scores yet</div>
          <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
            Run analysis on calls to generate parameter scores
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
                  Parameter
                </th>
                <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
                  Score
                </th>
                <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
                  Confidence
                </th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
                  Call Source
                </th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
                  Evidence
                </th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
                  Created
                </th>
              </tr>
            </thead>
            <tbody>
              {scores.map((score) => (
                <tr key={score.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{score.parameter.name}</div>
                    <div style={{ fontSize: 10, color: "#9ca3af", fontFamily: "monospace" }}>
                      {score.parameter.parameterId}
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "center" }}>
                    {score.score != null ? (
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: score.score > 0.66 ? "#10b981" : score.score > 0.33 ? "#f59e0b" : "#ef4444",
                        }}
                      >
                        {(score.score * 100).toFixed(0)}%
                      </span>
                    ) : (
                      <span style={{ color: "#9ca3af" }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "center", fontSize: 12, color: "#6b7280" }}>
                    {score.confidence != null ? `${(score.confidence * 100).toFixed(0)}%` : "—"}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
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
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: "#6b7280", maxWidth: 200 }}>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {score.evidence || <span style={{ color: "#9ca3af" }}>—</span>}
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: "#6b7280" }}>
                    {new Date(score.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
