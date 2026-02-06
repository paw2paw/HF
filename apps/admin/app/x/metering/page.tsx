"use client";

import { useState, useEffect } from "react";

// Category colors
const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  AI: { bg: "#dbeafe", text: "#1d4ed8", border: "#93c5fd" },
  DATABASE: { bg: "#fef3c7", text: "#b45309", border: "#fcd34d" },
  COMPUTE: { bg: "#d1fae5", text: "#047857", border: "#6ee7b7" },
  STORAGE: { bg: "#e0e7ff", text: "#4338ca", border: "#a5b4fc" },
  EXTERNAL: { bg: "#fce7f3", text: "#be185d", border: "#f9a8d4" },
};

interface SummaryData {
  period: { days: number; startDate: string; endDate: string };
  totals: { eventCount: number; totalCostCents: number; totalCostDollars: string };
  today: { eventCount: number; costCents: number; costDollars: string };
  monthToDate: { eventCount: number; costCents: number; costDollars: string };
  byCategory: Array<{
    category: string;
    eventCount: number;
    totalQty: number;
    costCents: number;
    costDollars: string;
  }>;
  topOperations: Array<{
    category: string;
    operation: string;
    eventCount: number;
    totalQty: number;
    costCents: number;
    costDollars: string;
  }>;
  dailyTrend: Array<{
    date: string;
    category: string;
    eventCount: number;
    totalQty: number;
    costCents: number;
  }>;
}

interface RecentEvent {
  id: string;
  category: string;
  operation: string;
  quantity: number;
  unitType: string;
  costCents: number;
  createdAt: string;
  userId: string | null;
  callerId: string | null;
}

export default function MeteringPage() {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  // Fetch data
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const [summaryRes, eventsRes] = await Promise.all([
          fetch(`/api/metering/summary?days=${days}`),
          fetch("/api/metering/events?limit=50"),
        ]);

        const summaryData = await summaryRes.json();
        const eventsData = await eventsRes.json();

        if (summaryData.ok) {
          setSummary(summaryData);
        } else {
          setError(summaryData.error || "Failed to fetch summary");
        }

        if (eventsData.ok) {
          setRecentEvents(eventsData.events);
        }
      } catch (err) {
        setError("Failed to fetch metering data");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [days]);

  if (loading) {
    return (
      <div style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
        <div style={{ textAlign: "center", padding: 60 }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>Loading...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 8,
            padding: 16,
            color: "#dc2626",
          }}
        >
          Error: {error}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Resource Metering</h1>
        <p style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
          Track usage and costs across AI, database, compute, storage, and external services
        </p>
      </div>

      {/* Period Selector */}
      <div style={{ marginBottom: 20, display: "flex", gap: 8 }}>
        {[7, 30, 90].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              border: days === d ? "2px solid #3b82f6" : "1px solid #e5e7eb",
              background: days === d ? "#eff6ff" : "white",
              fontWeight: days === d ? 600 : 400,
              cursor: "pointer",
            }}
          >
            {d} days
          </button>
        ))}
      </div>

      {/* Summary Cards Row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {/* Total Cost Card */}
        <div
          style={{
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 20,
          }}
        >
          <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>
            Total Cost ({days}d)
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#111827" }}>
            ${summary?.totals.totalCostDollars || "0.00"}
          </div>
          <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
            {summary?.totals.eventCount.toLocaleString() || 0} events
          </div>
        </div>

        {/* Today Card */}
        <div
          style={{
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 20,
          }}
        >
          <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>Today</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#111827" }}>
            ${summary?.today.costDollars || "0.00"}
          </div>
          <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
            {summary?.today.eventCount.toLocaleString() || 0} events
          </div>
        </div>

        {/* MTD Card */}
        <div
          style={{
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 20,
          }}
        >
          <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>
            Month to Date
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#111827" }}>
            ${summary?.monthToDate.costDollars || "0.00"}
          </div>
          <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
            {summary?.monthToDate.eventCount.toLocaleString() || 0} events
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        {(summary?.byCategory || []).map((cat) => {
          const colors = CATEGORY_COLORS[cat.category] || CATEGORY_COLORS.AI;
          return (
            <div
              key={cat.category}
              style={{
                background: colors.bg,
                border: `1px solid ${colors.border}`,
                borderRadius: 10,
                padding: 16,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: colors.text,
                  marginBottom: 4,
                }}
              >
                {cat.category}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: colors.text }}>
                ${cat.costDollars}
              </div>
              <div style={{ fontSize: 11, color: colors.text, opacity: 0.8 }}>
                {cat.eventCount.toLocaleString()} events
              </div>
            </div>
          );
        })}

        {/* Show placeholder if no data */}
        {(!summary?.byCategory || summary.byCategory.length === 0) && (
          <div
            style={{
              gridColumn: "1 / -1",
              textAlign: "center",
              padding: 40,
              color: "#9ca3af",
            }}
          >
            No usage data yet. Start using AI, running pipelines, or processing
            transcripts to see metering data.
          </div>
        )}
      </div>

      {/* Two Column Layout: Top Operations + Recent Events */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* Top Operations */}
        <div
          style={{
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 20,
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
            Top Operations by Cost
          </h2>
          {(summary?.topOperations || []).length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {summary?.topOperations.map((op, i) => {
                const colors = CATEGORY_COLORS[op.category] || CATEGORY_COLORS.AI;
                return (
                  <div
                    key={`${op.category}-${op.operation}-${i}`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 12px",
                      background: "#f9fafb",
                      borderRadius: 6,
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          color: colors.text,
                          background: colors.bg,
                          padding: "2px 6px",
                          borderRadius: 4,
                          marginRight: 8,
                        }}
                      >
                        {op.category}
                      </span>
                      <span style={{ fontSize: 13 }}>{op.operation}</span>
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>${op.costDollars}</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ color: "#9ca3af", textAlign: "center", padding: 20 }}>
              No operations recorded yet
            </div>
          )}
        </div>

        {/* Recent Events */}
        <div
          style={{
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 20,
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
            Recent Events
          </h2>
          {recentEvents.length > 0 ? (
            <div
              style={{
                maxHeight: 400,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {recentEvents.map((event) => {
                const colors = CATEGORY_COLORS[event.category] || CATEGORY_COLORS.AI;
                return (
                  <div
                    key={event.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "6px 10px",
                      background: "#f9fafb",
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 600,
                          color: colors.text,
                          background: colors.bg,
                          padding: "1px 4px",
                          borderRadius: 3,
                        }}
                      >
                        {event.category}
                      </span>
                      <span style={{ color: "#374151" }}>{event.operation}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ color: "#6b7280" }}>
                        {event.quantity.toLocaleString()} {event.unitType}
                      </span>
                      <span style={{ fontWeight: 500 }}>
                        {(event.costCents / 100).toFixed(4)}
                      </span>
                      <span style={{ color: "#9ca3af", fontSize: 10 }}>
                        {new Date(event.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ color: "#9ca3af", textAlign: "center", padding: 20 }}>
              No events recorded yet
            </div>
          )}
        </div>
      </div>

      {/* Info Box */}
      <div
        style={{
          marginTop: 24,
          padding: 16,
          background: "#f0f9ff",
          border: "1px solid #bae6fd",
          borderRadius: 8,
          fontSize: 13,
          color: "#0369a1",
        }}
      >
        <strong>Note:</strong> Usage is tracked automatically when you use AI features,
        run pipeline operations, or execute queries. Run{" "}
        <code style={{ background: "#e0f2fe", padding: "1px 4px", borderRadius: 3 }}>
          metering:rollup
        </code>{" "}
        via Ops to aggregate data into period summaries. Events are retained for 30 days.
      </div>
    </div>
  );
}
