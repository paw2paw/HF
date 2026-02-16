"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useTerminology } from "@/contexts/TerminologyContext";

interface DashboardData {
  classrooms: {
    id: string;
    name: string;
    domain: { id: string; name: string; slug: string };
    memberCount: number;
    createdAt: string;
  }[];
  stats: {
    classroomCount: number;
    totalStudents: number;
    activeThisWeek: number;
  };
  recentCalls: {
    id: string;
    createdAt: string;
    studentName: string;
    studentId: string;
  }[];
  needsAttention: {
    id: string;
    name: string;
    classroom: string;
  }[];
}

interface InstitutionOption {
  id: string;
  name: string;
  slug: string;
}

export default function EducatorDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const { terms, plural, lower, lowerPlural } = useTerminology();

  // School picker for ADMIN users without an educator profile
  const [needsSchoolPicker, setNeedsSchoolPicker] = useState(false);
  const [institutions, setInstitutions] = useState<InstitutionOption[]>([]);
  const [selectedInstitutionId, setSelectedInstitutionId] = useState<string | null>(null);

  // Invite teacher state
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ ok: boolean; message: string; url?: string } | null>(null);

  const handleInviteTeacher = useCallback(async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteResult(null);
    try {
      const res = await fetch("/api/educator/invite-teacher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });
      const body = await res.json();
      if (body.ok) {
        setInviteResult({ ok: true, message: "Invite sent!", url: body.inviteUrl });
        setInviteEmail("");
      } else {
        setInviteResult({ ok: false, message: body.error || "Failed to send invite" });
      }
    } catch {
      setInviteResult({ ok: false, message: "Network error" });
    } finally {
      setInviting(false);
    }
  }, [inviteEmail]);

  const loadDashboard = useCallback(async (institutionId?: string) => {
    setLoading(true);
    try {
      const url = institutionId
        ? `/api/educator/dashboard?institutionId=${institutionId}`
        : "/api/educator/dashboard";
      const res = await fetch(url);

      if (res.status === 403 && !institutionId) {
        // ADMIN user without educator profile — show institution picker
        const instRes = await fetch("/api/institutions");
        const instData = await instRes.json();
        if (instData?.institutions) {
          setInstitutions(instData.institutions.map((i: { id: string; name: string; slug: string }) => ({
            id: i.id, name: i.name, slug: i.slug,
          })));
        }
        setNeedsSchoolPicker(true);
        return;
      }

      const body = await res.json();
      if (body?.ok) {
        setData(body);
        setNeedsSchoolPicker(false);
      }
    } catch {
      // Network error — leave in loading/empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleSelectSchool = useCallback((institutionId: string) => {
    setSelectedInstitutionId(institutionId);
    loadDashboard(institutionId);
  }, [loadDashboard]);

  if (loading) {
    return (
      <div style={{ padding: 32 }}>
        <div style={{ fontSize: 15, color: "var(--text-muted)" }}>Loading your {lower("institution")}...</div>
      </div>
    );
  }

  // Picker for ADMIN users
  if (needsSchoolPicker && !loading) {
    return (
      <div data-tour="welcome" style={{ padding: "0 0 40px" }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
            Select a {terms.institution}
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: 15 }}>
            As an admin, choose which {lower("institution")} dashboard to view.
          </p>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 16,
          }}
        >
          {institutions.map((inst) => (
            <button
              key={inst.id}
              onClick={() => handleSelectSchool(inst.id)}
              style={{
                display: "flex",
                flexDirection: "column",
                padding: 20,
                background: selectedInstitutionId === inst.id
                  ? "var(--surface-active)"
                  : "var(--surface-primary)",
                border: selectedInstitutionId === inst.id
                  ? "2px solid var(--accent-primary)"
                  : "1px solid var(--border-default)",
                borderRadius: 12,
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.2s",
              }}
              className="home-stat-card"
            >
              <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
                {inst.name}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                {inst.slug}
              </div>
            </button>
          ))}
        </div>
        {institutions.length === 0 && (
          <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 16 }}>
            No {lowerPlural("institution")} found. Create an {lower("institution")} first.
          </p>
        )}
      </div>
    );
  }

  const stats = data?.stats ?? { classroomCount: 0, totalStudents: 0, activeThisWeek: 0 };
  const hasClassrooms = stats.classroomCount > 0;
  const viewingSchoolName = selectedInstitutionId
    ? institutions.find((i) => i.id === selectedInstitutionId)?.name
    : null;
  const instQuery = selectedInstitutionId ? `?institutionId=${selectedInstitutionId}` : "";

  return (
    <div data-tour="welcome" style={{ padding: "0 0 40px" }}>
      {/* Welcome Header */}
      <div style={{ marginBottom: 32 }}>
        {viewingSchoolName && (
          <button
            onClick={() => { setNeedsSchoolPicker(true); setData(null); }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 10px",
              fontSize: 12,
              fontWeight: 500,
              color: "var(--text-muted)",
              background: "var(--surface-secondary)",
              border: "1px solid var(--border-default)",
              borderRadius: 6,
              cursor: "pointer",
              marginBottom: 12,
            }}
          >
            &larr; Change {terms.institution}
          </button>
        )}
        <h1
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: "var(--text-primary)",
            marginBottom: 8,
          }}
        >
          {viewingSchoolName ?? `My ${terms.institution}`}
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: 15 }}>
          {hasClassrooms
            ? `${stats.totalStudents} ${stats.totalStudents !== 1 ? lowerPlural("learner") : lower("learner")} across ${stats.classroomCount} ${stats.classroomCount !== 1 ? lowerPlural("cohort") : lower("cohort")}`
            : `Get started by creating your first ${lower("cohort")}`}
        </p>
      </div>

      {/* Stats Row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 16,
          marginBottom: 32,
        }}
      >
        {[
          { label: plural("learner"), value: stats.totalStudents, color: "var(--button-primary-bg)" },
          { label: "Active This Week", value: stats.activeThisWeek, color: "var(--status-success-text)" },
          { label: plural("cohort"), value: stats.classroomCount, color: "var(--accent-primary)" },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px 16px",
              background: "var(--surface-primary)",
              border: "1px solid var(--border-default)",
              borderRadius: 12,
            }}
          >
            <div
              style={{
                fontSize: 32,
                fontWeight: 700,
                color: stat.color,
                lineHeight: 1,
                marginBottom: 6,
              }}
            >
              {stat.value}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div style={{ marginBottom: 32 }}>
        <h2
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: "var(--text-primary)",
            marginBottom: 12,
          }}
        >
          Quick Actions
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 12,
          }}
        >
          {[
            {
              title: `Create ${terms.cohort}`,
              description: `Set up a new ${lower("cohort")}`,
              href: `/x/educator/classrooms/new${instQuery}`,
              accent: "var(--accent-primary)",
            },
            {
              title: `View ${plural("learner")}`,
              description: `Track progress across all ${lowerPlural("cohort")}`,
              href: `/x/educator/students${instQuery}`,
              accent: "var(--button-primary-bg)",
            },
            {
              title: "Try a Call",
              description: `Experience what your ${lowerPlural("learner")} will`,
              href: `/x/educator/try${instQuery}`,
              accent: "var(--badge-purple-text)",
            },
            {
              title: "View Reports",
              description: "Analytics and engagement data",
              href: `/x/educator/reports${instQuery}`,
              accent: "var(--status-success-text)",
            },
          ].map((action) => (
            <Link
              key={action.title}
              href={action.href}
              style={{
                display: "flex",
                flexDirection: "column",
                padding: 16,
                background: "var(--surface-primary)",
                border: "1px solid var(--border-default)",
                borderRadius: 10,
                textDecoration: "none",
                transition: "all 0.2s",
                borderLeft: `3px solid ${action.accent}`,
              }}
              className="home-stat-card"
            >
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  marginBottom: 4,
                }}
              >
                {action.title}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                {action.description}
              </div>
            </Link>
          ))}

          {/* Invite Teacher Button */}
          <button
            onClick={() => { setShowInviteForm(!showInviteForm); setInviteResult(null); }}
            style={{
              display: "flex",
              flexDirection: "column",
              padding: 16,
              background: "var(--surface-primary)",
              border: "1px solid var(--border-default)",
              borderRadius: 10,
              textAlign: "left",
              cursor: "pointer",
              transition: "all 0.2s",
              borderLeft: "3px solid var(--status-warning-text)",
            }}
            className="home-stat-card"
          >
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
              Invite a {terms.instructor}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Bring a colleague onto the platform
            </div>
          </button>
        </div>

        {/* Inline Invite Form */}
        {showInviteForm && (
          <div
            style={{
              marginTop: 12,
              padding: 16,
              background: "var(--surface-primary)",
              border: "1px solid var(--border-default)",
              borderRadius: 10,
              display: "flex",
              gap: 8,
              alignItems: "flex-start",
              flexWrap: "wrap",
            }}
          >
            <input
              type="email"
              placeholder="colleague@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleInviteTeacher()}
              style={{
                flex: 1,
                minWidth: 200,
                padding: "8px 12px",
                borderRadius: 6,
                border: "1px solid var(--border-default)",
                background: "var(--surface-secondary)",
                fontSize: 14,
                color: "var(--text-primary)",
              }}
            />
            <button
              onClick={handleInviteTeacher}
              disabled={inviting || !inviteEmail.trim()}
              style={{
                padding: "8px 20px",
                borderRadius: 6,
                border: "none",
                background: "var(--status-warning-text)",
                color: "white",
                fontSize: 14,
                fontWeight: 600,
                cursor: inviting ? "wait" : "pointer",
                opacity: inviting || !inviteEmail.trim() ? 0.6 : 1,
              }}
            >
              {inviting ? "Sending..." : "Send Invite"}
            </button>
            {inviteResult && (
              <div
                style={{
                  width: "100%",
                  fontSize: 13,
                  padding: "6px 0",
                  color: inviteResult.ok ? "var(--status-success-text)" : "var(--status-error-text)",
                }}
              >
                {inviteResult.message}
                {inviteResult.url && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(inviteResult.url!);
                      setInviteResult({ ...inviteResult, message: "Link copied!" });
                    }}
                    style={{
                      marginLeft: 8,
                      padding: "2px 8px",
                      fontSize: 12,
                      border: "1px solid var(--border-default)",
                      borderRadius: 4,
                      background: "var(--surface-secondary)",
                      cursor: "pointer",
                      color: "var(--text-secondary)",
                    }}
                  >
                    Copy Link
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Two Column: Recent Activity + Needs Attention */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: hasClassrooms ? "1fr 1fr" : "1fr",
          gap: 20,
        }}
      >
        {/* Recent Activity */}
        <div
          style={{
            background: "var(--surface-primary)",
            border: "1px solid var(--border-default)",
            borderRadius: 12,
            padding: 20,
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
            Recent Activity
          </h3>
          {(!data?.recentCalls || data.recentCalls.length === 0) ? (
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
              No calls yet. Invite {lowerPlural("learner")} to get started.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {data.recentCalls.map((call) => (
                <div
                  key={call.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 0",
                    borderBottom: "1px solid var(--border-subtle)",
                  }}
                >
                  <div>
                    <Link
                      href={`/x/educator/students/${call.studentId}`}
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: "var(--text-primary)",
                        textDecoration: "none",
                      }}
                    >
                      {call.studentName}
                    </Link>
                  </div>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {new Date(call.createdAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Needs Attention */}
        {hasClassrooms && (
          <div
            style={{
              background: "var(--surface-primary)",
              border: "1px solid var(--border-default)",
              borderRadius: 12,
              padding: 20,
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
              Needs Attention
            </h3>
            {(!data?.needsAttention || data.needsAttention.length === 0) ? (
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                All {lowerPlural("learner")} are active. Great work!
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {data.needsAttention.map((student) => (
                  <div
                    key={student.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 0",
                      borderBottom: "1px solid var(--border-subtle)",
                    }}
                  >
                    <Link
                      href={`/x/educator/students/${student.id}`}
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: "var(--text-primary)",
                        textDecoration: "none",
                      }}
                    >
                      {student.name}
                    </Link>
                    <span
                      style={{
                        fontSize: 12,
                        color: "var(--text-muted)",
                        background: "var(--surface-secondary)",
                        padding: "2px 8px",
                        borderRadius: 6,
                      }}
                    >
                      {student.classroom}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Empty State CTA */}
      {!hasClassrooms && (
        <div
          style={{
            textAlign: "center",
            padding: "40px 20px",
            background: "var(--surface-primary)",
            border: "1px solid var(--border-default)",
            borderRadius: 12,
            marginTop: 20,
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>
            <span role="img" aria-label="welcome">
              👋
            </span>
          </div>
          <h3
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: "var(--text-primary)",
              marginBottom: 8,
            }}
          >
            Welcome to your {lower("institution")}
          </h3>
          <p
            style={{
              fontSize: 14,
              color: "var(--text-muted)",
              marginBottom: 20,
              maxWidth: 400,
              margin: "0 auto 20px",
            }}
          >
            Create your first {lower("cohort")}, invite {lowerPlural("learner")}, and start tracking
            their learning journey.
          </p>
          <Link
            href="/x/educator/classrooms/new"
            style={{
              display: "inline-block",
              padding: "10px 24px",
              background: "var(--button-primary-bg)",
              color: "var(--button-primary-text)",
              borderRadius: 8,
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Create {terms.cohort}
          </Link>
        </div>
      )}
    </div>
  );
}
