"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download, Quote, Users } from "lucide-react";

interface ParameterAvg {
  parameterId: string;
  avgScore: number;
  avgConfidence: number;
  count: number;
}

interface EvidenceQuote {
  evidence: string;
  score: number;
  confidence: number;
  callerName: string;
  callId: string;
  scoredAt: string;
}

interface CallerRow {
  callerId: string;
  name: string;
  avgScore: number;
  totalScores: number;
  callCount: number;
}

interface SpecDetail {
  spec: {
    id: string;
    slug: string;
    name: string;
    specRole: string;
  };
  totalScores: number;
  parameterAverages: ParameterAvg[];
  distribution: {
    labels: string[];
    values: number[];
  };
  evidenceQuotes: EvidenceQuote[];
  callerSummary: CallerRow[];
}

const roleColors: Record<string, string> = {
  EXTRACT: "var(--badge-blue-text)",
  SYNTHESISE: "var(--badge-purple-text)",
  ORCHESTRATE: "var(--text-muted)",
  CONSTRAIN: "var(--status-warning-text)",
  IDENTITY: "#4338ca",
  CONTENT: "#8b5cf6",
  VOICE: "var(--status-success-text)",
};

export default function TestimonySpecDetail() {
  const params = useParams();
  const searchParams = useSearchParams();
  const specId = params.specId as string;
  const domainId = searchParams.get("domainId");

  const [data, setData] = useState<SpecDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = domainId
      ? `/api/testimony/specs/${specId}?domainId=${domainId}`
      : `/api/testimony/specs/${specId}`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok) setData(d);
      })
      .finally(() => setLoading(false));
  }, [specId, domainId]);

  const handleExport = () => {
    const exportUrl = domainId
      ? `/api/testimony/export?specId=${specId}&domainId=${domainId}`
      : `/api/testimony/export?specId=${specId}`;
    window.open(exportUrl, "_blank");
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 rounded bg-[var(--surface-secondary)]" />
          <div className="h-48 rounded-lg bg-[var(--surface-secondary)]" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <p style={{ color: "var(--text-muted)" }}>Spec not found or no data available.</p>
      </div>
    );
  }

  const maxDist = Math.max(...data.distribution.values, 1);

  return (
    <div style={{ maxWidth: 960, padding: "0 0 40px" }}>
      {/* Back link */}
      <Link
        href={`/x/testimony${domainId ? `?domainId=${domainId}` : ""}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontSize: 13,
          color: "var(--text-muted)",
          textDecoration: "none",
          marginBottom: 16,
        }}
      >
        <ArrowLeft size={14} />
        Back to Testimony
      </Link>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: roleColors[data.spec.specRole] ?? "var(--text-muted)",
                padding: "2px 6px",
                borderRadius: 4,
                background: `color-mix(in srgb, ${roleColors[data.spec.specRole] ?? "var(--text-muted)"} 10%, transparent)`,
              }}
            >
              {data.spec.specRole}
            </span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
            {data.spec.name}
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: "monospace" }}>
            {data.spec.slug}
          </p>
        </div>
        <button
          onClick={handleExport}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 16px",
            background: "var(--surface-primary)",
            border: "1px solid var(--border-default)",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 500,
            color: "var(--text-secondary)",
            cursor: "pointer",
          }}
        >
          <Download size={14} />
          Download CSV
        </button>
      </div>

      {/* Summary stat */}
      <div
        style={{
          display: "flex",
          gap: 24,
          marginBottom: 32,
          padding: 16,
          background: "var(--surface-primary)",
          border: "1px solid var(--border-default)",
          borderRadius: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Total Scores</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>
            {data.totalScores}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Callers</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>
            {data.callerSummary.length}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Parameters</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>
            {data.parameterAverages.length}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 32 }}>
        {/* Score Distribution */}
        <div
          style={{
            background: "var(--surface-primary)",
            border: "1px solid var(--border-default)",
            borderRadius: 12,
            padding: 20,
          }}
        >
          <h2
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--text-primary)",
              marginBottom: 16,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Score Distribution
          </h2>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 120 }}>
            {data.distribution.values.map((val, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{val}</span>
                <div
                  style={{
                    width: "100%",
                    height: `${(val / maxDist) * 100}px`,
                    minHeight: 2,
                    background: "var(--accent-primary)",
                    borderRadius: 4,
                    transition: "height 0.3s",
                  }}
                />
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                  {data.distribution.labels[i]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Per-Parameter Averages */}
        <div
          style={{
            background: "var(--surface-primary)",
            border: "1px solid var(--border-default)",
            borderRadius: 12,
            padding: 20,
          }}
        >
          <h2
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--text-primary)",
              marginBottom: 16,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Parameter Averages
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 160, overflowY: "auto" }}>
            {data.parameterAverages.map((p) => (
              <div key={p.parameterId}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {p.parameterId.replace(/_/g, " ")}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {p.avgScore.toFixed(2)} ({p.count})
                  </span>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: "var(--surface-secondary)" }}>
                  <div
                    style={{
                      height: "100%",
                      borderRadius: 2,
                      width: `${Math.min(100, p.avgScore * 100)}%`,
                      background: "var(--accent-primary)",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Evidence Quotes */}
      {data.evidenceQuotes.length > 0 && (
        <div
          style={{
            background: "var(--surface-primary)",
            border: "1px solid var(--border-default)",
            borderRadius: 12,
            padding: 20,
            marginBottom: 32,
          }}
        >
          <h2
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--text-primary)",
              marginBottom: 16,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Top Evidence
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {data.evidenceQuotes.map((q, i) => (
              <div
                key={i}
                style={{
                  padding: 12,
                  background: "var(--surface-secondary)",
                  borderRadius: 8,
                  borderLeft: "3px solid var(--accent-primary)",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <Quote size={14} style={{ color: "var(--text-muted)", flexShrink: 0, marginTop: 2 }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.5, marginBottom: 6 }}>
                      {q.evidence}
                    </p>
                    <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--text-muted)" }}>
                      <span>{q.callerName}</span>
                      <span>Score: {q.score.toFixed(2)}</span>
                      <span>Confidence: {q.confidence.toFixed(2)}</span>
                      <span>
                        {new Date(q.scoredAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Caller Table */}
      {data.callerSummary.length > 0 && (
        <div
          style={{
            background: "var(--surface-primary)",
            border: "1px solid var(--border-default)",
            borderRadius: 12,
            padding: 20,
          }}
        >
          <h2
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--text-primary)",
              marginBottom: 16,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Callers
          </h2>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-default)" }}>
                {["Name", "Avg Score", "Scores", "Calls"].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      padding: "8px 12px",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.callerSummary.map((caller) => (
                <tr
                  key={caller.callerId}
                  style={{ borderBottom: "1px solid var(--border-subtle)" }}
                >
                  <td style={{ padding: "8px 12px" }}>
                    <Link
                      href={`/x/callers/${caller.callerId}`}
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: "var(--text-primary)",
                        textDecoration: "none",
                      }}
                    >
                      {caller.name}
                    </Link>
                  </td>
                  <td style={{ padding: "8px 12px", fontSize: 13, color: "var(--text-primary)" }}>
                    {caller.avgScore.toFixed(2)}
                  </td>
                  <td style={{ padding: "8px 12px", fontSize: 13, color: "var(--text-muted)" }}>
                    {caller.totalScores}
                  </td>
                  <td style={{ padding: "8px 12px", fontSize: 13, color: "var(--text-muted)" }}>
                    {caller.callCount}
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
