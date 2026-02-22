"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useBackgroundTaskQueue } from "@/components/shared/ContentJobQueue";
import { useTaskPoll } from "@/hooks/useTaskPoll";

// ── Types ──

interface SnapshotInfo {
  name: string;
  fileSize: number;
  metadata: {
    name: string;
    description?: string;
    version: string;
    createdAt: string;
    layers: number[];
    withLearners: boolean;
    stats: Record<string, number>;
    totalRows: number;
  };
}

// ── Page ──

export default function SnapshotsPage() {
  const { data: session } = useSession();
  const isSuperAdmin = session?.user?.role === "SUPERADMIN";
  const { addSnapshotJob } = useBackgroundTaskQueue();

  const [snapshots, setSnapshots] = useState<SnapshotInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showTakeModal, setShowTakeModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);

  // Active job tracking
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [activeTaskType, setActiveTaskType] = useState<"take" | "restore" | null>(null);

  // ── Fetch snapshots ──

  const fetchSnapshots = useCallback(async () => {
    try {
      const res = await fetch("/api/snapshots");
      const data = await res.json();
      if (data.ok) {
        setSnapshots(data.snapshots);
      } else {
        setError(data.error || "Failed to load snapshots");
      }
    } catch {
      setError("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSnapshots();
  }, [fetchSnapshots]);

  // Check for active snapshot tasks on mount (re-entry)
  useEffect(() => {
    async function checkActiveTasks() {
      try {
        const res = await fetch("/api/tasks?status=in_progress");
        const data = await res.json();
        if (data.ok && data.tasks) {
          const snapshotTask = data.tasks.find(
            (t: any) => t.taskType === "snapshot_take" || t.taskType === "snapshot_restore"
          );
          if (snapshotTask) {
            setActiveTaskId(snapshotTask.id);
            setActiveTaskType(snapshotTask.taskType === "snapshot_take" ? "take" : "restore");
          }
        }
      } catch {
        // Ignore
      }
    }
    checkActiveTasks();
  }, []);

  // Poll active task
  useTaskPoll({
    taskId: activeTaskId,
    onComplete: () => {
      setActiveTaskId(null);
      setActiveTaskType(null);
      fetchSnapshots();
    },
    onError: (msg) => {
      setError(msg);
      setActiveTaskId(null);
      setActiveTaskType(null);
    },
  });

  // ── Actions ──

  const handleTake = async (name: string, description: string, withLearners: boolean) => {
    setError(null);
    try {
      const res = await fetch("/api/snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, withLearners }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Failed to start snapshot");

      setActiveTaskId(data.taskId);
      setActiveTaskType("take");
      addSnapshotJob(data.taskId, name, "take");
      setShowTakeModal(false);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRestore = async (name: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/snapshots/${encodeURIComponent(name)}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Failed to start restore");

      setActiveTaskId(data.taskId);
      setActiveTaskType("restore");
      addSnapshotJob(data.taskId, name, "restore");
      setShowRestoreModal(null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (name: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/snapshots/${encodeURIComponent(name)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Failed to delete");

      setSnapshots((prev) => prev.filter((s) => s.name !== name));
      setShowDeleteModal(null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // ── Helpers ──

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // ── Loading ──

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
        <div className="hf-spinner" />
      </div>
    );
  }

  // ── Render ──

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 className="hf-page-title" style={{ marginBottom: 4 }}>
            Database Snapshots
          </h1>
          <p className="hf-page-subtitle">
            Save and restore database state
          </p>
        </div>
        <button
          className="hf-btn hf-btn-primary"
          onClick={() => setShowTakeModal(true)}
          disabled={!!activeTaskId}
        >
          Take Snapshot
        </button>
      </div>

      {/* Active job banner */}
      {activeTaskId && (
        <div className="hf-banner hf-banner-info" style={{ marginBottom: 16 }}>
          {activeTaskType === "take"
            ? "Taking snapshot... Check the background jobs badge for progress."
            : "Restoring snapshot... The database is being updated."}
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="hf-banner hf-banner-error" style={{ marginBottom: 16 }}>
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "inherit" }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Empty state */}
      {snapshots.length === 0 && !activeTaskId ? (
        <div className="hf-card" style={{ textAlign: "center", padding: 48 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📸</div>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4, color: "var(--text-primary)" }}>
            No snapshots yet
          </h3>
          <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 16 }}>
            Take a snapshot to save the current database state. You can restore it later.
          </p>
          <button className="hf-btn hf-btn-primary" onClick={() => setShowTakeModal(true)}>
            Take First Snapshot
          </button>
        </div>
      ) : (
        /* Snapshot cards */
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {snapshots.map((snap) => (
            <div key={snap.name} className="hf-card" style={{ padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
                      {snap.name}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        padding: "2px 8px",
                        borderRadius: 4,
                        background: snap.metadata.withLearners
                          ? "color-mix(in srgb, var(--accent-primary) 15%, transparent)"
                          : "var(--surface-secondary)",
                        color: snap.metadata.withLearners
                          ? "var(--accent-primary)"
                          : "var(--text-muted)",
                        fontWeight: 600,
                      }}
                    >
                      {snap.metadata.withLearners ? "L0-3" : "L0-2"}
                    </span>
                  </div>
                  {snap.metadata.description && (
                    <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>
                      {snap.metadata.description}
                    </p>
                  )}
                  <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--text-muted)" }}>
                    <span>{formatDate(snap.metadata.createdAt)}</span>
                    <span>{formatBytes(snap.fileSize)}</span>
                    <span>{snap.metadata.totalRows.toLocaleString()} rows</span>
                    <span>{Object.keys(snap.metadata.stats).length} tables</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  {isSuperAdmin && (
                    <button
                      className="hf-btn hf-btn-secondary"
                      onClick={() => setShowRestoreModal(snap.name)}
                      disabled={!!activeTaskId}
                      style={{ fontSize: 13 }}
                    >
                      Restore
                    </button>
                  )}
                  <button
                    className="hf-btn hf-btn-secondary"
                    onClick={() => setShowDeleteModal(snap.name)}
                    disabled={!!activeTaskId}
                    style={{ fontSize: 13 }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Take Snapshot Modal */}
      {showTakeModal && (
        <TakeModal
          onTake={handleTake}
          onClose={() => setShowTakeModal(false)}
        />
      )}

      {/* Restore Confirmation Modal */}
      {showRestoreModal && (
        <RestoreModal
          snapshotName={showRestoreModal}
          snapshot={snapshots.find((s) => s.name === showRestoreModal)!}
          onRestore={handleRestore}
          onClose={() => setShowRestoreModal(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <DeleteModal
          snapshotName={showDeleteModal}
          onDelete={handleDelete}
          onClose={() => setShowDeleteModal(null)}
        />
      )}
    </div>
  );
}

// ── Take Modal ──

function TakeModal({
  onTake,
  onClose,
}: {
  onTake: (name: string, description: string, withLearners: boolean) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [withLearners, setWithLearners] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isValid = /^[a-zA-Z0-9_-]+$/.test(name) && name.length > 0;

  const handleSubmit = async () => {
    if (!isValid) return;
    setSubmitting(true);
    await onTake(name, description, withLearners);
    setSubmitting(false);
  };

  return (
    <ModalOverlay onClose={onClose}>
      <div className="hf-card" style={{ width: 480, padding: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: "var(--text-primary)" }}>
          Take Snapshot
        </h2>

        <div style={{ marginBottom: 16 }}>
          <label className="hf-label">Name</label>
          <input
            className="hf-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. after-golden-seed"
            autoFocus
          />
          {name && !isValid && (
            <p style={{ fontSize: 12, color: "var(--status-error-text)", marginTop: 4 }}>
              Use alphanumeric characters, hyphens, and underscores only
            </p>
          )}
        </div>

        <div style={{ marginBottom: 16 }}>
          <label className="hf-label">Description (optional)</label>
          <textarea
            className="hf-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What state does this capture?"
            rows={2}
            style={{ resize: "vertical" }}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--text-primary)", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={withLearners}
              onChange={(e) => setWithLearners(e.target.checked)}
            />
            Include learner data (callers, calls, memories)
          </label>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, marginLeft: 24 }}>
            {withLearners
              ? "Layers 0-3: System + Specs + Organisation + Learners"
              : "Layers 0-2: System + Specs + Organisation only"}
          </p>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="hf-btn hf-btn-secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            className="hf-btn hf-btn-primary"
            onClick={handleSubmit}
            disabled={!isValid || submitting}
          >
            {submitting ? "Starting..." : "Take Snapshot"}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

// ── Restore Modal ──

function RestoreModal({
  snapshotName,
  snapshot,
  onRestore,
  onClose,
}: {
  snapshotName: string;
  snapshot: SnapshotInfo;
  onRestore: (name: string) => void;
  onClose: () => void;
}) {
  const [confirmText, setConfirmText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const confirmed = confirmText === snapshotName;

  const handleSubmit = async () => {
    if (!confirmed) return;
    setSubmitting(true);
    await onRestore(snapshotName);
    setSubmitting(false);
  };

  return (
    <ModalOverlay onClose={onClose}>
      <div className="hf-card" style={{ width: 480, padding: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: "var(--text-primary)" }}>
          Restore Snapshot
        </h2>

        <div className="hf-banner hf-banner-error" style={{ marginBottom: 16 }}>
          This will <strong>REPLACE all data</strong> in{" "}
          {snapshot.metadata.withLearners ? "layers 0-3" : "layers 0-2"}.
          This action cannot be undone.
        </div>

        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
          <p><strong>Snapshot:</strong> {snapshotName}</p>
          <p><strong>Created:</strong> {new Date(snapshot.metadata.createdAt).toLocaleString()}</p>
          <p><strong>Rows:</strong> {snapshot.metadata.totalRows.toLocaleString()}</p>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label className="hf-label">
            Type <strong>{snapshotName}</strong> to confirm
          </label>
          <input
            className="hf-input"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={snapshotName}
            autoFocus
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="hf-btn hf-btn-secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            className="hf-btn hf-btn-destructive"
            onClick={handleSubmit}
            disabled={!confirmed || submitting}
          >
            {submitting ? "Starting..." : "Restore"}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

// ── Delete Modal ──

function DeleteModal({
  snapshotName,
  onDelete,
  onClose,
}: {
  snapshotName: string;
  onDelete: (name: string) => void;
  onClose: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  const handleDelete = async () => {
    setSubmitting(true);
    await onDelete(snapshotName);
    setSubmitting(false);
  };

  return (
    <ModalOverlay onClose={onClose}>
      <div className="hf-card" style={{ width: 400, padding: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: "var(--text-primary)" }}>
          Delete Snapshot
        </h2>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 20 }}>
          Delete snapshot &ldquo;{snapshotName}&rdquo;? This cannot be undone.
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="hf-btn hf-btn-secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button className="hf-btn hf-btn-destructive" onClick={handleDelete} disabled={submitting}>
            {submitting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

// ── Modal Overlay ──

function ModalOverlay({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "color-mix(in srgb, var(--text-primary) 40%, transparent)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {children}
    </div>
  );
}
