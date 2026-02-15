"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

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
  return base;
}

function getResumePath(task: UserTask): string {
  const ctx = task.context;
  if (task.taskType === "curriculum_generation" && ctx?.subjectId) {
    return `/x/subjects/${ctx.subjectId}`;
  }
  return TASK_TYPE_LABELS[task.taskType]?.resumePath || "/x";
}

function isBackgroundTask(task: UserTask): boolean {
  return TASK_TYPE_LABELS[task.taskType]?.isBackground === true;
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

// ── Main Page ──────────────────────────────────────

export default function TasksPage() {
  const router = useRouter();
  const [activeTasks, setActiveTasks] = useState<UserTask[]>([]);
  const [recentTasks, setRecentTasks] = useState<UserTask[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTasks = useCallback(async () => {
    try {
      const [activeRes, completedRes] = await Promise.all([
        fetch("/api/tasks?status=in_progress"),
        fetch("/api/tasks?status=completed"),
      ]);

      const activeData = await activeRes.json();
      const completedData = await completedRes.json();

      if (activeData.ok) setActiveTasks(activeData.tasks || []);
      if (completedData.ok) setRecentTasks((completedData.tasks || []).slice(0, 10));
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
    // Poll every 10 seconds
    const interval = setInterval(loadTasks, 10000);
    return () => clearInterval(interval);
  }, [loadTasks]);

  const handleAbandon = async (taskId: string) => {
    try {
      await fetch(`/api/tasks?taskId=${taskId}`, { method: "DELETE" });
      loadTasks();
    } catch {
      // Ignore
    }
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

      {/* In Progress */}
      {!loading && (
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
                  className="bg-white dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700"
                  style={{
                    padding: 20,
                    borderRadius: 14,
                  }}
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
                        <button
                          onClick={() => router.push(getResumePath(task))}
                          style={{
                            padding: "8px 16px",
                            borderRadius: 8,
                            background: "var(--accent-primary)",
                            color: "var(--accent-primary-text)",
                            border: "none",
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          Resume
                        </button>
                      )}
                      <button
                        onClick={() => handleAbandon(task.id)}
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

      {/* Recent Completed */}
      {!loading && recentTasks.length > 0 && (
        <section>
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
            Recent
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {recentTasks.map((task) => (
              <div
                key={task.id}
                className="bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700"
                style={{
                  padding: "12px 20px",
                  borderRadius: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    className="bg-emerald-500 dark:bg-emerald-400"
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      color: "#fff",
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    &#10003;
                  </div>
                  <div className="text-neutral-900 dark:text-neutral-100" style={{ fontSize: 14, fontWeight: 500 }}>
                    {getTaskLabel(task)}
                  </div>
                </div>
                <div className="text-neutral-500 dark:text-neutral-400" style={{ fontSize: 12 }}>
                  {task.completedAt ? timeAgo(task.completedAt) : timeAgo(task.updatedAt)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
