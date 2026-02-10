"use client";

import { useApi } from "@/hooks/useApi";

type AnalysisRun = {
  id: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  createdAt: string;
  parameterSet: {
    name: string;
    _count?: { parameters: number };
  };
  _count?: {
    scores: number;
  };
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  QUEUED: { bg: "#f3f4f6", text: "#6b7280" },
  RUNNING: { bg: "#dbeafe", text: "#2563eb" },
  SUCCEEDED: { bg: "#ecfdf5", text: "#10b981" },
  FAILED: { bg: "#fef2f2", text: "#dc2626" },
};

export default function AnalysisRunsPage() {
  const { data: runs, loading, error } = useApi<AnalysisRun[]>(
    "/api/analysis-runs",
    { transform: (res) => (res.runs as AnalysisRun[]) || [] }
  );

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Analysis Runs</h1>
        <p style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
          Call analysis execution history
        </p>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Loading...</div>
      ) : error ? (
        <div style={{ padding: 20, background: "#fef2f2", color: "#dc2626", borderRadius: 8 }}>
          {error}
        </div>
      ) : (runs || []).length === 0 ? (
        <div
          style={{
            padding: 40,
            textAlign: "center",
            background: "#f9fafb",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔬</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#374151" }}>No analysis runs yet</div>
          <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
            Start an analysis run to score calls
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
                  Parameter Set
                </th>
                <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
                  Status
                </th>
                <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
                  Scores
                </th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
                  Started
                </th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
                  Duration
                </th>
              </tr>
            </thead>
            <tbody>
              {(runs || []).map((run) => {
                const statusStyle = STATUS_COLORS[run.status] || STATUS_COLORS.QUEUED;
                const duration =
                  run.finishedAt && run.startedAt
                    ? Math.round((new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)
                    : null;
                return (
                  <tr key={run.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{run.parameterSet.name}</div>
                      <div style={{ fontSize: 10, color: "#9ca3af" }}>
                        {run.parameterSet._count?.parameters || 0} parameters
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      <span
                        style={{
                          fontSize: 10,
                          padding: "2px 8px",
                          background: statusStyle.bg,
                          color: statusStyle.text,
                          borderRadius: 4,
                          fontWeight: 600,
                        }}
                      >
                        {run.status}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center", fontSize: 14 }}>
                      {run._count?.scores || 0}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: "#6b7280" }}>
                      {new Date(run.startedAt).toLocaleString()}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: "#6b7280" }}>
                      {duration != null ? `${duration}s` : run.status === "RUNNING" ? "In progress..." : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
