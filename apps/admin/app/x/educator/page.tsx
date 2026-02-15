"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

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

export default function EducatorDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    fetch("/api/educator/dashboard")
      .then((r) => r.json())
      .then((res: DashboardData & { ok: boolean }) => {
        if (res?.ok) setData(res);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 32 }}>
        <div style={{ fontSize: 15, color: "var(--text-muted)" }}>Loading your school...</div>
      </div>
    );
  }

  const stats = data?.stats ?? { classroomCount: 0, totalStudents: 0, activeThisWeek: 0 };
  const hasClassrooms = stats.classroomCount > 0;

  return (
    <div style={{ padding: "0 0 40px" }}>
      {/* Welcome Header */}
      <div style={{ marginBottom: 32 }}>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: "var(--text-primary)",
            marginBottom: 8,
          }}
        >
          My School
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: 15 }}>
          {hasClassrooms
            ? `${stats.totalStudents} student${stats.totalStudents !== 1 ? "s" : ""} across ${stats.classroomCount} classroom${stats.classroomCount !== 1 ? "s" : ""}`
            : "Get started by creating your first classroom"}
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
          { label: "Students", value: stats.totalStudents, color: "var(--button-primary-bg)" },
          { label: "Active This Week", value: stats.activeThisWeek, color: "var(--status-success-text)" },
          { label: "Classrooms", value: stats.classroomCount, color: "var(--accent-primary)" },
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
              title: "Create Classroom",
              description: "Set up a new learning group",
              href: "/x/educator/classrooms/new",
              accent: "var(--accent-primary)",
            },
            {
              title: "View Students",
              description: "Track progress across all classrooms",
              href: "/x/educator/students",
              accent: "var(--button-primary-bg)",
            },
            {
              title: "Try a Call",
              description: "Experience what your students will",
              href: "/x/educator/try",
              accent: "var(--badge-purple-text)",
            },
            {
              title: "View Reports",
              description: "Analytics and engagement data",
              href: "/x/educator/reports",
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
              Invite a Teacher
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
              placeholder="colleague@school.org"
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
              No calls yet. Invite students to get started.
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
                All students are active. Great work!
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
            <span role="img" aria-label="school">
              🏫
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
            Welcome to your school
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
            Create your first classroom, invite students, and start tracking
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
            Create Classroom
          </Link>
        </div>
      )}
    </div>
  );
}
