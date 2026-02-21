"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";

interface ReportData {
  classrooms: { id: string; name: string }[];
  stats: {
    totalStudents: number;
    totalCalls: number;
    callsThisWeek: number;
    activeStudents7d: number;
    engagementRate: number;
  };
  callsPerDay: { date: string; count: number }[];
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<div style={{ fontSize: 15, color: "var(--text-muted)", padding: 32 }}>Loading reports...</div>}>
      <ReportsContent />
    </Suspense>
  );
}

function ReportsContent() {
  const searchParams = useSearchParams();
  const institutionId = searchParams.get("institutionId");
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCohort, setSelectedCohort] = useState<string>("");

  const loadReports = useCallback(
    async (cohortId: string) => {
      setLoading(true);
      const params = new URLSearchParams();
      if (cohortId) params.set("cohortId", cohortId);
      if (institutionId) params.set("institutionId", institutionId);
      const qs = params.toString();
      const url = qs ? `/api/educator/reports?${qs}` : "/api/educator/reports";
      const res = await fetch(url).then((r) => r.json());
      if (res?.ok) setData(res);
      setLoading(false);
    },
    [institutionId]
  );

  useEffect(() => {
    loadReports(selectedCohort);
  }, [loadReports, selectedCohort]);

  const stats = data?.stats;

  // Simple SVG trend chart
  const renderTrendChart = () => {
    if (!data?.callsPerDay || data.callsPerDay.length === 0) return null;

    const values = data.callsPerDay.map((d) => d.count);
    const max = Math.max(...values, 1);
    const width = 600;
    const height = 140;
    const padding = { top: 10, right: 10, bottom: 24, left: 10 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const points = values.map((v, i) => ({
      x: padding.left + (i / (values.length - 1)) * chartW,
      y: padding.top + chartH - (v / max) * chartH,
    }));

    const lineD = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
    const areaD = `${lineD} L${points[points.length - 1].x},${padding.top + chartH} L${points[0].x},${padding.top + chartH} Z`;

    return (
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto" }}>
        {/* Grid */}
        {[0, 0.5, 1].map((frac) => (
          <line
            key={frac}
            x1={padding.left}
            x2={width - padding.right}
            y1={padding.top + chartH * (1 - frac)}
            y2={padding.top + chartH * (1 - frac)}
            stroke="var(--border-default)"
            strokeDasharray="4 4"
          />
        ))}
        {/* Area */}
        <path d={areaD} fill="color-mix(in srgb, var(--accent-primary) 12%, transparent)" />
        {/* Line */}
        <path d={lineD} fill="none" stroke="var(--accent-primary)" strokeWidth={2} />
        {/* Labels */}
        <text x={padding.left} y={height - 4} fontSize={10} fill="var(--text-muted)">
          {data.callsPerDay[0].date.slice(5)}
        </text>
        <text x={width - padding.right} y={height - 4} fontSize={10} fill="var(--text-muted)" textAnchor="end">
          {data.callsPerDay[data.callsPerDay.length - 1].date.slice(5)}
        </text>
      </svg>
    );
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 className="hf-page-title" style={{ marginBottom: 4 }}>
            Reports
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            Track engagement and progress across your classrooms
          </p>
        </div>
        {data?.classrooms && data.classrooms.length > 1 && (
          <select
            value={selectedCohort}
            onChange={(e) => setSelectedCohort(e.target.value)}
            style={{
              padding: "8px 12px",
              border: "1px solid var(--border-default)",
              borderRadius: 8,
              fontSize: 14,
              background: "var(--surface-secondary)",
              color: "var(--text-primary)",
              outline: "none",
            }}
          >
            <option value="">All Classrooms</option>
            {data.classrooms.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <div style={{ fontSize: 15, color: "var(--text-muted)" }}>Loading reports...</div>
      ) : !stats ? (
        <div style={{ fontSize: 15, color: "var(--text-muted)" }}>No data available.</div>
      ) : (
        <>
          {/* Stats Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
            {[
              { label: "Students", value: stats.totalStudents, color: "var(--badge-pink-text)" },
              { label: "Total Calls", value: stats.totalCalls, color: "var(--accent-primary)" },
              { label: "Calls This Week", value: stats.callsThisWeek, color: "var(--status-success-text)" },
              { label: "Active (7d)", value: stats.activeStudents7d, color: "var(--badge-purple-text)" },
              { label: "Engagement", value: `${stats.engagementRate}%`, color: "var(--badge-cyan-text)" },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  padding: 16,
                  background: "var(--surface-primary)",
                  border: "1px solid var(--border-default)",
                  borderRadius: 10,
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 24, fontWeight: 700, color: s.color, marginBottom: 4 }}>
                  {s.value}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          {/* Trend Chart */}
          <div
            style={{
              background: "var(--surface-primary)",
              border: "1px solid var(--border-default)",
              borderRadius: 12,
              padding: 20,
              marginBottom: 24,
            }}
          >
            <h3
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--text-primary)",
                marginBottom: 16,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Calls Per Day (Last 30 Days)
            </h3>
            {renderTrendChart()}
          </div>
        </>
      )}
    </div>
  );
}
