"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download, Quote, Users } from "lucide-react";
import "./testimony.css";

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
  IDENTITY: "var(--identity-accent, #4338ca)",
  CONTENT: "var(--content-accent, #8b5cf6)",
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
        <p className="tst-not-found">Spec not found or no data available.</p>
      </div>
    );
  }

  const maxDist = Math.max(...data.distribution.values, 1);

  return (
    <div className="tst-page">
      {/* Back link */}
      <Link
        href={`/x/testimony${domainId ? `?domainId=${domainId}` : ""}`}
        className="tst-back-link"
      >
        <ArrowLeft size={14} />
        Back to Testimony
      </Link>

      {/* Header */}
      <div className="tst-header">
        <div>
          <div className="hf-flex hf-items-center hf-gap-sm hf-mb-sm">
            <span
              className="tst-role-badge"
              style={{
                color: roleColors[data.spec.specRole] ?? "var(--text-muted)",
                background: `color-mix(in srgb, ${roleColors[data.spec.specRole] ?? "var(--text-muted)"} 10%, transparent)`,
              }}
            >
              {data.spec.specRole}
            </span>
          </div>
          <h1 className="hf-page-title tst-title-row">
            {data.spec.name}
            <span className="hf-gf-badge">GF</span>
          </h1>
          <p className="tst-slug">
            {data.spec.slug}
          </p>
        </div>
        <button onClick={handleExport} className="tst-export-btn">
          <Download size={14} />
          Download CSV
        </button>
      </div>

      {/* Summary stat */}
      <div className="tst-summary-bar">
        <div>
          <div className="tst-stat-label">Total Scores</div>
          <div className="tst-stat-value">{data.totalScores}</div>
        </div>
        <div>
          <div className="tst-stat-label">Callers</div>
          <div className="tst-stat-value">{data.callerSummary.length}</div>
        </div>
        <div>
          <div className="tst-stat-label">Parameters</div>
          <div className="tst-stat-value">{data.parameterAverages.length}</div>
        </div>
      </div>

      <div className="tst-grid-2">
        {/* Score Distribution */}
        <div className="tst-panel">
          <h2 className="tst-panel-heading">Score Distribution</h2>
          <div className="tst-chart-bars">
            {data.distribution.values.map((val, i) => (
              <div key={i} className="tst-bar-col">
                <span className="tst-bar-value">{val}</span>
                <div
                  className="tst-bar-fill"
                  style={{ height: `${(val / maxDist) * 100}px` }}
                />
                <span className="tst-bar-label">
                  {data.distribution.labels[i]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Per-Parameter Averages */}
        <div className="tst-panel">
          <h2 className="tst-panel-heading">Parameter Averages</h2>
          <div className="tst-param-list">
            {data.parameterAverages.map((p) => (
              <div key={p.parameterId}>
                <div className="tst-param-header">
                  <span className="tst-param-name">
                    {p.parameterId.replace(/_/g, " ")}
                  </span>
                  <span className="tst-param-score">
                    {p.avgScore.toFixed(2)} ({p.count})
                  </span>
                </div>
                <div className="tst-progress-track">
                  <div
                    className="tst-progress-fill"
                    style={{ width: `${Math.min(100, p.avgScore * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Evidence Quotes */}
      {data.evidenceQuotes.length > 0 && (
        <div className="tst-panel tst-evidence-section">
          <h2 className="tst-panel-heading">Top Evidence</h2>
          <div className="tst-evidence-list">
            {data.evidenceQuotes.map((q, i) => (
              <div key={i} className="tst-evidence-card">
                <div className="tst-evidence-inner">
                  <Quote size={14} className="tst-quote-icon" />
                  <div className="hf-flex-1">
                    <p className="tst-evidence-text">
                      {q.evidence}
                    </p>
                    <div className="tst-evidence-meta">
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
        <div className="tst-panel">
          <h2 className="tst-panel-heading">Callers</h2>
          <table className="tst-table">
            <thead>
              <tr className="tst-thead-row">
                {["Name", "Avg Score", "Scores", "Calls"].map((h) => (
                  <th key={h} className="tst-th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.callerSummary.map((caller) => (
                <tr key={caller.callerId} className="tst-tr">
                  <td className="tst-td">
                    <Link
                      href={`/x/callers/${caller.callerId}`}
                      className="tst-caller-link"
                    >
                      {caller.name}
                    </Link>
                  </td>
                  <td className="tst-td">
                    {caller.avgScore.toFixed(2)}
                  </td>
                  <td className="tst-td-muted">
                    {caller.totalScores}
                  </td>
                  <td className="tst-td-muted">
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
