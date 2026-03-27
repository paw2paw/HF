"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Plus, BookOpen } from "lucide-react";
import { useTerminology } from "@/contexts/TerminologyContext";

// ── Types ──────────────────────────────────────────────

interface SubjectCourse {
  id: string;
  name: string;
  slug: string;
  courses: {
    id: string;
    name: string;
    status: string;
    subjects: { subjectId: string }[];
  }[];
}

interface GroupDetail {
  id: string;
  domainId: string;
  name: string;
  slug: string;
  description: string | null;
  groupType: string;
  isActive: boolean;
  playbookCount: number;
  cohortCount: number;
  subjectCount: number;
  subjects: { id: string; slug: string; name: string }[];
  subjectCourses: SubjectCourse[];
  playbooks: { id: string; name: string; status: string }[];
}

// ── Page ───────────────────────────────────────────────

export default function DepartmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { terms, plural, lower, lowerPlural } = useTerminology();
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res = await fetch(`/api/playbook-groups/${id}`);
        const body = await res.json();
        if (body.ok) {
          setGroup(body.group);
        } else {
          setError(body.error || "Failed to load");
        }
      } catch {
        setError("Network error");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="hf-page-container">
        <div className="hf-text-muted">Loading...</div>
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="hf-page-container">
        <div className="hf-text-error">{error || "Not found"}</div>
      </div>
    );
  }

  // Courses not assigned to any subject in this group
  const assignedCourseIds = new Set(
    group.subjectCourses.flatMap((sc) => sc.courses.map((c) => c.id)),
  );
  const ungroupedCourses = group.playbooks.filter((pb) => !assignedCourseIds.has(pb.id));

  return (
    <div className="hf-page-container">
      {/* Back link */}
      <Link
        href="/x/educator/departments"
        className="hf-flex hf-gap-xs hf-text-sm hf-text-muted hf-link"
        style={{ marginBottom: 16, display: "inline-flex", alignItems: "center" }}
      >
        <ChevronLeft size={14} />
        {plural("group")}
      </Link>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h1 className="hf-page-title" style={{ margin: 0 }}>{group.name}</h1>
        <span className="hf-badge hf-badge-neutral">{group.groupType}</span>
      </div>

      {group.description && (
        <p className="hf-text-sm hf-text-muted" style={{ marginBottom: 16 }}>{group.description}</p>
      )}

      {/* Stats strip */}
      <div className="hf-flex hf-gap-lg hf-text-sm hf-text-muted" style={{ marginBottom: 24 }}>
        <span>{group.subjectCount} {group.subjectCount === 1 ? lower("knowledge_area") : lowerPlural("knowledge_area")}</span>
        <span>{group.playbookCount} {group.playbookCount === 1 ? lower("playbook") : lowerPlural("playbook")}</span>
        <span>{group.cohortCount} {group.cohortCount === 1 ? lower("cohort") : lowerPlural("cohort")}</span>
      </div>

      {/* Subject → Course hierarchy */}
      {group.subjectCourses.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {group.subjectCourses.map((sc) => (
            <div key={sc.id} className="hf-card" style={{ padding: 0, overflow: "hidden" }}>
              {/* Subject header */}
              <div
                style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid var(--border-primary)",
                  background: "var(--surface-secondary)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span className="hf-text-sm" style={{ fontWeight: 600 }}>{sc.name}</span>
                <span className="hf-text-xs hf-text-muted">
                  {sc.courses.length} {sc.courses.length === 1 ? lower("playbook") : lowerPlural("playbook")}
                </span>
              </div>

              {/* Course rows */}
              {sc.courses.length > 0 ? (
                sc.courses.map((course) => (
                  <Link
                    key={course.id}
                    href={`/x/courses/${course.id}`}
                    className="hf-flex hf-gap-md"
                    style={{
                      padding: "10px 16px",
                      borderBottom: "1px solid var(--border-secondary)",
                      alignItems: "center",
                      textDecoration: "none",
                      color: "inherit",
                    }}
                  >
                    <BookOpen size={14} className="hf-text-muted" />
                    <span className="hf-text-sm" style={{ flex: 1 }}>{course.name}</span>
                    <span className={`hf-badge hf-badge-${course.status === "PUBLISHED" ? "success" : course.status === "DRAFT" ? "warning" : "neutral"}`}>
                      {course.status}
                    </span>
                  </Link>
                ))
              ) : (
                <div style={{ padding: "10px 16px" }} className="hf-text-sm hf-text-muted">
                  No {lowerPlural("playbook")} yet
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="hf-card hf-text-center" style={{ padding: 32 }}>
          <p className="hf-text-muted">No {lowerPlural("knowledge_area")} linked to this {lower("group")} yet.</p>
          <p className="hf-text-xs hf-text-muted" style={{ marginTop: 8 }}>
            {plural("knowledge_area")} are linked automatically when you create a {lower("playbook")} in this {lower("group")}.
          </p>
        </div>
      )}

      {/* Ungrouped courses (in this dept but not linked to any subject) */}
      {ungroupedCourses.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3 className="hf-text-sm hf-text-muted" style={{ marginBottom: 8 }}>
            {plural("playbook")} without a {lower("knowledge_area")}
          </h3>
          <div className="hf-card" style={{ padding: 0, overflow: "hidden" }}>
            {ungroupedCourses.map((course) => (
              <Link
                key={course.id}
                href={`/x/courses/${course.id}`}
                className="hf-flex hf-gap-md"
                style={{
                  padding: "10px 16px",
                  borderBottom: "1px solid var(--border-secondary)",
                  alignItems: "center",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <BookOpen size={14} className="hf-text-muted" />
                <span className="hf-text-sm" style={{ flex: 1 }}>{course.name}</span>
                <span className={`hf-badge hf-badge-${course.status === "PUBLISHED" ? "success" : "warning"}`}>
                  {course.status}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
