"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type RosterEntry = {
  id: string;
  status: string;
  enrolledAt: string;
  enrolledBy: string | null;
  caller: {
    id: string;
    name: string | null;
    email: string | null;
  };
};

const ROSTER_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  ACTIVE: { bg: "var(--badge-green-bg)", text: "var(--badge-green-text)" },
  COMPLETED: { bg: "var(--badge-blue-bg)", text: "var(--badge-blue-text)" },
  PAUSED: { bg: "var(--badge-yellow-bg)", text: "var(--badge-yellow-text)" },
  DROPPED: { bg: "var(--surface-secondary)", text: "var(--text-muted)" },
};

export type RosterTabContentProps = {
  playbookId: string;
  onCountChange: (count: number | null) => void;
};

export function RosterTabContent({ playbookId, onCountChange }: RosterTabContentProps) {
  return (
    <PlaybookRosterSection playbookId={playbookId} onCountChange={onCountChange} />
  );
}

function PlaybookRosterSection({
  playbookId,
  onCountChange,
}: {
  playbookId: string;
  onCountChange: (count: number | null) => void;
}) {
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [bulkCallerIds, setBulkCallerIds] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");

  const fetchRoster = useCallback(async () => {
    try {
      const qs = statusFilter ? `?status=${statusFilter}` : "";
      const res = await fetch(`/api/playbooks/${playbookId}/enrollments${qs}`);
      const result = await res.json();
      if (result.ok) {
        setRoster(result.enrollments || []);
        onCountChange(result.enrollments?.length ?? null);
      }
    } catch (err) {
      console.error("Error fetching roster:", err);
    } finally {
      setLoading(false);
    }
  }, [playbookId, statusFilter, onCountChange]);

  useEffect(() => {
    fetchRoster();
  }, [fetchRoster]);

  const handleBulkEnroll = async () => {
    const ids = bulkCallerIds
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (ids.length === 0) return;
    setEnrolling(true);
    try {
      const res = await fetch(`/api/playbooks/${playbookId}/enrollments/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callerIds: ids }),
      });
      if (res.ok) {
        setBulkCallerIds("");
        setShowAdd(false);
        await fetchRoster();
      }
    } catch (err) {
      console.error("Error bulk enrolling:", err);
    } finally {
      setEnrolling(false);
    }
  };

  const handleStatusChange = async (enrollmentId: string, callerId: string, newStatus: string) => {
    setUpdating(enrollmentId);
    try {
      const res = await fetch(`/api/callers/${callerId}/enrollments/${enrollmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        await fetchRoster();
      }
    } catch (err) {
      console.error("Error updating enrollment:", err);
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", marginTop: 24 }}>Loading roster...</div>
    );
  }

  return (
    <div style={{ marginTop: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
            Class Roster
          </span>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {roster.length} enrolled
          </span>
          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              fontSize: 11,
              padding: "3px 8px",
              border: "1px solid var(--input-border)",
              borderRadius: 4,
              background: "var(--surface-primary)",
              color: "var(--text-secondary)",
            }}
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="COMPLETED">Completed</option>
            <option value="PAUSED">Paused</option>
            <option value="DROPPED">Dropped</option>
          </select>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          style={{
            padding: "5px 12px",
            fontSize: 12,
            fontWeight: 600,
            background: showAdd ? "var(--surface-secondary)" : "var(--button-primary-bg)",
            color: showAdd ? "var(--text-secondary)" : "var(--button-primary-text)",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          {showAdd ? "Cancel" : "+ Add Callers"}
        </button>
      </div>

      {/* Bulk add panel */}
      {showAdd && (
        <div style={{ padding: 12, background: "var(--surface-secondary)", borderRadius: 8, marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 }}>
            Paste caller IDs (comma or newline separated):
          </div>
          <textarea
            value={bulkCallerIds}
            onChange={(e) => setBulkCallerIds(e.target.value)}
            placeholder="caller-id-1, caller-id-2, ..."
            rows={3}
            style={{
              width: "100%",
              padding: 8,
              fontSize: 12,
              fontFamily: "monospace",
              border: "1px solid var(--input-border)",
              borderRadius: 6,
              background: "var(--surface-primary)",
              color: "var(--text-primary)",
              resize: "vertical",
            }}
          />
          <button
            onClick={handleBulkEnroll}
            disabled={enrolling || !bulkCallerIds.trim()}
            style={{
              marginTop: 6,
              padding: "5px 14px",
              fontSize: 12,
              fontWeight: 600,
              background: "var(--button-primary-bg)",
              color: "var(--button-primary-text)",
              border: "none",
              borderRadius: 5,
              cursor: enrolling ? "not-allowed" : "pointer",
              opacity: enrolling || !bulkCallerIds.trim() ? 0.6 : 1,
            }}
          >
            {enrolling ? "Enrolling..." : "Enroll All"}
          </button>
        </div>
      )}

      {/* Empty state */}
      {roster.length === 0 && (
        <div style={{ padding: 40, textAlign: "center", background: "var(--background)", borderRadius: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>No callers enrolled</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Use &ldquo;Add Callers&rdquo; to enroll callers in this playbook.
          </div>
        </div>
      )}

      {/* Roster table */}
      {roster.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {/* Header row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 120px 80px 100px 120px",
              gap: 8,
              padding: "6px 12px",
              fontSize: 10,
              fontWeight: 700,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            <span>Caller</span>
            <span>Status</span>
            <span>Source</span>
            <span>Enrolled</span>
            <span>Actions</span>
          </div>
          {roster.map((entry) => {
            const colors = ROSTER_STATUS_COLORS[entry.status] || ROSTER_STATUS_COLORS.ACTIVE;
            const isUpdating = updating === entry.id;
            return (
              <div
                key={entry.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 120px 80px 100px 120px",
                  gap: 8,
                  padding: "8px 12px",
                  background: "var(--surface-primary)",
                  border: "1px solid var(--border-default)",
                  borderRadius: 6,
                  fontSize: 13,
                  alignItems: "center",
                }}
              >
                <Link
                  href={`/x/callers/${entry.caller.id}`}
                  style={{ textDecoration: "none", color: "var(--text-primary)", fontWeight: 500 }}
                >
                  {entry.caller.name || entry.caller.email || entry.caller.id}
                </Link>
                <span
                  style={{
                    display: "inline-block",
                    width: "fit-content",
                    padding: "2px 8px",
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    borderRadius: 10,
                    background: colors.bg,
                    color: colors.text,
                  }}
                >
                  {entry.status}
                </span>
                <span style={{ fontSize: 11, color: "var(--text-placeholder)" }}>{entry.enrolledBy || "—"}</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
                  {new Date(entry.enrolledAt).toLocaleDateString()}
                </span>
                <div style={{ display: "flex", gap: 4 }}>
                  {isUpdating ? (
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>...</span>
                  ) : (
                    <>
                      {entry.status === "ACTIVE" && (
                        <>
                          <button onClick={() => handleStatusChange(entry.id, entry.caller.id, "PAUSED")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "var(--text-muted)", padding: "2px 4px" }}>Pause</button>
                          <button onClick={() => handleStatusChange(entry.id, entry.caller.id, "DROPPED")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#dc2626", padding: "2px 4px" }}>Drop</button>
                        </>
                      )}
                      {entry.status === "PAUSED" && (
                        <button onClick={() => handleStatusChange(entry.id, entry.caller.id, "ACTIVE")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "var(--button-primary-bg)", padding: "2px 4px" }}>Resume</button>
                      )}
                      {entry.status === "DROPPED" && (
                        <button onClick={() => handleStatusChange(entry.id, entry.caller.id, "ACTIVE")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "var(--button-primary-bg)", padding: "2px 4px" }}>Re-enroll</button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
