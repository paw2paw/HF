"use client";

import { useState, useMemo } from "react";
import { useApiParallel } from "@/hooks/useApi";

// Category colors
const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  AI: { bg: "#dbeafe", text: "#1d4ed8", border: "#93c5fd" },
  DATABASE: { bg: "#fef3c7", text: "#b45309", border: "#fcd34d" },
  COMPUTE: { bg: "#d1fae5", text: "#047857", border: "#6ee7b7" },
  STORAGE: { bg: "#e0e7ff", text: "#4338ca", border: "#a5b4fc" },
  EXTERNAL: { bg: "#fce7f3", text: "#be185d", border: "#f9a8d4" },
};

// AI Provider colors - distinct dots for each provider
const PROVIDER_COLORS: Record<string, { dot: string; bg: string; text: string; border: string; label: string }> = {
  anthropic: { dot: "#8b5cf6", bg: "#f3e8ff", text: "#7c3aed", border: "#c4b5fd", label: "Claude" },
  openai: { dot: "#10b981", bg: "#d1fae5", text: "#059669", border: "#6ee7b7", label: "OpenAI" },
  mock: { dot: "#9ca3af", bg: "#f3f4f6", text: "#6b7280", border: "#d1d5db", label: "Mock" },
  unknown: { dot: "#3b82f6", bg: "#dbeafe", text: "#1d4ed8", border: "#93c5fd", label: "Other" },
};

// Helper: Derive provider from model name or engine
function getProvider(model?: string | null, engine?: string | null): string {
  const m = (model || "").toLowerCase();
  const e = (engine || "").toLowerCase();

  if (e === "mock" || m.includes("mock")) return "mock";
  if (m.startsWith("claude") || m.includes("anthropic") || e === "anthropic") return "anthropic";
  if (m.startsWith("gpt") || m.startsWith("o1") || m.includes("openai") || e === "openai") return "openai";
  return "unknown";
}

// Provider dot component
function ProviderDot({ provider, size = 8 }: { provider: string; size?: number }) {
  const colors = PROVIDER_COLORS[provider] || PROVIDER_COLORS.unknown;
  return (
    <span
      title={colors.label}
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: "50%",
        backgroundColor: colors.dot,
        flexShrink: 0,
      }}
    />
  );
}

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
  aiByCallPoint?: Array<{
    callPoint: string;
    model: string;
    eventCount: number;
    totalTokens: number;
    costCents: number;
    costDollars: string;
  }>;
  uncategorizedAI?: {
    eventCount: number;
    totalTokens: number;
    costCents: number;
    costDollars: string;
  };
  aiByEngine?: Array<{
    engine: string;
    eventCount: number;
    totalQty: number;
    costCents: number;
    costDollars: string;
    isMock: boolean;
  }>;
  aiSummary?: {
    mock: { eventCount: number; costCents: number; costDollars: string };
    real: { eventCount: number; totalTokens: number; costCents: number; costDollars: string };
    mockPercentage: number;
  };
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
  model?: string | null;
  engine?: string | null;
}

export default function MeteringPage() {
  const [days, setDays] = useState(30);

  // Fetch summary and events in parallel
  const { data, loading, error } = useApiParallel<{
    summary: SummaryData;
    events: RecentEvent[];
  }>(
    {
      summary: {
        url: `/api/metering/summary?days=${days}`,
        transform: (res) => res as unknown as SummaryData,
      },
      events: {
        url: "/api/metering/events?limit=50",
        transform: (res) => (res.events as RecentEvent[]) || [],
      },
    },
    [days]
  );

  const summary = data.summary;
  const recentEvents = data.events || [];

  // Compute provider breakdown from aiByCallPoint
  const providerBreakdown = useMemo(() => {
    if (!summary?.aiByCallPoint) return [];

    const byProvider: Record<string, { eventCount: number; costCents: number; tokens: number }> = {};

    for (const cp of summary.aiByCallPoint) {
      const provider = getProvider(cp.model);
      if (!byProvider[provider]) {
        byProvider[provider] = { eventCount: 0, costCents: 0, tokens: 0 };
      }
      byProvider[provider].eventCount += cp.eventCount;
      byProvider[provider].costCents += cp.costCents;
      byProvider[provider].tokens += cp.totalTokens;
    }

    // Also include mock from aiByEngine if not in callPoints
    if (summary.aiByEngine) {
      for (const eng of summary.aiByEngine) {
        const provider = eng.engine === "mock" ? "mock" : getProvider(null, eng.engine);
        if (!byProvider[provider]) {
          byProvider[provider] = { eventCount: 0, costCents: 0, tokens: 0 };
        }
        // Only add if not already counted (engine-level might overlap)
      }
    }

    return Object.entries(byProvider)
      .map(([provider, data]) => ({
        provider,
        ...data,
        costDollars: (data.costCents / 100).toFixed(2),
      }))
      .sort((a, b) => b.costCents - a.costCents);
  }, [summary]);

  // Total AI cost for percentage calculation
  const totalAICost = useMemo(() => {
    return providerBreakdown.reduce((sum, p) => sum + p.costCents, 0);
  }, [providerBreakdown]);

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
            background: "var(--status-error-bg)",
            border: "1px solid var(--status-error-border)",
            borderRadius: 8,
            padding: 16,
            color: "var(--status-error-text)",
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
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>Resource Metering</h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
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
              border: days === d ? "2px solid var(--button-primary-bg)" : "1px solid var(--border-default)",
              background: days === d ? "var(--status-info-bg)" : "var(--surface-primary)",
              color: "var(--text-primary)",
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
            background: "var(--surface-primary)",
            border: "1px solid var(--border-default)",
            borderRadius: 12,
            padding: 20,
          }}
        >
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>
            Total Cost ({days}d)
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)" }}>
            ${summary?.totals.totalCostDollars || "0.00"}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
            {summary?.totals.eventCount.toLocaleString() || 0} events
          </div>
        </div>

        {/* Today Card */}
        <div
          style={{
            background: "var(--surface-primary)",
            border: "1px solid var(--border-default)",
            borderRadius: 12,
            padding: 20,
          }}
        >
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>Today</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)" }}>
            ${summary?.today.costDollars || "0.00"}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
            {summary?.today.eventCount.toLocaleString() || 0} events
          </div>
        </div>

        {/* MTD Card */}
        <div
          style={{
            background: "var(--surface-primary)",
            border: "1px solid var(--border-default)",
            borderRadius: 12,
            padding: 20,
          }}
        >
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>
            Month to Date
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)" }}>
            ${summary?.monthToDate.costDollars || "0.00"}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
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
              color: "var(--text-muted)",
            }}
          >
            No usage data yet. Start using AI, running pipelines, or processing
            transcripts to see metering data.
          </div>
        )}
      </div>

      {/* AI Usage Section */}
      {((summary?.aiByCallPoint?.length ?? 0) > 0 || providerBreakdown.length > 0) && (
        <div
          style={{
            background: "var(--surface-primary)",
            border: "1px solid var(--status-info-border)",
            borderRadius: 12,
            padding: 20,
            marginBottom: 24,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: "#1d4ed8" }}>
              AI Usage
            </h2>
            <a
              href="/x/ai-config"
              style={{
                fontSize: 12,
                color: "#3b82f6",
                textDecoration: "none",
              }}
            >
              Configure Models &rarr;
            </a>
          </div>

          {/* Mock vs Real Summary */}
          {summary?.aiSummary && (summary.aiSummary.mock.eventCount > 0 || summary.aiSummary.real.eventCount > 0) && (
            <div
              style={{
                marginBottom: 20,
                padding: 16,
                background: summary.aiSummary.mockPercentage > 50 ? "#fef3c7" : "#d1fae5",
                border: `1px solid ${summary.aiSummary.mockPercentage > 50 ? "#fcd34d" : "#6ee7b7"}`,
                borderRadius: 10,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: summary.aiSummary.mockPercentage > 50 ? "#92400e" : "#047857", marginBottom: 4 }}>
                    {summary.aiSummary.mockPercentage > 50 ? "⚠️ Mostly Mock Calls" : "✓ Real AI Calls"}
                  </div>
                  <div style={{ fontSize: 12, color: summary.aiSummary.mockPercentage > 50 ? "#a16207" : "#059669" }}>
                    {summary.aiSummary.real.eventCount.toLocaleString()} real calls (${summary.aiSummary.real.costDollars})
                    {summary.aiSummary.mock.eventCount > 0 && (
                      <span> &middot; {summary.aiSummary.mock.eventCount.toLocaleString()} mock calls ($0.00)</span>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: summary.aiSummary.mockPercentage > 50 ? "#b45309" : "#047857" }}>
                    {100 - summary.aiSummary.mockPercentage}%
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>real calls</div>
                </div>
              </div>
              {summary.aiSummary.mockPercentage > 0 && (
                <div style={{ marginTop: 10, height: 6, background: "var(--surface-tertiary)", borderRadius: 3, overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${100 - summary.aiSummary.mockPercentage}%`,
                      background: summary.aiSummary.mockPercentage > 50 ? "#fbbf24" : "#10b981",
                      borderRadius: 3,
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Provider Summary Cards */}
          {providerBreakdown.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 10 }}>
                By Provider
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                {providerBreakdown.map((p) => {
                  const colors = PROVIDER_COLORS[p.provider] || PROVIDER_COLORS.unknown;
                  const pct = totalAICost > 0 ? Math.round((p.costCents / totalAICost) * 100) : 0;
                  return (
                    <div
                      key={p.provider}
                      style={{
                        background: colors.bg,
                        border: `1px solid ${colors.border}`,
                        borderRadius: 8,
                        padding: "12px 16px",
                        minWidth: 140,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <ProviderDot provider={p.provider} size={10} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: colors.text }}>
                          {colors.label}
                        </span>
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: colors.text }}>
                        ${p.costDollars}
                      </div>
                      <div style={{ fontSize: 11, color: colors.text, opacity: 0.8 }}>
                        {pct}% &middot; {p.eventCount.toLocaleString()} calls
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* By Call Point */}
          {(summary?.aiByCallPoint?.length ?? 0) > 0 && (
            <>
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 10 }}>
                By Call Point
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                  gap: 10,
                }}
              >
                {summary?.aiByCallPoint?.map((cp, i) => {
                  const provider = getProvider(cp.model);
                  const colors = PROVIDER_COLORS[provider] || PROVIDER_COLORS.unknown;
                  return (
                    <div
                      key={`${cp.callPoint}-${cp.model}-${i}`}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "10px 14px",
                        background: "var(--surface-secondary)",
                        borderRadius: 8,
                        border: "1px solid var(--border-default)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flex: 1 }}>
                        <ProviderDot provider={provider} size={8} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
                            {cp.callPoint}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                            <span style={{ color: colors.text, fontWeight: 500 }}>{colors.label}</span>
                            {" · "}
                            {cp.model}
                            {" · "}
                            {cp.eventCount.toLocaleString()} calls
                            {" · "}
                            {Math.round(cp.totalTokens).toLocaleString()} tokens
                          </div>
                        </div>
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)", marginLeft: 12 }}>
                        ${cp.costDollars}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Uncategorized AI Warning */}
          {(summary?.uncategorizedAI?.eventCount ?? 0) > 0 && (
            <div
              style={{
                marginTop: 16,
                padding: 12,
                background: "#fef3c7",
                border: "1px solid #fcd34d",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <span style={{ fontSize: 18 }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "#92400e" }}>
                  Uncategorized AI Usage
                </div>
                <div style={{ fontSize: 12, color: "#a16207", marginTop: 2 }}>
                  {summary?.uncategorizedAI?.eventCount.toLocaleString()} AI calls (${summary?.uncategorizedAI?.costDollars})
                  are not tagged with a call point. These won&apos;t appear in the breakdown above.
                </div>
              </div>
              <div style={{ fontWeight: 600, fontSize: 14, color: "#92400e" }}>
                ${summary?.uncategorizedAI?.costDollars}
              </div>
            </div>
          )}

          {/* Provider Legend */}
          <div
            style={{
              marginTop: 16,
              paddingTop: 12,
              borderTop: "1px solid #e2e8f0",
              display: "flex",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontSize: 11, color: "#94a3b8" }}>Providers:</span>
            {Object.entries(PROVIDER_COLORS).map(([key, val]) => (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <ProviderDot provider={key} size={6} />
                <span style={{ fontSize: 11, color: "#64748b" }}>{val.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Two Column Layout: Top Operations + Recent Events */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* Top Operations */}
        <div
          style={{
            background: "var(--surface-primary)",
            border: "1px solid var(--border-default)",
            borderRadius: 12,
            padding: 20,
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: "var(--text-primary)" }}>
            Top Operations by Cost
          </h2>
          {(summary?.topOperations || []).length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {summary?.topOperations.map((op, i) => {
                const colors = CATEGORY_COLORS[op.category] || CATEGORY_COLORS.AI;
                // For AI operations, we could show provider dot if we had model info
                // For now, show category dot
                return (
                  <div
                    key={`${op.category}-${op.operation}-${i}`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 12px",
                      background: "var(--surface-secondary)",
                      borderRadius: 6,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        style={{
                          display: "inline-block",
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          backgroundColor: colors.text,
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          color: colors.text,
                          background: colors.bg,
                          padding: "2px 6px",
                          borderRadius: 4,
                        }}
                      >
                        {op.category}
                      </span>
                      <span style={{ fontSize: 13, color: "var(--text-primary)" }}>{op.operation}</span>
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)" }}>${op.costDollars}</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ color: "var(--text-muted)", textAlign: "center", padding: 20 }}>
              No operations recorded yet
            </div>
          )}
        </div>

        {/* Recent Events */}
        <div
          style={{
            background: "var(--surface-primary)",
            border: "1px solid var(--border-default)",
            borderRadius: 12,
            padding: 20,
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: "var(--text-primary)" }}>
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
                const isAI = event.category === "AI";
                const provider = isAI ? getProvider(event.model, event.engine) : null;

                return (
                  <div
                    key={event.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "6px 10px",
                      background: "var(--surface-secondary)",
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {/* Category/Provider dot */}
                      {isAI && provider ? (
                        <ProviderDot provider={provider} size={6} />
                      ) : (
                        <span
                          style={{
                            display: "inline-block",
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            backgroundColor: colors.text,
                            flexShrink: 0,
                          }}
                        />
                      )}
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
                      <span style={{ color: "var(--text-primary)" }}>{event.operation}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ color: "var(--text-secondary)" }}>
                        {event.quantity.toLocaleString()} {event.unitType}
                      </span>
                      <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>
                        ${(event.costCents / 100).toFixed(4)}
                      </span>
                      <span style={{ color: "var(--text-muted)", fontSize: 10 }}>
                        {new Date(event.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ color: "var(--text-muted)", textAlign: "center", padding: 20 }}>
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
          background: "var(--status-info-bg)",
          border: "1px solid var(--status-info-border)",
          borderRadius: 8,
          fontSize: 13,
          color: "var(--status-info-text)",
        }}
      >
        <strong>Note:</strong> Usage is tracked automatically when you use AI features,
        run pipeline operations, or execute queries. Run{" "}
        <code style={{ background: "var(--surface-secondary)", padding: "1px 4px", borderRadius: 3 }}>
          metering:rollup
        </code>{" "}
        via Ops to aggregate data into period summaries. Events are retained for 30 days.
      </div>
    </div>
  );
}
