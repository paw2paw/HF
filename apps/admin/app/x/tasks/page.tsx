"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// ── Types ──────────────────────────────────────────

interface UserTask {
  id: string;
  taskType: string;
  status: "in_progress" | "completed" | "abandoned";
  currentStep: number;
  totalSteps: number;
  completedSteps: string[];
  blockers: string[];
  context: any;
  startedAt: string;
  completedAt: string | null;
  archivedAt: string | null;
  updatedAt: string;
}

// ── Task Type Labels ───────────────────────────────

const TASK_TYPE_LABELS: Record<string, { label: string; icon: string; resumePath: string; isBackground?: boolean }> = {
  quick_launch: {
    label: "Quick Launch",
    icon: "Zap",
    resumePath: "/x/quick-launch",
  },
  create_spec: {
    label: "Create Spec",
    icon: "ClipboardList",
    resumePath: "/x/specs",
  },
  configure_caller: {
    label: "Configure Caller",
    icon: "User",
    resumePath: "/x/callers",
  },
  extraction: {
    label: "Content Extraction",
    icon: "FileSearch",
    resumePath: "/x/content-sources",
    isBackground: true,
  },
  curriculum_generation: {
    label: "Curriculum Generation",
    icon: "BookOpen",
    resumePath: "/x/subjects",
    isBackground: true,
  },
  content_wizard: {
    label: "Content Wizard",
    icon: "BookPlus",
    resumePath: "/x/subjects",
  },
};

function getTaskLabel(task: UserTask): string {
  const base = TASK_TYPE_LABELS[task.taskType]?.label || task.taskType.replace(/_/g, " ");
  const ctx = task.context;
  if (task.taskType === "quick_launch" && ctx?.input?.subjectName) {
    return `${base} — ${ctx.input.subjectName}`;
  }
  if (task.taskType === "extraction" && ctx?.fileName) {
    return `${base} — ${ctx.fileName}`;
  }
  if (task.taskType === "curriculum_generation" && ctx?.subjectName) {
    return `${base} — ${ctx.subjectName}`;
  }
  if (task.taskType === "content_wizard" && ctx?.subjectName) {
    return `${base} — ${ctx.subjectName}`;
  }
  return base;
}

function getResumePath(task: UserTask): string {
  const ctx = task.context;
  if (task.taskType === "curriculum_generation" && ctx?.subjectId) {
    return `/x/subjects/${ctx.subjectId}`;
  }
  if (task.taskType === "content_wizard" && ctx?.subjectId) {
    return `/x/subjects/${ctx.subjectId}`;
  }
  return TASK_TYPE_LABELS[task.taskType]?.resumePath || "/x";
}

/**
 * Returns the result entity path for a completed/in-progress task.
 * Falls back to resumePath if no entity context is available.
 */
function getResultPath(task: UserTask): string {
  const ctx = task.context;
  const summary = ctx?.summary;

  switch (task.taskType) {
    case "quick_launch":
      // Completed with summary → domain page
      if (summary?.domain?.id) return `/x/domains/${summary.domain.id}`;
      // In-progress with domainId → domain page (entity exists)
      if (ctx?.domainId) return `/x/domains/${ctx.domainId}`;
      break;
    case "extraction":
      if (summary?.sourceId) return `/x/content-sources/${summary.sourceId}`;
      if (ctx?.sourceId) return `/x/content-sources/${ctx.sourceId}`;
      break;
    case "curriculum_generation":
      if (summary?.subject?.id) return `/x/subjects/${summary.subject.id}`;
      if (ctx?.subjectId) return `/x/subjects/${ctx.subjectId}`;
      break;
    case "content_wizard":
      if (summary?.subject?.id) return `/x/subjects/${summary.subject.id}`;
      if (summary?.domain?.id) return `/x/domains/${summary.domain.id}`;
      if (ctx?.subjectId) return `/x/subjects/${ctx.subjectId}`;
      break;
    case "configure_caller":
      if (summary?.callerId) return `/x/callers/${summary.callerId}`;
      if (ctx?.callerId) return `/x/callers/${ctx.callerId}`;
      break;
    case "create_spec":
      if (summary?.specId) return `/x/specs/${summary.specId}`;
      if (ctx?.specId) return `/x/specs/${ctx.specId}`;
      break;
  }

  // Fallback to resume path
  return getResumePath(task);
}

/**
 * Determines where clicking a task should navigate.
 * - In-progress interactive → resume path (wizard)
 * - In-progress background → result entity page (shows spinners)
 * - Completed success → result entity page
 * - Completed failed → resume path (try again)
 */
function getTaskClickPath(task: UserTask): string {
  if (task.status === "in_progress") {
    return isBackgroundTask(task) ? getResultPath(task) : getResumePath(task);
  }
  // Completed
  return isFailedTask(task) ? getResumePath(task) : getResultPath(task);
}

function isBackgroundTask(task: UserTask): boolean {
  return TASK_TYPE_LABELS[task.taskType]?.isBackground === true;
}

function isFailedTask(task: UserTask): boolean {
  return task.context?.phase === "failed" || !!task.context?.error;
}

// ── Time Ago ───────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ── Summary Badges ─────────────────────────────────

function CountBadge({ label, count }: { label: string; count: number }) {
  return (
    <span
      className="rounded px-2 py-0.5 text-[11px] font-mono"
      style={{ background: "var(--surface-secondary)", color: "var(--text-secondary)" }}
    >
      {count} {label}
    </span>
  );
}

function EntityLink({ label, name, href }: { label: string; name: string; href: string }) {
  return (
    <Link
      href={href}
      className="rounded px-2 py-0.5 text-[11px] transition-colors hover:underline"
      style={{ background: "var(--surface-secondary)", color: "var(--accent-primary)" }}
      onClick={(e) => e.stopPropagation()}
    >
      {label}: {name}
    </Link>
  );
}

function TaskSummary({ task }: { task: UserTask }) {
  // Show error for failed tasks
  if (isFailedTask(task) && task.context?.error) {
    return (
      <div style={{ marginTop: 6, fontSize: 12, color: "var(--status-error-text, #ef4444)" }}>
        {task.context.error}
      </div>
    );
  }

  const summary = task.context?.summary;
  if (!summary) return null;

  if (task.taskType === "quick_launch") {
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
        {summary.domain?.name && (
          <EntityLink label="Domain" name={summary.domain.name} href={`/x/domains/${summary.domain.id}`} />
        )}
        {summary.caller?.name && (
          <EntityLink label="Caller" name={summary.caller.name} href={`/x/callers/${summary.caller.id}`} />
        )}
        {summary.counts?.assertions > 0 && <CountBadge label="assertions" count={summary.counts.assertions} />}
        {summary.counts?.modules > 0 && <CountBadge label="modules" count={summary.counts.modules} />}
        {summary.counts?.goals > 0 && <CountBadge label="goals" count={summary.counts.goals} />}
      </div>
    );
  }

  if (task.taskType === "extraction") {
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
        {summary.counts?.extracted > 0 && <CountBadge label="extracted" count={summary.counts.extracted} />}
        {summary.counts?.imported > 0 && <CountBadge label="imported" count={summary.counts.imported} />}
        {summary.counts?.duplicates > 0 && (
          <span
            className="rounded px-2 py-0.5 text-[11px] font-mono"
            style={{ background: "var(--surface-tertiary)", color: "var(--text-muted)" }}
          >
            {summary.counts.duplicates} duplicates
          </span>
        )}
      </div>
    );
  }

  if (task.taskType === "curriculum_generation") {
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
        {summary.subject?.name && (
          <EntityLink label="Subject" name={summary.subject.name} href={`/x/subjects/${summary.subject.id}`} />
        )}
        {summary.counts?.modules > 0 && <CountBadge label="modules" count={summary.counts.modules} />}
        {summary.counts?.assertions > 0 && <CountBadge label="assertions" count={summary.counts.assertions} />}
      </div>
    );
  }

  if (task.taskType === "content_wizard") {
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
        {summary.subject?.name && (
          <EntityLink label="Subject" name={summary.subject.name} href={`/x/subjects/${summary.subject.id}`} />
        )}
        {summary.domain?.name && (
          <EntityLink label="Domain" name={summary.domain.name} href={`/x/domains/${summary.domain.id}`} />
        )}
        {summary.counts?.assertions > 0 && <CountBadge label="assertions" count={summary.counts.assertions} />}
        {summary.counts?.sessions > 0 && <CountBadge label="sessions" count={summary.counts.sessions} />}
      </div>
    );
  }

  return null;
}

// ── Main Page ──────────────────────────────────────

const COMPLETED_PAGE_SIZE = 20;
const ARCHIVED_PAGE_SIZE = 20;

export default function TasksPage() {
  const router = useRouter();
  const [activeTasks, setActiveTasks] = useState<UserTask[]>([]);
  const [completedTasks, setCompletedTasks] = useState<UserTask[]>([]);
  const [completedTotal, setCompletedTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Archive state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [archiving, setArchiving] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [archivedTasks, setArchivedTasks] = useState<UserTask[]>([]);
  const [archivedTotal, setArchivedTotal] = useState(0);
  const [archivedHasMore, setArchivedHasMore] = useState(false);
  const [loadingArchive, setLoadingArchive] = useState(false);
  const [loadingMoreArchive, setLoadingMoreArchive] = useState(false);

  const loadTasks = useCallback(async () => {
    try {
      const [activeRes, completedRes] = await Promise.all([
        fetch("/api/tasks?status=in_progress"),
        fetch(`/api/tasks?status=completed&limit=${COMPLETED_PAGE_SIZE}&offset=0`),
      ]);

      const activeData = await activeRes.json();
      const completedData = await completedRes.json();

      if (activeData.ok) setActiveTasks(activeData.tasks || []);
      if (completedData.ok) {
        setCompletedTasks(completedData.tasks || []);
        setCompletedTotal(completedData.total ?? completedData.count ?? 0);
        setHasMore(completedData.hasMore ?? false);
      }
    } catch {
      setError("Failed to load tasks. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
    const interval = setInterval(loadTasks, 10000);
    return () => clearInterval(interval);
  }, [loadTasks]);

  const loadMoreCompleted = async () => {
    setLoadingMore(true);
    try {
      const res = await fetch(
        `/api/tasks?status=completed&limit=${COMPLETED_PAGE_SIZE}&offset=${completedTasks.length}`
      );
      const data = await res.json();
      if (data.ok) {
        setCompletedTasks((prev) => [...prev, ...(data.tasks || [])]);
        setHasMore(data.hasMore ?? false);
      }
    } catch {
      // Ignore
    } finally {
      setLoadingMore(false);
    }
  };

  const handleAbandon = async (taskId: string) => {
    try {
      await fetch(`/api/tasks?taskId=${taskId}`, { method: "DELETE" });
      loadTasks();
    } catch {
      // Ignore
    }
  };

  // ── Selection ───────────────────────────────────

  const toggleSelect = (taskId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const selectableCompleted = completedTasks.filter((t) => !isFailedTask(t));

  const toggleSelectAll = () => {
    if (selectedIds.size === selectableCompleted.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableCompleted.map((t) => t.id)));
    }
  };

  // ── Archive ─────────────────────────────────────

  const handleArchive = async () => {
    if (selectedIds.size === 0) return;
    setArchiving(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskIds: Array.from(selectedIds), action: "archive" }),
      });
      const data = await res.json();
      if (data.ok) {
        setSelectedIds(new Set());
        await loadTasks();
        // Refresh archive if open
        if (showArchive) loadArchivedTasks();
      }
    } catch {
      // Ignore
    } finally {
      setArchiving(false);
    }
  };

  const handleUnarchive = async (taskIds: string[]) => {
    try {
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskIds, action: "unarchive" }),
      });
      const data = await res.json();
      if (data.ok) {
        await loadTasks();
        loadArchivedTasks();
      }
    } catch {
      // Ignore
    }
  };

  const loadArchivedTasks = async () => {
    setLoadingArchive(true);
    try {
      const res = await fetch(`/api/tasks?status=archived&limit=${ARCHIVED_PAGE_SIZE}&offset=0`);
      const data = await res.json();
      if (data.ok) {
        setArchivedTasks(data.tasks || []);
        setArchivedTotal(data.total ?? data.count ?? 0);
        setArchivedHasMore(data.hasMore ?? false);
      }
    } catch {
      // Ignore
    } finally {
      setLoadingArchive(false);
    }
  };

  const loadMoreArchived = async () => {
    setLoadingMoreArchive(true);
    try {
      const res = await fetch(
        `/api/tasks?status=archived&limit=${ARCHIVED_PAGE_SIZE}&offset=${archivedTasks.length}`
      );
      const data = await res.json();
      if (data.ok) {
        setArchivedTasks((prev) => [...prev, ...(data.tasks || [])]);
        setArchivedHasMore(data.hasMore ?? false);
      }
    } catch {
      // Ignore
    } finally {
      setLoadingMoreArchive(false);
    }
  };

  const toggleArchive = () => {
    const next = !showArchive;
    setShowArchive(next);
    if (next && archivedTasks.length === 0) loadArchivedTasks();
  };

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "48px 32px 64px" }}>
      {/* Header */}
      <h1
        style={{
          fontSize: 32,
          fontWeight: 800,
          letterSpacing: "-0.03em",
          marginBottom: 8,
          color: "var(--text-primary)",
        }}
      >
        Tasks
      </h1>
      <p
        style={{
          fontSize: 15,
          color: "var(--text-secondary)",
          marginBottom: 36,
          lineHeight: 1.5,
        }}
      >
        Track your in-progress and completed tasks.
      </p>

      {loading && (
        <div style={{ fontSize: 14, color: "var(--text-muted)", padding: "24px 0" }}>
          Loading tasks...
        </div>
      )}

      {error && !loading && (
        <div style={{ padding: 16, background: "color-mix(in srgb, var(--status-error-text) 10%, transparent)", color: "var(--status-error-text)", borderRadius: 12, fontSize: 14, marginBottom: 24 }}>
          {error}
        </div>
      )}

      {/* In Progress */}
      {!loading && !error && (
        <section style={{ marginBottom: 40 }}>
          <h2
            style={{
              fontSize: 14,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--text-muted)",
              marginBottom: 16,
            }}
          >
            In Progress ({activeTasks.length})
          </h2>

          {activeTasks.length === 0 ? (
            <div
              className="bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400"
              style={{
                padding: 32,
                borderRadius: 14,
                textAlign: "center",
                fontSize: 14,
              }}
            >
              No tasks in progress. Start one from Quick Launch or other tools.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {activeTasks.map((task) => (
                <div
                  key={task.id}
                  className="bg-white dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-500"
                  style={{
                    padding: 20,
                    borderRadius: 14,
                    cursor: "pointer",
                    transition: "border-color 0.15s ease",
                  }}
                  onClick={() => router.push(getTaskClickPath(task))}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2 }}>
                        {getTaskLabel(task)}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        Started {timeAgo(task.startedAt)}
                        {isBackgroundTask(task)
                          ? ` \u00b7 ${task.taskType === "extraction"
                              ? `${task.context?.extractedCount ?? 0} assertions extracted`
                              : `Step ${task.currentStep} of ${task.totalSteps}`}`
                          : ` \u00b7 Step ${task.currentStep} of ${task.totalSteps}`}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {isBackgroundTask(task) ? (
                        <span
                          style={{
                            padding: "8px 16px",
                            borderRadius: 8,
                            background: "var(--surface-secondary)",
                            fontSize: 13,
                            fontWeight: 600,
                            color: "var(--accent-primary)",
                          }}
                        >
                          Running...
                        </span>
                      ) : (
                        <span
                          style={{
                            padding: "8px 16px",
                            borderRadius: 8,
                            background: "var(--accent-primary)",
                            color: "var(--accent-primary-text)",
                            fontSize: 13,
                            fontWeight: 700,
                          }}
                        >
                          Resume
                        </span>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleAbandon(task.id); }}
                        style={{
                          padding: "8px 16px",
                          borderRadius: 8,
                          background: "transparent",
                          border: "1px solid var(--border-default)",
                          fontSize: 13,
                          fontWeight: 500,
                          cursor: "pointer",
                          color: "var(--text-muted)",
                        }}
                      >
                        Abandon
                      </button>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div
                    style={{
                      height: 6,
                      borderRadius: 3,
                      background: "var(--surface-tertiary)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${(task.currentStep / task.totalSteps) * 100}%`,
                        borderRadius: 3,
                        background: "var(--accent-primary)",
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>

                  {/* Blockers */}
                  {task.blockers && task.blockers.length > 0 && (
                    <div style={{ marginTop: 8, fontSize: 12, color: "var(--status-warning-text)" }}>
                      Blocked: {task.blockers.join(", ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Completed */}
      {!loading && (
        <section style={{ marginBottom: 40 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h2
              style={{
                fontSize: 14,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--text-muted)",
              }}
            >
              Done ({completedTotal})
            </h2>

            {/* Archive controls */}
            {completedTasks.length > 0 && (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {selectedIds.size > 0 && (
                  <button
                    onClick={handleArchive}
                    disabled={archiving}
                    style={{
                      padding: "5px 12px",
                      borderRadius: 6,
                      background: "var(--surface-secondary)",
                      border: "1px solid var(--border-default)",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: archiving ? "default" : "pointer",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {archiving ? "Archiving..." : `Archive ${selectedIds.size}`}
                  </button>
                )}
                <button
                  onClick={toggleSelectAll}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 6,
                    background: "transparent",
                    border: "1px solid var(--border-default)",
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: "pointer",
                    color: "var(--text-muted)",
                  }}
                >
                  {selectedIds.size === selectableCompleted.length && selectableCompleted.length > 0
                    ? "Deselect All"
                    : "Select All"}
                </button>
              </div>
            )}
          </div>

          {completedTasks.length === 0 ? (
            <div
              className="text-neutral-500 dark:text-neutral-400"
              style={{ fontSize: 14, padding: "16px 0" }}
            >
              No completed tasks yet.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {completedTasks.map((task) => {
                const failed = isFailedTask(task);
                const selectable = !failed;
                const selected = selectedIds.has(task.id);

                return (
                  <div
                    key={task.id}
                    className="bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-500"
                    style={{
                      padding: "12px 20px",
                      borderRadius: 10,
                      cursor: "pointer",
                      transition: "border-color 0.15s ease",
                      ...(selected ? { borderColor: "var(--accent-primary)", background: "color-mix(in srgb, var(--accent-primary) 5%, transparent)" } : {}),
                    }}
                    onClick={() => router.push(getTaskClickPath(task))}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {/* Checkbox (for selectable) or status icon */}
                        {selectable ? (
                          <label
                            style={{ display: "flex", alignItems: "center", cursor: "pointer", flexShrink: 0 }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleSelect(task.id)}
                              style={{ width: 16, height: 16, accentColor: "var(--accent-primary)", cursor: "pointer" }}
                            />
                          </label>
                        ) : (
                          <div
                            className="bg-red-500 dark:bg-red-400"
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: "50%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 11,
                              color: "white",
                              fontWeight: 700,
                              flexShrink: 0,
                            }}
                          >
                            &#10007;
                          </div>
                        )}
                        <div className="text-neutral-900 dark:text-neutral-100" style={{ fontSize: 14, fontWeight: 500 }}>
                          {getTaskLabel(task)}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: 12 }}>
                        {failed && (
                          <span
                            className="text-red-500 dark:text-red-400"
                            style={{ fontSize: 11, fontWeight: 600 }}
                          >
                            Failed
                          </span>
                        )}
                        <span className="text-neutral-500 dark:text-neutral-400" style={{ fontSize: 12 }}>
                          {task.completedAt ? timeAgo(task.completedAt) : timeAgo(task.updatedAt)}
                        </span>
                      </div>
                    </div>
                    <TaskSummary task={task} />
                  </div>
                );
              })}

              {/* Load More */}
              {hasMore && (
                <button
                  onClick={loadMoreCompleted}
                  disabled={loadingMore}
                  style={{
                    padding: "10px 20px",
                    borderRadius: 10,
                    background: "transparent",
                    border: "1px solid var(--border-default)",
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: loadingMore ? "default" : "pointer",
                    color: "var(--text-secondary)",
                    marginTop: 4,
                  }}
                >
                  {loadingMore ? "Loading..." : "Load More"}
                </button>
              )}
            </div>
          )}
        </section>
      )}

      {/* Archive */}
      {!loading && (
        <section>
          <button
            onClick={toggleArchive}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              marginBottom: showArchive ? 16 : 0,
            }}
          >
            <h2
              style={{
                fontSize: 14,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--text-muted)",
              }}
            >
              Archive {archivedTotal > 0 && `(${archivedTotal})`}
            </h2>
            <span style={{ fontSize: 12, color: "var(--text-muted)", transition: "transform 0.2s ease", transform: showArchive ? "rotate(180deg)" : "rotate(0)" }}>
              &#9660;
            </span>
          </button>

          {showArchive && (
            <>
              {loadingArchive ? (
                <div style={{ fontSize: 14, color: "var(--text-muted)", padding: "16px 0" }}>
                  Loading archived tasks...
                </div>
              ) : archivedTasks.length === 0 ? (
                <div
                  className="text-neutral-500 dark:text-neutral-400"
                  style={{ fontSize: 14, padding: "16px 0" }}
                >
                  No archived tasks.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {archivedTasks.map((task) => (
                    <div
                      key={task.id}
                      className="bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-500"
                      style={{
                        padding: "12px 20px",
                        borderRadius: 10,
                        cursor: "pointer",
                        opacity: 0.7,
                        transition: "border-color 0.15s ease, opacity 0.15s ease",
                      }}
                      onClick={() => router.push(getTaskClickPath(task))}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div
                            className={isFailedTask(task) ? "bg-red-500 dark:bg-red-400" : "bg-emerald-500 dark:bg-emerald-400"}
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: "50%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 11,
                              color: "white",
                              fontWeight: 700,
                              flexShrink: 0,
                            }}
                          >
                            {isFailedTask(task) ? "\u2717" : "\u2713"}
                          </div>
                          <div className="text-neutral-900 dark:text-neutral-100" style={{ fontSize: 14, fontWeight: 500 }}>
                            {getTaskLabel(task)}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: 12 }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleUnarchive([task.id]); }}
                            style={{
                              padding: "4px 10px",
                              borderRadius: 6,
                              background: "transparent",
                              border: "1px solid var(--border-default)",
                              fontSize: 11,
                              fontWeight: 500,
                              cursor: "pointer",
                              color: "var(--text-muted)",
                            }}
                          >
                            Restore
                          </button>
                          <span className="text-neutral-500 dark:text-neutral-400" style={{ fontSize: 12 }}>
                            {task.completedAt ? timeAgo(task.completedAt) : timeAgo(task.updatedAt)}
                          </span>
                        </div>
                      </div>
                      <TaskSummary task={task} />
                    </div>
                  ))}

                  {archivedHasMore && (
                    <button
                      onClick={loadMoreArchived}
                      disabled={loadingMoreArchive}
                      style={{
                        padding: "10px 20px",
                        borderRadius: 10,
                        background: "transparent",
                        border: "1px solid var(--border-default)",
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: loadingMoreArchive ? "default" : "pointer",
                        color: "var(--text-secondary)",
                        marginTop: 4,
                      }}
                    >
                      {loadingMoreArchive ? "Loading..." : "Load More"}
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
