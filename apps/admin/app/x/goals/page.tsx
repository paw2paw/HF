"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

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

const GOAL_TYPES = [
  { value: "all", label: "All Types" },
  { value: "LEARN", label: "📚 Learn", color: "#3b82f6" },
  { value: "ACHIEVE", label: "🏆 Achieve", color: "#f59e0b" },
  { value: "CHANGE", label: "🔄 Change", color: "#8b5cf6" },
  { value: "CONNECT", label: "🤝 Connect", color: "#ec4899" },
  { value: "SUPPORT", label: "💚 Support", color: "#10b981" },
  { value: "CREATE", label: "🎨 Create", color: "#06b6d4" },
];

const GOAL_STATUSES = [
  { value: "all", label: "All Statuses" },
  { value: "ACTIVE", label: "✅ Active", color: "#10b981" },
  { value: "COMPLETED", label: "🎉 Completed", color: "#3b82f6" },
  { value: "PAUSED", label: "⏸️ Paused", color: "#f59e0b" },
  { value: "ARCHIVED", label: "📦 Archived", color: "#6b7280" },
];

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [counts, setCounts] = useState<GoalCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [sortBy, setSortBy] = useState<"priority" | "name" | "status" | "progress">("priority");

  const fetchGoals = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterStatus !== "all") params.set("status", filterStatus);
    if (filterType !== "all") params.set("type", filterType);

    fetch(`/api/goals?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setGoals(data.goals || []);
          setCounts(data.counts);
        } else {
          setError(data.error);
        }
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchGoals();
  }, [filterStatus, filterType]);

  const getTypeConfig = (type: string) => {
    return GOAL_TYPES.find((t) => t.value === type) || { label: type, color: "#6b7280" };
  };

  const getStatusConfig = (status: string) => {
    return GOAL_STATUSES.find((s) => s.value === status) || { label: status, color: "#6b7280" };
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
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1f2937", margin: 0 }}>🎯 Goals</h1>
          <p style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
            Track learning, achievements, and objectives across all callers
          </p>
        </div>
        {counts && (
          <div style={{ fontSize: 13, color: "#6b7280" }}>
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
                  background: "#fff",
                  border: `2px solid ${statusConfig.color}20`,
                  borderRadius: 8,
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 24, fontWeight: 700, color: statusConfig.color }}>{count}</div>
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>{statusConfig.label}</div>
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
            border: "1px solid #d1d5db",
            borderRadius: 6,
            fontSize: 13,
            width: 220,
          }}
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{
            padding: "8px 12px",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            fontSize: 13,
          }}
        >
          {GOAL_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          style={{
            padding: "8px 12px",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            fontSize: 13,
          }}
        >
          {GOAL_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          style={{
            padding: "8px 12px",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            fontSize: 13,
          }}
        >
          <option value="priority">Sort by priority</option>
          <option value="name">Sort by name</option>
          <option value="status">Sort by status</option>
          <option value="progress">Sort by progress</option>
        </select>
      </div>

      {error && (
        <div style={{ padding: 16, background: "#fef2f2", color: "#dc2626", borderRadius: 8, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Loading...</div>
      ) : filteredAndSortedGoals.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", background: "#f9fafb", borderRadius: 12, border: "1px solid #e5e7eb" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎯</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#374151" }}>
            {search || filterStatus !== "all" || filterType !== "all" ? "No goals match filters" : "No goals yet"}
          </div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 8 }}>
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
                href={`/callers/${goal.caller.id}?tab=learning`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div
                  style={{
                    background: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                    padding: 16,
                    cursor: "pointer",
                    transition: "border-color 0.15s, box-shadow 0.15s",
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = typeConfig.color || "#4f46e5";
                    e.currentTarget.style.boxShadow = `0 2px 8px ${typeConfig.color}20`;
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = "#e5e7eb";
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
                            background: `${typeConfig.color}15`,
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
                            background: `${statusConfig.color}15`,
                            color: statusConfig.color,
                            borderRadius: 4,
                            fontWeight: 600,
                          }}
                        >
                          {statusConfig.label}
                        </span>
                        <span style={{ fontSize: 11, color: "#6b7280" }}>
                          Priority: {goal.priority}
                        </span>
                      </div>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#1f2937" }}>
                        {goal.name}
                      </h3>
                      {goal.description && (
                        <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "#6b7280" }}>
                          {goal.description}
                        </p>
                      )}
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: typeConfig.color }}>
                      {Math.round(goal.progress * 100)}%
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div style={{ height: 6, background: "#e5e7eb", borderRadius: 3, marginBottom: 12, overflow: "hidden" }}>
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
                  <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#6b7280", flexWrap: "wrap" }}>
                    <div>
                      <strong>Caller:</strong> {goal.caller.name}
                    </div>
                    {goal.caller.domain && (
                      <div>
                        <strong>Domain:</strong> {goal.caller.domain.name}
                      </div>
                    )}
                    {goal.playbook && (
                      <div>
                        <strong>Playbook:</strong> {goal.playbook.name} v{goal.playbook.version}
                      </div>
                    )}
                    {goal.contentSpec && (
                      <div>
                        <strong>Content:</strong> {goal.contentSpec.name}
                      </div>
                    )}
                    {goal.startedAt && (
                      <div>
                        <strong>Started:</strong> {new Date(goal.startedAt).toLocaleDateString()}
                      </div>
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
