"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import { FancySelect } from "@/components/shared/FancySelect";
import { CallerPill, DomainPill, PlaybookPill, SpecPill, GoalPill } from "@/src/components/shared/EntityPill";

type Goal = {
  id: string;
  type: string;
  name: string;
  description: string | null;
  status: string;
  priority: number;
  progress: number;
  startedAt: string | null;
  completedAt: string | null;
  targetDate: string | null;
  caller: {
    id: string;
    name: string;
    domain: {
      id: string;
      slug: string;
      name: string;
    } | null;
  };
  playbook: {
    id: string;
    name: string;
    version: string;
  } | null;
  contentSpec: {
    id: string;
    slug: string;
    name: string;
  } | null;
};

type GoalCounts = {
  total: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
};

type GoalsResponse = { goals: Goal[]; counts: GoalCounts };

const GOAL_TYPES = [
  { value: "all", label: "All Types" },
  { value: "LEARN", label: "📚 Learn", color: "var(--accent-primary)" },
  { value: "ACHIEVE", label: "🏆 Achieve", color: "var(--status-warning-text)" },
  { value: "CHANGE", label: "🔄 Change", color: "var(--badge-purple-text)" },
  { value: "CONNECT", label: "🤝 Connect", color: "var(--badge-pink-text)" },
  { value: "SUPPORT", label: "💚 Support", color: "var(--status-success-text)" },
  { value: "CREATE", label: "🎨 Create", color: "var(--badge-cyan-text)" },
];

const GOAL_STATUSES = [
  { value: "all", label: "All Statuses" },
  { value: "ACTIVE", label: "✅ Active", color: "var(--status-success-text)" },
  { value: "COMPLETED", label: "🎉 Completed", color: "var(--accent-primary)" },
  { value: "PAUSED", label: "⏸️ Paused", color: "var(--status-warning-text)" },
  { value: "ARCHIVED", label: "📦 Archived", color: "var(--text-muted)" },
];

export default function GoalsPage() {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [sortBy, setSortBy] = useState<"priority" | "name" | "status" | "progress">("priority");

  // Build API URL with filters
  const apiUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (filterStatus !== "all") params.set("status", filterStatus);
    if (filterType !== "all") params.set("type", filterType);
    return `/api/goals?${params}`;
  }, [filterStatus, filterType]);

  const { data, loading, error } = useApi<GoalsResponse>(
    apiUrl,
    { transform: (res) => ({ goals: res.goals as Goal[], counts: res.counts as GoalCounts }) },
    [filterStatus, filterType]
  );

  const goals = data?.goals || [];
  const counts = data?.counts || null;

  const getTypeConfig = (type: string) => {
    return GOAL_TYPES.find((t) => t.value === type) || { label: type, color: "var(--text-muted)" };
  };

  const getStatusConfig = (status: string) => {
    return GOAL_STATUSES.find((s) => s.value === status) || { label: status, color: "var(--text-muted)" };
  };

  // Filter and sort goals
  const filteredAndSortedGoals = goals
    .filter((goal) => {
      // Search filter
      if (search) {
        const s = search.toLowerCase();
        const matchesSearch =
          goal.name.toLowerCase().includes(s) ||
          goal.description?.toLowerCase().includes(s) ||
          goal.caller.name.toLowerCase().includes(s) ||
          goal.caller.domain?.name.toLowerCase().includes(s);
        if (!matchesSearch) return false;
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "priority":
          return b.priority - a.priority;
        case "progress":
          return b.progress - a.progress;
        case "status":
          return a.status.localeCompare(b.status);
        case "name":
        default:
          return a.name.localeCompare(b.name);
      }
    });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 className="hf-page-title">Goals</h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
            Track learning, achievements, and objectives across all callers
          </p>
        </div>
        {counts && (
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            <strong>{counts.total}</strong> total goals
          </div>
        )}
      </div>

      {/* Status Summary Cards */}
      {counts && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 20 }}>
          {GOAL_STATUSES.filter(s => s.value !== "all").map((statusConfig) => {
            const count = counts.byStatus[statusConfig.value] || 0;
            return (
              <div
                key={statusConfig.value}
                style={{
                  padding: "12px 16px",
                  background: "var(--surface-primary)",
                  border: `2px solid color-mix(in srgb, ${statusConfig.color} 12%, transparent)`,
                  borderRadius: 8,
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 24, fontWeight: 700, color: statusConfig.color }}>{count}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{statusConfig.label}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Search goals..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: "8px 12px",
            border: "1px solid var(--input-border)",
            borderRadius: 6,
            fontSize: 13,
            width: 220,
            background: "var(--surface-primary)",
            color: "var(--text-primary)",
          }}
        />
        <FancySelect
          value={filterStatus}
          onChange={setFilterStatus}
          searchable={false}
          style={{ minWidth: 140 }}
          options={GOAL_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
        />
        <FancySelect
          value={filterType}
          onChange={setFilterType}
          searchable={false}
          style={{ minWidth: 140 }}
          options={GOAL_TYPES.map((t) => ({ value: t.value, label: t.label }))}
        />
        <FancySelect
          value={sortBy}
          onChange={(v) => setSortBy(v as "priority" | "name" | "status" | "progress")}
          searchable={false}
          style={{ minWidth: 150 }}
          options={[
            { value: "priority", label: "Sort by priority" },
            { value: "name", label: "Sort by name" },
            { value: "status", label: "Sort by status" },
            { value: "progress", label: "Sort by progress" },
          ]}
        />
      </div>

      {error && (
        <div style={{ padding: 16, background: "var(--status-error-bg)", color: "var(--status-error-text)", borderRadius: 8, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading...</div>
      ) : filteredAndSortedGoals.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", background: "var(--surface-secondary)", borderRadius: 12, border: "1px solid var(--border-default)" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎯</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-secondary)" }}>
            {search || filterStatus !== "all" || filterType !== "all" ? "No goals match filters" : "No goals yet"}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 8 }}>
            Goals are automatically created when a caller is assigned to a domain
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filteredAndSortedGoals.map((goal) => {
            const typeConfig = getTypeConfig(goal.type);
            const statusConfig = getStatusConfig(goal.status);

            return (
              <Link
                key={goal.id}
                href={`/x/callers/${goal.caller.id}?tab=learning`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div
                  style={{
                    background: "var(--surface-primary)",
                    border: "1px solid var(--border-default)",
                    borderRadius: 10,
                    padding: 16,
                    cursor: "pointer",
                    transition: "border-color 0.15s, box-shadow 0.15s",
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = typeConfig.color || "var(--accent-primary)";
                    e.currentTarget.style.boxShadow = `0 2px 8px color-mix(in srgb, ${typeConfig.color} 12%, transparent)`;
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = "var(--border-default)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span
                          style={{
                            fontSize: 10,
                            padding: "2px 8px",
                            background: `color-mix(in srgb, ${typeConfig.color} 10%, transparent)`,
                            color: typeConfig.color,
                            borderRadius: 4,
                            fontWeight: 600,
                          }}
                        >
                          {typeConfig.label}
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            padding: "2px 8px",
                            background: `color-mix(in srgb, ${statusConfig.color} 10%, transparent)`,
                            color: statusConfig.color,
                            borderRadius: 4,
                            fontWeight: 600,
                          }}
                        >
                          {statusConfig.label}
                        </span>
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                          Priority: {goal.priority}
                        </span>
                      </div>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
                        {goal.name}
                      </h3>
                      {goal.description && (
                        <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "var(--text-muted)" }}>
                          {goal.description}
                        </p>
                      )}
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: typeConfig.color }}>
                      {Math.round(goal.progress * 100)}%
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div style={{ height: 6, background: "var(--surface-tertiary)", borderRadius: 3, marginBottom: 12, overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${goal.progress * 100}%`,
                        background: typeConfig.color,
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>

                  {/* Caller info */}
                  <div style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--text-muted)", flexWrap: "wrap", alignItems: "center" }}>
                    <CallerPill label={goal.caller.name} size="compact" />
                    {goal.caller.domain && (
                      <DomainPill label={goal.caller.domain.name} size="compact" />
                    )}
                    {goal.playbook && (
                      <PlaybookPill label={`${goal.playbook.name} v${goal.playbook.version}`} size="compact" />
                    )}
                    {goal.contentSpec && (
                      <SpecPill label={goal.contentSpec.name} size="compact" />
                    )}
                    {goal.startedAt && (
                      <span style={{ fontSize: 11, color: "var(--text-placeholder)" }}>
                        Started {new Date(goal.startedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
