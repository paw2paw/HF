"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface StudentDetail {
  id: string;
  name: string;
  email: string | null;
  classroom: { id: string; name: string } | null;
  domain: { id: string; slug: string; name: string } | null;
  joinedAt: string;
}

interface CallItem {
  id: string;
  createdAt: string;
}

interface Goal {
  id: string;
  name: string;
  type: string;
  status: string;
  progress: number;
}

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [calls, setCalls] = useState<CallItem[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/educator/students/${id}`)
      .then((r) => r.json())
      .then((res: { ok: boolean; student: StudentDetail; calls: CallItem[]; goals: Goal[] }) => {
        if (res?.ok) {
          setStudent(res.student);
          setCalls(res.calls);
          setGoals(res.goals);
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div style={{ padding: 32 }}>
        <div style={{ fontSize: 15, color: "var(--text-muted)" }}>Loading student...</div>
      </div>
    );
  }

  if (!student) {
    return (
      <div style={{ padding: 32 }}>
        <div style={{ fontSize: 15, color: "var(--text-muted)" }}>Student not found.</div>
      </div>
    );
  }

  return (
    <div>
      {/* Breadcrumb */}
      <Link
        href="/x/educator/students"
        style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}
      >
        &larr; Students
      </Link>

      {/* Profile Card */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 20,
          padding: 20,
          background: "var(--surface-primary)",
          border: "1px solid var(--border-default)",
          borderRadius: 12,
          marginTop: 12,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "#ec4899",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: 24,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {student.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "var(--text-primary)",
              marginBottom: 4,
            }}
          >
            {student.name}
          </h1>
          <div style={{ display: "flex", gap: 12, fontSize: 13, color: "var(--text-muted)" }}>
            {student.classroom && (
              <Link
                href={`/x/educator/classrooms/${student.classroom.id}`}
                style={{ color: "var(--text-secondary)", textDecoration: "none" }}
              >
                {student.classroom.name}
              </Link>
            )}
            {student.domain && <span>{student.domain.name}</span>}
            <span>
              Joined{" "}
              {new Date(student.joinedAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            padding: 16,
            background: "var(--surface-primary)",
            border: "1px solid var(--border-default)",
            borderRadius: 10,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 28, fontWeight: 700, color: "#3b82f6" }}>{calls.length}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase" }}>
            Total Calls
          </div>
        </div>
        <div
          style={{
            padding: 16,
            background: "var(--surface-primary)",
            border: "1px solid var(--border-default)",
            borderRadius: 10,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 28, fontWeight: 700, color: "#10b981" }}>
            {goals.filter((g) => g.status === "COMPLETED").length}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase" }}>
            Goals Completed
          </div>
        </div>
        <div
          style={{
            padding: 16,
            background: "var(--surface-primary)",
            border: "1px solid var(--border-default)",
            borderRadius: 10,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 28, fontWeight: 700, color: "#8b5cf6" }}>
            {calls.length > 0
              ? new Date(calls[0].createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
              : "—"}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase" }}>
            Last Call
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Call History */}
        <div
          style={{
            background: "var(--surface-primary)",
            border: "1px solid var(--border-default)",
            borderRadius: 10,
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
            Call History
          </h3>
          {calls.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No calls yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {calls.map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "8px 0",
                    borderBottom: "1px solid var(--border-subtle)",
                    fontSize: 13,
                  }}
                >
                  <span style={{ color: "var(--text-secondary)" }}>
                    {new Date(c.createdAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Goals */}
        <div
          style={{
            background: "var(--surface-primary)",
            border: "1px solid var(--border-default)",
            borderRadius: 10,
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
            Learning Goals
          </h3>
          {goals.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No goals yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {goals.map((g) => {
                const colors: Record<string, string> = {
                  ACTIVE: "#3b82f6",
                  COMPLETED: "#10b981",
                  PAUSED: "#f59e0b",
                  ARCHIVED: "#6b7280",
                };
                return (
                  <div key={g.id}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 4,
                      }}
                    >
                      <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>
                        {g.name}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          color: colors[g.status] || "#6b7280",
                          textTransform: "uppercase",
                        }}
                      >
                        {g.status}
                      </span>
                    </div>
                    <div
                      style={{
                        height: 4,
                        background: "var(--border-default)",
                        borderRadius: 2,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${(g.progress ?? 0) * 100}%`,
                          background: colors[g.status] || "#6b7280",
                          borderRadius: 2,
                          transition: "width 0.3s",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
