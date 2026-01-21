"use client";

import { useState, useCallback } from "react";
import { AgentSettingsEditor } from "./AgentSettingsEditor";

interface AgentConfig {
  agentId: string;
  enabled: boolean;
  title: string;
  description: string;
  settings: Record<string, any>;
  schema?: any;
}

interface AgentCardProps {
  agent: AgentConfig;
  onUpdate: (patch: Partial<AgentConfig>) => void;
  onRun: (dryRun: boolean) => Promise<void>;
  onViewHistory: () => void;
  isRunning?: boolean;
}

export function AgentCard({
  agent,
  onUpdate,
  onRun,
  onViewHistory,
  isRunning = false,
}: AgentCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const handleToggleEnabled = useCallback(() => {
    onUpdate({ enabled: !agent.enabled });
  }, [agent.enabled, onUpdate]);

  const handleSettingsChange = useCallback(
    (settings: Record<string, any>) => {
      onUpdate({ settings });
    },
    [onUpdate]
  );

  const handleRun = useCallback(
    async (dryRun: boolean) => {
      setRunError(null);
      try {
        await onRun(dryRun);
      } catch (err: any) {
        setRunError(err?.message || "Run failed");
      }
    },
    [onRun]
  );

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 12,
        border: "1px solid #e5e7eb",
        overflow: "hidden",
        opacity: agent.enabled ? 1 : 0.7,
        transition: "opacity 0.15s ease",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 20px",
          background: agent.enabled
            ? "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)"
            : "#f9fafb",
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
            <h3
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 700,
                color: "#1f2937",
              }}
            >
              {agent.title}
            </h3>
            <span
              style={{
                fontSize: 10,
                padding: "3px 8px",
                borderRadius: 4,
                background: agent.enabled ? "#10b981" : "#6b7280",
                color: "#fff",
                fontWeight: 600,
                textTransform: "uppercase",
              }}
            >
              {agent.enabled ? "Enabled" : "Disabled"}
            </span>
          </div>
          <code
            style={{
              fontSize: 11,
              color: "#6b7280",
              fontFamily: "monospace",
            }}
          >
            {agent.agentId}
          </code>
        </div>

        {/* Enable toggle */}
        <button
          type="button"
          onClick={handleToggleEnabled}
          style={{
            position: "relative",
            width: 52,
            height: 28,
            borderRadius: 14,
            border: "none",
            background: agent.enabled ? "#10b981" : "#d1d5db",
            cursor: "pointer",
            transition: "background 0.15s ease",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 3,
              left: agent.enabled ? 27 : 3,
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: "#fff",
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              transition: "left 0.15s ease",
            }}
          />
        </button>
      </div>

      {/* Description */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6" }}>
        <p style={{ margin: 0, fontSize: 13, color: "#4b5563", lineHeight: 1.5 }}>
          {agent.description}
        </p>
      </div>

      {/* Actions bar */}
      <div
        style={{
          padding: "12px 20px",
          background: "#fafafa",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => handleRun(false)}
            disabled={!agent.enabled || isRunning}
            style={{
              padding: "8px 16px",
              background: agent.enabled && !isRunning ? "#2563eb" : "#9ca3af",
              border: "none",
              borderRadius: 6,
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: agent.enabled && !isRunning ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {isRunning ? (
              <>
                <span
                  style={{
                    width: 12,
                    height: 12,
                    border: "2px solid #fff",
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                  }}
                />
                Running...
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                    clipRule="evenodd"
                  />
                </svg>
                Run
              </>
            )}
          </button>
          <button
            onClick={() => handleRun(true)}
            disabled={!agent.enabled || isRunning}
            style={{
              padding: "8px 16px",
              background: "#fff",
              border: "1px solid #d1d5db",
              borderRadius: 6,
              color: agent.enabled && !isRunning ? "#374151" : "#9ca3af",
              fontSize: 13,
              fontWeight: 500,
              cursor: agent.enabled && !isRunning ? "pointer" : "not-allowed",
            }}
          >
            Dry Run
          </button>
          <button
            onClick={onViewHistory}
            style={{
              padding: "8px 16px",
              background: "#fff",
              border: "1px solid #d1d5db",
              borderRadius: 6,
              color: "#374151",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            History
          </button>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            padding: "8px 16px",
            background: expanded ? "#eff6ff" : "#fff",
            border: expanded ? "1px solid #bfdbfe" : "1px solid #d1d5db",
            borderRadius: 6,
            color: expanded ? "#1e40af" : "#374151",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 20 20"
            fill="currentColor"
            style={{
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.15s ease",
            }}
          >
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
          Settings
        </button>
      </div>

      {/* Error display */}
      {runError && (
        <div
          style={{
            padding: "12px 20px",
            background: "#fef2f2",
            borderTop: "1px solid #fecaca",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: 13, color: "#dc2626" }}>{runError}</span>
          <button
            onClick={() => setRunError(null)}
            style={{
              background: "none",
              border: "none",
              color: "#dc2626",
              cursor: "pointer",
              fontSize: 16,
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Settings panel (expanded) */}
      {expanded && (
        <div
          style={{
            padding: 20,
            background: "#f9fafb",
            borderTop: "1px solid #e5e7eb",
          }}
        >
          <AgentSettingsEditor
            agentId={agent.agentId}
            agentTitle={agent.title}
            schema={agent.schema}
            settings={agent.settings}
            onChange={handleSettingsChange}
            disabled={isRunning}
          />
        </div>
      )}

      {/* CSS for spinner animation */}
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

export default AgentCard;
