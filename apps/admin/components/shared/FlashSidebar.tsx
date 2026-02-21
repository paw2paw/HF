"use client";

import { useState, useEffect } from "react";

export interface FlashSidebarProps {
  taskId?: string;
  visible?: boolean;
  onClose?: () => void;
}

interface TaskGuidance {
  task: {
    taskId: string;
    taskType: string;
    currentStep: number;
    totalSteps: number;
    stepTitle: string;
    stepDescription: string;
    completedSteps: string[];
    blockers?: string[];
  };
  suggestions: Array<{
    type: "tip" | "warning" | "shortcut" | "best-practice";
    message: string;
    action?: {
      label: string;
      handler: string;
    };
  }>;
  nextActions: Array<{
    label: string;
    description: string;
    priority: "high" | "medium" | "low";
    estimated: string;
  }>;
  warnings?: string[];
}

export function FlashSidebar({ taskId, visible = false, onClose }: FlashSidebarProps) {
  const [isVisible, setIsVisible] = useState(visible);
  const [guidance, setGuidance] = useState<TaskGuidance | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setIsVisible(visible);
  }, [visible]);

  useEffect(() => {
    if (taskId && isVisible) {
      loadGuidance();
    }
  }, [taskId, isVisible]);

  const loadGuidance = async () => {
    if (!taskId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/tasks?taskId=${taskId}`);
      if (!res.ok) {
        console.error("Task guidance API returned", res.status);
        return;
      }
      const data = await res.json();

      if (data.ok && data.guidance) {
        setGuidance(data.guidance);
      }
    } catch (error) {
      console.error("Failed to load task guidance:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setIsVisible(false);
    onClose?.();
  };

  if (!isVisible) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.3)",
          backdropFilter: "blur(2px)",
          zIndex: 999,
          animation: "fadeIn 0.2s ease-out",
        }}
        onClick={handleClose}
      />

      {/* Sidebar */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: 380,
          background: "var(--surface-primary)",
          borderLeft: "1px solid var(--border-default)",
          boxShadow: "-4px 0 24px rgba(0, 0, 0, 0.15)",
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          animation: "slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--border-default)",
            background: "linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(99, 102, 241, 0.08) 100%)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: "linear-gradient(135deg, var(--accent-secondary, #8b5cf6) 0%, var(--accent-primary) 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 20,
                }}
              >
                ✨
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                  Task Guidance
                </h3>
                <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0" }}>
                  {guidance?.task.stepTitle || "Loading..."}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                border: "1px solid var(--border-default)",
                background: "var(--surface-secondary)",
                color: "var(--text-muted)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--surface-tertiary)";
                e.currentTarget.style.borderColor = "var(--border-hover)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "var(--surface-secondary)";
                e.currentTarget.style.borderColor = "var(--border-default)";
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  margin: "0 auto 16px",
                  border: "3px solid var(--border-default)",
                  borderTopColor: "var(--accent-primary)",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                }}
              />
              Loading guidance...
            </div>
          ) : guidance ? (
            <>
              {/* Progress */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>PROGRESS</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-primary)" }}>
                    Step {guidance.task.currentStep} of {guidance.task.totalSteps}
                  </span>
                </div>
                <div
                  style={{
                    height: 8,
                    background: "var(--surface-tertiary)",
                    borderRadius: 4,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${(guidance.task.currentStep / guidance.task.totalSteps) * 100}%`,
                      background: "linear-gradient(90deg, var(--accent-secondary, #8b5cf6) 0%, var(--accent-primary) 100%)",
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 8 }}>
                  {guidance.task.stepDescription}
                </p>
              </div>

              {/* Warnings */}
              {guidance.warnings && guidance.warnings.length > 0 && (
                <div
                  style={{
                    padding: 12,
                    background: "rgba(251, 191, 36, 0.1)",
                    border: "1px solid rgba(251, 191, 36, 0.3)",
                    borderRadius: 8,
                    marginBottom: 20,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <span style={{ fontSize: 16 }}>⚠️</span>
                    <div style={{ flex: 1 }}>
                      {guidance.warnings.map((warning, i) => (
                        <p key={i} style={{ fontSize: 13, color: "var(--status-warning-text)", margin: 0 }}>
                          {warning}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Suggestions */}
              {guidance.suggestions.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <h4
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--text-muted)",
                      marginBottom: 12,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Tips
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {guidance.suggestions.map((suggestion, i) => (
                      <div
                        key={i}
                        style={{
                          padding: 12,
                          background: "var(--surface-secondary)",
                          border: "1px solid var(--border-default)",
                          borderRadius: 8,
                          fontSize: 13,
                          color: "var(--text-secondary)",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                          <span style={{ fontSize: 14 }}>
                            {suggestion.type === "warning"
                              ? "⚠️"
                              : suggestion.type === "tip"
                              ? "💡"
                              : suggestion.type === "shortcut"
                              ? "⚡"
                              : "✨"}
                          </span>
                          <div style={{ flex: 1 }}>
                            <p style={{ margin: 0 }}>{suggestion.message}</p>
                            {/* TODO: Wire up action handlers (focusAIInput, openCommandPalette, showBlockerHelp) — actions are not yet functional */}
                            {suggestion.action && (
                              <button
                                disabled
                                title="Coming soon"
                                style={{
                                  marginTop: 8,
                                  padding: "4px 12px",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  borderRadius: 6,
                                  border: "1px solid var(--border-default)",
                                  background: "transparent",
                                  color: "var(--text-muted)",
                                  cursor: "not-allowed",
                                  opacity: 0.6,
                                }}
                              >
                                {suggestion.action.label} — coming soon
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Next Actions */}
              {guidance.nextActions.length > 0 && (
                <div>
                  <h4
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--text-muted)",
                      marginBottom: 12,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Next Steps
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {guidance.nextActions.map((action, i) => (
                      <div
                        key={i}
                        style={{
                          padding: 14,
                          background:
                            action.priority === "high"
                              ? "rgba(139, 92, 246, 0.05)"
                              : "var(--surface-secondary)",
                          border:
                            action.priority === "high"
                              ? "1px solid rgba(139, 92, 246, 0.3)"
                              : "1px solid var(--border-default)",
                          borderRadius: 8,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: 4,
                              background:
                                action.priority === "high"
                                  ? "var(--accent-primary)"
                                  : "var(--surface-tertiary)",
                              color: action.priority === "high" ? "var(--surface-primary)" : "var(--text-muted)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            {i + 1}
                          </span>
                          <strong style={{ fontSize: 13, color: "var(--text-primary)", flex: 1 }}>
                            {action.label}
                          </strong>
                          <span
                            style={{
                              fontSize: 11,
                              color: "var(--text-muted)",
                              background: "var(--surface-tertiary)",
                              padding: "2px 6px",
                              borderRadius: 4,
                            }}
                          >
                            {action.estimated}
                          </span>
                        </div>
                        <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0, paddingLeft: 28 }}>
                          {action.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
              <p>{taskId ? "No task guidance available" : "Sign in to enable task guidance"}</p>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </>
  );
}
