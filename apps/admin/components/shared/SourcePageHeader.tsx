"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type AgentInfo = {
  agentId: string;
  title: string;
  description: string;
  enabled: boolean;
  opid?: string;
  relationship: "consumer" | "producer" | "both";
  latestRun: {
    id: string;
    status: string;
    startedAt: string;
    finishedAt: string | null;
    summary?: string;
  } | null;
  isRunning: boolean;
};

type RunState = "idle" | "running" | "done" | "error";
type RunFeedback = {
  agentId: string;
  state: RunState;
  message?: string;
};

export interface SourcePageHeaderProps {
  title: string;
  description: string;
  /** Data node ID for fetching related agents (optional - if omitted, agents bar won't show) */
  dataNodeId?: string;
  /** Optional icon (emoji or similar) */
  icon?: string;
  /** Optional count to display */
  count?: number;
  /** Optional actions to render on the right side */
  actions?: React.ReactNode;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  OK: { bg: "#ecfdf5", text: "#10b981", label: "OK" },
  RUNNING: { bg: "#dbeafe", text: "#2563eb", label: "Running" },
  ERROR: { bg: "#fef2f2", text: "#dc2626", label: "Error" },
  QUEUED: { bg: "#f3f4f6", text: "#6b7280", label: "Queued" },
};

const RELATIONSHIP_LABELS: Record<string, { label: string; color: string }> = {
  consumer: { label: "reads from", color: "#3b82f6" },
  producer: { label: "writes to", color: "#10b981" },
  both: { label: "reads/writes", color: "#8b5cf6" },
};

export function SourcePageHeader({
  title,
  description,
  dataNodeId,
  icon,
  count,
  actions,
}: SourcePageHeaderProps) {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [runFeedback, setRunFeedback] = useState<RunFeedback | null>(null);

  // Fetch agents for this data node (only if dataNodeId provided)
  useEffect(() => {
    if (!dataNodeId) {
      setLoading(false);
      return;
    }
    fetch(`/api/agents/by-data-node?dataNode=${encodeURIComponent(dataNodeId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setAgents(data.agents || []);
        }
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [dataNodeId]);

  // Run an agent
  const handleRunAgent = useCallback(async (agent: AgentInfo) => {
    if (!agent.agentId || runFeedback?.state === "running" || !dataNodeId) return;

    setRunFeedback({ agentId: agent.agentId, state: "running" });

    try {
      const res = await fetch("/api/agents/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: agent.agentId,
          settings: {},
        }),
      });

      const data = await res.json();

      if (!data.ok) {
        setRunFeedback({
          agentId: agent.agentId,
          state: "error",
          message: data.error || "Run failed",
        });
        // Clear error after 5 seconds
        setTimeout(() => setRunFeedback(null), 5000);
      } else {
        setRunFeedback({
          agentId: agent.agentId,
          state: "done",
          message: data.run?.summary || "Completed",
        });
        // Clear success after 3 seconds
        setTimeout(() => setRunFeedback(null), 3000);
      }

      // Refresh agents to get updated status
      const refreshRes = await fetch(
        `/api/agents/by-data-node?dataNode=${encodeURIComponent(dataNodeId)}`
      );
      const refreshData = await refreshRes.json();
      if (refreshData.ok) {
        setAgents(refreshData.agents || []);
      }
    } catch (err) {
      console.error("Error running agent:", err);
      setRunFeedback({
        agentId: agent.agentId,
        state: "error",
        message: "Network error",
      });
      setTimeout(() => setRunFeedback(null), 5000);
    }
  }, [dataNodeId, runFeedback]);

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Title row */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {icon && <span style={{ fontSize: 24 }}>{icon}</span>}
            <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>{title}</h1>
            {count !== undefined && (
              <span
                style={{
                  fontSize: 14,
                  padding: "4px 10px",
                  background: "#f3f4f6",
                  borderRadius: 12,
                  color: "#6b7280",
                  fontWeight: 500,
                }}
              >
                {count.toLocaleString()}
              </span>
            )}
          </div>
          <p style={{ fontSize: 14, color: "#6b7280", marginTop: 4, marginBottom: 0 }}>
            {description}
          </p>
        </div>
        {actions && <div>{actions}</div>}
      </div>

      {/* Agents bar */}
      {!loading && agents.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 16px",
            background: "#f9fafb",
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 500 }}>
            Related Agents:
          </span>

          {agents.map((agent) => {
            const statusInfo = agent.latestRun
              ? STATUS_COLORS[agent.latestRun.status] || STATUS_COLORS.QUEUED
              : null;
            const relInfo = RELATIONSHIP_LABELS[agent.relationship];
            const thisAgentFeedback = runFeedback?.agentId === agent.agentId ? runFeedback : null;
            const isRunning = thisAgentFeedback?.state === "running" || agent.isRunning;
            const justFinished = thisAgentFeedback?.state === "done";
            const hasError = thisAgentFeedback?.state === "error";

            return (
              <div
                key={agent.agentId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 12px",
                  background: justFinished ? "#ecfdf5" : hasError ? "#fef2f2" : "#fff",
                  borderRadius: 6,
                  border: `1px solid ${justFinished ? "#10b981" : hasError ? "#dc2626" : "#e5e7eb"}`,
                  transition: "all 0.3s ease",
                }}
              >
                {/* Agent name with link to agents page */}
                <Link
                  href={`/agents?highlight=${agent.agentId}`}
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#374151",
                    textDecoration: "none",
                  }}
                  title={agent.description}
                >
                  {agent.title}
                </Link>

                {/* Relationship badge */}
                <span
                  style={{
                    fontSize: 9,
                    padding: "2px 6px",
                    background: `${relInfo.color}15`,
                    color: relInfo.color,
                    borderRadius: 4,
                    fontWeight: 500,
                    textTransform: "uppercase",
                  }}
                >
                  {relInfo.label}
                </span>

                {/* Last run info */}
                {agent.latestRun && !isRunning && !justFinished && !hasError && (
                  <span
                    style={{
                      fontSize: 10,
                      color: "#6b7280",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                    title={`Last run: ${new Date(agent.latestRun.startedAt).toLocaleString()}`}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: statusInfo?.text || "#6b7280",
                      }}
                    />
                    {formatRelativeTime(agent.latestRun.startedAt)}
                  </span>
                )}

                {/* Running indicator */}
                {isRunning && (
                  <span
                    style={{
                      fontSize: 10,
                      padding: "2px 8px",
                      background: "#dbeafe",
                      color: "#2563eb",
                      borderRadius: 4,
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        border: "2px solid #2563eb",
                        borderTopColor: "transparent",
                        borderRadius: "50%",
                        animation: "spin 0.8s linear infinite",
                      }}
                    />
                    Running...
                  </span>
                )}

                {/* Done feedback */}
                {justFinished && (
                  <span
                    style={{
                      fontSize: 10,
                      padding: "2px 8px",
                      background: "#ecfdf5",
                      color: "#10b981",
                      borderRadius: 4,
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Done
                  </span>
                )}

                {/* Error feedback */}
                {hasError && (
                  <span
                    style={{
                      fontSize: 10,
                      padding: "2px 8px",
                      background: "#fef2f2",
                      color: "#dc2626",
                      borderRadius: 4,
                      fontWeight: 600,
                      maxWidth: 150,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={thisAgentFeedback?.message}
                  >
                    Error
                  </span>
                )}

                {/* Run button */}
                {agent.opid && agent.enabled && !isRunning && !justFinished && (
                  <button
                    onClick={() => handleRunAgent(agent)}
                    disabled={isRunning}
                    style={{
                      padding: "3px 8px",
                      fontSize: 11,
                      fontWeight: 600,
                      background: "#2563eb",
                      color: "#fff",
                      border: "none",
                      borderRadius: 4,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                    title={`Run ${agent.title}`}
                  >
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Run
                  </button>
                )}

                {/* Disabled indicator */}
                {!agent.enabled && (
                  <span
                    style={{
                      fontSize: 9,
                      padding: "2px 6px",
                      background: "#f3f4f6",
                      color: "#9ca3af",
                      borderRadius: 4,
                      fontWeight: 500,
                    }}
                  >
                    Disabled
                  </span>
                )}
              </div>
            );
          })}

          {/* View all agents link */}
          <Link
            href="/agents"
            style={{
              fontSize: 12,
              color: "#6b7280",
              textDecoration: "none",
              marginLeft: "auto",
            }}
          >
            View all agents
          </Link>
        </div>
      )}

      {/* Spinner CSS */}
      <style jsx>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

export default SourcePageHeader;
