"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { DraggableTabs } from "@/components/shared/DraggableTabs";
import { DomainPill } from "@/src/components/shared/EntityPill";
import {
  ArrowLeft,
  Users,
  Activity,
  Settings,
  Phone,
  Target,
  Brain,
  Clock,
  TrendingUp,
  User,
  Mail,
  Link2,
  Copy,
  RefreshCw,
  X,
  BookOpen,
  Plus,
  Trash2,
  RefreshCcw,
} from "lucide-react";

// ==============================
// Types
// ==============================

type Personality = {
  openness: number | null;
  conscientiousness: number | null;
  extraversion: number | null;
  agreeableness: number | null;
  neuroticism: number | null;
  confidenceScore: number | null;
};

type Pupil = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  createdAt: string;
  archivedAt: string | null;
  personality: Personality | null;
  callCount: number;
  goalCount: number;
  memoryCount: number;
  lastCallAt: string | null;
  goals: { total: number; completed: number; active: number };
};

type DashboardSummary = {
  memberCount: number;
  activePupils: number;
  recentlyActive: number;
  totalCalls: number;
  totalGoals: number;
  completedGoals: number;
  goalCompletionRate: number;
};

type Cohort = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  maxMembers: number;
  owner: { id: string; name: string; email: string | null };
  domain: { id: string; slug: string; name: string };
  _count: { members: number };
};

type ActivityItem = {
  type: "call";
  id: string;
  callerId: string;
  callerName: string;
  timestamp: string;
  source: string;
  scoreCount: number;
  memoryCount: number;
};

// ==============================
// Main Component
// ==============================

type TabId = "roster" | "playbooks" | "activity" | "invite" | "settings";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "roster", label: "Roster", icon: <Users size={14} /> },
  { id: "playbooks", label: "Courses", icon: <BookOpen size={14} /> },
  { id: "activity", label: "Activity", icon: <Activity size={14} /> },
  { id: "invite", label: "Invite", icon: <Mail size={14} /> },
  { id: "settings", label: "Settings", icon: <Settings size={14} /> },
];

export default function CohortDashboardPage() {
  const { cohortId } = useParams<{ cohortId: string }>();
  const [activeTab, setActiveTab] = useState<TabId>("roster");
  const [dashboard, setDashboard] = useState<{
    cohort: Cohort;
    summary: DashboardSummary;
    pupils: Pupil[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(() => {
    setLoading(true);
    fetch(`/api/cohorts/${cohortId}/dashboard`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setDashboard(data);
        } else {
          setError(data.error || "Failed to load dashboard");
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [cohortId]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (loading) {
    return (
      <div
        style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}
      >
        Loading cohort dashboard...
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div style={{ padding: 24 }}>
        <Link
          href="/x/cohorts"
          style={{
            color: "var(--text-muted)",
            fontSize: 13,
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 4,
            marginBottom: 16,
          }}
        >
          <ArrowLeft size={14} /> Back to Cohorts
        </Link>
        <div
          style={{
            padding: 16,
            background: "var(--status-error-bg)",
            color: "var(--status-error-text)",
            borderRadius: 8,
          }}
        >
          {error || "Cohort not found"}
        </div>
      </div>
    );
  }

  const { cohort, summary, pupils } = dashboard;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {/* Header */}
      <div style={{ padding: "16px 24px 0 24px", flexShrink: 0 }}>
        <Link
          href="/x/cohorts"
          style={{
            color: "var(--text-muted)",
            fontSize: 13,
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 4,
            marginBottom: 12,
          }}
        >
          <ArrowLeft size={14} /> Back to Cohorts
        </Link>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "start",
            marginBottom: 16,
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 4,
              }}
            >
              <h1
                style={{
                  margin: 0,
                  fontSize: 22,
                  fontWeight: 700,
                  color: "var(--text-primary)",
                }}
              >
                {cohort.name}
              </h1>
              <span
                style={{
                  fontSize: 10,
                  padding: "2px 8px",
                  background: cohort.isActive
                    ? "color-mix(in srgb, var(--status-success-text) 15%, transparent)"
                    : "var(--surface-tertiary)",
                  color: cohort.isActive ? "var(--status-success-text)" : "var(--text-muted)",
                  borderRadius: 4,
                  fontWeight: 600,
                }}
              >
                {cohort.isActive ? "Active" : "Inactive"}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                fontSize: 13,
              }}
            >
              <DomainPill label={cohort.domain.name} size="compact" />
              <span style={{ color: "var(--text-muted)" }}>
                Owner: {cohort.owner.name}
              </span>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <SummaryCard
            icon={<Users size={16} />}
            label="Members"
            value={summary.memberCount}
            sub={`of ${cohort.maxMembers}`}
          />
          <SummaryCard
            icon={<TrendingUp size={16} />}
            label="Active (7d)"
            value={summary.recentlyActive}
            sub={`of ${summary.memberCount}`}
          />
          <SummaryCard
            icon={<Phone size={16} />}
            label="Total Calls"
            value={summary.totalCalls}
          />
          <SummaryCard
            icon={<Target size={16} />}
            label="Goals"
            value={summary.totalGoals}
            sub={`${summary.goalCompletionRate}% done`}
          />
        </div>

        {/* Tabs */}
        <DraggableTabs
          storageKey="cohort-detail-tabs"
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={(id) => setActiveTab(id as TabId)}
        />
      </div>

      {/* Scrollable Content */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 24,
        }}
      >
        {activeTab === "roster" && (
          <RosterTab pupils={pupils} cohortId={cohortId} />
        )}
        {activeTab === "playbooks" && <PlaybooksTab cohortId={cohortId} />}
        {activeTab === "activity" && <ActivityTab cohortId={cohortId} />}
        {activeTab === "invite" && <InviteTab cohortId={cohortId} />}
        {activeTab === "settings" && (
          <SettingsTab cohort={cohort} onUpdated={fetchDashboard} />
        )}
      </div>
    </div>
  );
}

// ==============================
// Summary Card
// ==============================

function SummaryCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub?: string;
}) {
  return (
    <div
      style={{
        padding: "12px 16px",
        background: "var(--surface-primary)",
        border: "1px solid var(--border-default)",
        borderRadius: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          color: "var(--text-muted)",
          fontSize: 12,
          marginBottom: 4,
        }}
      >
        {icon}
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>
        {value}
        {sub && (
          <span
            style={{
              fontSize: 12,
              fontWeight: 400,
              color: "var(--text-muted)",
              marginLeft: 4,
            }}
          >
            {sub}
          </span>
        )}
      </div>
    </div>
  );
}

// ==============================
// Roster Tab
// ==============================

function RosterTab({
  pupils,
  cohortId,
}: {
  pupils: Pupil[];
  cohortId: string;
}) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "calls" | "lastCall">("name");

  const sorted = [...pupils]
    .filter((p) => {
      if (!search) return true;
      const s = search.toLowerCase();
      return (
        p.name?.toLowerCase().includes(s) ||
        p.email?.toLowerCase().includes(s)
      );
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "calls":
          return b.callCount - a.callCount;
        case "lastCall":
          if (!a.lastCallAt && !b.lastCallAt) return 0;
          if (!a.lastCallAt) return 1;
          if (!b.lastCallAt) return -1;
          return (
            new Date(b.lastCallAt).getTime() -
            new Date(a.lastCallAt).getTime()
          );
        default:
          return (a.name || "").localeCompare(b.name || "");
      }
    });

  return (
    <div>
      {/* Filters */}
      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 16,
          alignItems: "center",
        }}
      >
        <input
          type="text"
          placeholder="Search pupils..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: "8px 12px",
            border: "1px solid var(--input-border)",
            borderRadius: 6,
            fontSize: 13,
            width: 200,
            background: "var(--surface-primary)",
            color: "var(--text-primary)",
          }}
        />
        <div
          style={{
            display: "flex",
            gap: 4,
          }}
        >
          {(["name", "calls", "lastCall"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              style={{
                padding: "4px 10px",
                fontSize: 12,
                border: "1px solid var(--border-default)",
                borderRadius: 4,
                background:
                  sortBy === s
                    ? "color-mix(in srgb, var(--accent-primary) 15%, transparent)"
                    : "transparent",
                color:
                  sortBy === s ? "var(--accent-primary)" : "var(--text-muted)",
                cursor: "pointer",
                fontWeight: sortBy === s ? 600 : 400,
              }}
            >
              {s === "name"
                ? "Name"
                : s === "calls"
                  ? "Calls"
                  : "Last Active"}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: "auto" }}>
          {sorted.length} pupil{sorted.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Pupil Table */}
      {sorted.length === 0 ? (
        <div
          style={{
            padding: 40,
            textAlign: "center",
            background: "var(--surface-secondary)",
            borderRadius: 10,
            border: "1px solid var(--border-default)",
          }}
        >
          <User
            size={36}
            style={{ color: "var(--text-placeholder)", marginBottom: 12 }}
          />
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--text-secondary)",
            }}
          >
            No pupils in this cohort
          </div>
          <div
            style={{
              fontSize: 13,
              color: "var(--text-muted)",
              marginTop: 4,
            }}
          >
            Add members from the Callers page
          </div>
        </div>
      ) : (
        <div
          style={{
            border: "1px solid var(--border-default)",
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          {/* Header Row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 1fr 1fr 1.5fr",
              padding: "10px 16px",
              background: "var(--surface-secondary)",
              fontSize: 11,
              fontWeight: 600,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            <div>Pupil</div>
            <div>Calls</div>
            <div>Goals</div>
            <div>Memories</div>
            <div>Last Active</div>
          </div>

          {/* Rows */}
          {sorted.map((pupil, idx) => (
            <Link
              key={pupil.id}
              href={`/x/callers/${pupil.id}`}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 1fr 1fr 1.5fr",
                  padding: "12px 16px",
                  borderTop:
                    idx > 0 ? "1px solid var(--border-default)" : "none",
                  cursor: "pointer",
                  transition: "background 0.1s",
                }}
                onMouseOver={(e) =>
                  (e.currentTarget.style.background =
                    "var(--surface-secondary)")
                }
                onMouseOut={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      color: "var(--text-primary)",
                    }}
                  >
                    {pupil.name || "Unnamed"}
                  </div>
                  {pupil.email && (
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--text-muted)",
                        marginTop: 2,
                      }}
                    >
                      {pupil.email}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Phone size={12} style={{ color: "var(--text-placeholder)" }} />
                  <span style={{ fontSize: 14, color: "var(--text-primary)" }}>
                    {pupil.callCount}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Target
                    size={12}
                    style={{ color: "var(--text-placeholder)" }}
                  />
                  <span style={{ fontSize: 14, color: "var(--text-primary)" }}>
                    {pupil.goals.completed}/{pupil.goals.total}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Brain
                    size={12}
                    style={{ color: "var(--text-placeholder)" }}
                  />
                  <span style={{ fontSize: 14, color: "var(--text-primary)" }}>
                    {pupil.memoryCount}
                  </span>
                </div>
                <div>
                  {pupil.lastCallAt ? (
                    <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                      {formatRelativeTime(new Date(pupil.lastCallAt))}
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: 13,
                        color: "var(--text-placeholder)",
                        fontStyle: "italic",
                      }}
                    >
                      No calls yet
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ==============================
// Playbooks (Courses) Tab
// ==============================

type CohortPlaybookItem = {
  id: string;
  name: string;
  status: string;
  version: number | null;
  assignedAt: string;
  assignedBy: string | null;
  enrolledCount: number;
};

type AvailablePlaybook = {
  id: string;
  name: string;
  status: string;
  version: number | null;
};

function PlaybooksTab({ cohortId }: { cohortId: string }) {
  const [playbooks, setPlaybooks] = useState<CohortPlaybookItem[]>([]);
  const [available, setAvailable] = useState<AvailablePlaybook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");

  const fetchPlaybooks = useCallback(() => {
    setLoading(true);
    fetch(`/api/cohorts/${cohortId}/playbooks`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setPlaybooks(data.playbooks || []);
          setAvailable(data.available || []);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [cohortId]);

  useEffect(() => {
    fetchPlaybooks();
  }, [fetchPlaybooks]);

  const handleAssign = async (playbookId: string) => {
    try {
      const res = await fetch(`/api/cohorts/${cohortId}/playbooks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playbookIds: [playbookId], autoEnrollMembers: true }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessage(`Assigned. ${data.enrolled} student${data.enrolled !== 1 ? "s" : ""} enrolled.`);
        setShowPicker(false);
        fetchPlaybooks();
        setTimeout(() => setMessage(""), 3000);
      } else {
        setMessage(data.error || "Failed to assign");
      }
    } catch (err: any) {
      setMessage(err.message || "Failed to assign");
    }
  };

  const handleRemove = async (playbookId: string, playbookName: string) => {
    if (!confirm(`Remove "${playbookName}" from this cohort? Member enrollments will be kept.`)) return;

    try {
      const res = await fetch(`/api/cohorts/${cohortId}/playbooks/${playbookId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.ok) {
        setMessage("Removed");
        fetchPlaybooks();
        setTimeout(() => setMessage(""), 3000);
      } else {
        setMessage(data.error || "Failed to remove");
      }
    } catch (err: any) {
      setMessage(err.message || "Failed to remove");
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`/api/cohorts/${cohortId}/playbooks/sync`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.ok) {
        setMessage(`Synced ${data.synced} enrollment${data.synced !== 1 ? "s" : ""}${data.errors.length > 0 ? ` (${data.errors.length} errors)` : ""}`);
        fetchPlaybooks();
        setTimeout(() => setMessage(""), 3000);
      }
    } catch (err: any) {
      setMessage(err.message || "Sync failed");
    }
    setSyncing(false);
  };

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
        Loading courses...
      </div>
    );
  }

  return (
    <div>
      {/* Actions Bar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
        <button
          onClick={() => setShowPicker(!showPicker)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "6px 14px",
            background: "var(--button-primary-bg)",
            color: "var(--button-primary-text)",
            border: "none",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <Plus size={14} />
          Assign Course
        </button>
        {playbooks.length > 0 && (
          <button
            onClick={handleSync}
            disabled={syncing}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "6px 14px",
              border: "1px solid var(--border-default)",
              borderRadius: 6,
              background: "transparent",
              fontSize: 13,
              color: "var(--text-muted)",
              cursor: syncing ? "not-allowed" : "pointer",
            }}
          >
            <RefreshCcw size={14} />
            {syncing ? "Syncing..." : "Sync Members"}
          </button>
        )}
        {message && (
          <span
            style={{
              fontSize: 13,
              marginLeft: "auto",
              color: message.includes("Failed") || message.includes("error")
                ? "var(--status-error-text)"
                : "var(--status-success-text)",
            }}
          >
            {message}
          </span>
        )}
      </div>

      {/* Picker */}
      {showPicker && available.length > 0 && (
        <div
          style={{
            border: "1px solid var(--border-default)",
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
            background: "var(--surface-secondary)",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8 }}>
            Available Courses
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {available.map((pb) => (
              <div
                key={pb.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 12px",
                  background: "var(--surface-primary)",
                  border: "1px solid var(--border-default)",
                  borderRadius: 6,
                }}
              >
                <div>
                  <span style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 500 }}>
                    {pb.name}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      padding: "1px 6px",
                      marginLeft: 8,
                      background: "color-mix(in srgb, var(--status-success-text) 15%, transparent)",
                      color: "var(--status-success-text)",
                      borderRadius: 4,
                      fontWeight: 600,
                    }}
                  >
                    {pb.status}
                  </span>
                </div>
                <button
                  onClick={() => handleAssign(pb.id)}
                  style={{
                    padding: "4px 10px",
                    fontSize: 12,
                    border: "1px solid var(--accent-primary)",
                    borderRadius: 4,
                    background: "transparent",
                    color: "var(--accent-primary)",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Assign
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      {showPicker && available.length === 0 && (
        <div
          style={{
            padding: 16,
            marginBottom: 16,
            background: "var(--surface-secondary)",
            border: "1px solid var(--border-default)",
            borderRadius: 8,
            fontSize: 13,
            color: "var(--text-muted)",
            textAlign: "center",
          }}
        >
          All domain courses are already assigned to this cohort
        </div>
      )}

      {/* Assigned Playbooks */}
      {playbooks.length === 0 ? (
        <div
          style={{
            padding: 40,
            textAlign: "center",
            background: "var(--surface-secondary)",
            borderRadius: 10,
            border: "1px solid var(--border-default)",
          }}
        >
          <BookOpen
            size={36}
            style={{ color: "var(--text-placeholder)", marginBottom: 12 }}
          />
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)" }}>
            No courses assigned
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
            Students joining this cohort will receive all domain courses as a fallback.
            Assign specific courses to control what students are enrolled in.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {playbooks.map((pb) => (
            <div
              key={pb.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "14px 16px",
                background: "var(--surface-primary)",
                border: "1px solid var(--border-default)",
                borderRadius: 8,
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <BookOpen size={14} style={{ color: "var(--accent-primary)" }} />
                  <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>
                    {pb.name}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      padding: "1px 6px",
                      background:
                        pb.status === "PUBLISHED"
                          ? "color-mix(in srgb, var(--status-success-text) 15%, transparent)"
                          : "var(--surface-tertiary)",
                      color:
                        pb.status === "PUBLISHED"
                          ? "var(--status-success-text)"
                          : "var(--text-muted)",
                      borderRadius: 4,
                      fontWeight: 600,
                    }}
                  >
                    {pb.status}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, display: "flex", gap: 12 }}>
                  <span>{pb.enrolledCount} enrolled</span>
                  <span>Assigned {new Date(pb.assignedAt).toLocaleDateString()}</span>
                </div>
              </div>
              <button
                onClick={() => handleRemove(pb.id, pb.name)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "4px 10px",
                  border: "1px solid var(--border-default)",
                  borderRadius: 4,
                  background: "transparent",
                  fontSize: 12,
                  color: "var(--text-muted)",
                  cursor: "pointer",
                }}
              >
                <Trash2 size={12} />
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ==============================
// Activity Tab
// ==============================

function ActivityTab({ cohortId }: { cohortId: string }) {
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetch(`/api/cohorts/${cohortId}/activity?limit=50`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setActivity(data.activity || []);
          setTotal(data.total || 0);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [cohortId]);

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
        Loading activity...
      </div>
    );
  }

  if (activity.length === 0) {
    return (
      <div
        style={{
          padding: 40,
          textAlign: "center",
          background: "var(--surface-secondary)",
          borderRadius: 10,
          border: "1px solid var(--border-default)",
        }}
      >
        <Activity
          size={36}
          style={{ color: "var(--text-placeholder)", marginBottom: 12 }}
        />
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "var(--text-secondary)",
          }}
        >
          No activity yet
        </div>
        <div
          style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}
        >
          Activity appears as cohort members make calls
        </div>
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          fontSize: 12,
          color: "var(--text-muted)",
          marginBottom: 12,
        }}
      >
        Showing {activity.length} of {total} calls
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {activity.map((item) => (
          <Link
            key={item.id}
            href={`/x/callers/${item.callerId}?tab=calls`}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 16px",
                background: "var(--surface-primary)",
                border: "1px solid var(--border-default)",
                borderRadius: 8,
                cursor: "pointer",
                transition: "border-color 0.15s",
              }}
              onMouseOver={(e) =>
                (e.currentTarget.style.borderColor = "var(--accent-primary)")
              }
              onMouseOut={(e) =>
                (e.currentTarget.style.borderColor = "var(--border-default)")
              }
            >
              <Phone
                size={16}
                style={{ color: "var(--text-placeholder)", flexShrink: 0 }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: "var(--text-primary)" }}>
                  <strong>{item.callerName}</strong> had a call
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    marginTop: 2,
                    display: "flex",
                    gap: 8,
                  }}
                >
                  <span>Source: {item.source}</span>
                  {item.scoreCount > 0 && (
                    <span>{item.scoreCount} scores</span>
                  )}
                  {item.memoryCount > 0 && (
                    <span>{item.memoryCount} memories</span>
                  )}
                </div>
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  whiteSpace: "nowrap",
                }}
              >
                {formatRelativeTime(new Date(item.timestamp))}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ==============================
// Settings Tab
// ==============================

function SettingsTab({
  cohort,
  onUpdated,
}: {
  cohort: Cohort;
  onUpdated: () => void;
}) {
  const [name, setName] = useState(cohort.name);
  const [description, setDescription] = useState(cohort.description || "");
  const [maxMembers, setMaxMembers] = useState(cohort.maxMembers);
  const [isActive, setIsActive] = useState(cohort.isActive);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const hasChanges =
    name !== cohort.name ||
    description !== (cohort.description || "") ||
    maxMembers !== cohort.maxMembers ||
    isActive !== cohort.isActive;

  const handleSave = async () => {
    setSaving(true);
    setMessage("");

    try {
      const res = await fetch(`/api/cohorts/${cohort.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          maxMembers,
          isActive,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessage("Saved");
        onUpdated();
        setTimeout(() => setMessage(""), 2000);
      } else {
        setMessage(data.error || "Failed to save");
      }
    } catch (err: any) {
      setMessage(err.message || "Failed to save");
    }
    setSaving(false);
  };

  return (
    <div style={{ maxWidth: 500 }}>
      <h3
        style={{
          margin: "0 0 16px 0",
          fontSize: 16,
          fontWeight: 600,
          color: "var(--text-primary)",
        }}
      >
        Cohort Settings
      </h3>

      <label
        style={{
          display: "block",
          fontSize: 13,
          fontWeight: 500,
          color: "var(--text-secondary)",
          marginBottom: 4,
        }}
      >
        Name
      </label>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{
          width: "100%",
          padding: "8px 12px",
          border: "1px solid var(--input-border)",
          borderRadius: 6,
          fontSize: 14,
          marginBottom: 16,
          background: "var(--surface-primary)",
          color: "var(--text-primary)",
          boxSizing: "border-box",
        }}
      />

      <label
        style={{
          display: "block",
          fontSize: 13,
          fontWeight: 500,
          color: "var(--text-secondary)",
          marginBottom: 4,
        }}
      >
        Description
      </label>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        style={{
          width: "100%",
          padding: "8px 12px",
          border: "1px solid var(--input-border)",
          borderRadius: 6,
          fontSize: 14,
          marginBottom: 16,
          background: "var(--surface-primary)",
          color: "var(--text-primary)",
          resize: "vertical",
          boxSizing: "border-box",
        }}
      />

      <label
        style={{
          display: "block",
          fontSize: 13,
          fontWeight: 500,
          color: "var(--text-secondary)",
          marginBottom: 4,
        }}
      >
        Max Members
      </label>
      <input
        type="number"
        value={maxMembers}
        onChange={(e) => setMaxMembers(parseInt(e.target.value) || 1)}
        min={1}
        max={500}
        style={{
          width: 120,
          padding: "8px 12px",
          border: "1px solid var(--input-border)",
          borderRadius: 6,
          fontSize: 14,
          marginBottom: 16,
          background: "var(--surface-primary)",
          color: "var(--text-primary)",
        }}
      />

      <div style={{ marginBottom: 16 }}>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 14,
            color: "var(--text-primary)",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Cohort is active
        </label>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          style={{
            padding: "8px 20px",
            background: hasChanges
              ? "var(--button-primary-bg)"
              : "var(--surface-tertiary)",
            color: hasChanges
              ? "var(--button-primary-text)"
              : "var(--text-muted)",
            border: "none",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            cursor: hasChanges && !saving ? "pointer" : "not-allowed",
          }}
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
        {message && (
          <span
            style={{
              fontSize: 13,
              color: message === "Saved"
                ? "var(--status-success-text)"
                : "var(--status-error-text)",
            }}
          >
            {message}
          </span>
        )}
      </div>
    </div>
  );
}

// ==============================
// Invite Tab
// ==============================

type PendingInvite = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  createdAt: string;
  expiresAt: string;
  sentAt: string | null;
};

function InviteTab({ cohortId }: { cohortId: string }) {
  const [joinToken, setJoinToken] = useState<string | null>(null);
  const [loadingLink, setLoadingLink] = useState(true);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [emailInput, setEmailInput] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  const baseUrl =
    typeof window !== "undefined" ? window.location.origin : "";

  // Fetch join link
  useEffect(() => {
    fetch(`/api/cohorts/${cohortId}/join-link`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setJoinToken(data.joinToken);
        setLoadingLink(false);
      })
      .catch(() => setLoadingLink(false));
  }, [cohortId]);

  // Fetch pending invites
  const fetchInvites = useCallback(() => {
    setLoadingInvites(true);
    fetch(`/api/cohorts/${cohortId}/invite`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setInvites(data.invites || []);
        setLoadingInvites(false);
      })
      .catch(() => setLoadingInvites(false));
  }, [cohortId]);

  useEffect(() => {
    fetchInvites();
  }, [fetchInvites]);

  const handleCopyLink = () => {
    if (!joinToken) return;
    const url = `${baseUrl}/join/${joinToken}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerateLink = async () => {
    const res = await fetch(`/api/cohorts/${cohortId}/join-link`, {
      method: "POST",
    });
    const data = await res.json();
    if (data.ok) setJoinToken(data.joinToken);
  };

  const handleRevokeLink = async () => {
    const res = await fetch(`/api/cohorts/${cohortId}/join-link`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (data.ok) setJoinToken(null);
  };

  const handleSendInvites = async () => {
    const emails = emailInput
      .split(/[,\n]+/)
      .map((e) => e.trim())
      .filter((e) => e.includes("@"));

    if (emails.length === 0) {
      setMessage("Enter at least one valid email");
      return;
    }

    setSending(true);
    setMessage("");

    try {
      const res = await fetch(`/api/cohorts/${cohortId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessage(
          `Created ${data.created} invite${data.created !== 1 ? "s" : ""}` +
            (data.skipped > 0 ? `, ${data.skipped} skipped` : "") +
            (data.sent > 0 ? `, ${data.sent} email${data.sent !== 1 ? "s" : ""} sent` : "")
        );
        setEmailInput("");
        fetchInvites();
      } else {
        setMessage(data.error || "Failed to send invites");
      }
    } catch (err: any) {
      setMessage(err.message || "Failed to send invites");
    }
    setSending(false);
    setTimeout(() => setMessage(""), 5000);
  };

  return (
    <div style={{ maxWidth: 600 }}>
      {/* Join Link Section */}
      <h3
        style={{
          margin: "0 0 12px 0",
          fontSize: 16,
          fontWeight: 600,
          color: "var(--text-primary)",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <Link2 size={16} />
        Join Link
      </h3>
      <p
        style={{
          fontSize: 13,
          color: "var(--text-muted)",
          margin: "0 0 12px 0",
        }}
      >
        Share this link with pupils so they can self-enrol in this cohort.
      </p>

      {loadingLink ? (
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
          Loading...
        </div>
      ) : joinToken ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 14px",
            background: "var(--surface-secondary)",
            borderRadius: 8,
            border: "1px solid var(--border-default)",
            marginBottom: 8,
          }}
        >
          <code
            style={{
              flex: 1,
              fontSize: 13,
              color: "var(--text-primary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {baseUrl}/join/{joinToken}
          </code>
          <button
            onClick={handleCopyLink}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 10px",
              border: "1px solid var(--border-default)",
              borderRadius: 4,
              background: "transparent",
              fontSize: 12,
              color: copied ? "var(--status-success-text)" : "var(--text-muted)",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            <Copy size={12} />
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      ) : (
        <div
          style={{
            fontSize: 13,
            color: "var(--text-muted)",
            fontStyle: "italic",
            marginBottom: 8,
          }}
        >
          No join link active
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 32 }}>
        <button
          onClick={handleRegenerateLink}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "4px 10px",
            border: "1px solid var(--border-default)",
            borderRadius: 4,
            background: "transparent",
            fontSize: 12,
            color: "var(--text-muted)",
            cursor: "pointer",
          }}
        >
          <RefreshCw size={12} />
          {joinToken ? "Regenerate" : "Generate"}
        </button>
        {joinToken && (
          <button
            onClick={handleRevokeLink}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 10px",
              border: "1px solid var(--border-default)",
              borderRadius: 4,
              background: "transparent",
              fontSize: 12,
              color: "var(--status-error-text)",
              cursor: "pointer",
            }}
          >
            <X size={12} />
            Revoke
          </button>
        )}
      </div>

      {/* Email Invite Section */}
      <h3
        style={{
          margin: "0 0 12px 0",
          fontSize: 16,
          fontWeight: 600,
          color: "var(--text-primary)",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <Mail size={16} />
        Email Invites
      </h3>
      <p
        style={{
          fontSize: 13,
          color: "var(--text-muted)",
          margin: "0 0 12px 0",
        }}
      >
        Enter email addresses (one per line, or comma-separated) to send invite
        links.
      </p>

      <textarea
        value={emailInput}
        onChange={(e) => setEmailInput(e.target.value)}
        placeholder="student1@example.com&#10;student2@example.com"
        rows={4}
        style={{
          width: "100%",
          padding: "10px 12px",
          border: "1px solid var(--input-border)",
          borderRadius: 6,
          fontSize: 13,
          background: "var(--surface-primary)",
          color: "var(--text-primary)",
          resize: "vertical",
          boxSizing: "border-box",
          fontFamily: "inherit",
        }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginTop: 8,
          marginBottom: 24,
        }}
      >
        <button
          onClick={handleSendInvites}
          disabled={sending || !emailInput.trim()}
          style={{
            padding: "8px 16px",
            background:
              emailInput.trim()
                ? "var(--button-primary-bg)"
                : "var(--surface-tertiary)",
            color:
              emailInput.trim()
                ? "var(--button-primary-text)"
                : "var(--text-muted)",
            border: "none",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            cursor: sending || !emailInput.trim() ? "not-allowed" : "pointer",
          }}
        >
          {sending ? "Sending..." : "Send Invites"}
        </button>
        {message && (
          <span
            style={{
              fontSize: 13,
              color: message.startsWith("Created")
                ? "var(--status-success-text)"
                : "var(--status-error-text)",
            }}
          >
            {message}
          </span>
        )}
      </div>

      {/* Pending Invites List */}
      {loadingInvites ? (
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
          Loading invites...
        </div>
      ) : invites.length > 0 ? (
        <div>
          <h4
            style={{
              margin: "0 0 8px 0",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text-secondary)",
            }}
          >
            Pending Invites ({invites.length})
          </h4>
          <div
            style={{
              border: "1px solid var(--border-default)",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            {invites.map((invite, idx) => (
              <div
                key={invite.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 14px",
                  borderTop:
                    idx > 0 ? "1px solid var(--border-default)" : "none",
                  fontSize: 13,
                }}
              >
                <div>
                  <div style={{ color: "var(--text-primary)" }}>
                    {invite.email}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-muted)",
                      marginTop: 2,
                    }}
                  >
                    Sent {invite.sentAt
                      ? formatRelativeTime(new Date(invite.sentAt))
                      : "not yet"}{" "}
                    &middot; Expires{" "}
                    {new Date(invite.expiresAt).toLocaleDateString()}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 10,
                    padding: "2px 8px",
                    background:
                      "color-mix(in srgb, var(--status-warning-text) 15%, transparent)",
                    color: "var(--status-warning-text)",
                    borderRadius: 4,
                    fontWeight: 600,
                  }}
                >
                  Pending
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ==============================
// Utility
// ==============================

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
