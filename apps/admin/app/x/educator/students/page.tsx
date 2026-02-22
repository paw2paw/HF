"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTerminology } from "@/contexts/TerminologyContext";

interface Student {
  id: string;
  name: string;
  email: string | null;
  classroom: { id: string; name: string } | null;
  totalCalls: number;
  lastCallAt: string | null;
  joinedAt: string;
}

interface ActiveCall {
  callId: string;
  callerId: string;
}

export default function StudentsPage() {
  const searchParams = useSearchParams();
  const institutionId = searchParams.get("institutionId");
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCalls, setActiveCalls] = useState<Map<string, string>>(new Map());
  const { plural, lower, lowerPlural } = useTerminology();

  useEffect(() => {
    const instQuery = institutionId ? `?institutionId=${institutionId}` : "";
    Promise.all([
      fetch(`/api/educator/students${instQuery}`).then((r) => r.json()),
      fetch(`/api/educator/active-calls${instQuery}`).then((r) => r.json()),
    ])
      .then(([studentsRes, callsRes]: [{ ok: boolean; students: Student[] }, { ok: boolean; activeCalls: ActiveCall[] }]) => {
        if (studentsRes?.ok) setStudents(studentsRes.students);
        if (callsRes?.ok) {
          const map = new Map<string, string>();
          for (const c of callsRes.activeCalls) {
            if (c.callerId) map.set(c.callerId, c.callId);
          }
          setActiveCalls(map);
        }
      })
      .finally(() => setLoading(false));
  }, [institutionId]);

  const filtered = search
    ? students.filter(
        (s) =>
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          s.classroom?.name.toLowerCase().includes(search.toLowerCase()) ||
          (!s.classroom && "unassigned".includes(search.toLowerCase()))
      )
    : students;

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;

  if (loading) {
    return (
      <div style={{ padding: 32 }}>
        <div style={{ fontSize: 15, color: "var(--text-muted)" }}>Loading...</div>
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <div>
          <h1 className="hf-page-title" style={{ marginBottom: 4 }}>
            {plural("caller")}
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            {students.length} {students.length !== 1 ? lowerPlural("caller") : lower("caller")}
            {students.some((s) => !s.classroom) && (
              <> &middot; {students.filter((s) => !s.classroom).length} unassigned</>
            )}
          </p>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${lowerPlural("caller")}...`}
          style={{
            padding: "8px 14px",
            border: "1px solid var(--border-default)",
            borderRadius: 8,
            fontSize: 14,
            background: "var(--surface-secondary)",
            color: "var(--text-primary)",
            outline: "none",
            width: 240,
          }}
        />
      </div>

      {filtered.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "40px 20px",
            color: "var(--text-muted)",
            fontSize: 14,
          }}
        >
          {search ? `No ${lowerPlural("caller")} match your search.` : `No ${lowerPlural("caller")} yet. Invite them via your ${lowerPlural("cohort")}.`}
        </div>
      ) : (
        <div
          style={{
            background: "var(--surface-primary)",
            border: "1px solid var(--border-default)",
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid var(--border-default)",
                  fontSize: 12,
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600 }}>Name</th>
                <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600 }}>Classroom</th>
                <th style={{ padding: "10px 16px", textAlign: "center", fontWeight: 600 }}>Calls</th>
                <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600 }}>Last Call</th>
                <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const lastCall = s.lastCallAt ? new Date(s.lastCallAt).getTime() : 0;
                const neverCalled = !s.lastCallAt;
                const isActive = lastCall > threeDaysAgo;
                const isModerate = !neverCalled && lastCall > sevenDaysAgo;

                let statusColor = "var(--status-error-text)"; // red — 7+ days
                let statusLabel = "Inactive 7d+";
                if (neverCalled) { statusColor = "var(--text-muted)"; statusLabel = "Not started"; }
                else if (isActive) { statusColor = "var(--status-success-text)"; statusLabel = "Active"; }
                else if (isModerate) { statusColor = "var(--status-warning-text)"; statusLabel = "3-7 days ago"; }

                return (
                  <tr key={s.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <td style={{ padding: "10px 16px" }}>
                      <Link
                        href={`/x/educator/students/${s.id}`}
                        style={{
                          fontSize: 14,
                          fontWeight: 500,
                          color: "var(--text-primary)",
                          textDecoration: "none",
                        }}
                      >
                        {s.name}
                      </Link>
                    </td>
                    <td style={{ padding: "10px 16px" }}>
                      {s.classroom ? (
                        <Link
                          href={`/x/educator/classrooms/${s.classroom.id}`}
                          style={{
                            fontSize: 13,
                            color: "var(--text-secondary)",
                            textDecoration: "none",
                            padding: "2px 8px",
                            background: "var(--surface-secondary)",
                            borderRadius: 4,
                          }}
                        >
                          {s.classroom.name}
                        </Link>
                      ) : (
                        <span
                          style={{
                            fontSize: 12,
                            color: "var(--status-warning-text)",
                            padding: "2px 8px",
                            background: "var(--status-warning-bg)",
                            borderRadius: 4,
                            fontWeight: 500,
                          }}
                        >
                          Unassigned
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "10px 16px", textAlign: "center", fontSize: 14, color: "var(--text-secondary)" }}>
                      {s.totalCalls}
                    </td>
                    <td style={{ padding: "10px 16px", fontSize: 13, color: "var(--text-muted)" }}>
                      {s.lastCallAt
                        ? new Date(s.lastCallAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                        : "—"}
                    </td>
                    <td style={{ padding: "10px 16px" }}>
                      {activeCalls.has(s.id) ? (
                        <Link
                          href={`/x/educator/observe/${activeCalls.get(s.id)}`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            color: "var(--status-success-text)",
                            textDecoration: "none",
                            padding: "2px 8px",
                            background: "var(--status-success-bg)",
                            borderRadius: 6,
                            border: "1px solid var(--status-success-border)",
                          }}
                        >
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--status-success-text)", animation: "pulse 2s infinite" }} />
                          In Call — Observe
                        </Link>
                      ) : (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            fontSize: 12,
                            color: statusColor,
                          }}
                        >
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: statusColor }} />
                          {statusLabel}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
