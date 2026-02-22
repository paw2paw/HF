"use client";

import { useEffect, useState, useCallback } from "react";
import { ErrorBanner } from "@/components/shared/ErrorBanner";

interface Enrollment {
  id: string;
  playbookId: string;
  status: "ACTIVE" | "COMPLETED" | "PAUSED" | "DROPPED";
  enrolledAt: string;
  completedAt: string | null;
  playbook: { id: string; name: string; status: string; domainId: string };
}

interface AvailablePlaybook {
  id: string;
  name: string;
  status: string;
}

interface StudentEnrollmentsSectionProps {
  studentId: string;
  domainId: string | null | undefined;
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "var(--status-success-text)",
  COMPLETED: "var(--accent-primary)",
  PAUSED: "var(--status-warning-text)",
  DROPPED: "var(--text-muted)",
};

export function StudentEnrollmentsSection({ studentId, domainId }: StudentEnrollmentsSectionProps) {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [available, setAvailable] = useState<AvailablePlaybook[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchEnrollments = useCallback(async () => {
    try {
      const res = await fetch(`/api/educator/students/${studentId}/enrollments`);
      const data = await res.json();
      if (data.ok) setEnrollments(data.enrollments);
    } catch {
      // silently fail — section is supplementary
    }
  }, [studentId]);

  const fetchAvailable = useCallback(async () => {
    if (!domainId) return;
    try {
      const res = await fetch(`/api/educator/playbooks?domainId=${domainId}`);
      const data = await res.json();
      if (data.ok) setAvailable(data.playbooks || []);
    } catch {
      // silently fail
    }
  }, [domainId]);

  useEffect(() => {
    Promise.all([fetchEnrollments(), fetchAvailable()]).finally(() => setLoading(false));
  }, [fetchEnrollments, fetchAvailable]);

  const enrolledIds = new Set(enrollments.map((e) => e.playbookId));
  const unenrolled = available.filter((p) => !enrolledIds.has(p.id) && p.status === "PUBLISHED");

  const handleEnroll = async (playbookId: string) => {
    setEnrolling(true);
    setError(null);
    try {
      const res = await fetch(`/api/educator/students/${studentId}/enrollments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playbookId }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Failed to enroll");
        return;
      }
      await fetchEnrollments();
    } catch {
      setError("Failed to enroll");
    } finally {
      setEnrolling(false);
    }
  };

  const handleStatusChange = async (enrollmentId: string, status: string) => {
    setUpdating(enrollmentId);
    setError(null);
    try {
      const res = await fetch(`/api/educator/students/${studentId}/enrollments/${enrollmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Failed to update");
        return;
      }
      await fetchEnrollments();
    } catch {
      setError("Failed to update");
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="hf-card" style={{ marginTop: 20 }}>
        <h3 className="hf-section-title">Course Enrolments</h3>
        <p className="hf-section-desc">Loading...</p>
      </div>
    );
  }

  return (
    <div className="hf-card" style={{ marginTop: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 className="hf-section-title" style={{ marginBottom: 0 }}>Course Enrolments</h3>
        {unenrolled.length > 0 && (
          <select
            disabled={enrolling}
            onChange={(e) => {
              if (e.target.value) handleEnroll(e.target.value);
              e.target.value = "";
            }}
            className="hf-input"
            style={{ width: "auto", minWidth: 180 }}
            defaultValue=""
          >
            <option value="" disabled>
              {enrolling ? "Enrolling..." : "Enrol in course..."}
            </option>
            {unenrolled.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <ErrorBanner error={error} style={{ marginBottom: 12 }} />

      {enrollments.length === 0 ? (
        <p className="hf-section-desc">
          Not enrolled in any courses yet.
          {unenrolled.length > 0 && " Use the dropdown above to enrol."}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {enrollments.map((e) => (
            <div key={e.id} className="hf-list-row" style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>
                {e.playbook.name}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  color: STATUS_COLORS[e.status] || "var(--text-muted)",
                  letterSpacing: "0.04em",
                }}
              >
                {e.status}
              </span>
              {e.status === "ACTIVE" && (
                <button
                  className="hf-btn hf-btn-secondary"
                  style={{ fontSize: 12, padding: "4px 10px" }}
                  disabled={updating === e.id}
                  onClick={() => handleStatusChange(e.id, "PAUSED")}
                >
                  Pause
                </button>
              )}
              {e.status === "PAUSED" && (
                <button
                  className="hf-btn hf-btn-primary"
                  style={{ fontSize: 12, padding: "4px 10px" }}
                  disabled={updating === e.id}
                  onClick={() => handleStatusChange(e.id, "ACTIVE")}
                >
                  Resume
                </button>
              )}
              {(e.status === "ACTIVE" || e.status === "PAUSED") && (
                <button
                  className="hf-btn hf-btn-destructive"
                  style={{ fontSize: 12, padding: "4px 10px" }}
                  disabled={updating === e.id}
                  onClick={() => handleStatusChange(e.id, "DROPPED")}
                >
                  Drop
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
