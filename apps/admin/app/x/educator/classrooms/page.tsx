"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTerminology } from "@/contexts/TerminologyContext";
import { useSession } from "next-auth/react";

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
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const { terms, plural, lower, lowerPlural } = useTerminology();

  const { data: session } = useSession();
  const isOperator = ["OPERATOR", "EDUCATOR", "ADMIN", "SUPERADMIN"].includes((session?.user?.role as string) || "");

  const handleArchive = async (id: string) => {
    setArchiving(true);
    setArchiveError(null);
    try {
      const res = await fetch(`/api/educator/classrooms/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Failed to archive");
      setClassrooms((prev) => prev.map((c) => c.id === id ? { ...c, isActive: false } : c));
    } catch (err: any) {
      setArchiveError(err.message || "Failed to archive");
    } finally {
      setArchiving(false);
      setConfirmArchiveId(null);
    }
  };

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
        {isOperator && (
          <Link
            href="/x/educator/classrooms/new"
            className="hf-btn hf-btn-primary"
            style={{ textDecoration: "none" }}
          >
            + New {terms.cohort}
          </Link>
        )}
      </div>

      {archiveError && (
        <div className="hf-banner hf-banner-error" style={{ justifyContent: "space-between" }}>
          <span>{archiveError}</span>
          <button
            onClick={() => setArchiveError(null)}
            className="hf-btn-ghost"
            style={{ padding: 0, fontSize: 12, color: "inherit", textDecoration: "underline" }}
          >
            Dismiss
          </button>
        </div>
      )}

      {classrooms.length === 0 ? (
        <div className="hf-card text-center" style={{ padding: "60px 20px" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>👋</div>
          <h3 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
            No {lowerPlural("cohort")} yet
          </h3>
          <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 20 }}>
            Create your first {lower("cohort")} to start inviting {lowerPlural("caller")}.
          </p>
          {isOperator && (
            <Link
              href="/x/educator/classrooms/new"
              className="hf-btn hf-btn-primary"
              style={{ textDecoration: "none" }}
            >
              Create {terms.cohort}
            </Link>
          )}
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

              {/* Archive action */}
              {isOperator && classroom.isActive && (
                <div
                  style={{ paddingTop: 10, marginTop: 10, borderTop: "1px solid var(--border-default)" }}
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
                >
                  {confirmArchiveId === classroom.id ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                      <span style={{ color: "var(--status-error-text)" }}>Archive?</span>
                      <button
                        onClick={() => handleArchive(classroom.id)}
                        disabled={archiving}
                        className="hf-btn hf-btn-destructive"
                        style={{ padding: "2px 8px", fontSize: 11 }}
                      >
                        {archiving ? "..." : "Yes"}
                      </button>
                      <button
                        onClick={() => setConfirmArchiveId(null)}
                        className="hf-btn hf-btn-secondary"
                        style={{ padding: "2px 8px", fontSize: 11 }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmArchiveId(classroom.id)}
                      className="hf-btn-ghost"
                      style={{ padding: 0, fontSize: 11 }}
                    >
                      Archive
                    </button>
                  )}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
