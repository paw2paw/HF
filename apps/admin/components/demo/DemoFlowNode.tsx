"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";

export interface DemoFlowNodeData {
  stepIndex: number;
  totalSteps: number;
  title: string;
  description: string;
  contentType: "screenshot" | "markdown" | "split";
  hasScreenshot: boolean;
  hasSidebarHighlight: boolean;
  sidebarHref?: string;
  isFirst: boolean;
  isLast: boolean;
  onNavigate?: (stepIndex: number) => void;
}

const CONTENT_ICONS: Record<string, string> = {
  screenshot: "📸",
  markdown: "📝",
  split: "📐",
};

function DemoFlowNodeComponent({ data }: NodeProps<DemoFlowNodeData>) {
  const {
    stepIndex,
    totalSteps,
    title,
    description,
    contentType,
    hasSidebarHighlight,
    sidebarHref,
    isFirst,
    isLast,
    onNavigate,
  } = data;

  const progress = ((stepIndex + 1) / totalSteps) * 100;

  return (
    <div
      onClick={() => onNavigate?.(stepIndex)}
      style={{
        padding: "12px 16px",
        borderRadius: 10,
        background: "var(--surface-primary, #1e1e2e)",
        border: `1px solid ${isFirst || isLast ? "var(--accent-primary, #7c3aed)" : "var(--border-default, #333)"}`,
        minWidth: 180,
        maxWidth: 220,
        cursor: onNavigate ? "pointer" : "default",
        transition: "all 0.15s ease",
        boxShadow: isFirst || isLast
          ? "0 0 12px color-mix(in srgb, var(--accent-primary, #7c3aed) 20%, transparent)"
          : "0 1px 4px rgba(0,0,0,0.2)",
      }}
    >
      {/* Target handle (left) */}
      {!isFirst && (
        <Handle
          type="target"
          position={Position.Left}
          style={{
            background: "var(--border-default, #555)",
            width: 8,
            height: 8,
            border: "2px solid var(--surface-primary, #1e1e2e)",
          }}
        />
      )}

      {/* Step number + content type */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "var(--accent-primary, #7c3aed)",
            letterSpacing: "0.05em",
          }}
        >
          STEP {stepIndex + 1}
        </span>
        <span style={{ fontSize: 13 }} title={contentType}>
          {CONTENT_ICONS[contentType] || "📄"}
        </span>
      </div>

      {/* Title */}
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "var(--text-primary, #e0e0e0)",
          lineHeight: 1.3,
          marginBottom: 4,
        }}
      >
        {title}
      </div>

      {/* Description (truncated) */}
      <div
        style={{
          fontSize: 11,
          color: "var(--text-muted, #888)",
          lineHeight: 1.4,
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
        }}
      >
        {description}
      </div>

      {/* Sidebar link badge */}
      {hasSidebarHighlight && sidebarHref && (
        <div
          style={{
            marginTop: 6,
            fontSize: 10,
            color: "var(--accent-secondary, #0891b2)",
            background: "color-mix(in srgb, var(--accent-secondary, #0891b2) 10%, transparent)",
            padding: "2px 6px",
            borderRadius: 4,
            display: "inline-block",
          }}
        >
          → {sidebarHref}
        </div>
      )}

      {/* Progress bar at bottom */}
      <div
        style={{
          marginTop: 8,
          height: 2,
          borderRadius: 1,
          background: "var(--border-default, #333)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${progress}%`,
            background: "var(--accent-primary, #7c3aed)",
            borderRadius: 1,
            transition: "width 0.3s",
          }}
        />
      </div>

      {/* Source handle (right) */}
      {!isLast && (
        <Handle
          type="source"
          position={Position.Right}
          style={{
            background: "var(--accent-primary, #7c3aed)",
            width: 8,
            height: 8,
            border: "2px solid var(--surface-primary, #1e1e2e)",
          }}
        />
      )}
    </div>
  );
}

export const DemoFlowNode = memo(DemoFlowNodeComponent);
