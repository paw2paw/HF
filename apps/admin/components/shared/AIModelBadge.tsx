"use client";

import { useState, useEffect } from "react";

interface AIModelBadgeProps {
  /** The call point identifier (e.g., "spec.assistant", "pipeline.measure") */
  callPoint: string;
  /** Show as inline badge (default) or as subtitle text */
  variant?: "badge" | "text";
  /** Size */
  size?: "sm" | "md";
}

interface ConfigInfo {
  provider: string;
  model: string;
  version?: string;
}

/**
 * Shows "Provider | Model | Version" for AI endpoints
 * Displays prominently so users know which AI is responding
 */
export function AIModelBadge({ callPoint, variant = "badge", size = "sm" }: AIModelBadgeProps) {
  const [configInfo, setConfigInfo] = useState<ConfigInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch("/api/ai-config");
        const data = await res.json();
        if (data.ok) {
          const config = data.configs.find((c: { callPoint: string }) => c.callPoint === callPoint);
          if (config) {
            // Extract version from model name if present
            // e.g., "claude-sonnet-4.5" -> provider: "claude", model: "sonnet", version: "4.5"
            const modelParts = config.model.split("-");
            let version = modelParts[modelParts.length - 1];

            // Check if last part looks like a version (contains a digit)
            if (!/\d/.test(version)) {
              version = undefined;
            }

            setConfigInfo({
              provider: config.provider.charAt(0).toUpperCase() + config.provider.slice(1),
              model: config.model,
              version,
            });
          }
        }
      } catch (e) {
        console.error("Failed to load AI config:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, [callPoint]);

  if (loading) {
    return (
      <span style={{
        fontSize: size === "sm" ? 11 : 13,
        color: "var(--text-muted)",
        fontStyle: "italic",
      }}>
        Loading AI info...
      </span>
    );
  }

  if (!configInfo) {
    return null;
  }

  const displayText = `${configInfo.provider} | ${configInfo.model}${configInfo.version ? ` | v${configInfo.version}` : ""}`;

  if (variant === "text") {
    return (
      <span style={{
        fontSize: size === "sm" ? 11 : 13,
        color: "var(--text-muted)",
        fontFamily: "monospace",
        letterSpacing: "0.02em",
      }}>
        {displayText}
      </span>
    );
  }

  // Badge variant
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: size === "sm" ? "2px 8px" : "4px 10px",
        fontSize: size === "sm" ? 10 : 11,
        fontWeight: 600,
        fontFamily: "monospace",
        background: "var(--surface-tertiary)",
        border: "1px solid var(--border-default)",
        borderRadius: 4,
        color: "var(--text-secondary)",
        letterSpacing: "0.02em",
        whiteSpace: "nowrap",
      }}
      title={`AI: ${displayText}`}
    >
      <span style={{ fontSize: size === "sm" ? 10 : 12 }}>🤖</span>
      {displayText}
    </span>
  );
}
