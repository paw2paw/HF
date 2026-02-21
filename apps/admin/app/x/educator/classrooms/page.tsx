"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTerminology } from "@/contexts/TerminologyContext";

interface Classroom {
  id: string;
  name: string;
  description: string | null;
  domain: { id: string; name: string; slug: string };
  memberCount: number;
  isActive: boolean;
  joinToken: string | null;
  lastActivity: string | null;
  createdAt: string;
}

export default function ClassroomsPage() {
  const searchParams = useSearchParams();
  const institutionId = searchParams.get("institutionId");
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const { terms, plural, lower, lowerPlural } = useTerminology();

  useEffect(() => {
    const instQuery = institutionId ? `?institutionId=${institutionId}` : "";
    fetch(`/api/educator/classrooms${instQuery}`)
      .then((r) => r.json())
      .then((res: { ok: boolean; classrooms: Classroom[] }) => {
        if (res?.ok) setClassrooms(res.classrooms);
      })
      .finally(() => setLoading(false));
  }, [institutionId]);

  if (loading) {
    return (
      <div style={{ padding: 32 }}>
        <div style={{ fontSize: 15, color: "var(--text-muted)" }}>Loading {lowerPlural("cohort")}...</div>
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
          marginBottom: 24,
        }}
      >
        <div>
          <h1 className="hf-page-title" style={{ marginBottom: 4 }}>
            {plural("cohort")}
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            {classrooms.length} {classrooms.length !== 1 ? lowerPlural("cohort") : lower("cohort")}
          </p>
        </div>
        <Link
          href="/x/educator/classrooms/new"
          className="hf-btn hf-btn-primary"
          style={{ textDecoration: "none" }}
        >
          + New {terms.cohort}
        </Link>
      </div>

      {classrooms.length === 0 ? (
        <div className="hf-card text-center" style={{ padding: "60px 20px" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>👋</div>
          <h3 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
            No {lowerPlural("cohort")} yet
          </h3>
          <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 20 }}>
            Create your first {lower("cohort")} to start inviting {lowerPlural("caller")}.
          </p>
          <Link
            href="/x/educator/classrooms/new"
            className="hf-btn hf-btn-primary"
            style={{ textDecoration: "none" }}
          >
            Create {terms.cohort}
          </Link>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 16,
          }}
        >
          {classrooms.map((classroom) => (
            <Link
              key={classroom.id}
              href={`/x/educator/classrooms/${classroom.id}`}
              className="hf-card-compact home-stat-card flex flex-col"
              style={{
                padding: 20,
                textDecoration: "none",
                borderLeft: `3px solid ${classroom.isActive ? "var(--accent-primary)" : "var(--text-muted)"}`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 12,
                }}
              >
                <h3
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    margin: 0,
                  }}
                >
                  {classroom.name}
                </h3>
                {!classroom.isActive && (
                  <span
                    style={{
                      fontSize: 11,
                      padding: "2px 8px",
                      borderRadius: 4,
                      background: "var(--surface-tertiary)",
                      color: "var(--text-muted)",
                    }}
                  >
                    Archived
                  </span>
                )}
              </div>

              {classroom.description && (
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--text-muted)",
                    marginBottom: 12,
                    lineHeight: 1.4,
                  }}
                >
                  {classroom.description}
                </p>
              )}

              <div
                style={{
                  display: "flex",
                  gap: 16,
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  marginTop: "auto",
                }}
              >
                <span>{classroom.memberCount} {classroom.memberCount !== 1 ? lowerPlural("caller") : lower("caller")}</span>
                <span
                  style={{
                    padding: "1px 6px",
                    borderRadius: 4,
                    background: "var(--surface-secondary)",
                    fontSize: 12,
                  }}
                >
                  {classroom.domain.name}
                </span>
              </div>

              {classroom.lastActivity && (
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    marginTop: 8,
                  }}
                >
                  Last activity:{" "}
                  {new Date(classroom.lastActivity).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                  })}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
